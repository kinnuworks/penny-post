import { findAssociatedTokenPda, fetchMint, fetchToken, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token'
import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getAddressEncoder,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from '@solana/kit'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { PENNY_POST_PROGRAM_ADDRESS } from '../src'

// `anchor test` starts Surfpool, which forks mainnet on demand. That means the
// tests run against the real SKR mint and a real Seeker Genesis Token mint.

export const rpcUrl = process.env.ANCHOR_PROVIDER_URL ?? 'http://127.0.0.1:8899'
export const rpc = createSolanaRpc(rpcUrl)
export const rpcSubscriptions = createSolanaRpcSubscriptions(rpcUrl.replace('http', 'ws').replace('8899', '8900'))
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })

export const SKR_MINT = address('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3')
export const SGT_GROUP = address('GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te')
export const SGT_MINT_AUTHORITY = address('GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4')
/** A real Genesis Token mint: member number 20 of the group above. */
export const REAL_SGT_MINT = address('5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj')
export const TOKEN_2022_PROGRAM_ADDRESS = address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')
const UPGRADEABLE_LOADER = address('BPFLoaderUpgradeab1e11111111111111111111111')
const ASSOCIATED_TOKEN_PROGRAM = address('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

/** One SKR, in base units. SKR has six decimals. */
export const SKR = 1_000_000n

// An optional account is left out by not passing it: the generated client then
// sends the program's own address in that slot, which Anchor reads as absent.

/** The wallet `anchor test` deploys with, which makes it the program's upgrade authority. */
export async function loadDeployer(): Promise<KeyPairSigner> {
  const path = (process.env.ANCHOR_WALLET ?? '~/.config/solana/id.json').replace('~', homedir())
  const bytes = new Uint8Array(JSON.parse(readFileSync(path, 'utf8')) as number[])
  return createKeyPairSignerFromBytes(bytes)
}

export async function programDataAddress(): Promise<Address> {
  const [programData] = await getProgramDerivedAddress({
    programAddress: UPGRADEABLE_LOADER,
    seeds: [getAddressEncoder().encode(PENNY_POST_PROGRAM_ADDRESS)],
  })
  return programData
}

export async function send(payer: KeyPairSigner, instructions: Instruction[]) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()
  const transaction = await pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => signTransactionMessageWithSigners(tx),
  )
  assertIsTransactionWithBlockhashLifetime(transaction)
  await sendAndConfirm(transaction, { commitment: 'confirmed' })
  return getSignatureFromTransaction(transaction)
}

/** Resolves to the program's custom error code if the transaction fails with one, else rethrows. */
export async function errorCodeOf(attempt: Promise<unknown>): Promise<number> {
  try {
    await attempt
  } catch (error) {
    const code = findCustomCode(error)
    if (code === undefined) {
      throw error
    }
    return code
  }
  throw new Error('Expected the transaction to fail, but it went through.')
}

function findCustomCode(error: unknown, depth = 0): number | undefined {
  if (depth > 6 || typeof error !== 'object' || error === null) {
    return undefined
  }
  const { cause, context } = error as { cause?: unknown; context?: Record<string, unknown> }
  if (context && typeof context.code === 'number') {
    return context.code
  }
  return findCustomCode(cause, depth + 1)
}

// --- Surfpool cheatcodes -----------------------------------------------------

async function cheat(method: string, params: unknown[]) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  const body = (await response.json()) as { error?: { message: string }; result?: unknown }
  if (body.error) {
    throw new Error(`${method}: ${body.error.message}`)
  }
  return body.result
}

/** Puts `amount` of a token in the owner's associated token account. */
export async function giveTokens(
  owner: Address,
  mint: Address,
  amount: bigint,
  tokenProgram: Address = TOKEN_PROGRAM_ADDRESS,
) {
  await cheat('surfnet_setTokenAccount', [owner, mint, { amount: Number(amount) }, tokenProgram])
}

/** Moves the validator's clock forward to a Unix time in seconds. */
export async function travelTo(unixSeconds: bigint) {
  await cheat('surfnet_timeTravel', [{ absoluteTimestamp: Number(unixSeconds) * 1000 }])
}

// --- Token helpers -----------------------------------------------------------

export async function tokenAccountOf(
  owner: Address,
  mint: Address = SKR_MINT,
  tokenProgram: Address = TOKEN_PROGRAM_ADDRESS,
) {
  const [tokenAccount] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM,
    seeds: [
      getAddressEncoder().encode(owner),
      getAddressEncoder().encode(tokenProgram),
      getAddressEncoder().encode(mint),
    ],
  })
  return tokenAccount
}

export async function skrBalance(owner: Address): Promise<bigint> {
  const [tokenAccount] = await findAssociatedTokenPda({ mint: SKR_MINT, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS })
  return (await fetchToken(rpc, tokenAccount)).data.amount
}

export async function skrSupply(): Promise<bigint> {
  return (await fetchMint(rpc, SKR_MINT)).data.supply
}

export async function accountExists(account: Address): Promise<boolean> {
  const { value } = await rpc.getAccountInfo(account, { encoding: 'base64' }).send()
  return value !== null
}

let nextCardId = BigInt(Date.now())
/** A card id nobody has used in this run. */
export function freshCardId(): bigint {
  nextCardId += 1n
  return nextCardId
}
