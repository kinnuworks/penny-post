use anchor_lang::{prelude::*, system_program};
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{
    constants::*,
    error::PostError,
    events::CircularPosted,
    state::{utc_day, Circular, PostOffice},
    vault::{self, VaultAccounts},
};

/// Puts one question to every Seeker for one UTC day, with a pot for the
/// phones that answer. A day that has not begun can be taken over by a larger
/// pot, and the sponsor who is outbid gets their pot and rent back in the same
/// transaction.
#[derive(Accounts)]
#[instruction(day: u32)]
pub struct PostCircular<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,
    #[account(
        init_if_needed,
        payer = sponsor,
        space = 8 + Circular::INIT_SPACE,
        seeds = [CIRCULAR_SEED, day.to_le_bytes().as_ref()],
        bump
    )]
    pub circular: Box<Account<'info, Circular>>,
    #[account(
        init_if_needed,
        payer = sponsor,
        seeds = [CIRCULAR_VAULT_SEED, circular.key().as_ref()],
        bump,
        token::mint = postage_mint,
        token::authority = circular,
        token::token_program = token_program
    )]
    pub pot_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = sponsor_token.mint == post_office.postage_mint @ PostError::WrongTokenAccount,
        constraint = sponsor_token.owner == sponsor.key() @ PostError::WrongTokenAccount,
    )]
    pub sponsor_token: Box<Account<'info, TokenAccount>>,
    /// CHECK: the sponsor being outbid. The handler requires it to be the one
    /// recorded on the circular, and pays their rent deposit back to it.
    #[account(mut)]
    pub previous_sponsor: Option<UncheckedAccount<'info>>,
    #[account(
        mut,
        constraint = previous_sponsor_token.mint == post_office.postage_mint @ PostError::WrongTokenAccount,
    )]
    pub previous_sponsor_token: Option<Box<Account<'info, TokenAccount>>>,
    #[account(seeds = [POST_OFFICE_SEED], bump = post_office.bump, has_one = postage_mint)]
    pub post_office: Box<Account<'info, PostOffice>>,
    pub postage_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_post_circular(
    ctx: Context<PostCircular>,
    day: u32,
    question: String,
    options: Vec<String>,
    pot: u64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let today = utc_day(now);
    require!(i64::from(day) >= today, PostError::CircularDayPassed);
    check_question(&question, &options)?;

    let post_office = &ctx.accounts.post_office;
    let floor = post_office
        .floor_price
        .checked_mul(CIRCULAR_FLOOR_MULTIPLE)
        .ok_or(PostError::Overflow)?;
    require!(pot >= floor, PostError::CircularPotTooLow);

    let sponsor = ctx.accounts.sponsor.key();
    let decimals = ctx.accounts.postage_mint.decimals;
    let previous = ctx.accounts.circular.sponsor;

    // A fresh account has no sponsor yet. Anything else is a day already taken.
    if previous != Pubkey::default() {
        // Once a question is open, phones may have answered it. It stays.
        require!(i64::from(day) > today, PostError::CircularAlreadyOpen);
        let needed = u128::from(ctx.accounts.circular.pot)
            .checked_mul(OUTBID_BPS)
            .ok_or(PostError::Overflow)?
            / BPS_DENOMINATOR;
        require!(u128::from(pot) >= needed, PostError::CircularBidTooLow);

        let previous_sponsor = ctx
            .accounts
            .previous_sponsor
            .as_ref()
            .ok_or(PostError::MissingPreviousSponsor)?;
        let previous_token = ctx
            .accounts
            .previous_sponsor_token
            .as_ref()
            .ok_or(PostError::MissingPreviousSponsor)?;
        require_keys_eq!(
            previous_sponsor.key(),
            previous,
            PostError::MissingPreviousSponsor
        );
        require_keys_eq!(previous_token.owner, previous, PostError::WrongTokenAccount);

        // Their pot goes home, along with anything else that found its way in.
        let day_bytes = day.to_le_bytes();
        let bump = [ctx.accounts.circular.bump];
        let seeds: &[&[u8]] = &[CIRCULAR_SEED, day_bytes.as_ref(), bump.as_ref()];
        vault::pay_out(
            &VaultAccounts {
                token_program: ctx.accounts.token_program.to_account_info(),
                vault: ctx.accounts.pot_vault.to_account_info(),
                mint: ctx.accounts.postage_mint.to_account_info(),
                card: ctx.accounts.circular.to_account_info(),
            },
            previous_token.to_account_info(),
            ctx.accounts.pot_vault.amount,
            decimals,
            seeds,
        )?;

        // They paid the rent for these two accounts. The new sponsor pays it back.
        let rent = ctx
            .accounts
            .circular
            .to_account_info()
            .lamports()
            .checked_add(ctx.accounts.pot_vault.to_account_info().lamports())
            .ok_or(PostError::Overflow)?;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.sponsor.to_account_info(),
                    to: previous_sponsor.to_account_info(),
                },
            ),
            rent,
        )?;
    }

    let circular = &mut ctx.accounts.circular;
    circular.sponsor = sponsor;
    circular.day = day;
    circular.pot = pot;
    circular.burn_bps = post_office.burn_bps;
    circular.answers = 0;
    circular.collected = 0;
    circular.tallies = [0; 4];
    circular.question = question;
    circular.options = options;
    circular.bump = ctx.bumps.circular;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.sponsor_token.to_account_info(),
                mint: ctx.accounts.postage_mint.to_account_info(),
                to: ctx.accounts.pot_vault.to_account_info(),
                authority: ctx.accounts.sponsor.to_account_info(),
            },
        ),
        pot,
        decimals,
    )?;

    emit!(CircularPosted {
        circular: ctx.accounts.circular.key(),
        sponsor,
        day,
        pot,
    });
    Ok(())
}

/// A question, and two to four answers short enough to fit a card.
pub fn check_question(question: &str, options: &[String]) -> Result<()> {
    let fits = |text: &str, limit: usize| !text.trim().is_empty() && text.len() <= limit;
    require!(
        fits(question, MAX_QUESTION_LEN)
            && (MIN_OPTIONS..=MAX_OPTIONS).contains(&options.len())
            && options.iter().all(|option| fits(option, MAX_OPTION_LEN)),
        PostError::CircularBadQuestion
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(list: &[&str]) -> Vec<String> {
        list.iter().map(|option| option.to_string()).collect()
    }

    #[test]
    fn takes_a_question_with_two_to_four_answers() {
        assert!(check_question("Tea or coffee?", &options(&["Tea", "Coffee"])).is_ok());
        assert!(check_question("Which?", &options(&["A", "B", "C", "D"])).is_ok());
    }

    #[test]
    fn refuses_too_few_or_too_many_answers() {
        assert!(check_question("Tea?", &options(&["Tea"])).is_err());
        assert!(check_question("Which?", &options(&["A", "B", "C", "D", "E"])).is_err());
    }

    #[test]
    fn refuses_blank_or_overlong_text() {
        assert!(check_question("  ", &options(&["Tea", "Coffee"])).is_err());
        assert!(check_question("Tea or coffee?", &options(&["Tea", ""])).is_err());
        assert!(check_question(&"q".repeat(121), &options(&["Tea", "Coffee"])).is_err());
        assert!(check_question("Tea?", &options(&["Tea", &"c".repeat(29)])).is_err());
    }
}
