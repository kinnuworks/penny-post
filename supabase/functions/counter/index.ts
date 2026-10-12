// The devnet counter. It hands a tester what a Seeker owner already has.
//
// POST /counter/kit  { wallet }  ->  { given, signature }
//
// Devnet has no SKR and no Seeker Genesis Token, so somebody trying the app
// there can look and do nothing. One call gives a wallet a little devnet SOL,
// some stand-in postage and one stand-in Genesis Token, once.
//
// This is the only part of Penny Post that holds a key, and the key is only
// good on devnet: it is a wallet stocked with test SOL, stand-in postage and a
// pile of stand-in Genesis Tokens minted ahead of time. It cannot mint either
// token and has no say over the program. There is no counter on mainnet.
//
// It takes no API key. A caller with many wallets can empty the pile, and then
// the counter says it has run out.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { ed25519 } from 'npm:@noble/curves@1.9.7/ed25519'

const RPC_URL = Deno.env.get('DEVNET_RPC_URL') ?? 'https://api.devnet.solana.com'

const SYSTEM_PROGRAM = '11111111111111111111111111111111'
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'

/** The stand-in postage the devnet post office was opened with. */
const POSTAGE_MINT = '2tqGk3fXK3XYGg69jhQUiMg1gQxHbFWTzYokXDVb8NDX'
const POSTAGE_DECIMALS = 6

/** Enough for a letterbox, a few cards and a few answers. */
const KIT_LAMPORTS = 25_000_000n
const KIT_POSTAGE = 300n * 10n ** BigInt(POSTAGE_DECIMALS)

const ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return reply(405, { error: 'The counter takes POST.' })
  }
  if (new URL(request.url).pathname.split('/').filter(Boolean).at(-1) !== 'kit') {
    return reply(404, { error: 'The counter only hands out kits.' })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return reply(400, { error: 'Send JSON.' })
  }
  const wallet = typeof body.wallet === 'string' ? body.wallet : ''
  if (!ADDRESS_PATTERN.test(wallet) || fromBase58(wallet).length !== 32) {
    return reply(400, { error: 'Give a wallet address.' })
  }

  try {
    return await handOver(wallet)
  } catch (error) {
    console.error(error)
    return reply(503, { error: 'The counter is not answering. Try again.' })
  }
})

async function handOver(wallet: string): Promise<Response> {
  const database = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: secretKey, error } = await database.rpc('counter_key', { for_cluster: 'devnet' })
  if (error || !Array.isArray(secretKey) || secretKey.length !== 64) {
    return reply(503, { error: 'The counter is shut.' })
  }
  // A Solana key file is the 32-byte seed followed by the public key.
  const seed = new Uint8Array(secretKey.slice(0, 32) as number[])
  const counter = toBase58(new Uint8Array(secretKey.slice(32) as number[]))

  // A wallet that already has a postage account has been here before.
  const postageTo = await tokenAccount(wallet, POSTAGE_MINT, TOKEN_PROGRAM)
  const already = await rpc<{ value: unknown }>('getAccountInfo', [postageTo, { encoding: 'base64' }])
  if (already.value) {
    return reply(409, { error: 'This wallet has had its kit.' })
  }

  const instructions: Instruction[] = [
    transferSol(counter, wallet, KIT_LAMPORTS),
    createTokenAccount(counter, postageTo, wallet, POSTAGE_MINT, TOKEN_PROGRAM),
    transferTokens(
      await tokenAccount(counter, POSTAGE_MINT, TOKEN_PROGRAM),
      POSTAGE_MINT,
      postageTo,
      counter,
      KIT_POSTAGE,
      POSTAGE_DECIMALS,
      TOKEN_PROGRAM,
    ),
  ]

  // One stand-in Genesis Token from the pile, unless the wallet holds one.
  let seeker: string | null = null
  if ((await oneOfAKindTokens(wallet)).length === 0) {
    const pile = await oneOfAKindTokens(counter)
    if (pile.length === 0) {
      return reply(410, { error: 'The counter has run out of test Genesis Tokens.' })
    }
    // A random one, so two testers at the counter together rarely reach for the same token.
    seeker = pile[Math.floor(Math.random() * pile.length)]
    const seekerTo = await tokenAccount(wallet, seeker, TOKEN_2022_PROGRAM)
    instructions.push(
      createTokenAccount(counter, seekerTo, wallet, seeker, TOKEN_2022_PROGRAM),
      transferTokens(
        await tokenAccount(counter, seeker, TOKEN_2022_PROGRAM),
        seeker,
        seekerTo,
        counter,
        1n,
        0,
        TOKEN_2022_PROGRAM,
      ),
    )
  }

  const { value: latest } = await rpc<{ value: { blockhash: string } }>('getLatestBlockhash', [
    { commitment: 'confirmed' },
  ])
  const message = compileMessage(counter, latest.blockhash, instructions)
  const signatureBytes = ed25519.sign(message, seed)
  const signature = toBase58(signatureBytes)
  const wire = new Uint8Array(1 + 64 + message.length)
  wire[0] = 1
  wire.set(signatureBytes, 1)
  wire.set(message, 65)
  await rpc('sendTransaction', [toBase64(wire), { encoding: 'base64', preflightCommitment: 'confirmed' }])

  for (let attempt = 0; attempt < 25; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    const status = await rpc<{ value: ({ confirmationStatus?: string; err: unknown } | null)[] }>(
      'getSignatureStatuses',
      [[signature]],
    )
      .then(({ value }) => value[0])
      .catch(() => null)
    if (status?.err) {
      return reply(503, { error: 'The counter dropped it. Try again.' })
    }
    if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
      return reply(200, {
        given: { lamports: KIT_LAMPORTS.toString(), postage: KIT_POSTAGE.toString(), seeker },
        signature,
      })
    }
  }
  // No word on the transaction. The postage account being there says it landed.
  const landed = await rpc<{ value: unknown }>('getAccountInfo', [postageTo, { encoding: 'base64' }]).catch(() => null)
  if (landed?.value) {
    return reply(200, {
      given: { lamports: KIT_LAMPORTS.toString(), postage: KIT_POSTAGE.toString(), seeker },
      signature,
    })
  }
  return reply(503, { error: 'The counter is slow today. Look again in a minute.' })
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(RPC_URL, {
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  const answer = await response.json()
  if (answer.error) {
    throw new Error(`${method}: ${JSON.stringify(answer.error)}`)
  }
  return answer.result as T
}

/** Token-2022 mints of which `owner` holds exactly one indivisible token. */
async function oneOfAKindTokens(owner: string): Promise<string[]> {
  type Holding = {
    account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string; decimals: number } } } } }
  }
  const { value } = await rpc<{ value: Holding[] }>('getTokenAccountsByOwner', [
    owner,
    { programId: TOKEN_2022_PROGRAM },
    { encoding: 'jsonParsed' },
  ])
  return value
    .map((entry) => entry.account.data.parsed.info)
    .filter((info) => info.tokenAmount.amount === '1' && info.tokenAmount.decimals === 0)
    .map((info) => info.mint)
}

type Account = { address: string; signer?: boolean; writable?: boolean }
type Instruction = { accounts: Account[]; data: Uint8Array; program: string }

/** The owner's associated token account: the first bump that lands off the curve. */
async function tokenAccount(owner: string, mint: string, tokenProgram: string): Promise<string> {
  const seeds = [fromBase58(owner), fromBase58(tokenProgram), fromBase58(mint)]
  const tail = [fromBase58(ASSOCIATED_TOKEN_PROGRAM), new TextEncoder().encode('ProgramDerivedAddress')]
  for (let bump = 255; bump >= 0; bump--) {
    const candidate = new Uint8Array(
      await crypto.subtle.digest('SHA-256', concat([...seeds, new Uint8Array([bump]), ...tail])),
    )
    if (!isOnCurve(candidate)) {
      return toBase58(candidate)
    }
  }
  throw new Error('No address for that token account.')
}

function isOnCurve(bytes: Uint8Array): boolean {
  try {
    ed25519.ExtendedPoint.fromHex(bytes)
    return true
  } catch {
    return false
  }
}

function transferSol(from: string, to: string, lamports: bigint): Instruction {
  const data = new Uint8Array(12)
  const view = new DataView(data.buffer)
  view.setUint32(0, 2, true)
  view.setBigUint64(4, lamports, true)
  return {
    accounts: [
      { address: from, signer: true, writable: true },
      { address: to, writable: true },
    ],
    data,
    program: SYSTEM_PROGRAM,
  }
}

/** Creates the owner's associated token account if it is not there yet. */
function createTokenAccount(
  payer: string,
  account: string,
  owner: string,
  mint: string,
  tokenProgram: string,
): Instruction {
  return {
    accounts: [
      { address: payer, signer: true, writable: true },
      { address: account, writable: true },
      { address: owner },
      { address: mint },
      { address: SYSTEM_PROGRAM },
      { address: tokenProgram },
    ],
    data: new Uint8Array([1]),
    program: ASSOCIATED_TOKEN_PROGRAM,
  }
}

/** TransferChecked, which both token programs spell the same way. */
function transferTokens(
  from: string,
  mint: string,
  to: string,
  authority: string,
  amount: bigint,
  decimals: number,
  tokenProgram: string,
): Instruction {
  const data = new Uint8Array(10)
  data[0] = 12
  new DataView(data.buffer).setBigUint64(1, amount, true)
  data[9] = decimals
  return {
    accounts: [
      { address: from, writable: true },
      { address: mint },
      { address: to, writable: true },
      { address: authority, signer: true },
    ],
    data,
    program: tokenProgram,
  }
}

/**
 * A legacy transaction message with one signer, who also pays. Accounts are
 * listed payer first, then the rest that are written to, then the rest that
 * are only read, which is the order the header's counts describe.
 */
function compileMessage(payer: string, blockhash: string, instructions: Instruction[]): Uint8Array {
  const writable = new Set<string>()
  const readonly = new Set<string>()
  for (const instruction of instructions) {
    readonly.add(instruction.program)
    for (const account of instruction.accounts) {
      if (account.signer && account.address !== payer) {
        throw new Error('Only the counter signs.')
      }
      ;(account.writable ? writable : readonly).add(account.address)
    }
  }
  writable.delete(payer)
  for (const address of [payer, ...writable]) {
    readonly.delete(address)
  }
  const keys = [payer, ...writable, ...readonly]

  const parts: Uint8Array[] = [
    new Uint8Array([1, 0, readonly.size]),
    shortLength(keys.length),
    ...keys.map(fromBase58),
    fromBase58(blockhash),
    shortLength(instructions.length),
  ]
  for (const instruction of instructions) {
    parts.push(
      new Uint8Array([keys.indexOf(instruction.program)]),
      shortLength(instruction.accounts.length),
      new Uint8Array(instruction.accounts.map((account) => keys.indexOf(account.address))),
      shortLength(instruction.data.length),
      instruction.data,
    )
  }
  return concat(parts)
}

/** Solana's compact length: seven bits at a time, low bits first. */
function shortLength(length: number): Uint8Array {
  const bytes: number[] = []
  let rest = length
  while (rest >= 0x80) {
    bytes.push((rest & 0x7f) | 0x80)
    rest >>= 7
  }
  bytes.push(rest)
  return new Uint8Array(bytes)
}

function concat(parts: Uint8Array[]): Uint8Array {
  const whole = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    whole.set(part, offset)
    offset += part.length
  }
  return whole
}

function fromBase58(text: string): Uint8Array {
  let value = 0n
  for (const character of text) {
    const digit = ALPHABET.indexOf(character)
    if (digit === -1) {
      throw new Error('Not base58.')
    }
    value = value * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn))
    value >>= 8n
  }
  for (const character of text) {
    if (character !== '1') {
      break
    }
    bytes.unshift(0)
  }
  return new Uint8Array(bytes)
}

function toBase58(bytes: Uint8Array): string {
  let value = 0n
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte)
  }
  let text = ''
  while (value > 0n) {
    text = ALPHABET[Number(value % 58n)] + text
    value /= 58n
  }
  for (const byte of bytes) {
    if (byte !== 0) {
      break
    }
    text = '1' + text
  }
  return text
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  })
}
