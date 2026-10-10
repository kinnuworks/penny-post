import { type Address, type KeyPairSigner } from '@solana/kit'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  fetchCard,
  findSealPda,
  getVerifyLetterboxInstructionAsync,
  PENNY_POST_ERROR__NOT_DELIVERED_YET,
  PENNY_POST_ERROR__NOT_EXPIRED_YET,
  PENNY_POST_ERROR__STAMP_ALREADY_USED,
} from '../src'
import {
  buildOpenCard,
  buildOpenLetterbox,
  buildPostCard,
  buildReturnCard,
  listCardsTo,
  newCardId,
} from '../../src/features/post/chain'
import {
  accountExists,
  errorCodeOf,
  giveTokens,
  newWallet,
  REAL_SGT_MINT,
  rpc,
  send,
  SKR,
  SKR_MINT,
  skrBalance,
  TOKEN_2022_PROGRAM_ADDRESS,
  tokenAccountOf,
  travelTo,
  validatorTime,
} from './harness'

// Everything that depends on the time of day. These tests move the validator's
// clock forward and it cannot go back, so this file runs last.

const KOLKATA = 330
const SECONDS_PER_DAY = 86_400n
const CONTENT_HASH = new Uint8Array(32).fill(3)

describe('the clock', () => {
  let writer: KeyPairSigner
  let reader: KeyPairSigner
  let stranger: KeyPairSigner
  let seeker: KeyPairSigner
  let seal: Address

  beforeAll(async () => {
    ;[writer, reader, stranger, seeker] = await Promise.all([newWallet(), newWallet(), newWallet(), newWallet()])
    await giveTokens(writer.address, SKR_MINT, 100n * SKR)

    for (const owner of [reader, seeker]) {
      await send(
        owner,
        await buildOpenLetterbox({
          owner,
          price: 5n * SKR,
          readingKey: new Uint8Array(32).fill(2),
          utcOffsetMinutes: KOLKATA,
        }),
      )
    }

    // The Genesis Token's seal was used earlier today by the first test file.
    // Here it arrives in a new wallet, which inherits that used stamp.
    await giveTokens(seeker.address, REAL_SGT_MINT, 1n, TOKEN_2022_PROGRAM_ADDRESS)
    const verify = await getVerifyLetterboxInstructionAsync({
      owner: seeker,
      sgtMint: REAL_SGT_MINT,
      sgtToken: await tokenAccountOf(seeker.address, REAL_SGT_MINT, TOKEN_2022_PROGRAM_ADDRESS),
    })
    await send(seeker, [verify])
    ;[seal] = await findSealPda({ sgtMint: REAL_SGT_MINT })
  })

  function post(from: KeyPairSigner, postage: bigint, withSeal = false) {
    return buildPostCard({
      cardId: newCardId(),
      contentHash: CONTENT_HASH,
      express: false,
      postage,
      postageMint: SKR_MINT,
      recipient: reader.address,
      seal: withSeal ? seal : undefined,
      sender: from,
      stamp: 1,
    })
  }

  it('holds a card until eight in the morning where the reader lives', async () => {
    const { card, instructions } = await post(writer, 5n * SKR)
    await send(writer, instructions)

    const { data } = await fetchCard(rpc, card)
    const localSecondOfDay = (data.deliverAt + BigInt(KOLKATA * 60)) % SECONDS_PER_DAY
    expect(localSecondOfDay).toBe(8n * 3_600n)
    expect(data.deliverAt).toBeGreaterThan(data.postedAt)
    expect(data.deliverAt - data.postedAt).toBeLessThanOrEqual(SECONDS_PER_DAY)
    expect(data.expiresAt).toBe(data.deliverAt + 7n * SECONDS_PER_DAY)

    const [posted] = await listCardsTo(rpc, reader.address)
    const open = await buildOpenCard({ card: posted, postageMint: SKR_MINT, recipient: reader })
    expect(await errorCodeOf(send(reader, open))).toBe(PENNY_POST_ERROR__NOT_DELIVERED_YET)

    await travelTo(data.deliverAt + 60n)
    await send(reader, open)
    expect(await accountExists(card)).toBe(false)
    expect(await skrBalance(reader.address)).toBe((5n * SKR * 9n) / 10n)
  })

  it('gives the seal a fresh stamp each UTC day, and only one', async () => {
    const now = await validatorTime()
    await travelTo((now / SECONDS_PER_DAY + 1n) * SECONDS_PER_DAY + 60n)

    const { card, instructions } = await post(seeker, 0n, true)
    await send(seeker, instructions)

    const again = await post(seeker, 0n, true)
    expect(await errorCodeOf(send(seeker, again.instructions))).toBe(PENNY_POST_ERROR__STAMP_ALREADY_USED)

    // A free card carries no postage, so opening it involves no token account at all.
    const { data } = await fetchCard(rpc, card)
    await travelTo(data.deliverAt + 60n)
    const posted = (await listCardsTo(rpc, reader.address)).find((entry) => entry.address === card)!
    const open = await buildOpenCard({ card: posted, postageMint: SKR_MINT, recipient: reader })
    expect(open).toHaveLength(1)
    await send(reader, open)
    expect(await accountExists(card)).toBe(false)
  })

  it('goes back to its sender after a week, and anyone can carry it', async () => {
    const before = await skrBalance(writer.address)
    const { card, instructions } = await post(writer, 5n * SKR)
    await send(writer, instructions)
    const { data } = await fetchCard(rpc, card)
    const posted = (await listCardsTo(rpc, reader.address)).find((entry) => entry.address === card)!

    const carry = await buildReturnCard({ caller: stranger, card: posted, postageMint: SKR_MINT })
    expect(await errorCodeOf(send(stranger, carry))).toBe(PENNY_POST_ERROR__NOT_EXPIRED_YET)

    await travelTo(data.expiresAt + 60n)
    await send(stranger, carry)

    expect(await skrBalance(writer.address)).toBe(before)
    expect(await accountExists(card)).toBe(false)
  })
})
