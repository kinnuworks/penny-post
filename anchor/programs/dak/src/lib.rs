//! Dak: a letterbox for every wallet.
//!
//! A card is posted to a wallet with postage held in the card's own vault. The
//! post comes once a day, at 08:00 in the reader's time zone. When the reader
//! signs for a card the postage is theirs, less a share that is burned. A card
//! nobody opens goes back to its sender after a week.
//!
//! A wallet that holds a Seeker Genesis Token gets one free stamp a day.

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod sgt;
pub mod state;
pub mod vault;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("BneHHhN7nSXgjZytQWLsi1TRY7xMz83FxpkKgoCb1n2d");

#[program]
pub mod dak {
    use super::*;

    pub fn open_post_office(
        ctx: Context<OpenPostOffice>,
        terms: Terms,
        sgt_group: Pubkey,
        sgt_mint_authority: Pubkey,
    ) -> Result<()> {
        crate::instructions::open_post_office::handle_open_post_office(
            ctx,
            terms,
            sgt_group,
            sgt_mint_authority,
        )
    }

    pub fn set_terms(ctx: Context<SetTerms>, terms: Terms) -> Result<()> {
        crate::instructions::set_terms::handle_set_terms(ctx, terms)
    }

    pub fn open_letterbox(
        ctx: Context<OpenLetterbox>,
        reading_key: [u8; 32],
        price: u64,
        utc_offset_minutes: i16,
    ) -> Result<()> {
        crate::instructions::open_letterbox::handle_open_letterbox(
            ctx,
            reading_key,
            price,
            utc_offset_minutes,
        )
    }

    pub fn set_letterbox(
        ctx: Context<SetLetterbox>,
        reading_key: [u8; 32],
        price: u64,
        utc_offset_minutes: i16,
    ) -> Result<()> {
        crate::instructions::set_letterbox::handle_set_letterbox(
            ctx,
            reading_key,
            price,
            utc_offset_minutes,
        )
    }

    pub fn verify_letterbox(ctx: Context<VerifyLetterbox>) -> Result<()> {
        crate::instructions::verify_letterbox::handle_verify_letterbox(ctx)
    }

    pub fn post_card(
        ctx: Context<PostCard>,
        card_id: u64,
        postage: u64,
        content_hash: [u8; 32],
        stamp: u16,
        express: bool,
    ) -> Result<()> {
        crate::instructions::post_card::handle_post_card(
            ctx,
            card_id,
            postage,
            content_hash,
            stamp,
            express,
        )
    }

    pub fn open_card(ctx: Context<OpenCard>) -> Result<()> {
        crate::instructions::open_card::handle_open_card(ctx)
    }

    pub fn return_card(ctx: Context<ReturnCard>) -> Result<()> {
        crate::instructions::return_card::handle_return_card(ctx)
    }
}
