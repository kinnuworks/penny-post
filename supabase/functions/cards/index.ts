// Stores the contents of a card that is already in the post.
//
// PUT /cards/<card address>?cluster=devnet|mainnet   body: the card's bytes
//
// The function holds no keys and moves no money. It will only store bytes
// whose SHA-256 is the `content_hash` of a card account that exists on-chain
// and is owned by the Penny Post program. Posting a card costs the sender a
// transaction and a stamp, so the chain is what limits how much can be stored.
// Contents are filed under their hash, so a reader can check what they fetch.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const PROGRAM_ADDRESS = 'D5LZ7kUmpXhE2hsKHnse9itthWHX6j8o4EkGcfz2MLAD'
const BUCKET = 'cards'
const MAX_BYTES = 400_000

// Card account: discriminator (8), sender (32), recipient (32), postage (8),
// card id (8), then the 32-byte content hash.
const CARD_DISCRIMINATOR = [166, 250, 46, 230, 152, 63, 140, 182]
const HASH_OFFSET = 88
const HASH_LENGTH = 32

const RPC_URLS: Record<string, string> = {
  devnet: Deno.env.get('DEVNET_RPC_URL') ?? 'https://api.devnet.solana.com',
  mainnet: Deno.env.get('MAINNET_RPC_URL') ?? 'https://api.mainnet-beta.solana.com',
}

const ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

Deno.serve(async (request: Request) => {
  if (request.method !== 'PUT') {
    return reply(405, 'Cards are stored with PUT.')
  }

  const url = new URL(request.url)
  const card = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
  const rpcUrl = RPC_URLS[url.searchParams.get('cluster') ?? '']
  if (!ADDRESS_PATTERN.test(card) || !rpcUrl) {
    return reply(400, 'Give a card address and a cluster of devnet or mainnet.')
  }

  // Refuse an oversized body before reading it, then check again once read.
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES) {
    return reply(413, 'That card is too large.')
  }
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.length === 0 || body.length > MAX_BYTES) {
    return reply(body.length === 0 ? 400 : 413, 'A card must be between 1 byte and 400 kB.')
  }

  let expected: Uint8Array | null
  try {
    expected = await contentHashOnChain(rpcUrl, card)
  } catch {
    return reply(502, 'Could not reach the chain to check this card. Try again.')
  }
  if (!expected) {
    return reply(404, 'There is no card in the post at that address.')
  }

  const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', body))
  if (!sameBytes(actual, expected)) {
    return reply(409, 'These are not the contents that card was posted with.')
  }

  const storage = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const name = toHex(actual)
  const { error } = await storage.storage
    .from(BUCKET)
    .upload(name, body, { contentType: 'application/octet-stream', upsert: true })
  if (error) {
    return reply(500, 'The card could not be filed. Try again.')
  }

  return reply(200, name)
})

/** The content hash recorded on a card account, or null if there is no such card. */
async function contentHashOnChain(rpcUrl: string, card: string): Promise<Uint8Array | null> {
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
  if (data.length < HASH_OFFSET + HASH_LENGTH || !CARD_DISCRIMINATOR.every((byte, index) => data[index] === byte)) {
    return null
  }
  return data.subarray(HASH_OFFSET, HASH_OFFSET + HASH_LENGTH)
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  let difference = 0
  for (let i = 0; i < a.length; i++) {
    difference |= a[i] ^ b[i]
  }
  return difference === 0
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function reply(status: number, message: string): Response {
  return new Response(JSON.stringify(status === 200 ? { stored: message } : { error: message }), {
    headers: { 'content-type': 'application/json' },
    status,
  })
}
