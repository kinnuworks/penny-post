import nacl from 'tweetnacl'
import { decodeCard, encodeCard, type CardContent } from './card'

// A sealed letter. If the reader has a letterbox, the card is encrypted to its
// reading key before it leaves the writer's phone, and only the reader's phone
// can open it. If they have no letterbox yet there is no key to seal to, so
// the card goes as an open postcard, the way a real one would.
//
// Sealed bytes: a marker byte, the writer's one-time public key (32), a nonce
// (24), then the box. A fresh key pair is made for every letter and thrown
// away, so a letter does not say which wallet wrote it.

const SEALED_MARKER = 0x02
const KEY_LENGTH = nacl.box.publicKeyLength
const NONCE_LENGTH = nacl.box.nonceLength
const HEADER_LENGTH = 1 + KEY_LENGTH + NONCE_LENGTH

export interface ReadingKey {
  publicKey: Uint8Array
  secretKey: Uint8Array
}

export function newReadingKey(): ReadingKey {
  return nacl.box.keyPair()
}

/** A letterbox that was opened without a reading key records 32 zero bytes. */
export function isUsableReadingKey(publicKey: Uint8Array): boolean {
  return publicKey.length === KEY_LENGTH && publicKey.some((byte) => byte !== 0)
}

/** The bytes to store and hash: sealed if there is a key to seal to, open if not. */
export function packCard(card: CardContent, readerPublicKey: Uint8Array | null): Uint8Array {
  const plain = encodeCard(card)
  if (!readerPublicKey || !isUsableReadingKey(readerPublicKey)) {
    return plain
  }

  const oneTime = nacl.box.keyPair()
  const nonce = nacl.randomBytes(NONCE_LENGTH)
  const box = nacl.box(plain, nonce, readerPublicKey, oneTime.secretKey)

  const sealed = new Uint8Array(HEADER_LENGTH + box.length)
  sealed[0] = SEALED_MARKER
  sealed.set(oneTime.publicKey, 1)
  sealed.set(nonce, 1 + KEY_LENGTH)
  sealed.set(box, HEADER_LENGTH)
  return sealed
}

export function isSealed(bytes: Uint8Array): boolean {
  return bytes[0] === SEALED_MARKER
}

/**
 * Reads stored bytes back into a card. A sealed letter needs the reader's
 * key. Throws if the letter was sealed to someone else or has been altered.
 */
export function unpackCard(bytes: Uint8Array, readingKey: ReadingKey | null): CardContent {
  if (!isSealed(bytes)) {
    return decodeCard(bytes)
  }
  if (!readingKey) {
    throw new Error('This letter is sealed and this phone has no key for it.')
  }
  if (bytes.length <= HEADER_LENGTH) {
    throw new Error('This letter is damaged and cannot be read.')
  }

  const writerKey = bytes.subarray(1, 1 + KEY_LENGTH)
  const nonce = bytes.subarray(1 + KEY_LENGTH, HEADER_LENGTH)
  const plain = nacl.box.open(bytes.subarray(HEADER_LENGTH), nonce, writerKey, readingKey.secretKey)
  if (!plain) {
    throw new Error('This letter was sealed for a different key, or it has been tampered with.')
  }
  return decodeCard(plain)
}
