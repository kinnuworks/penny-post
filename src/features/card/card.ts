import { sha256 } from '@noble/hashes/sha2.js'

/** Handwriting is drawn in this box and scaled to wherever the card is shown. */
export const WRITING_BOX = { width: 260, height: 300 } as const

export const MAX_MESSAGE_LENGTH = 280
export const MAX_STROKES = 400

/** What a card says. This is what gets stored off-chain and hashed on-chain. */
export interface CardContent {
  version: 1
  /** Base64 JPEG for the picture side, or null for a plain front. */
  photo: string | null
  /** Typed message. Empty when the card is handwritten only. */
  message: string
  /** Handwriting, as SVG path data inside WRITING_BOX. */
  strokes: string[]
  stampId: number
  /** The sender's .skr name, if they have one. Shown as the return address. */
  fromName: string | null
  /** Unix seconds. */
  writtenAt: number
}

export function emptyCard(stampId: number): CardContent {
  return { version: 1, photo: null, message: '', strokes: [], stampId, fromName: null, writtenAt: 0 }
}

export function isBlank(card: CardContent): boolean {
  return card.photo === null && card.message.trim().length === 0 && card.strokes.length === 0
}

/**
 * The exact bytes that are stored and hashed. Keys are written in a fixed
 * order so the same card always produces the same hash on any phone.
 */
export function encodeCard(card: CardContent): Uint8Array {
  const ordered = {
    version: card.version,
    photo: card.photo,
    message: card.message,
    strokes: card.strokes,
    stampId: card.stampId,
    fromName: card.fromName,
    writtenAt: card.writtenAt,
  }
  return new TextEncoder().encode(JSON.stringify(ordered))
}

/** Reads stored bytes back into a card, rejecting anything that is not one. */
export function decodeCard(bytes: Uint8Array): CardContent {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error('This is not a card we know how to read.')
  }
  const { fromName, message, photo, stampId, strokes, writtenAt } = parsed
  if (
    (photo !== null && typeof photo !== 'string') ||
    typeof message !== 'string' ||
    !Array.isArray(strokes) ||
    !strokes.every((stroke) => typeof stroke === 'string' && isPathData(stroke)) ||
    typeof stampId !== 'number' ||
    (fromName !== null && typeof fromName !== 'string') ||
    typeof writtenAt !== 'number'
  ) {
    throw new Error('This card is damaged and cannot be read.')
  }
  return {
    version: 1,
    photo,
    message: message.slice(0, MAX_MESSAGE_LENGTH),
    strokes: strokes.slice(0, MAX_STROKES),
    stampId,
    fromName,
    writtenAt,
  }
}

/** SHA-256 of the stored bytes. This is the `content_hash` the program records. */
export function hashCard(bytes: Uint8Array): Uint8Array {
  return sha256(bytes)
}

/** True if a card fetched from storage is the one the chain says was posted. */
export function matchesHash(bytes: Uint8Array, expected: Uint8Array): boolean {
  const actual = hashCard(bytes)
  if (actual.length !== expected.length) {
    return false
  }
  let difference = 0
  for (let i = 0; i < actual.length; i++) {
    difference |= actual[i] ^ expected[i]
  }
  return difference === 0
}

// A stroke comes from a stranger, and it is handed to an SVG renderer. Only
// plain move, line and curve commands with numbers are let through.
function isPathData(value: string): boolean {
  return value.length <= 20_000 && /^[MLQ0-9 .,-]*$/.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
