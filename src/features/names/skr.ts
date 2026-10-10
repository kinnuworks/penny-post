import { sha256 } from '@noble/hashes/sha2.js'
import {
  address,
  getAddressDecoder,
  getAddressEncoder,
  getProgramDerivedAddress,
  isAddress,
  type Address,
  type createSolanaRpc,
} from '@solana/kit'

// Looks up who owns a `.skr` name. Every Seeker gets one, and they are built on
// the AllDomains name service, which lives on mainnet only.
//
// The six addresses below are the ones Solana Mobile publishes in
// @solana-mobile/skr-domain. That package has no resolver yet, so the steps
// here follow AllDomains' own @onsol/tldparser.

type Rpc = ReturnType<typeof createSolanaRpc>

const ANS_PROGRAM = address('ALTNSZ46uaAUU7XUV6awvdorLGqAsPwa9shm7h4uP2FK')
const NAME_HOUSE_PROGRAM = address('NH3uX6FtVE2fNREAioP7hm5RaozotZxeL6khU1EHx51')
const TLD_HOUSE_PROGRAM = address('TLDHkysf5pCnKsVA4gXpNvmy7psXLPEu4LAdDJthT9S')
const SKR_PARENT = address('F3A8kuikEiu6k2399oSJ1PWfcJYDHqpwoQ2e8psSDNuF')
const SKR_TLD_HOUSE = address('4RKP4BEMu5sXBfXSH7xN2owtQrnAJvhhwtBBmj9JEYkA')

const HASH_PREFIX = 'ALT Name Service'
const NO_CLASS = new Uint8Array(32)

// Name record: discriminator (8), parent (32), owner (32), class (32), expires (8).
const OWNER_OFFSET = 40
const EXPIRES_OFFSET = 104
// NFT record: discriminator (8), tag (1), bump (1), name (32), owner (32), mint (32).
const NFT_TAG_OFFSET = 8
const NFT_MINT_OFFSET = 74
const NFT_TAG_ACTIVE = 1
const TOKEN_ACCOUNT_OWNER_OFFSET = 32

const GRACE_SECONDS = 50 * 24 * 60 * 60

const SUFFIX = '.skr'

/** "Asha.SKR " becomes "asha". Returns null if it is not a `.skr` name. */
export function parseSkrName(input: string): string | null {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed.endsWith(SUFFIX)) {
    return null
  }
  const label = trimmed.slice(0, -SUFFIX.length)
  // One label, no dots: a name like "a.b.skr" is a subdomain, which Seekers do not have.
  return label.length > 0 && !label.includes('.') && !/\s/.test(label) ? label : null
}

/** The name record's address for a label such as "asha". */
export async function skrNameAccount(label: string): Promise<Address> {
  const hashed = sha256(new TextEncoder().encode(HASH_PREFIX + label))
  const [nameAccount] = await getProgramDerivedAddress({
    programAddress: ANS_PROGRAM,
    seeds: [hashed, NO_CLASS, getAddressEncoder().encode(SKR_PARENT)],
  })
  return nameAccount
}

/**
 * The wallet a `.skr` name points to, or null if nobody holds that name.
 * `rpc` must be a mainnet connection.
 */
export async function resolveSkrName(
  rpc: Rpc,
  label: string,
  now = Math.floor(Date.now() / 1000),
): Promise<Address | null> {
  const nameAccount = await skrNameAccount(label)
  const record = await fetchData(rpc, nameAccount)
  if (!record || record.length < EXPIRES_OFFSET + 8) {
    return null
  }

  const expires = Number(new DataView(record.buffer, record.byteOffset).getBigUint64(EXPIRES_OFFSET, true))
  if (expires !== 0 && expires + GRACE_SECONDS <= now) {
    return null
  }

  const owner = getAddressDecoder().decode(record.subarray(OWNER_OFFSET, OWNER_OFFSET + 32))

  // A name can be wrapped as an NFT. Then its recorded owner is an NFT record,
  // and the real owner is whoever holds that NFT.
  const nftRecord = await nftRecordFor(nameAccount)
  return owner === nftRecord ? holderOfWrappedName(rpc, nftRecord) : owner
}

/**
 * Turns what the writer typed into a wallet address: a `.skr` name is looked
 * up, a wallet address is passed through, anything else is null.
 */
export async function resolveRecipient(
  rpc: Rpc,
  input: string,
): Promise<{ address: Address; name: string | null } | null> {
  const label = parseSkrName(input)
  if (label) {
    const owner = await resolveSkrName(rpc, label)
    return owner ? { address: owner, name: `${label}${SUFFIX}` } : null
  }
  const trimmed = input.trim()
  return isAddress(trimmed) ? { address: trimmed, name: null } : null
}

/**
 * The `.skr` name a wallet has set as its main name, or null. The record is
 * checked the other way round too, because it can outlive a name that has
 * since moved to another wallet.
 */
export async function primarySkrName(rpc: Rpc, owner: Address): Promise<string | null> {
  const [mainDomain] = await getProgramDerivedAddress({
    programAddress: TLD_HOUSE_PROGRAM,
    seeds: [new TextEncoder().encode('main_domain'), getAddressEncoder().encode(owner)],
  })
  const record = await fetchData(rpc, mainDomain)
  if (!record) {
    return null
  }

  // Main domain record: discriminator (8), name account (32), then two
  // length-prefixed strings: the top-level domain and the name.
  const tld = readString(record, 40)
  const label = tld ? readString(record, tld.end) : null
  if (!tld || !label || tld.text !== SUFFIX || parseSkrName(label.text + SUFFIX) !== label.text) {
    return null
  }
  return (await resolveSkrName(rpc, label.text)) === owner ? label.text + SUFFIX : null
}

function readString(data: Uint8Array, offset: number): { end: number; text: string } | null {
  if (offset + 4 > data.length) {
    return null
  }
  const length = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true)
  const end = offset + 4 + length
  if (length > 64 || end > data.length) {
    return null
  }
  return { end, text: new TextDecoder().decode(data.subarray(offset + 4, end)) }
}

async function nftRecordFor(nameAccount: Address): Promise<Address> {
  const encoder = getAddressEncoder()
  const text = new TextEncoder()
  const [nameHouse] = await getProgramDerivedAddress({
    programAddress: NAME_HOUSE_PROGRAM,
    seeds: [text.encode('name_house'), encoder.encode(SKR_TLD_HOUSE)],
  })
  const [nftRecord] = await getProgramDerivedAddress({
    programAddress: NAME_HOUSE_PROGRAM,
    seeds: [text.encode('nft_record'), encoder.encode(nameHouse), encoder.encode(nameAccount)],
  })
  return nftRecord
}

async function holderOfWrappedName(rpc: Rpc, nftRecord: Address): Promise<Address | null> {
  const record = await fetchData(rpc, nftRecord)
  if (!record || record.length < NFT_MINT_OFFSET + 32 || record[NFT_TAG_OFFSET] !== NFT_TAG_ACTIVE) {
    return null
  }
  const mint = getAddressDecoder().decode(record.subarray(NFT_MINT_OFFSET, NFT_MINT_OFFSET + 32))

  const { value: largest } = await rpc.getTokenLargestAccounts(mint).send()
  const holding = largest.find((account) => account.amount === '1')
  if (!holding) {
    return null
  }
  const tokenAccount = await fetchData(rpc, holding.address)
  if (!tokenAccount || tokenAccount.length < TOKEN_ACCOUNT_OWNER_OFFSET + 32) {
    return null
  }
  return getAddressDecoder().decode(tokenAccount.subarray(TOKEN_ACCOUNT_OWNER_OFFSET, TOKEN_ACCOUNT_OWNER_OFFSET + 32))
}

async function fetchData(rpc: Rpc, account: Address): Promise<Uint8Array | null> {
  const { value } = await rpc.getAccountInfo(account, { encoding: 'base64' }).send()
  if (!value) {
    return null
  }
  return base64ToBytes(value.data[0])
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
