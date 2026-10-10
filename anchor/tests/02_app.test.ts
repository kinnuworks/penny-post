import { PENNY_POST_ERROR__PRICE_BELOW_FLOOR } from '../src'
import { type KeyPairSigner } from '@solana/kit'
import { beforeAll, describe, expect, it } from 'vitest'
import { encodeCard, hashCard, type CardContent } from '../../src/features/card/card'
import {
  buildOpenCard,
  buildOpenLetterbox,
  buildPostCard,
  buildReturnCard,
  buildSetLetterbox,
  fetchLetterbox,
  fetchPostOffice,
  fetchSealHeldBy,
  listCardsFrom,
  listCardsTo,
  newCardId,
  priceToReach,
} from '../../src/features/post/chain'
import { errorCodeOf, giveTokens, newWallet, rpc, send, SKR, SKR_MINT, skrBalance } from './harness'

// Drives the program through the same functions the app calls, so the code
// that ships on the phone is what gets tested. It needs the post office that
// 01_program.test.ts opens.

const card: CardContent = {
  version: 1,
  photo: null,
  message: 'Wish you were here. The chai is terrible.',
  strokes: [],
  stampId: 2,
  fromName: null,
  writtenAt: 1_791_590_400,
}

describe('the app, talking to the program', () => {
  let writer: KeyPairSigner
  let reader: KeyPairSigner

  beforeAll(async () => {
    // The validator stalls for about ten seconds between the first file and
    // this one. The cause is not known yet; `hookTimeout` in vitest.config.mts
    // allows for it.
    ;[writer, reader] = await Promise.all([newWallet(), newWallet()])
    await giveTokens(writer.address, SKR_MINT, 100n * SKR)
  })

  it('reads the post office terms', async () => {
    const postOffice = await fetchPostOffice(rpc)
    expect(postOffice?.postageMint).toBe(SKR_MINT)
  })

  it('opens a letterbox and reads it back', async () => {
    expect(await fetchLetterbox(rpc, reader.address)).toBeNull()

    const instructions = await buildOpenLetterbox({
      owner: reader,
      price: 5n * SKR,
      readingKey: new Uint8Array(32).fill(9),
      utcOffsetMinutes: 330,
    })
    await send(reader, instructions)

    const letterbox = await fetchLetterbox(rpc, reader.address)
    expect(letterbox?.price).toBe(5n * SKR)
    // No Genesis Token has been shown, so there is no seal and no free stamp.
    expect(await fetchSealHeldBy(rpc, letterbox!)).toBeNull()
  })

  it("quotes the higher of the floor and the reader's own price", async () => {
    const postOffice = (await fetchPostOffice(rpc))!
    expect(priceToReach(postOffice, await fetchLetterbox(rpc, reader.address))).toBe(5n * SKR)
    expect(priceToReach(postOffice, null)).toBe(postOffice.floorPrice)
  })

  it('posts a card, lists it for both sides, and pays the reader on opening', async () => {
    const contentHash = hashCard(encodeCard(card))
    const { card: address, instructions } = await buildPostCard({
      cardId: newCardId(),
      contentHash,
      express: true,
      postage: 5n * SKR,
      postageMint: SKR_MINT,
      recipient: reader.address,
      sender: writer,
      stamp: card.stampId,
    })
    await send(writer, instructions)

    const inbox = await listCardsTo(rpc, reader.address)
    expect(inbox.map((posted) => posted.address)).toEqual([address])
    expect(new Uint8Array(inbox[0].contentHash)).toEqual(contentHash)
    expect((await listCardsFrom(rpc, writer.address)).map((posted) => posted.address)).toEqual([address])

    // The reader has never held SKR. Opening creates their token account first.
    await send(reader, await buildOpenCard({ card: inbox[0], postageMint: SKR_MINT, recipient: reader }))

    expect(await skrBalance(reader.address)).toBe((5n * SKR * 9n) / 10n)
    expect(await listCardsTo(rpc, reader.address)).toEqual([])
  })

  it('lets the reader send a card back', async () => {
    const before = await skrBalance(writer.address)
    const { instructions } = await buildPostCard({
      cardId: newCardId(),
      contentHash: hashCard(encodeCard(card)),
      express: false,
      postage: 5n * SKR,
      postageMint: SKR_MINT,
      recipient: reader.address,
      sender: writer,
      stamp: card.stampId,
    })
    await send(writer, instructions)

    const [posted] = await listCardsTo(rpc, reader.address)
    await send(reader, await buildReturnCard({ caller: reader, card: posted, postageMint: SKR_MINT }))

    expect(await skrBalance(writer.address)).toBe(before)
    expect(await listCardsFrom(rpc, writer.address)).toEqual([])
  })

  it('lets the reader change their price, and holds them to the floor', async () => {
    const postOffice = (await fetchPostOffice(rpc))!
    const settings = { owner: reader, readingKey: new Uint8Array(32).fill(9), utcOffsetMinutes: 330 }

    await send(reader, await buildSetLetterbox({ ...settings, price: 12n * SKR }))
    const letterbox = await fetchLetterbox(rpc, reader.address)
    expect(letterbox?.price).toBe(12n * SKR)
    expect(priceToReach(postOffice, letterbox)).toBe(12n * SKR)

    const tooLow = await buildSetLetterbox({ ...settings, price: postOffice.floorPrice - 1n })
    expect(await errorCodeOf(send(reader, tooLow))).toBe(PENNY_POST_ERROR__PRICE_BELOW_FLOOR)
    expect((await fetchLetterbox(rpc, reader.address))?.price).toBe(12n * SKR)
  })
})
