use anchor_lang::prelude::*;

#[constant]
pub const POST_OFFICE_SEED: &[u8] = b"post_office";
#[constant]
pub const LETTERBOX_SEED: &[u8] = b"letterbox";
#[constant]
pub const SEAL_SEED: &[u8] = b"seal";
#[constant]
pub const CARD_SEED: &[u8] = b"card";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
#[constant]
pub const CIRCULAR_SEED: &[u8] = b"circular";
#[constant]
pub const CIRCULAR_VAULT_SEED: &[u8] = b"circular_vault";
#[constant]
pub const ANSWER_SEED: &[u8] = b"answer";

pub const SECONDS_PER_DAY: i64 = 86_400;
pub const SECONDS_PER_MINUTE: i64 = 60;

/// The post comes at 08:00 in the reader's own time zone.
pub const DELIVERY_SECOND_OF_DAY: i64 = 8 * 3_600;

/// An unopened card goes back to its sender after a week on the doormat.
pub const SHELF_LIFE_SECONDS: i64 = 7 * SECONDS_PER_DAY;

/// A letterbox takes at most this many paid cards per delivery day.
pub const MAX_PAID_CARDS_PER_DAY: u8 = 3;

/// The post office can never burn more than a fifth of a card's postage.
pub const MAX_BURN_BPS: u16 = 2_000;
pub const BPS_DENOMINATOR: u128 = 10_000;

/// UTC-12:00 to UTC+14:00.
pub const MIN_UTC_OFFSET_MINUTES: i16 = -720;
pub const MAX_UTC_OFFSET_MINUTES: i16 = 840;

/// The Token-2022 program, which every Seeker Genesis Token lives under.
pub const TOKEN_2022_PROGRAM_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/// A circular is one question put to every Seeker for one UTC day. Its sponsor
/// puts up at least this many times the floor price, to be shared among the
/// phones that answer.
pub const CIRCULAR_FLOOR_MULTIPLE: u64 = 20;
/// A day not yet begun can be taken over by a pot at least a tenth larger.
pub const OUTBID_BPS: u128 = 11_000;
pub const MAX_QUESTION_LEN: usize = 120;
pub const MAX_OPTION_LEN: usize = 28;
pub const MIN_OPTIONS: usize = 2;
pub const MAX_OPTIONS: usize = 4;
/// Shares nobody has collected a month after the day closed are burned.
pub const UNCOLLECTED_AFTER_SECONDS: i64 = 30 * SECONDS_PER_DAY;
