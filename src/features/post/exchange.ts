import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Address } from '@solana/kit'
import { CARD_STORE_URL } from '../../config'
import type { Cluster } from './card-store'

// The pen-pal exchange: send a card to a stranger, and the next stranger's
// card comes to you. See supabase/functions/exchange.

const URL = `${CARD_STORE_URL}/functions/v1/exchange`
const PENDING_KEY = 'penny-post/exchange-pending/v1'

interface Pending {
  card: Address
  cluster: Cluster
}

async function call(action: 'draw' | 'confirm', body: Record<string, string>): Promise<Response> {
  return fetch(`${URL}/${action}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
}

/** The wallet that has waited longest for a card, or null if nobody is waiting. */
export async function drawPenPal(wallet: Address, cluster: Cluster): Promise<Address | null> {
  const response = await call('draw', { cluster, wallet })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`The exchange is not answering (${response.status}).`)
  }
  const { recipient } = (await response.json()) as { recipient: Address }
  return recipient
}

async function readPending(): Promise<Pending[]> {
  try {
    const stored = await AsyncStorage.getItem(PENDING_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? (parsed as Pending[]) : []
  } catch {
    return []
  }
}

/**
 * Remembers a posted card so the exchange can be told about it. The exchange
 * checks the card on-chain itself and ignores any that were not exchange cards.
 */
export async function noteForExchange(card: Address, cluster: Cluster): Promise<void> {
  const pending = (await readPending()).filter((entry) => entry.card !== card)
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...pending, { card, cluster }]))
}

/** Tells the exchange about every remembered card. Anything it cannot reach is kept for next time. */
export async function flushExchange(): Promise<void> {
  const stillPending: Pending[] = []
  for (const entry of await readPending()) {
    try {
      const response = await call('confirm', { card: entry.card, cluster: entry.cluster })
      // 404 means the card is no longer in the post, so there is nothing left to tell.
      if (!response.ok && response.status !== 404) {
        stillPending.push(entry)
      }
    } catch {
      stillPending.push(entry)
    }
  }
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(stillPending))
}
