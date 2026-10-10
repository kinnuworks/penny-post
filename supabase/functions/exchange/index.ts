// The pen-pal exchange. Send a card to a stranger, and the next stranger's
// card comes to you.
//
// POST /exchange/draw     { wallet, cluster }  ->  { recipient }
// POST /exchange/confirm  { card, cluster }    ->  { settled }
//
// `draw` hands the writer the wallet that has waited longest for a card.
// `confirm` is called once the card is posted. It reads the card account from
// the chain and only then counts it: the writer becomes owed a card, and the
// reader is owed one fewer. Nothing is taken on the app's word.
//
// The function holds no keys and moves no money. It takes no API key, so
// anyone can call it. What a caller can do is limited by the rules below: one
// open draw per wallet per day, and no credit without a real card on-chain.
// Since a card costs its sender the reader's price, joining with many wallets
// earns back only what was spent.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const PROGRAM_ADDRESS = 'D5LZ7kUmpXhE2hsKHnse9itthWHX6j8o4EkGcfz2MLAD'
const CARD_DISCRIMINATOR = [166, 250, 46, 230, 152, 63, 140, 182]
const SENDER_OFFSET = 8
const RECIPIENT_OFFSET = 40

/** A draw that is not used within a day lapses, and the writer can draw again. */
const DRAW_LIFETIME_MS = 24 * 60 * 60 * 1000
/** A writer is not given the same reader twice within this long. */
const REPEAT_GAP_MS = 7 * 24 * 60 * 60 * 1000

const RPC_URLS: Record<string, string> = {
  devnet: Deno.env.get('DEVNET_RPC_URL') ?? 'https://api.devnet.solana.com',
  mainnet: Deno.env.get('MAINNET_RPC_URL') ?? 'https://api.mainnet-beta.solana.com',
}

/** Who a writer is given when nobody is waiting yet. Optional, one per cluster. */
const POSTMASTERS: Record<string, string | undefined> = {
  devnet: Deno.env.get('DEVNET_POSTMASTER'),
  mainnet: Deno.env.get('MAINNET_POSTMASTER'),
}

const ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return reply(405, { error: 'The exchange takes POST.' })
  }
  const action = new URL(request.url).pathname.split('/').filter(Boolean).at(-1)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return reply(400, { error: 'Send JSON.' })
  }
  const cluster = typeof body.cluster === 'string' ? body.cluster : ''
  if (!(cluster in RPC_URLS)) {
    return reply(400, { error: 'Give a cluster of devnet or mainnet.' })
  }

  const database = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  if (action === 'draw') {
    const wallet = typeof body.wallet === 'string' ? body.wallet : ''
    if (!ADDRESS_PATTERN.test(wallet)) {
      return reply(400, { error: 'Give a wallet address.' })
    }
    return draw(database, cluster, wallet)
  }

  if (action === 'confirm') {
    const card = typeof body.card === 'string' ? body.card : ''
    if (!ADDRESS_PATTERN.test(card)) {
      return reply(400, { error: 'Give a card address.' })
    }
    return confirm(database, cluster, card)
  }

  return reply(404, { error: 'The exchange knows draw and confirm.' })
})

type Database = ReturnType<typeof createClient>

async function draw(database: Database, cluster: string, wallet: string): Promise<Response> {
  const now = Date.now()

  // A writer who has drawn and not yet posted gets the same reader again.
  const { data: open, error: openError } = await database
    .from('exchange_draws')
    .select('recipient, drawn_at')
    .eq('cluster', cluster)
    .eq('drawer', wallet)
    .is('fulfilled_at', null)
    .gte('drawn_at', new Date(now - DRAW_LIFETIME_MS).toISOString())
    .order('drawn_at', { ascending: false })
    .limit(1)
  if (openError) {
    return reply(500, { error: 'The exchange is not answering. Try again.' })
  }
  if (open && open.length > 0) {
    return reply(200, { recipient: open[0].recipient })
  }

  // Readers this writer was given recently are left out.
  const { data: recent, error: recentError } = await database
    .from('exchange_draws')
    .select('recipient')
    .eq('cluster', cluster)
    .eq('drawer', wallet)
    .gte('drawn_at', new Date(now - REPEAT_GAP_MS).toISOString())
  if (recentError) {
    return reply(500, { error: 'The exchange is not answering. Try again.' })
  }
  const skip = new Set([wallet, ...(recent ?? []).map((row) => row.recipient as string)])

  // Whoever is owed a card and has waited longest.
  const { data: waiting, error: waitingError } = await database
    .from('exchange_members')
    .select('wallet')
    .eq('cluster', cluster)
    .gt('owed', 0)
    .order('last_received_at', { ascending: true, nullsFirst: true })
    .order('joined_at', { ascending: true })
    .limit(50)
  if (waitingError) {
    return reply(500, { error: 'The exchange is not answering. Try again.' })
  }

  const postmaster = POSTMASTERS[cluster]
  const recipient =
    (waiting ?? []).map((row) => row.wallet as string).find((candidate) => !skip.has(candidate)) ??
    (postmaster && !skip.has(postmaster) ? postmaster : undefined)
  if (!recipient) {
    return reply(404, { error: 'Nobody is waiting for a card just now.' })
  }

  const { error: insertError } = await database.from('exchange_draws').insert({ cluster, drawer: wallet, recipient })
  if (insertError) {
    return reply(500, { error: 'The exchange is not answering. Try again.' })
  }
  return reply(200, { recipient })
}

async function confirm(database: Database, cluster: string, card: string): Promise<Response> {
  let posted: { recipient: string; sender: string } | null
  try {
    posted = await cardOnChain(RPC_URLS[cluster], card)
  } catch {
    return reply(502, { error: 'Could not reach the chain to check this card. Try again.' })
  }
  if (!posted) {
    return reply(404, { error: 'There is no card in the post at that address.' })
  }

  const { data: draws, error: drawError } = await database
    .from('exchange_draws')
    .select('id')
    .eq('cluster', cluster)
    .eq('drawer', posted.sender)
    .eq('recipient', posted.recipient)
    .is('fulfilled_at', null)
    .order('drawn_at', { ascending: false })
    .limit(1)
  if (drawError) {
    return reply(500, { error: 'The exchange is not answering. Try again.' })
  }
  if (!draws || draws.length === 0) {
    // Either this card was not an exchange card, or it has been counted already.
    return reply(200, { settled: false })
  }

  // `card` is unique, so a second confirm for the same card fails here and
  // nothing below runs twice.
  const { error: settleError } = await database
    .from('exchange_draws')
    .update({ card, fulfilled_at: new Date().toISOString() })
    .eq('id', draws[0].id)
    .is('fulfilled_at', null)
  if (settleError) {
    return reply(200, { settled: false })
  }

  await adjustOwed(database, cluster, posted.sender, 1)
  await adjustOwed(database, cluster, posted.recipient, -1)
  return reply(200, { settled: true })
}

/** Adds to what a wallet is owed, never taking it below zero. */
async function adjustOwed(database: Database, cluster: string, wallet: string, change: number): Promise<void> {
  const { data: existing } = await database
    .from('exchange_members')
    .select('owed')
    .eq('cluster', cluster)
    .eq('wallet', wallet)
    .maybeSingle()

  if (!existing) {
    if (change > 0) {
      await database.from('exchange_members').insert({ cluster, owed: change, wallet })
    }
    return
  }
  const update: Record<string, unknown> = { owed: Math.max(0, (existing.owed as number) + change) }
  if (change < 0) {
    update.last_received_at = new Date().toISOString()
  }
  await database.from('exchange_members').update(update).eq('cluster', cluster).eq('wallet', wallet)
}

/** Who a card is from and to, read from its account, or null if there is no such card. */
async function cardOnChain(rpcUrl: string, card: string): Promise<{ recipient: string; sender: string } | null> {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'getAccountInfo',
      params: [card, { commitment: 'confirmed', encoding: 'base64' }],
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`RPC answered ${response.status}`)
  }
  const { error, result } = await response.json()
  if (error) {
    throw new Error('RPC returned an error')
  }

  const account = result?.value
  if (!account || account.owner !== PROGRAM_ADDRESS) {
    return null
  }
  const data = Uint8Array.from(atob(account.data[0]), (character) => character.charCodeAt(0))
  if (data.length < RECIPIENT_OFFSET + 32 || !CARD_DISCRIMINATOR.every((byte, index) => data[index] === byte)) {
    return null
  }
  return {
    recipient: toBase58(data.subarray(RECIPIENT_OFFSET, RECIPIENT_OFFSET + 32)),
    sender: toBase58(data.subarray(SENDER_OFFSET, SENDER_OFFSET + 32)),
  }
}

function toBase58(bytes: Uint8Array): string {
  let value = 0n
  for (const byte of bytes) {
    value = value * 256n + BigInt(byte)
  }
  let text = ''
  while (value > 0n) {
    text = ALPHABET[Number(value % 58n)] + text
    value /= 58n
  }
  // Each leading zero byte is written as a leading "1".
  for (const byte of bytes) {
    if (byte !== 0) {
      break
    }
    text = '1' + text
  }
  return text
}

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status })
}
