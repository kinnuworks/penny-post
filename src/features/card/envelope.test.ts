import { describe, expect, it } from 'vitest'
import { encodeCard, type CardContent } from './card'
import { isSealed, isUsableReadingKey, newReadingKey, packCard, unpackCard } from './envelope'

const card: CardContent = {
  version: 1,
  photo: null,
  message: 'Burn after reading.',
  strokes: [],
  stampId: 2,
  fromName: 'asha.skr',
  writtenAt: 1_791_590_400,
}

describe('packCard and unpackCard', () => {
  it('seals a card to the reader and opens it with their key', () => {
    const reader = newReadingKey()
    const sealed = packCard(card, reader.publicKey)

    expect(isSealed(sealed)).toBe(true)
    expect(unpackCard(sealed, reader)).toEqual(card)
  })

  it('does not leave the message readable in the sealed bytes', () => {
    const sealed = packCard(card, newReadingKey().publicKey)
    expect(new TextDecoder().decode(sealed)).not.toContain('Burn after reading')
  })

  it('seals differently every time, so two letters cannot be matched', () => {
    const reader = newReadingKey()
    expect(packCard(card, reader.publicKey)).not.toEqual(packCard(card, reader.publicKey))
  })

  it('will not open for anyone but the reader', () => {
    const sealed = packCard(card, newReadingKey().publicKey)
    expect(() => unpackCard(sealed, newReadingKey())).toThrow()
    expect(() => unpackCard(sealed, null)).toThrow()
  })

  it('will not open a letter that was altered on the way', () => {
    const reader = newReadingKey()
    const sealed = packCard(card, reader.publicKey)
    sealed[sealed.length - 1] ^= 1
    expect(() => unpackCard(sealed, reader)).toThrow()
  })

  it('will not open a letter cut short', () => {
    const reader = newReadingKey()
    const sealed = packCard(card, reader.publicKey)
    expect(() => unpackCard(sealed.subarray(0, 40), reader)).toThrow()
  })

  it('sends an open postcard when the reader has no key', () => {
    const open = packCard(card, null)
    expect(isSealed(open)).toBe(false)
    expect(open).toEqual(encodeCard(card))
    expect(unpackCard(open, null)).toEqual(card)
  })

  it('treats an all-zero key as no key', () => {
    const zeros = new Uint8Array(32)
    expect(isUsableReadingKey(zeros)).toBe(false)
    expect(isSealed(packCard(card, zeros))).toBe(false)
  })
})
