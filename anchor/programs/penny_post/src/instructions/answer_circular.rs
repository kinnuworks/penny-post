use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::PostError,
    events::CircularAnswered,
    sgt::require_held,
    state::{utc_day, Answer, Circular, Seal},
};

/// One phone answers the day's question. The answer's address comes from the
/// Genesis Token's mint, so a second answer from the same token cannot be
/// created, whichever wallet tries.
#[derive(Accounts)]
pub struct AnswerCircular<'info> {
    #[account(mut)]
    pub answerer: Signer<'info>,
    #[account(
        mut,
        seeds = [CIRCULAR_SEED, circular.day.to_le_bytes().as_ref()],
        bump = circular.bump
    )]
    pub circular: Box<Account<'info, Circular>>,
    #[account(seeds = [SEAL_SEED, seal.sgt_mint.as_ref()], bump = seal.bump)]
    pub seal: Box<Account<'info, Seal>>,
    /// CHECK: the answerer's Genesis Token account. It must be owned by
    /// Token-2022, and the handler requires that it holds the seal's token for
    /// the answerer right now.
    #[account(owner = TOKEN_2022_PROGRAM_ID @ PostError::GenesisTokenNotHeld)]
    pub sgt_token: UncheckedAccount<'info>,
    #[account(
        init,
        payer = answerer,
        space = 8 + Answer::INIT_SPACE,
        seeds = [ANSWER_SEED, circular.key().as_ref(), seal.sgt_mint.as_ref()],
        bump
    )]
    pub answer: Account<'info, Answer>,
    pub system_program: Program<'info, System>,
}

pub fn handle_answer_circular(ctx: Context<AnswerCircular>, choice: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let answerer = ctx.accounts.answerer.key();
    let sgt_mint = ctx.accounts.seal.sgt_mint;

    require!(
        utc_day(now) == i64::from(ctx.accounts.circular.day),
        PostError::CircularNotOpen
    );
    require_keys_eq!(ctx.accounts.seal.holder, answerer, PostError::SealNotYours);
    {
        let data = ctx.accounts.sgt_token.try_borrow_data()?;
        require_held(&data, &sgt_mint, &answerer)?;
    }

    let circular = &mut ctx.accounts.circular;
    require!(
        usize::from(choice) < circular.options.len(),
        PostError::BadChoice
    );
    let tally = &mut circular.tallies[usize::from(choice)];
    *tally = tally.checked_add(1).ok_or(PostError::Overflow)?;
    circular.answers = circular.answers.checked_add(1).ok_or(PostError::Overflow)?;

    let answer = &mut ctx.accounts.answer;
    answer.circular = ctx.accounts.circular.key();
    answer.sgt_mint = sgt_mint;
    answer.answerer = answerer;
    answer.choice = choice;
    answer.bump = ctx.bumps.answer;

    emit!(CircularAnswered {
        circular: ctx.accounts.circular.key(),
        sgt_mint,
        choice,
    });
    Ok(())
}
