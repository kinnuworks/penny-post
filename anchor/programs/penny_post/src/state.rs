use anchor_lang::prelude::*;

/// The one account that holds the post office's terms. Opened once by the
/// program's upgrade authority.
#[account]
#[derive(InitSpace)]
pub struct PostOffice {
    pub admin: Pubkey,
    /// The token postage is paid in. SKR on mainnet.
    pub postage_mint: Pubkey,
    /// Token-2022 group every Seeker Genesis Token is a member of.
    pub sgt_group: Pubkey,
    /// Mint authority shared by every Seeker Genesis Token.
    pub sgt_mint_authority: Pubkey,
    /// Lowest postage a paid card can carry, in base units.
    pub floor_price: u64,
    /// Burned when a card is sent express, in base units.
    pub express_fee: u64,
    /// Share of postage burned when a card is opened.
    pub burn_bps: u16,
    pub bump: u8,
}

/// A reader's letterbox. One per wallet.
#[account]
#[derive(InitSpace)]
pub struct Letterbox {
    pub owner: Pubkey,
    /// X25519 public key senders seal letters to.
    pub reading_key: [u8; 32],
    /// What a stranger pays to reach this reader, in base units.
    pub price: u64,
    /// Postage this reader has been paid, in base units.
    pub earned: u64,
    /// Local delivery day the paid counter below belongs to.
    pub paid_day: i64,
    /// Genesis Token mint behind this letterbox, or the default key if unverified.
    pub seal_mint: Pubkey,
    pub received: u32,
    pub opened: u32,
    pub utc_offset_minutes: i16,
    pub paid_count: u8,
    pub bump: u8,
}

impl Letterbox {
    /// Reads the letterbox at an address that was pinned by its seeds, or
    /// returns `None` if nobody has opened one there. An opened letterbox is
    /// owned by this program and carries its discriminator.
    pub fn load_if_open(info: &AccountInfo) -> Result<Option<Letterbox>> {
        if info.owner != &crate::ID {
            return Ok(None);
        }
        let data = info.try_borrow_data()?;
        let mut bytes: &[u8] = &data;
        let letterbox = Letterbox::try_deserialize(&mut bytes)
            .map_err(|_| crate::error::PostError::BadLetterbox)?;
        Ok(Some(letterbox))
    }

    /// Writes a letterbox loaded with `load_if_open` back to its account.
    pub fn store(&self, info: &AccountInfo) -> Result<()> {
        let mut data = info.try_borrow_mut_data()?;
        let mut bytes: &mut [u8] = &mut data;
        self.try_serialize(&mut bytes)
    }
}

/// One seal per Seeker Genesis Token. It follows the token, so moving the token
/// to another wallet never buys a second free stamp.
#[account]
#[derive(InitSpace)]
pub struct Seal {
    pub sgt_mint: Pubkey,
    pub holder: Pubkey,
    pub member_number: u64,
    /// UTC day the free stamp was last used.
    pub last_free_day: i64,
    pub bump: u8,
}

/// A card in the post. Closed when it is opened or returned, and its rent goes
/// back to the sender.
#[account]
#[derive(InitSpace)]
pub struct Card {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub postage: u64,
    pub card_id: u64,
    /// SHA-256 of the card as stored off-chain.
    pub content_hash: [u8; 32],
    pub posted_at: i64,
    pub deliver_at: i64,
    pub expires_at: i64,
    pub stamp: u16,
    pub express: bool,
    pub bump: u8,
    /// The post office's burn share on the day this card was posted. A later
    /// change to the terms does not reach postage already in the post.
    pub burn_bps: u16,
}

/// Next 08:00 in the reader's time zone, strictly after `now`.
pub fn next_delivery(now: i64, utc_offset_minutes: i16) -> Option<i64> {
    use crate::constants::*;
    let offset = i64::from(utc_offset_minutes).checked_mul(SECONDS_PER_MINUTE)?;
    let local = now.checked_add(offset)?;
    let day_start = local
        .div_euclid(SECONDS_PER_DAY)
        .checked_mul(SECONDS_PER_DAY)?;
    let mut delivery = day_start.checked_add(DELIVERY_SECOND_OF_DAY)?;
    if delivery <= local {
        delivery = delivery.checked_add(SECONDS_PER_DAY)?;
    }
    delivery.checked_sub(offset)
}

/// The reader's local calendar day a timestamp falls on.
pub fn local_day(timestamp: i64, utc_offset_minutes: i16) -> Option<i64> {
    use crate::constants::*;
    let offset = i64::from(utc_offset_minutes).checked_mul(SECONDS_PER_MINUTE)?;
    Some(timestamp.checked_add(offset)?.div_euclid(SECONDS_PER_DAY))
}

#[cfg(test)]
mod tests {
    use super::*;

    // 2026-10-10T00:00:00Z
    const MIDNIGHT_UTC: i64 = 1_791_590_400;

    #[test]
    fn delivers_at_eight_the_same_morning() {
        let now = MIDNIGHT_UTC + 3 * 3_600;
        assert_eq!(next_delivery(now, 0), Some(MIDNIGHT_UTC + 8 * 3_600));
    }

    #[test]
    fn rolls_to_tomorrow_once_the_post_has_come() {
        let now = MIDNIGHT_UTC + 8 * 3_600;
        assert_eq!(next_delivery(now, 0), Some(MIDNIGHT_UTC + 32 * 3_600));
    }

    #[test]
    fn follows_the_readers_time_zone() {
        // 08:00 in Kolkata (UTC+5:30) is 02:30 UTC.
        let now = MIDNIGHT_UTC;
        assert_eq!(
            next_delivery(now, 330),
            Some(MIDNIGHT_UTC + 2 * 3_600 + 1_800)
        );
        // 08:00 in Los Angeles (UTC-7:00) is 15:00 UTC.
        assert_eq!(next_delivery(now, -420), Some(MIDNIGHT_UTC + 15 * 3_600));
    }

    #[test]
    fn local_day_changes_at_local_midnight() {
        let just_before = MIDNIGHT_UTC - 330 * 60 - 1;
        let just_after = MIDNIGHT_UTC - 330 * 60;
        assert_eq!(
            local_day(just_before, 330).unwrap() + 1,
            local_day(just_after, 330).unwrap()
        );
    }

    #[test]
    fn never_overflows_on_hostile_clocks() {
        assert_eq!(next_delivery(i64::MAX, 840), None);
    }
}
