use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::PostError,
    state::{Circular, PostOffice},
    vault::{self, VaultAccounts},
};

/// Clears away a circular whose day is over. Anyone can do it, and the rent
/// can only go to the sponsor.
///
/// If nobody answered, the pot goes back to the sponsor. If phones did answer,
/// it can be closed once they have all collected, or a month after the day
/// closed. Shares nobody came for are burned: postage that was answered does
/// not go back to its sender.
#[derive(Accounts)]
pub struct CloseCircular<'info> {
    pub caller: Signer<'info>,
    /// CHECK: the circular's sponsor, matched by `has_one`. Receives the rent.
    #[account(mut)]
    pub sponsor: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [CIRCULAR_SEED, circular.day.to_le_bytes().as_ref()],
        bump = circular.bump,
        has_one = sponsor,
        close = sponsor
    )]
    pub circular: Box<Account<'info, Circular>>,
    #[account(
        mut,
        seeds = [CIRCULAR_VAULT_SEED, circular.key().as_ref()],
        bump,
        token::mint = postage_mint,
        token::authority = circular
    )]
    pub pot_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = sponsor_token.mint == post_office.postage_mint @ PostError::WrongTokenAccount,
        constraint = sponsor_token.owner == circular.sponsor @ PostError::WrongTokenAccount,
    )]
    pub sponsor_token: Option<Box<Account<'info, TokenAccount>>>,
    #[account(seeds = [POST_OFFICE_SEED], bump = post_office.bump, has_one = postage_mint)]
    pub post_office: Box<Account<'info, PostOffice>>,
    #[account(mut)]
    pub postage_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_close_circular(ctx: Context<CloseCircular>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let circular = &ctx.accounts.circular;
    let closes_at = circular.closes_at().ok_or(PostError::Overflow)?;
    require!(now >= closes_at, PostError::CircularStillOpen);

    let held = ctx.accounts.pot_vault.amount;
    let day_bytes = circular.day.to_le_bytes();
    let bump = [circular.bump];
    let seeds: &[&[u8]] = &[CIRCULAR_SEED, day_bytes.as_ref(), bump.as_ref()];
    let vault_accounts = VaultAccounts {
        token_program: ctx.accounts.token_program.to_account_info(),
        vault: ctx.accounts.pot_vault.to_account_info(),
        mint: ctx.accounts.postage_mint.to_account_info(),
        card: ctx.accounts.circular.to_account_info(),
    };

    if circular.answers == 0 {
        if held > 0 {
            let sponsor_token = ctx
                .accounts
                .sponsor_token
                .as_ref()
                .ok_or(PostError::MissingSenderToken)?;
            vault::pay_out(
                &vault_accounts,
                sponsor_token.to_account_info(),
                held,
                ctx.accounts.postage_mint.decimals,
                seeds,
            )?;
        }
    } else {
        let give_up_at = closes_at
            .checked_add(UNCOLLECTED_AFTER_SECONDS)
            .ok_or(PostError::Overflow)?;
        require!(
            circular.collected == circular.answers || now >= give_up_at,
            PostError::CircularNotFinished
        );
        vault::burn(&vault_accounts, held, seeds)?;
    }

    vault::close(
        &vault_accounts,
        ctx.accounts.sponsor.to_account_info(),
        seeds,
    )
}
