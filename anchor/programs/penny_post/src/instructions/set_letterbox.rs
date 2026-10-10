use anchor_lang::prelude::*;

use crate::{
    constants::*,
    instructions::check_letterbox_settings,
    state::{Letterbox, PostOffice},
};

#[derive(Accounts)]
pub struct SetLetterbox<'info> {
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
}

pub fn handle_set_letterbox(
    ctx: Context<SetLetterbox>,
    reading_key: [u8; 32],
    price: u64,
    utc_offset_minutes: i16,
) -> Result<()> {
    check_letterbox_settings(&ctx.accounts.post_office, price, utc_offset_minutes)?;

    let letterbox = &mut ctx.accounts.letterbox;
    letterbox.reading_key = reading_key;
    letterbox.price = price;
    letterbox.utc_offset_minutes = utc_offset_minutes;
    Ok(())
}
