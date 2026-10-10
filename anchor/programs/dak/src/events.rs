use anchor_lang::prelude::*;

#[event]
pub struct CardPosted {
    pub card: Pubkey,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub postage: u64,
    pub deliver_at: i64,
    pub express: bool,
}

#[event]
pub struct CardOpened {
    pub card: Pubkey,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub paid_to_reader: u64,
    pub burned: u64,
}

#[event]
pub struct CardReturned {
    pub card: Pubkey,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub refunded: u64,
}

#[event]
pub struct LetterboxVerified {
    pub owner: Pubkey,
    pub sgt_mint: Pubkey,
    pub member_number: u64,
}
