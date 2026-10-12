//! Reads the two facts that make a Token-2022 mint a Seeker Genesis Token (its
//! mint authority and its `TokenGroupMember` extension), and reads who holds
//! the token from its token account.
//!
//! The caller must first check that each account is owned by the Token-2022
//! program. Only that program can write a `TokenGroupMember` extension, and it
//! does so only when the group's update authority signs, so a member entry
//! under Token-2022 ownership cannot be forged.
//!
//! The layouts are read by hand so the program does not have to link the whole
//! Token-2022 crate for a few fixed offsets. Every reader is tested against
//! accounts copied from mainnet.

use anchor_lang::prelude::*;

use crate::error::PostError;

/// Length of the base mint, and of the padded base every extended account shares.
#[cfg(test)]
const BASE_MINT_LEN: usize = 82;
const BASE_ACCOUNT_LEN: usize = 165;
/// A Token-2022 multisig is this long and is made of bytes its creator picks.
/// Token-2022 itself refuses to read one as a mint or a token account, and so
/// does this module.
const MULTISIG_LEN: usize = 355;
/// Token account layout: mint (32), owner (32), amount (8), delegate option (36), state (1).
const HOLDING_STATE_OFFSET: usize = 108;
/// `AccountState::Initialized` and `AccountState::Frozen`. A Genesis Token sits
/// frozen in its holder's account, so both count as held.
const HOLDING_STATE_INITIALIZED: u8 = 1;
const HOLDING_STATE_FROZEN: u8 = 2;
/// `AccountType::Account` in the byte that follows the padded base.
const ACCOUNT_TYPE_HOLDING: u8 = 2;
/// Mint layout: authority option (36), supply (8), decimals (1), then this flag.
const MINT_IS_INITIALIZED_OFFSET: usize = 45;
/// `AccountType::Mint` in the byte that follows the padded base.
const ACCOUNT_TYPE_MINT: u8 = 1;
/// `ExtensionType::TokenGroupMember`.
const EXTENSION_TOKEN_GROUP_MEMBER: u16 = 23;
const TOKEN_GROUP_MEMBER_LEN: usize = 72;

pub struct GenesisToken {
    pub mint_authority: Pubkey,
    /// The mint this member entry says it belongs to.
    pub member_mint: Pubkey,
    pub group: Pubkey,
    pub member_number: u64,
}

/// A token account, as far as this program needs to know it.
pub struct Holding {
    pub mint: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

/// Reads a Token-2022 token account. Moving a Genesis Token leaves an empty
/// account behind in the old wallet, so the caller must check `amount`.
pub fn read_holding(data: &[u8]) -> Result<Holding> {
    require!(
        data.len() >= BASE_ACCOUNT_LEN && data.len() != MULTISIG_LEN,
        PostError::GenesisTokenNotHeld
    );
    // An account with extensions says what it is in the byte after the base.
    // One without is exactly the base length, which no mint is.
    if data.len() > BASE_ACCOUNT_LEN {
        require!(
            data[BASE_ACCOUNT_LEN] == ACCOUNT_TYPE_HOLDING,
            PostError::GenesisTokenNotHeld
        );
    }
    let state = data[HOLDING_STATE_OFFSET];
    require!(
        state == HOLDING_STATE_INITIALIZED || state == HOLDING_STATE_FROZEN,
        PostError::GenesisTokenNotHeld
    );
    Ok(Holding {
        mint: read_pubkey(data, 0).map_err(|_| PostError::GenesisTokenNotHeld)?,
        owner: read_pubkey(data, 32).map_err(|_| PostError::GenesisTokenNotHeld)?,
        amount: u64::from_le_bytes(
            read_array(data, 64).map_err(|_| PostError::GenesisTokenNotHeld)?,
        ),
    })
}

/// Requires that a Token-2022 token account holds exactly one of `mint` for
/// `owner`, right now.
pub fn require_held(data: &[u8], mint: &Pubkey, owner: &Pubkey) -> Result<()> {
    let holding = read_holding(data)?;
    require_keys_eq!(holding.mint, *mint, PostError::GenesisTokenNotHeld);
    require_keys_eq!(holding.owner, *owner, PostError::GenesisTokenNotHeld);
    require!(holding.amount == 1, PostError::GenesisTokenNotHeld);
    Ok(())
}

pub fn read_genesis_token(data: &[u8]) -> Result<GenesisToken> {
    let mint_authority = read_mint_authority(data)?;
    let member = find_extension(data, EXTENSION_TOKEN_GROUP_MEMBER)?;
    require!(
        member.len() == TOKEN_GROUP_MEMBER_LEN,
        PostError::NotGenesisToken
    );

    Ok(GenesisToken {
        mint_authority,
        member_mint: read_pubkey(member, 0)?,
        group: read_pubkey(member, 32)?,
        member_number: u64::from_le_bytes(read_array(member, 64)?),
    })
}

fn read_mint_authority(data: &[u8]) -> Result<Pubkey> {
    require!(
        data.len() > BASE_ACCOUNT_LEN && data.len() != MULTISIG_LEN,
        PostError::NotGenesisToken
    );
    // COption<Pubkey>: a four-byte tag, then the key.
    let tag = u32::from_le_bytes(read_array(data, 0)?);
    require!(tag == 1, PostError::NotGenesisToken);
    require!(
        data[MINT_IS_INITIALIZED_OFFSET] == 1,
        PostError::NotGenesisToken
    );
    read_pubkey(data, 4)
}

/// Walks the type-length-value entries after the account type byte.
fn find_extension(data: &[u8], wanted: u16) -> Result<&[u8]> {
    require!(
        data.len() > BASE_ACCOUNT_LEN && data.len() != MULTISIG_LEN,
        PostError::NotGenesisToken
    );
    require!(
        data[BASE_ACCOUNT_LEN] == ACCOUNT_TYPE_MINT,
        PostError::NotGenesisToken
    );

    let mut cursor = BASE_ACCOUNT_LEN + 1;
    while cursor + 4 <= data.len() {
        let kind = u16::from_le_bytes(read_array(data, cursor)?);
        let length = usize::from(u16::from_le_bytes(read_array(data, cursor + 2)?));
        let start = cursor + 4;
        let end = start
            .checked_add(length)
            .ok_or(PostError::NotGenesisToken)?;
        if kind == 0 {
            break;
        }
        require!(end <= data.len(), PostError::NotGenesisToken);
        if kind == wanted {
            return Ok(&data[start..end]);
        }
        cursor = end;
    }
    err!(PostError::NotGenesisToken)
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<Pubkey> {
    Ok(Pubkey::new_from_array(read_array(data, offset)?))
}

fn read_array<const N: usize>(data: &[u8], offset: usize) -> Result<[u8; N]> {
    let end = offset.checked_add(N).ok_or(PostError::NotGenesisToken)?;
    let slice = data.get(offset..end).ok_or(PostError::NotGenesisToken)?;
    let mut out = [0u8; N];
    out.copy_from_slice(slice);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    /// Mint 5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj, read from mainnet on 2026-10-10.
    const REAL_SGT_MINT_HEX: &str = include_str!("../tests/fixtures/sgt_mint_5mXbkqKz.hex");

    fn decode_hex(hex: &str) -> Vec<u8> {
        let hex = hex.trim();
        (0..hex.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
            .collect()
    }

    fn real_mint() -> Vec<u8> {
        decode_hex(REAL_SGT_MINT_HEX)
    }

    /// The account that holds that token: BLJGXXKnNdZEaXTGqZaaNoZ1UkkbD1dXht8DjVz2eeZV.
    fn real_holding() -> Vec<u8> {
        decode_hex(include_str!("../tests/fixtures/sgt_holding_full.hex"))
    }

    /// An account the same token passed through and left empty.
    fn emptied_holding() -> Vec<u8> {
        decode_hex(include_str!("../tests/fixtures/sgt_holding_empty.hex"))
    }

    #[test]
    fn reads_the_real_holding_which_is_frozen() {
        let holding = read_holding(&real_holding()).unwrap();
        assert_eq!(
            holding.mint,
            Pubkey::from_str("5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj").unwrap()
        );
        assert_eq!(
            holding.owner,
            Pubkey::from_str("D2ehKLUQApN8ZxcANjwuTJC7bk7BMJn2voofXy17tCrs").unwrap()
        );
        assert_eq!(holding.amount, 1);
        assert_eq!(real_holding()[HOLDING_STATE_OFFSET], HOLDING_STATE_FROZEN);
    }

    #[test]
    fn reads_an_emptied_holding_as_holding_nothing() {
        let holding = read_holding(&emptied_holding()).unwrap();
        assert_eq!(holding.amount, 0);
    }

    #[test]
    fn reads_a_holding_with_no_extensions() {
        let plain = &real_holding()[..BASE_ACCOUNT_LEN];
        assert_eq!(read_holding(plain).unwrap().amount, 1);
    }

    #[test]
    fn rejects_a_mint_passed_as_a_holding() {
        assert!(read_holding(&real_mint()).is_err());
    }

    #[test]
    fn rejects_an_uninitialized_or_short_holding() {
        let mut data = real_holding();
        data[HOLDING_STATE_OFFSET] = 0;
        assert!(read_holding(&data).is_err());
        assert!(read_holding(&real_holding()[..100]).is_err());
        assert!(read_holding(&[]).is_err());
    }

    #[test]
    fn rejects_a_holding_passed_as_a_mint() {
        assert!(read_genesis_token(&real_holding()).is_err());
    }

    #[test]
    fn reads_a_real_genesis_token() {
        let token = read_genesis_token(&real_mint()).unwrap();
        assert_eq!(
            token.member_mint,
            Pubkey::from_str("5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj").unwrap()
        );
        assert_eq!(
            token.group,
            Pubkey::from_str("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te").unwrap()
        );
        assert_eq!(
            token.mint_authority,
            Pubkey::from_str("GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4").unwrap()
        );
        assert_eq!(token.member_number, 20);
    }

    /// A member mint made with the stock `spl-token` tool, the way the devnet
    /// stand-in for the Genesis Token is made. It carries a member pointer
    /// ahead of the member entry, which the real one does not.
    #[test]
    fn reads_a_member_mint_made_with_the_stock_token_tool() {
        let data = decode_hex(include_str!("../tests/fixtures/standin_member_mint.hex"));
        let token = read_genesis_token(&data).unwrap();
        let mint = Pubkey::from_str("CeHmPhe9fyqH3cFbGJmRtV4cFctG5fbrCUhzdYApMZhJ").unwrap();
        assert_eq!(token.member_mint, mint);
        assert_eq!(
            token.group,
            Pubkey::from_str("AKwJKaLo3G6qCsb3V318mwLJoqSqYT3WZgy7Go94uQax").unwrap()
        );
        assert_eq!(
            token.mint_authority,
            Pubkey::from_str("CMNefAXQ6rsnkRpfjeSEa5t6U74hvb5TxtCNJdxjHfXs").unwrap()
        );
        assert_eq!(token.member_number, 1);
    }

    #[test]
    fn rejects_a_plain_mint_with_no_extensions() {
        let plain = &real_mint()[..BASE_MINT_LEN];
        assert!(read_genesis_token(plain).is_err());
    }

    #[test]
    fn rejects_a_token_account_dressed_as_a_mint() {
        let mut data = real_mint();
        data[BASE_ACCOUNT_LEN] = 2;
        assert!(read_genesis_token(&data).is_err());
    }

    #[test]
    fn rejects_a_mint_with_the_member_entry_removed() {
        // Overwrite the member entry's type with an unrelated extension type.
        let mut data = real_mint();
        let mut cursor = BASE_ACCOUNT_LEN + 1;
        loop {
            let kind = u16::from_le_bytes([data[cursor], data[cursor + 1]]);
            let length = usize::from(u16::from_le_bytes([data[cursor + 2], data[cursor + 3]]));
            if kind == EXTENSION_TOKEN_GROUP_MEMBER {
                data[cursor] = 3;
                break;
            }
            cursor += 4 + length;
        }
        assert!(read_genesis_token(&data).is_err());
    }

    #[test]
    fn rejects_a_length_that_runs_past_the_account() {
        let mut data = real_mint();
        let cursor = BASE_ACCOUNT_LEN + 1;
        data[cursor + 2] = 0xff;
        data[cursor + 3] = 0xff;
        assert!(read_genesis_token(&data).is_err());
    }

    #[test]
    fn rejects_empty_and_truncated_data() {
        assert!(read_genesis_token(&[]).is_err());
        assert!(read_genesis_token(&real_mint()[..BASE_ACCOUNT_LEN + 3]).is_err());
    }

    /// A multisig is 355 bytes its creator chooses: two counts, a flag, then
    /// eleven "signer keys". This one is filled in to read as a token account
    /// that holds the real Genesis Token.
    fn multisig_dressed_as_a_holding() -> Vec<u8> {
        let mut data = real_holding()[..BASE_ACCOUNT_LEN].to_vec();
        data.push(ACCOUNT_TYPE_HOLDING);
        data.resize(MULTISIG_LEN, 0);
        data
    }

    #[test]
    fn rejects_a_multisig_dressed_as_a_holding() {
        let forged = multisig_dressed_as_a_holding();
        assert!(read_holding(&forged).is_err());
        // One byte longer or shorter and the same bytes read as a holding, so
        // it is the length check doing the refusing.
        let mut longer = forged.clone();
        longer.push(0);
        assert_eq!(read_holding(&longer).unwrap().amount, 1);
        assert_eq!(read_holding(&forged[..MULTISIG_LEN - 1]).unwrap().amount, 1);
    }

    #[test]
    fn rejects_a_multisig_dressed_as_a_mint() {
        let mut forged = real_mint();
        forged.resize(MULTISIG_LEN, 0);
        assert!(read_genesis_token(&forged).is_err());
    }

    #[test]
    fn requires_the_token_to_be_in_this_wallet_now() {
        let mint = Pubkey::from_str("5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj").unwrap();
        let holder = Pubkey::from_str("D2ehKLUQApN8ZxcANjwuTJC7bk7BMJn2voofXy17tCrs").unwrap();
        let someone_else = Pubkey::new_unique();

        assert!(require_held(&real_holding(), &mint, &holder).is_ok());
        assert!(require_held(&real_holding(), &mint, &someone_else).is_err());
        assert!(require_held(&real_holding(), &someone_else, &holder).is_err());
        // The token has moved on and left this account empty.
        let mut emptied = real_holding();
        emptied[64..72].fill(0);
        assert!(require_held(&emptied, &mint, &holder).is_err());
    }
}
