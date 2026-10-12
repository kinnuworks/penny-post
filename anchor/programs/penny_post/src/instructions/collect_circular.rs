use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::PostError,
    events::CircularCollected,
    instructions::open_card::burn_share,
    state::{Answer, Circular, PostOffice},
    vault::{self, VaultAccounts},
};

/// Once the day has closed, a phone that answered collects its equal share of
/// the pot, less the burn. The answer account is closed and its rent returned.
#[derive(Accounts)]
pub struct CollectCircular<'info> {
    #[account(mut)]
    pub answerer: Signer<'info>,
    #[account(
        mut,
        seeds = [CIRCULAR_SEED, circular.day.to_le_bytes().as_ref()],
        bump = circular.bump
    )]
    pub circular: Box<Account<'info, Circular>>,
    #[account(
        mut,
        seeds = [ANSWER_SEED, circular.key().as_ref(), answer.sgt_mint.as_ref()],
        bump = answer.bump,
        has_one = answerer,
        has_one = circular,
        close = answerer
    )]
    pub answer: Account<'info, Answer>,
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
        constraint = answerer_token.mint == post_office.postage_mint @ PostError::WrongTokenAccount,
        constraint = answerer_token.owner == answerer.key() @ PostError::WrongTokenAccount,
    )]
    pub answerer_token: Box<Account<'info, TokenAccount>>,
    #[account(seeds = [POST_OFFICE_SEED], bump = post_office.bump, has_one = postage_mint)]
    pub post_office: Box<Account<'info, PostOffice>>,
    #[account(mut)]
    pub postage_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_collect_circular(ctx: Context<CollectCircular>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let circular = &ctx.accounts.circular;
    let closes_at = circular.closes_at().ok_or(PostError::Overflow)?;
    require!(now >= closes_at, PostError::CircularStillOpen);

    // Never more than the vault holds, whatever the arithmetic says.
    let held = ctx.accounts.pot_vault.amount;
    let share = circular.share().min(held);
    let burned = burn_share(share, circular.burn_bps)?;
    let paid = share.checked_sub(burned).ok_or(PostError::Overflow)?;
    let is_last = circular.collected.checked_add(1) == Some(circular.answers);
    // The last phone to collect also sweeps out what rounding left behind.
    let swept = if is_last {
        held.checked_sub(share).ok_or(PostError::Overflow)?
    } else {
        0
    };

    let day_bytes = circular.day.to_le_bytes();
    let bump = [circular.bump];
    let seeds: &[&[u8]] = &[CIRCULAR_SEED, day_bytes.as_ref(), bump.as_ref()];
    let vault_accounts = VaultAccounts {
        token_program: ctx.accounts.token_program.to_account_info(),
        vault: ctx.accounts.pot_vault.to_account_info(),
        mint: ctx.accounts.postage_mint.to_account_info(),
        card: ctx.accounts.circular.to_account_info(),
    };
    vault::pay_out(
        &vault_accounts,
        ctx.accounts.answerer_token.to_account_info(),
        paid,
        ctx.accounts.postage_mint.decimals,
        seeds,
    )?;
    vault::burn(
        &vault_accounts,
        burned.checked_add(swept).ok_or(PostError::Overflow)?,
        seeds,
    )?;

    let circular = &mut ctx.accounts.circular;
    circular.collected = circular
        .collected
        .checked_add(1)
        .ok_or(PostError::Overflow)?;

    emit!(CircularCollected {
        circular: circular.key(),
        answerer: ctx.accounts.answerer.key(),
        paid,
        burned,
    });
    Ok(())
}
