/**
 * A stand-in for the card store, for a validator on this machine.
 *
 *   pnpm local-card-store
 *
 * The deployed store checks cards against devnet or mainnet, so it cannot see
 * a card posted to a local fork. This keeps the same two addresses and the same
 * rule: bytes are stored only if their SHA-256 is the hash of a card that
 * exists on the local chain. Files go in a temporary folder.
 */

import { createHash } from 'node:crypto'
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PENNY_POST_PROGRAM_ADDRESS } from '../anchor/src'

const RPC_URL = 'http://127.0.0.1:8899'
const PORT = 8787
const MAX_BYTES = 400_000
// Card account: discriminator (8), sender (32), recipient (32), postage (8), card id (8), then the hash.
const HASH_OFFSET = 88
const folder = mkdtempSync(join(tmpdir(), 'penny-post-cards-'))

async function contentHashOnChain(card: string): Promise<string | null> {
  const response = await fetch(RPC_URL, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'getAccountInfo',
      params: [card, { commitment: 'confirmed', encoding: 'base64' }],
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  const { result } = (await response.json()) as { result?: { value: { data: [string]; owner: string } | null } }
  const account = result?.value
  if (!account || account.owner !== PENNY_POST_PROGRAM_ADDRESS) {
    return null
  }
  const data = Buffer.from(account.data[0], 'base64')
  return data.length < HASH_OFFSET + 32 ? null : data.subarray(HASH_OFFSET, HASH_OFFSET + 32).toString('hex')
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`)
  const last = url.pathname.split('/').filter(Boolean).at(-1) ?? ''
  const answer = (status: number, body: string | Buffer) => {
    response.writeHead(status, { 'content-type': typeof body === 'string' ? 'text/plain' : 'application/octet-stream' })
    response.end(body)
    console.log(`${request.method} ${url.pathname} ${status}`)
  }

  if (request.method === 'GET' && /^[0-9a-f]{64}$/.test(last)) {
    const file = join(folder, last)
    return existsSync(file) ? answer(200, readFileSync(file)) : answer(404, 'Not here yet.')
  }
  if (request.method !== 'PUT') {
    return answer(405, 'Cards are stored with PUT.')
  }

  const chunks: Buffer[] = []
  request.on('data', (chunk: Buffer) => chunks.push(chunk))
  request.on('end', () => {
    const body = Buffer.concat(chunks)
    if (body.length === 0 || body.length > MAX_BYTES) {
      return answer(body.length === 0 ? 400 : 413, 'A card must be between 1 byte and 400 kB.')
    }
    contentHashOnChain(last)
      .then((expected) => {
        const actual = createHash('sha256').update(body).digest('hex')
        if (!expected) {
          return answer(404, 'There is no card in the post at that address.')
        }
        if (actual !== expected) {
          return answer(409, 'These are not the contents that card was posted with.')
        }
        writeFileSync(join(folder, actual), body)
        return answer(200, actual)
      })
      .catch(() => answer(502, 'Could not reach the local validator.'))
  })
}).listen(PORT, () => console.log(`Local card store on http://localhost:${PORT}, filing in ${folder}`))
