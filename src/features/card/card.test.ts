import { describe, expect, it } from 'vitest'
import { decodeCard, emptyCard, encodeCard, hashCard, isBlank, matchesHash, type CardContent } from './card'

const card: CardContent = {
  version: 1,
  photo: null,
  message: 'Wish you were here. The chai is terrible.',
  strokes: ['M10 10 L20 24 Q30 30 40 22'],
  stampId: 2,
  fromName: 'asha.skr',
  writtenAt: 1_791_590_400,
}

describe('encodeCard and decodeCard', () => {
  it('round-trips a card', () => {
    expect(decodeCard(encodeCard(card))).toEqual(card)
  })

  it('gives the same bytes whatever order the fields were set in', () => {
    const shuffled = {
      writtenAt: card.writtenAt,
      fromName: card.fromName,
      stampId: card.stampId,
      strokes: card.strokes,
      message: card.message,
      photo: card.photo,
      version: 1,
    } as CardContent
    expect(encodeCard(shuffled)).toEqual(encodeCard(card))
  })

  it('rejects something that is not a card', () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ version: 2 }))
    expect(() => decodeCard(bytes)).toThrow()
  })

  it('rejects a stroke that carries anything but path commands', () => {
    const bytes = encodeCard({ ...card, strokes: ['M0 0"/><script>'] })
    expect(() => decodeCard(bytes)).toThrow()
  })

  it('cuts an overlong message down to size', () => {
    const long = decodeCard(encodeCard({ ...card, message: 'a'.repeat(1_000) }))
    expect(long.message.length).toBe(280)
  })
})

describe('hashCard', () => {
  it('matches the known SHA-256 of an empty input', () => {
    const hex = Array.from(hashCard(new Uint8Array()), (byte) => byte.toString(16).padStart(2, '0')).join('')
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('accepts the bytes that were hashed and refuses altered ones', () => {
    const bytes = encodeCard(card)
    const hash = hashCard(bytes)
    expect(matchesHash(bytes, hash)).toBe(true)

    const altered = encodeCard({ ...card, message: 'Send money.' })
    expect(matchesHash(altered, hash)).toBe(false)
  })
})

describe('isBlank', () => {
  it('knows an untouched card from a written one', () => {
    expect(isBlank(emptyCard(2))).toBe(true)
    expect(isBlank(card)).toBe(false)
  })
})
