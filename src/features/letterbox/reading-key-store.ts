import type { Address } from '@solana/kit'
import { fromUint8Array, toUint8Array } from '@wallet-ui/react-native-kit'
import * as SecureStore from 'expo-secure-store'
import nacl from 'tweetnacl'
import { newReadingKey, type ReadingKey } from '../card/envelope'

// The key that opens sealed letters. It is made on this phone, kept in the
// phone's secure storage, and never leaves it: only the public half is
// published, in the letterbox account.
//
// It is deliberately not derived from a wallet signature. A derived key could
// be recreated by any app that got the same message signed. The cost is that a
// new phone means a new key, and sealed letters not yet opened on the old
// phone cannot be read on the new one.

function slot(owner: Address): string {
  return `penny-post.reading-key.${owner}`
}

export async function loadReadingKey(owner: Address): Promise<ReadingKey | null> {
  const stored = await SecureStore.getItemAsync(slot(owner))
  if (!stored) {
    return null
  }
  const secretKey = toUint8Array(stored)
  if (secretKey.length !== nacl.box.secretKeyLength) {
    return null
  }
  return nacl.box.keyPair.fromSecretKey(secretKey)
}

/** The reading key for this wallet on this phone, made now if there is none. */
export async function loadOrCreateReadingKey(owner: Address): Promise<ReadingKey> {
  const existing = await loadReadingKey(owner)
  if (existing) {
    return existing
  }
  const created = newReadingKey()
  await SecureStore.setItemAsync(slot(owner), fromUint8Array(created.secretKey))
  return created
}
