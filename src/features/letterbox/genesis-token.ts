import { getAddressDecoder, getBase64Encoder, type Address, type createSolanaRpc } from '@solana/kit'

// Finds the Seeker Genesis Token in a wallet, if it holds one. This is only so
// the app knows which accounts to hand the program. The program runs the same
// checks itself and is the one that decides.

type Rpc = ReturnType<typeof createSolanaRpc>

export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' as Address
/** Token-2022 group every Seeker Genesis Token is a member of. */
export const SGT_GROUP = 'GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te' as Address

const BASE_ACCOUNT_LEN = 165
const ACCOUNT_TYPE_MINT = 1
const EXTENSION_TOKEN_GROUP_MEMBER = 23
const TOKEN_GROUP_MEMBER_LEN = 72

export interface GroupMember {
  group: Address
  memberNumber: bigint
  mint: Address
}

/**
 * Reads the `TokenGroupMember` extension from a Token-2022 mint's data, or
 * returns null if it has none. The same walk as `sgt.rs` in the program.
 */
export function readGroupMember(data: Uint8Array): GroupMember | null {
  if (data.length <= BASE_ACCOUNT_LEN || data[BASE_ACCOUNT_LEN] !== ACCOUNT_TYPE_MINT) {
    return null
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let cursor = BASE_ACCOUNT_LEN + 1
  while (cursor + 4 <= data.length) {
    const kind = view.getUint16(cursor, true)
    const length = view.getUint16(cursor + 2, true)
    const start = cursor + 4
    const end = start + length
    if (kind === 0 || end > data.length) {
      return null
    }
    if (kind === EXTENSION_TOKEN_GROUP_MEMBER) {
      if (length !== TOKEN_GROUP_MEMBER_LEN) {
        return null
      }
      const decoder = getAddressDecoder()
      return {
        group: decoder.decode(data.subarray(start + 32, start + 64)),
        memberNumber: view.getBigUint64(start + 64, true),
        mint: decoder.decode(data.subarray(start, start + 32)),
      }
    }
    cursor = end
  }
  return null
}

export interface GenesisToken {
  memberNumber: bigint
  mint: Address
  tokenAccount: Address
}

/** The Genesis Token this wallet holds right now, or null. */
export async function findGenesisToken(rpc: Rpc, owner: Address): Promise<GenesisToken | null> {
  const { value: holdings } = await rpc
    .getTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM }, { encoding: 'jsonParsed' })
    .send()

  // A Genesis Token is a single, indivisible token. Moving one leaves an empty
  // account behind, so only accounts that hold exactly one are worth a look.
  const candidates = holdings
    .map(({ account, pubkey }) => ({ info: account.data.parsed.info, tokenAccount: pubkey }))
    .filter(({ info }) => info.tokenAmount.amount === '1' && info.tokenAmount.decimals === 0)
    .slice(0, 25)

  for (const { info, tokenAccount } of candidates) {
    const { value: mintAccount } = await rpc.getAccountInfo(info.mint, { encoding: 'base64' }).send()
    if (!mintAccount || mintAccount.owner !== TOKEN_2022_PROGRAM) {
      continue
    }
    const member = readGroupMember(new Uint8Array(getBase64Encoder().encode(mintAccount.data[0])))
    if (member && member.group === SGT_GROUP && member.mint === info.mint) {
      return { memberNumber: member.memberNumber, mint: info.mint, tokenAccount }
    }
  }
  return null
}
