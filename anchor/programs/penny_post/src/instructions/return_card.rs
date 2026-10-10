use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::PostError,
    events::CardReturned,
    state::{Card, PostOffice},
    vault::{self, VaultAccounts},
};

/// Sends an unopened card back. Anyone can do this once the card has expired,
/// and the reader can do it at any time. The postage and the rent can only go
/// to the sender, whoever calls.
#[derive(Accounts)]
pub struct ReturnCard<'info> {
    pub caller: Signer<'info>,
    /// CHECK: the card's sender, matched by `has_one`. Receives the rent.
    #[account(mut)]
    pub sender: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [CARD_SEED, sender.key().as_ref(), card.card_id.to_le_bytes().as_ref()],
        bump = card.bump,
        has_one = sender,
        close = sender
    )]
    pub card: Box<Account<'info, Card>>,
    #[account(
        mut,
        seeds = [VAULT_SEED, card.key().as_ref()],
        bump,
        token::mint = postage_mint,
        token::authority = card
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = sender_token.mint == post_office.postage_mint @ PostError::WrongTokenAccount,
        constraint = sender_token.owner == card.sender @ PostError::WrongTokenAccount,
    )]
    pub sender_token: Option<Box<Account<'info, TokenAccount>>>,
    #[account(seeds = [POST_OFFICE_SEED], bump = post_office.bump, has_one = postage_mint)]
    pub post_office: Box<Account<'info, PostOffice>>,
    pub postage_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_return_card(ctx: Context<ReturnCard>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let card = &ctx.accounts.card;
    let caller_is_reader = ctx.accounts.caller.key() == card.recipient;
    require!(
        now >= card.expires_at || caller_is_reader,
        PostError::NotExpiredYet
    );

    let refunded = ctx.accounts.vault.amount;
    let sender = card.sender;
    let recipient = card.recipient;
    let card_id = card.card_id.to_le_bytes();
    let bump = [card.bump];
    let card_seeds: &[&[u8]] = &[CARD_SEED, sender.as_ref(), card_id.as_ref(), bump.as_ref()];

    let vault_accounts = VaultAccounts {
        token_program: ctx.accounts.token_program.to_account_info(),
        vault: ctx.accounts.vault.to_account_info(),
        mint: ctx.accounts.postage_mint.to_account_info(),
        card: ctx.accounts.card.to_account_info(),
    };

    if refunded > 0 {
        let sender_token = ctx
            .accounts
            .sender_token
            .as_ref()
            .ok_or(PostError::MissingSenderToken)?;
        vault::pay_out(
            &vault_accounts,
            sender_token.to_account_info(),
            refunded,
            ctx.accounts.postage_mint.decimals,
            card_seeds,
        )?;
    }
    vault::close(
        &vault_accounts,
        ctx.accounts.sender.to_account_info(),
        card_seeds,
    )?;

    emit!(CardReturned {
        card: ctx.accounts.card.key(),
        sender,
        recipient,
        refunded,
    });
    Ok(())
}
