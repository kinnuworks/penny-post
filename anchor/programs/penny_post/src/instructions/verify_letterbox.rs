use anchor_lang::prelude::*;
use anchor_spl::{token_2022, token_interface::TokenAccount};

use crate::{
    constants::*,
    error::PostError,
    events::LetterboxVerified,
    sgt::read_genesis_token,
    state::{Letterbox, PostOffice, Seal},
};

/// Proves the signer's wallet holds a Seeker Genesis Token and ties that
/// token's seal to their letterbox. The free daily stamp is counted on the
/// seal, which is keyed by the token's mint, so one phone gets one stamp a day
/// however many wallets the token passes through.
#[derive(Accounts)]
pub struct VerifyLetterbox<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [LETTERBOX_SEED, owner.key().as_ref()],
        bump = letterbox.bump,
        has_one = owner
    )]
    pub letterbox: Account<'info, Letterbox>,
    #[account(seeds = [POST_OFFICE_SEED], bump = post_office.bump)]
    pub post_office: Account<'info, PostOffice>,
    /// CHECK: must be owned by Token-2022. The handler reads its mint authority
    /// and group membership and compares both with the post office's record.
    #[account(owner = token_2022::ID @ PostError::NotGenesisToken)]
    pub sgt_mint: UncheckedAccount<'info>,
    #[account(
        constraint = *sgt_token.to_account_info().owner == token_2022::ID @ PostError::GenesisTokenNotHeld,
        constraint = sgt_token.mint == sgt_mint.key() @ PostError::GenesisTokenNotHeld,
        constraint = sgt_token.owner == owner.key() @ PostError::GenesisTokenNotHeld,
        constraint = sgt_token.amount == 1 @ PostError::GenesisTokenNotHeld,
    )]
    pub sgt_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Seal::INIT_SPACE,
        seeds = [SEAL_SEED, sgt_mint.key().as_ref()],
        bump
    )]
    pub seal: Account<'info, Seal>,
    pub system_program: Program<'info, System>,
}

pub fn handle_verify_letterbox(ctx: Context<VerifyLetterbox>) -> Result<()> {
    let sgt_mint = ctx.accounts.sgt_mint.key();
    let post_office = &ctx.accounts.post_office;

    let token = {
        let data = ctx.accounts.sgt_mint.try_borrow_data()?;
        read_genesis_token(&data)?
    };
    require_keys_eq!(token.member_mint, sgt_mint, PostError::NotGenesisToken);
    require_keys_eq!(token.group, post_office.sgt_group, PostError::NotGenesisToken);
    require_keys_eq!(
        token.mint_authority,
        post_office.sgt_mint_authority,
        PostError::NotGenesisToken
    );

    // A seal that already exists keeps its `last_free_day`. Only the holder changes.
    let seal = &mut ctx.accounts.seal;
    seal.sgt_mint = sgt_mint;
    seal.holder = ctx.accounts.owner.key();
    seal.member_number = token.member_number;
    seal.bump = ctx.bumps.seal;

    ctx.accounts.letterbox.seal_mint = sgt_mint;

    emit!(LetterboxVerified {
        owner: ctx.accounts.owner.key(),
        sgt_mint,
        member_number: token.member_number,
    });
    Ok(())
}
