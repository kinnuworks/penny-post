use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::DakError,
    events::CardOpened,
    state::{Card, Letterbox, PostOffice},
    vault::{self, VaultAccounts},
};

/// The reader signs for a card. The postage leaves the vault for the reader,
/// the post office's share is burned, and the card and vault are closed with
/// their rent returned to the sender.
#[derive(Accounts)]
pub struct OpenCard<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,
    /// CHECK: the card's sender, matched by `has_one`. Receives the rent.
    #[account(mut)]
    pub sender: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [CARD_SEED, sender.key().as_ref(), card.card_id.to_le_bytes().as_ref()],
        bump = card.bump,
        has_one = sender,
        has_one = recipient,
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
        constraint = recipient_token.mint == post_office.postage_mint @ DakError::WrongTokenAccount,
        constraint = recipient_token.owner == recipient.key() @ DakError::WrongTokenAccount,
    )]
    pub recipient_token: Option<Box<Account<'info, TokenAccount>>>,
    #[account(
        mut,
        seeds = [LETTERBOX_SEED, recipient.key().as_ref()],
        bump = recipient_letterbox.bump
    )]
    pub recipient_letterbox: Option<Box<Account<'info, Letterbox>>>,
    #[account(seeds = [POST_OFFICE_SEED], bump = post_office.bump, has_one = postage_mint)]
    pub post_office: Box<Account<'info, PostOffice>>,
    #[account(mut)]
    pub postage_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_open_card(ctx: Context<OpenCard>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let card = &ctx.accounts.card;
    require!(now >= card.deliver_at, DakError::NotDeliveredYet);

    // The vault can hold more than the postage if someone sent tokens straight
    // to it. Empty it fully, or the close below would fail and lock the card.
    let held = ctx.accounts.vault.amount;
    let burned = burn_share(card.postage, ctx.accounts.post_office.burn_bps)?.min(held);
    let paid_to_reader = held.checked_sub(burned).ok_or(DakError::Overflow)?;

    let sender = card.sender;
    let card_id = card.card_id.to_le_bytes();
    let bump = [card.bump];
    let card_seeds: &[&[u8]] = &[CARD_SEED, sender.as_ref(), card_id.as_ref(), bump.as_ref()];

    let vault_accounts = VaultAccounts {
        token_program: ctx.accounts.token_program.to_account_info(),
        vault: ctx.accounts.vault.to_account_info(),
        mint: ctx.accounts.postage_mint.to_account_info(),
        card: ctx.accounts.card.to_account_info(),
    };

    if paid_to_reader > 0 {
        let recipient_token = ctx
            .accounts
            .recipient_token
            .as_ref()
            .ok_or(DakError::MissingReaderToken)?;
        vault::pay_out(
            &vault_accounts,
            recipient_token.to_account_info(),
            paid_to_reader,
            ctx.accounts.postage_mint.decimals,
            card_seeds,
        )?;
    }
    vault::burn(&vault_accounts, burned, card_seeds)?;
    vault::close(&vault_accounts, ctx.accounts.sender.to_account_info(), card_seeds)?;

    if let Some(letterbox) = ctx.accounts.recipient_letterbox.as_mut() {
        letterbox.opened = letterbox.opened.checked_add(1).ok_or(DakError::Overflow)?;
        letterbox.earned = letterbox
            .earned
            .checked_add(paid_to_reader)
            .ok_or(DakError::Overflow)?;
    }

    emit!(CardOpened {
        card: ctx.accounts.card.key(),
        sender,
        recipient: ctx.accounts.recipient.key(),
        paid_to_reader,
        burned,
    });
    Ok(())
}

/// The post office's share of a card's postage, rounded down.
pub fn burn_share(postage: u64, burn_bps: u16) -> Result<u64> {
    let share = u128::from(postage)
        .checked_mul(u128::from(burn_bps))
        .ok_or(DakError::Overflow)?
        / BPS_DENOMINATOR;
    u64::try_from(share).map_err(|_| DakError::Overflow.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn burns_a_tenth_at_one_thousand_bps() {
        assert_eq!(burn_share(10_000_000, 1_000).unwrap(), 1_000_000);
    }

    #[test]
    fn rounds_down_in_the_readers_favour() {
        assert_eq!(burn_share(19, 1_000).unwrap(), 1);
        assert_eq!(burn_share(9, 1_000).unwrap(), 0);
    }

    #[test]
    fn handles_the_largest_postage() {
        assert_eq!(burn_share(u64::MAX, MAX_BURN_BPS).unwrap(), u64::MAX / 5);
    }

    #[test]
    fn burns_nothing_at_zero_bps() {
        assert_eq!(burn_share(u64::MAX, 0).unwrap(), 0);
    }
}
