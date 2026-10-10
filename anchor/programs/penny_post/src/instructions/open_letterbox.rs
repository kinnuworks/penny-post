use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::PostError,
    state::{Letterbox, PostOffice},
};

#[derive(Accounts)]
pub struct OpenLetterbox<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Letterbox::INIT_SPACE,
        seeds = [LETTERBOX_SEED, owner.key().as_ref()],
        bump
    )]
    pub letterbox: Account<'info, Letterbox>,
    #[account(seeds = [POST_OFFICE_SEED], bump = post_office.bump)]
    pub post_office: Account<'info, PostOffice>,
    pub system_program: Program<'info, System>,
}

pub fn handle_open_letterbox(
    ctx: Context<OpenLetterbox>,
    reading_key: [u8; 32],
    price: u64,
    utc_offset_minutes: i16,
) -> Result<()> {
    check_letterbox_settings(&ctx.accounts.post_office, price, utc_offset_minutes)?;

    let letterbox = &mut ctx.accounts.letterbox;
    letterbox.owner = ctx.accounts.owner.key();
    letterbox.reading_key = reading_key;
    letterbox.price = price;
    letterbox.earned = 0;
    letterbox.paid_day = 0;
    letterbox.seal_mint = Pubkey::default();
    letterbox.received = 0;
    letterbox.opened = 0;
    letterbox.utc_offset_minutes = utc_offset_minutes;
    letterbox.paid_count = 0;
    letterbox.bump = ctx.bumps.letterbox;
    Ok(())
}

pub fn check_letterbox_settings(
    post_office: &PostOffice,
    price: u64,
    utc_offset_minutes: i16,
) -> Result<()> {
    require!(price >= post_office.floor_price, PostError::PriceBelowFloor);
    require!(
        (MIN_UTC_OFFSET_MINUTES..=MAX_UTC_OFFSET_MINUTES).contains(&utc_offset_minutes),
        PostError::BadUtcOffset
    );
    Ok(())
}
