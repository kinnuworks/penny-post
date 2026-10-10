import type { Address } from '@solana/kit'
import { CARD_STORE_URL } from '../../config'
import { matchesHash } from '../card/card'

export type Cluster = 'devnet' | 'mainnet'

/** The store refused for good: retrying the same bytes will not help. */
export class CardRefused extends Error {}

/**
 * Hands a posted card's contents to the store. The store checks them against
 * the card's on-chain hash, so this only works once the card is confirmed.
 */
export async function uploadCard(card: Address, bytes: Uint8Array, cluster: Cluster): Promise<void> {
  const response = await fetch(`${CARD_STORE_URL}/functions/v1/cards/${card}?cluster=${cluster}`, {
    // A copy of exactly these bytes, as a plain buffer, which every fetch accepts as a body.
    body: bytes.slice().buffer,
    headers: { 'content-type': 'application/octet-stream' },
    method: 'PUT',
  })
  if (response.ok) {
    return
  }
  // 404: no such card on-chain. 409: wrong contents. 413: too large. None of these change on retry.
  if (response.status === 404 || response.status === 409 || response.status === 413) {
    throw new CardRefused(`The card store refused this card (${response.status}).`)
  }
  throw new Error(`The card store is not answering (${response.status}).`)
}

/**
 * Fetches a card's stored bytes by hash and checks them. Returns null if the
 * writer's phone has not delivered them to the store yet.
 */
export async function downloadCard(contentHash: Uint8Array): Promise<Uint8Array | null> {
  const response = await fetch(`${CARD_STORE_URL}/storage/v1/object/public/cards/${toHex(contentHash)}`)
  if (response.status === 400 || response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`The card store is not answering (${response.status}).`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  // The store is not trusted. What it returns must hash to what the chain recorded.
  if (!matchesHash(bytes, contentHash)) {
    throw new Error('The card store returned something other than this card.')
  }
  return bytes
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
