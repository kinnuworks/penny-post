import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Address } from '@solana/kit'
import type { CardContent } from '../card/card'

// Cards the reader has opened. Once a card is opened its account on-chain is
// closed, so this phone is where the reader's copy lives.
//
// A card with a picture is large, and Android caps how big one stored item can
// be. So the list of kept cards and each card's contents are stored separately.

export interface KeptEntry {
  card: Address
  from: Address
  openedAt: number
  /** Postage the reader was paid, in base units, as a decimal string. */
  paid: string
}

export interface KeptCard extends KeptEntry {
  content: CardContent
}

const indexKey = (owner: Address) => `penny-post/kept/v1/${owner}`
const cardKey = (owner: Address, card: Address) => `penny-post/kept/v1/${owner}/${card}`

/** Every card this wallet has kept, newest first, without their contents. */
export async function listKept(owner: Address): Promise<KeptEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(indexKey(owner))
    const parsed: unknown = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? (parsed as KeptEntry[]) : []
  } catch {
    return []
  }
}

export async function loadKept(owner: Address, card: Address): Promise<CardContent | null> {
  try {
    const stored = await AsyncStorage.getItem(cardKey(owner, card))
    return stored ? (JSON.parse(stored) as CardContent) : null
  } catch {
    return null
  }
}

export async function keep(owner: Address, kept: KeptCard): Promise<void> {
  const { content, ...entry } = kept
  // Contents first: an entry in the list must never point at a card that is not there.
  await AsyncStorage.setItem(cardKey(owner, entry.card), JSON.stringify(content))
  const others = (await listKept(owner)).filter((existing) => existing.card !== entry.card)
  await AsyncStorage.setItem(indexKey(owner), JSON.stringify([entry, ...others]))
}
