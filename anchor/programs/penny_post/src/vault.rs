//! Token moves out of a card's vault. Every card has its own vault, and the
//! card account is the vault's authority, so there is no shared pool to drain.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, CloseAccount, TransferChecked};

pub struct VaultAccounts<'info> {
    pub token_program: AccountInfo<'info>,
    pub vault: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
    /// The card account, which signs with its own seeds.
    pub card: AccountInfo<'info>,
}

pub fn pay_out<'info>(
    accounts: &VaultAccounts<'info>,
    to: AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    card_seeds: &[&[u8]],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token::transfer_checked(
        CpiContext::new_with_signer(
            accounts.token_program.key(),
            TransferChecked {
                from: accounts.vault.clone(),
                mint: accounts.mint.clone(),
                to,
                authority: accounts.card.clone(),
            },
            &[card_seeds],
        ),
        amount,
        decimals,
    )
}

pub fn burn<'info>(
    accounts: &VaultAccounts<'info>,
    amount: u64,
    card_seeds: &[&[u8]],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token::burn(
        CpiContext::new_with_signer(
            accounts.token_program.key(),
            Burn {
                mint: accounts.mint.clone(),
                from: accounts.vault.clone(),
                authority: accounts.card.clone(),
            },
            &[card_seeds],
        ),
        amount,
    )
}

/// Closes the emptied vault and sends its rent to `rent_to`.
pub fn close<'info>(
    accounts: &VaultAccounts<'info>,
    rent_to: AccountInfo<'info>,
    card_seeds: &[&[u8]],
) -> Result<()> {
    token::close_account(CpiContext::new_with_signer(
        accounts.token_program.key(),
        CloseAccount {
            account: accounts.vault.clone(),
            destination: rent_to,
            authority: accounts.card.clone(),
        },
        &[card_seeds],
    ))
}
