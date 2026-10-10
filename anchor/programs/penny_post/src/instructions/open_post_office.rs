use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::{constants::*, error::PostError, program::PennyPost, state::PostOffice};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Terms {
    pub floor_price: u64,
    pub express_fee: u64,
    pub burn_bps: u16,
}

impl Terms {
    pub fn check(&self) -> Result<()> {
        require!(self.burn_bps <= MAX_BURN_BPS, PostError::BurnShareTooHigh);
        Ok(())
    }
}

/// Runs once. Only the program's upgrade authority can call it, so nobody can
/// get in first and point the post office at their own token.
#[derive(Accounts)]
pub struct OpenPostOffice<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + PostOffice::INIT_SPACE,
        seeds = [POST_OFFICE_SEED],
        bump
    )]
    pub post_office: Account<'info, PostOffice>,
    pub postage_mint: Account<'info, Mint>,
    #[account(
        constraint = program.programdata_address()? == Some(program_data.key()) @ PostError::NotUpgradeAuthority
    )]
    pub program: Program<'info, PennyPost>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(admin.key()) @ PostError::NotUpgradeAuthority
    )]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

pub fn handle_open_post_office(
    ctx: Context<OpenPostOffice>,
    terms: Terms,
    sgt_group: Pubkey,
    sgt_mint_authority: Pubkey,
) -> Result<()> {
    terms.check()?;

    let post_office = &mut ctx.accounts.post_office;
    post_office.admin = ctx.accounts.admin.key();
    post_office.postage_mint = ctx.accounts.postage_mint.key();
    post_office.sgt_group = sgt_group;
    post_office.sgt_mint_authority = sgt_mint_authority;
    post_office.floor_price = terms.floor_price;
    post_office.express_fee = terms.express_fee;
    post_office.burn_bps = terms.burn_bps;
    post_office.bump = ctx.bumps.post_office;
    Ok(())
}
