import { getTransferInstruction } from '@solana-program/token'
import { type Address, type KeyPairSigner } from '@solana/kit'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  findPotVaultPda,
  findSealPda,
  getVerifyLetterboxInstructionAsync,
  PENNY_POST_ERROR__BAD_CHOICE,
  PENNY_POST_ERROR__CIRCULAR_ALREADY_OPEN,
  PENNY_POST_ERROR__CIRCULAR_BAD_QUESTION,
  PENNY_POST_ERROR__CIRCULAR_BID_TOO_LOW,
  PENNY_POST_ERROR__CIRCULAR_DAY_PASSED,
  PENNY_POST_ERROR__CIRCULAR_NOT_FINISHED,
  PENNY_POST_ERROR__CIRCULAR_NOT_OPEN,
  PENNY_POST_ERROR__CIRCULAR_POT_TOO_LOW,
  PENNY_POST_ERROR__CIRCULAR_STILL_OPEN,
  PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD,
  PENNY_POST_ERROR__SEAL_NOT_YOURS,
} from '../src'
import {
  buildAnswerCircular,
  buildCloseCircular,
  buildCollectCircular,
  buildPostCircular,
  closesAt,
  fetchAnswer,
  fetchCircular,
  shareAfterBurn,
  smallestOutbid,
  smallestPot,
  utcDay,
} from '../../src/features/circular/circular-chain'
import { buildOpenLetterbox, fetchPostOffice } from '../../src/features/post/chain'
import {
  accountExists,
  errorCodeOf,
  giveTokens,
  newWallet,
  rpc,
  send,
  SKR,
  SKR_MINT,
  skrBalance,
  skrSupply,
  TOKEN_2022_PROGRAM_ADDRESS,
  tokenAccountOf,
  travelTo,
  validatorTime,
} from './harness'

// The circular: one question a day for every Seeker, paid for by whoever asks.
// Shares can only be collected once the day has closed, so these tests move
// the validator's clock forward too, and run after the others.

// Three more real Genesis Token mints, read from mainnet on 2026-10-12. The
// fork can place any of them in a test wallet.
const GENESIS_TOKENS = [
  'H51yfxZSKHSt6TFv1AGbNktEWs6pKJSWsYkr5iSe5JUN',
  '4nCRMrxjBWbj5JfHA13kvNQXdtxi536vWo9XMcARdK7m',
  'AidS6DbfATThb3tFzDvHvdNGbCcZJFBxjLqTQ9H1j8ru',
] as Address[]
const LATE_GENESIS_TOKEN = 'GGFCLuha5nCW1NoDv3iVymDgPM5d6yR7nG775XYU3pbd' as Address

const QUESTION = 'Tea or coffee, first thing?'
const OPTIONS = ['Tea', 'Coffee']

interface Phone {
  seal: Address
  sgtMint: Address
  sgtToken: Address
  wallet: KeyPairSigner
}

describe('the circular', () => {
  let sponsor: KeyPairSigner
  let rival: KeyPairSigner
  let phones: Phone[]
  let latecomer: Phone
  let today: number

  /** A wallet with a letterbox that holds one real Genesis Token and has shown it to the program. */
  async function aPhone(sgtMint: Address): Promise<Phone> {
    const wallet = await newWallet()
    await send(
      wallet,
      await buildOpenLetterbox({
        owner: wallet,
        price: 5n * SKR,
        readingKey: new Uint8Array(32).fill(4),
        utcOffsetMinutes: 0,
      }),
    )
    await giveTokens(wallet.address, sgtMint, 1n, TOKEN_2022_PROGRAM_ADDRESS)
    const sgtToken = await tokenAccountOf(wallet.address, sgtMint, TOKEN_2022_PROGRAM_ADDRESS)
    await send(wallet, [await getVerifyLetterboxInstructionAsync({ owner: wallet, sgtMint, sgtToken })])
    const [seal] = await findSealPda({ sgtMint })
    return { seal, sgtMint, sgtToken, wallet }
  }

  function ask(by: KeyPairSigner, day: number, pot: bigint, extra: { outbid?: Address; options?: string[] } = {}) {
    return buildPostCircular({
      day,
      options: extra.options ?? OPTIONS,
      outbid: extra.outbid,
      postageMint: SKR_MINT,
      pot,
      question: QUESTION,
      sponsor: by,
    })
  }

  async function answer(phone: Phone, day: number, choice: number, sgtToken = phone.sgtToken) {
    const circular = (await fetchCircular(rpc, day))!
    return buildAnswerCircular({
      answerer: phone.wallet,
      choice,
      circular: circular.address,
      seal: phone.seal,
      sgtMint: phone.sgtMint,
      sgtToken,
    })
  }

  async function collect(phone: Phone, day: number) {
    const circular = (await fetchCircular(rpc, day))!
    return buildCollectCircular({
      answerer: phone.wallet,
      circular: circular.address,
      postageMint: SKR_MINT,
      sgtMint: phone.sgtMint,
    })
  }

  beforeAll(async () => {
    ;[sponsor, rival] = await Promise.all([newWallet(), newWallet()])
    await giveTokens(sponsor.address, SKR_MINT, 10_000n * SKR)
    await giveTokens(rival.address, SKR_MINT, 10_000n * SKR)
    phones = []
    for (const sgtMint of GENESIS_TOKENS) {
      phones.push(await aPhone(sgtMint))
    }
    latecomer = await aPhone(LATE_GENESIS_TOKEN)
    today = utcDay(Number(await validatorTime()))
  })

  it('will not take a day that has gone, a thin pot, or a question nobody could answer', async () => {
    const floor = smallestPot((await fetchPostOffice(rpc))!)

    expect(await errorCodeOf(send(sponsor, await ask(sponsor, today - 1, floor)))).toBe(
      PENNY_POST_ERROR__CIRCULAR_DAY_PASSED,
    )
    expect(await errorCodeOf(send(sponsor, await ask(sponsor, today, floor - 1n)))).toBe(
      PENNY_POST_ERROR__CIRCULAR_POT_TOO_LOW,
    )
    expect(await errorCodeOf(send(sponsor, await ask(sponsor, today, floor, { options: ['Tea'] })))).toBe(
      PENNY_POST_ERROR__CIRCULAR_BAD_QUESTION,
    )
  })

  it('puts a question to every Seeker for the day and holds the pot', async () => {
    const before = await skrBalance(sponsor.address)
    // A pot that does not divide by three, so the rounding has somewhere to show.
    const pot = 100n * SKR + 1n
    await send(sponsor, await ask(sponsor, today, pot))

    const circular = (await fetchCircular(rpc, today))!
    expect(circular.question).toBe(QUESTION)
    expect(circular.options).toEqual(OPTIONS)
    expect(circular.pot).toBe(pot)
    expect(circular.sponsor).toBe(sponsor.address)
    expect(circular.answers).toBe(0)
    expect(await skrBalance(sponsor.address)).toBe(before - pot)
  })

  it('will not replace a question that is already open, whatever is offered', async () => {
    const attempt = ask(rival, today, 1_000n * SKR, { outbid: sponsor.address })
    expect(await errorCodeOf(send(rival, await attempt))).toBe(PENNY_POST_ERROR__CIRCULAR_ALREADY_OPEN)
  })

  it('takes one answer from each phone', async () => {
    const [first, second, third] = phones
    await send(first.wallet, await answer(first, today, 0))
    await send(second.wallet, await answer(second, today, 1))
    await send(third.wallet, await answer(third, today, 1))

    const circular = (await fetchCircular(rpc, today))!
    expect(circular.answers).toBe(3)
    expect(circular.tallies.slice(0, 2)).toEqual([1, 2])
    expect((await fetchAnswer(rpc, circular.address, first.sgtMint))?.choice).toBe(0)

    // A second answer from the same Genesis Token has nowhere to go.
    await expect(send(first.wallet, await answer(first, today, 1))).rejects.toThrow()
    expect((await fetchCircular(rpc, today))!.answers).toBe(3)
  })

  it('will not count a wallet that cannot show the token', async () => {
    // The latecomer has not answered yet, so nothing but these checks stands in the way.
    const outsider: Phone = { ...latecomer, wallet: await newWallet() }

    // Another wallet pointing at somebody's seal.
    expect(await errorCodeOf(send(outsider.wallet, await answer(outsider, today, 0)))).toBe(
      PENNY_POST_ERROR__SEAL_NOT_YOURS,
    )
    // The right wallet and seal, showing somebody else's token account.
    const borrowed = answer(latecomer, today, 0, phones[1].sgtToken)
    expect(await errorCodeOf(send(latecomer.wallet, await borrowed))).toBe(PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD)
  })

  it('will not take an answer that is not on the card', async () => {
    const attempt = answer(latecomer, today, 2)
    expect(await errorCodeOf(send(latecomer.wallet, await attempt))).toBe(PENNY_POST_ERROR__BAD_CHOICE)
  })

  it('pays nothing out while the question is open', async () => {
    expect(await errorCodeOf(send(phones[0].wallet, await collect(phones[0], today)))).toBe(
      PENNY_POST_ERROR__CIRCULAR_STILL_OPEN,
    )
    const circular = (await fetchCircular(rpc, today))!
    const close = await buildCloseCircular({ caller: rival, circular, postageMint: SKR_MINT })
    expect(await errorCodeOf(send(rival, close))).toBe(PENNY_POST_ERROR__CIRCULAR_STILL_OPEN)
  })

  it('lets a larger pot take a day that has not begun, and pays the first sponsor back', async () => {
    const day = today + 3
    const before = await skrBalance(sponsor.address)
    await send(sponsor, await ask(sponsor, day, 200n * SKR))
    const held = (await fetchCircular(rpc, day))!

    // A tenth more is the least that will do.
    const tooLittle = ask(rival, day, smallestOutbid(held) - 1n, { outbid: sponsor.address })
    expect(await errorCodeOf(send(rival, await tooLittle))).toBe(PENNY_POST_ERROR__CIRCULAR_BID_TOO_LOW)

    await send(rival, await ask(rival, day, smallestOutbid(held), { outbid: sponsor.address }))
    const taken = (await fetchCircular(rpc, day))!
    expect(taken.sponsor).toBe(rival.address)
    expect(taken.pot).toBe(220n * SKR)
    expect(await skrBalance(sponsor.address)).toBe(before)
  })

  it('shares the pot equally once the day closes, burns a tenth, and sweeps the rounding', async () => {
    await travelTo(BigInt(closesAt(today)) + 60n)

    const circular = (await fetchCircular(rpc, today))!
    const each = shareAfterBurn(circular)
    // 100.000001 SKR between three: 33.333333 each, 3.333333 of it burned.
    expect(each).toBe(30_000_000n)
    const supplyBefore = await skrSupply()

    for (const phone of phones) {
      // None of these wallets has held SKR before. Collecting makes the account.
      await send(phone.wallet, await collect(phone, today))
      expect(await skrBalance(phone.wallet.address)).toBe(each)
      expect(await fetchAnswer(rpc, circular.address, phone.sgtMint)).toBeNull()
    }

    // Everything that was not paid out is gone from the supply, the stray base units included.
    expect(await skrSupply()).toBe(supplyBefore - (circular.pot - 3n * each))
    expect((await fetchCircular(rpc, today))!.collected).toBe(3)
  })

  it('takes no answers after the day has closed', async () => {
    // This phone never answered, so only the clock stands in its way.
    const attempt = answer(latecomer, today, 0)
    expect(await errorCodeOf(send(latecomer.wallet, await attempt))).toBe(PENNY_POST_ERROR__CIRCULAR_NOT_OPEN)
  })

  it('can be cleared away by anyone once every share is collected, with the rent going to the sponsor', async () => {
    const circular = (await fetchCircular(rpc, today))!
    await send(rival, await buildCloseCircular({ caller: rival, circular, postageMint: SKR_MINT }))
    expect(await accountExists(circular.address)).toBe(false)
  })

  it('cannot be cleared away while a phone has still to collect', async () => {
    const day = utcDay(Number(await validatorTime()))
    await send(sponsor, await ask(sponsor, day, 100n * SKR))
    await send(phones[0].wallet, await answer(phones[0], day, 0))
    await send(phones[1].wallet, await answer(phones[1], day, 1))
    await travelTo(BigInt(closesAt(day)) + 60n)
    await send(phones[0].wallet, await collect(phones[0], day))

    const circular = (await fetchCircular(rpc, day))!
    const close = await buildCloseCircular({ caller: sponsor, circular, postageMint: SKR_MINT })
    expect(await errorCodeOf(send(sponsor, close))).toBe(PENNY_POST_ERROR__CIRCULAR_NOT_FINISHED)

    // A stranger's tokens in the vault do not get in the way of the last share.
    const [vault] = await findPotVaultPda({ circular: circular.address })
    await send(rival, [
      getTransferInstruction({
        amount: 7n,
        authority: rival,
        destination: vault,
        source: await tokenAccountOf(rival.address),
      }),
    ])
    await send(phones[1].wallet, await collect(phones[1], day))
    await send(sponsor, await buildCloseCircular({ caller: sponsor, circular, postageMint: SKR_MINT }))
    expect(await accountExists(vault)).toBe(false)
  })

  it('gives the pot back when nobody answered', async () => {
    const day = utcDay(Number(await validatorTime()))
    const before = await skrBalance(sponsor.address)
    await send(sponsor, await ask(sponsor, day, 150n * SKR))
    expect(await skrBalance(sponsor.address)).toBe(before - 150n * SKR)

    await travelTo(BigInt(closesAt(day)) + 60n)
    const circular = (await fetchCircular(rpc, day))!
    await send(rival, await buildCloseCircular({ caller: rival, circular, postageMint: SKR_MINT }))

    expect(await skrBalance(sponsor.address)).toBe(before)
    expect(await accountExists(circular.address)).toBe(false)
  })
})
