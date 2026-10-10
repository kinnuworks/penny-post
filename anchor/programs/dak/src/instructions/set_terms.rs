use anchor_lang::prelude::*;

use crate::{constants::*, instructions::Terms, state::PostOffice};

/// The admin can change prices and the burn share. The postage token and the
/// Genesis Token group are fixed for good when the post office opens.
#[derive(Accounts)]
pub struct SetTerms<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [POST_OFFICE_SEED], bump = post_office.bump, has_one = admin)]
    pub post_office: Account<'info, PostOffice>,
}

pub fn handle_set_terms(ctx: Context<SetTerms>, terms: Terms) -> Result<()> {
    terms.check()?;

    let post_office = &mut ctx.accounts.post_office;
    post_office.floor_price = terms.floor_price;
    post_office.express_fee = terms.express_fee;
    post_office.burn_bps = terms.burn_bps;
    Ok(())
}
