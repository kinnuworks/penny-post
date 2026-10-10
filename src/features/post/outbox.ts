import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Address } from '@solana/kit'
import { fromUint8Array, toUint8Array } from '@wallet-ui/react-native-kit'
import { CardRefused, uploadCard, type Cluster } from './card-store'

// A card's contents are written here before the wallet is asked to sign, and
// removed once the store has them. If the app is closed or the network drops
// between the signature and the upload, the card is still on this phone and
// goes out the next time the app opens.
//
// The list of waiting cards and each card's bytes are stored separately,
// because Android caps how big one stored item can be.

const INDEX_KEY = 'penny-post/outbox/v1'
const bytesKey = (card: Address) => `penny-post/outbox/v1/${card}`
/** A card that was never confirmed on-chain is dropped after this long. */
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000

interface Waiting {
  card: Address
  cluster: Cluster
  since: number
}

async function readIndex(): Promise<Waiting[]> {
  try {
    const stored = await AsyncStorage.getItem(INDEX_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? (parsed as Waiting[]) : []
  } catch {
    return []
  }
}

export async function keepForUpload(card: Address, bytes: Uint8Array, cluster: Cluster): Promise<void> {
  await AsyncStorage.setItem(bytesKey(card), fromUint8Array(bytes))
  const others = (await readIndex()).filter((entry) => entry.card !== card)
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify([...others, { card, cluster, since: Date.now() }]))
}

export async function forget(card: Address): Promise<void> {
  const others = (await readIndex()).filter((entry) => entry.card !== card)
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(others))
  await AsyncStorage.removeItem(bytesKey(card))
}

/**
 * Tries to deliver everything that is waiting. Returns how many are still
 * waiting afterwards. Safe to call often.
 */
export async function flushOutbox(now = Date.now()): Promise<number> {
  let stillWaiting = 0

  for (const entry of await readIndex()) {
    const stored = await AsyncStorage.getItem(bytesKey(entry.card))
    if (!stored) {
      await forget(entry.card)
      continue
    }
    try {
      await uploadCard(entry.card, toUint8Array(stored), entry.cluster)
      await forget(entry.card)
    } catch (error) {
      // A refusal means the card is not on-chain: either the transaction never
      // landed, or the card has already been opened or returned. Keep it for a
      // day in case the transaction is only slow, then let it go.
      if (error instanceof CardRefused && now - entry.since > GIVE_UP_AFTER_MS) {
        await forget(entry.card)
      } else {
        stillWaiting += 1
      }
    }
  }

  return stillWaiting
}
