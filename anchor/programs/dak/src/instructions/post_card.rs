use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, TransferChecked};

use crate::{
    constants::*,
    error::DakError,
    events::CardPosted,
    state::{local_day, next_delivery, Card, Letterbox, PostOffice, Seal},
};

#[derive(Accounts)]
#[instruction(card_id: u64, postage: u64, content_hash: [u8; 32], stamp: u16, express: bool)]
pub struct PostCard<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: any wallet can be written to. The handler only requires that it
    /// is not the sender.
    pub recipient: UncheckedAccount<'info>,
    #[account(
        init,
        payer = sender,
        space = 8 + Card::INIT_SPACE,
        seeds = [CARD_SEED, sender.key().as_ref(), card_id.to_le_bytes().as_ref()],
        bump
    )]
    pub card: Box<Account<'info, Card>>,
    #[account(
        init,
        payer = sender,
        seeds = [VAULT_SEED, card.key().as_ref()],
        bump,
        token::mint = postage_mint,
        token::authority = card,
        token::token_program = token_program
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: the address is pinned by the seeds, so a sender cannot swap in
    /// another letterbox or leave this one out to dodge the reader's price. The
    /// reader may not have opened a letterbox yet, so the handler loads it by
    /// hand and treats a missing one as "no letterbox".
    #[account(mut, seeds = [LETTERBOX_SEED, recipient.key().as_ref()], bump)]
    pub recipient_letterbox: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = sender_token.mint == post_office.postage_mint @ DakError::WrongTokenAccount,
        constraint = sender_token.owner == sender.key() @ DakError::WrongTokenAccount,
    )]
    pub sender_token: Option<Box<Account<'info, TokenAccount>>>,
    #[account(mut, seeds = [SEAL_SEED, sender_seal.sgt_mint.as_ref()], bump = sender_seal.bump)]
    pub sender_seal: Option<Box<Account<'info, Seal>>>,
    #[account(seeds = [POST_OFFICE_SEED], bump = post_office.bump, has_one = postage_mint)]
    pub post_office: Box<Account<'info, PostOffice>>,
    #[account(mut)]
    pub postage_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_post_card(
    ctx: Context<PostCard>,
    card_id: u64,
    postage: u64,
    content_hash: [u8; 32],
    stamp: u16,
    express: bool,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let sender = ctx.accounts.sender.key();
    let recipient = ctx.accounts.recipient.key();
    require_keys_neq!(sender, recipient, DakError::SelfAddressed);

    let post_office = &ctx.accounts.post_office;
    let mut letterbox = load_letterbox(&ctx.accounts.recipient_letterbox)?;
    let utc_offset_minutes = letterbox.as_ref().map_or(0, |l| l.utc_offset_minutes);

    let deliver_at = if express {
        now
    } else {
        next_delivery(now, utc_offset_minutes).ok_or(DakError::Overflow)?
    };
    let expires_at = deliver_at
        .checked_add(SHELF_LIFE_SECONDS)
        .ok_or(DakError::Overflow)?;

    if postage == 0 {
        // A free card spends the sender's one stamp for the UTC day.
        let seal = ctx.accounts.sender_seal.as_mut().ok_or(DakError::NoSeal)?;
        require_keys_eq!(seal.holder, sender, DakError::SealNotYours);
        let today = now.div_euclid(SECONDS_PER_DAY);
        require!(seal.last_free_day < today, DakError::StampAlreadyUsed);
        seal.last_free_day = today;
    } else {
        let price = letterbox
            .as_ref()
            .map_or(post_office.floor_price, |l| l.price.max(post_office.floor_price));
        require!(postage >= price, DakError::PostageTooLow);

        if let Some(letterbox) = letterbox.as_mut() {
            let day = local_day(deliver_at, utc_offset_minutes).ok_or(DakError::Overflow)?;
            if letterbox.paid_day != day {
                letterbox.paid_day = day;
                letterbox.paid_count = 0;
            }
            require!(
                letterbox.paid_count < MAX_PAID_CARDS_PER_DAY,
                DakError::LetterboxFull
            );
            letterbox.paid_count += 1;
        }
    }

    if let Some(letterbox) = letterbox.as_mut() {
        letterbox.received = letterbox.received.checked_add(1).ok_or(DakError::Overflow)?;
        store_letterbox(&ctx.accounts.recipient_letterbox, letterbox)?;
    }

    let card = &mut ctx.accounts.card;
    card.sender = sender;
    card.recipient = recipient;
    card.postage = postage;
    card.card_id = card_id;
    card.content_hash = content_hash;
    card.posted_at = now;
    card.deliver_at = deliver_at;
    card.expires_at = expires_at;
    card.stamp = stamp;
    card.express = express;
    card.bump = ctx.bumps.card;

    let express_fee = if express { post_office.express_fee } else { 0 };
    if postage > 0 || express_fee > 0 {
        let sender_token = ctx
            .accounts
            .sender_token
            .as_ref()
            .ok_or(DakError::MissingSenderToken)?;
        let token_program = ctx.accounts.token_program.key();

        if postage > 0 {
            token::transfer_checked(
                CpiContext::new(
                    token_program,
                    TransferChecked {
                        from: sender_token.to_account_info(),
                        mint: ctx.accounts.postage_mint.to_account_info(),
                        to: ctx.accounts.vault.to_account_info(),
                        authority: ctx.accounts.sender.to_account_info(),
                    },
                ),
                postage,
                ctx.accounts.postage_mint.decimals,
            )?;
        }
        if express_fee > 0 {
            token::burn(
                CpiContext::new(
                    token_program,
                    Burn {
                        mint: ctx.accounts.postage_mint.to_account_info(),
                        from: sender_token.to_account_info(),
                        authority: ctx.accounts.sender.to_account_info(),
                    },
                ),
                express_fee,
            )?;
        }
    }

    emit!(CardPosted {
        card: ctx.accounts.card.key(),
        sender,
        recipient,
        postage,
        deliver_at,
        express,
    });
    Ok(())
}

/// Returns the letterbox at this address, or `None` if nobody has opened one.
/// An opened letterbox is owned by this program and carries its discriminator.
fn load_letterbox(info: &UncheckedAccount) -> Result<Option<Letterbox>> {
    if info.owner != &crate::ID {
        return Ok(None);
    }
    let data = info.try_borrow_data()?;
    let mut bytes: &[u8] = &data;
    let letterbox = Letterbox::try_deserialize(&mut bytes).map_err(|_| DakError::BadLetterbox)?;
    Ok(Some(letterbox))
}

fn store_letterbox(info: &UncheckedAccount, letterbox: &Letterbox) -> Result<()> {
    let mut data = info.try_borrow_mut_data()?;
    let mut bytes: &mut [u8] = &mut data;
    letterbox.try_serialize(&mut bytes)
}
