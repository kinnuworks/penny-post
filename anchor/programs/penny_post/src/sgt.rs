//! Reads the two facts that make a Token-2022 mint a Seeker Genesis Token:
//! its mint authority, and its `TokenGroupMember` extension.
//!
//! The caller must first check that the account is owned by the Token-2022
//! program. Only that program can write a `TokenGroupMember` extension, and it
//! does so only when the group's update authority signs, so a member entry
//! under Token-2022 ownership cannot be forged.

use anchor_lang::prelude::*;

use crate::error::PostError;

/// Length of the base mint, and of the padded base every extended account shares.
#[cfg(test)]
const BASE_MINT_LEN: usize = 82;
const BASE_ACCOUNT_LEN: usize = 165;
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

pub fn read_genesis_token(data: &[u8]) -> Result<GenesisToken> {
    let mint_authority = read_mint_authority(data)?;
    let member = find_extension(data, EXTENSION_TOKEN_GROUP_MEMBER)?;
    require!(member.len() == TOKEN_GROUP_MEMBER_LEN, PostError::NotGenesisToken);

    Ok(GenesisToken {
        mint_authority,
        member_mint: read_pubkey(member, 0)?,
        group: read_pubkey(member, 32)?,
        member_number: u64::from_le_bytes(read_array(member, 64)?),
    })
}

fn read_mint_authority(data: &[u8]) -> Result<Pubkey> {
    require!(data.len() > BASE_ACCOUNT_LEN, PostError::NotGenesisToken);
    // COption<Pubkey>: a four-byte tag, then the key.
    let tag = u32::from_le_bytes(read_array(data, 0)?);
    require!(tag == 1, PostError::NotGenesisToken);
    require!(data[MINT_IS_INITIALIZED_OFFSET] == 1, PostError::NotGenesisToken);
    read_pubkey(data, 4)
}

/// Walks the type-length-value entries after the account type byte.
fn find_extension(data: &[u8], wanted: u16) -> Result<&[u8]> {
    require!(data.len() > BASE_ACCOUNT_LEN, PostError::NotGenesisToken);
    require!(data[BASE_ACCOUNT_LEN] == ACCOUNT_TYPE_MINT, PostError::NotGenesisToken);

    let mut cursor = BASE_ACCOUNT_LEN + 1;
    while cursor + 4 <= data.len() {
        let kind = u16::from_le_bytes(read_array(data, cursor)?);
        let length = usize::from(u16::from_le_bytes(read_array(data, cursor + 2)?));
        let start = cursor + 4;
        let end = start.checked_add(length).ok_or(PostError::NotGenesisToken)?;
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
}
