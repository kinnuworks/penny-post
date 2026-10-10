import { getCreateAssociatedTokenIdempotentInstructionAsync, getTransferInstruction } from '@solana-program/token'
import { type Address, type KeyPairSigner } from '@solana/kit'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  fetchCard,
  fetchLetterbox,
  fetchPostOffice,
  fetchSeal,
  findCardPda,
  findLetterboxPda,
  findSealPda,
  findVaultPda,
  getOpenCardInstructionAsync,
  getOpenLetterboxInstructionAsync,
  getOpenPostOfficeInstructionAsync,
  getPostCardInstructionAsync,
  getReturnCardInstructionAsync,
  getSetLetterboxInstructionAsync,
  getSetTermsInstructionAsync,
  getVerifyLetterboxInstructionAsync,
  PENNY_POST_ERROR__BURN_SHARE_TOO_HIGH,
  PENNY_POST_ERROR__EXPRESS_FEE_TOO_HIGH,
  PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD,
  PENNY_POST_ERROR__LETTERBOX_FULL,
  PENNY_POST_ERROR__NO_SEAL,
  PENNY_POST_ERROR__NOT_DELIVERED_YET,
  PENNY_POST_ERROR__NOT_EXPIRED_YET,
  PENNY_POST_ERROR__NOT_GENESIS_TOKEN,
  PENNY_POST_ERROR__NOT_UPGRADE_AUTHORITY,
  PENNY_POST_ERROR__POSTAGE_TOO_LOW,
  PENNY_POST_ERROR__PRICE_BELOW_FLOOR,
  PENNY_POST_ERROR__SEAL_NOT_YOURS,
  PENNY_POST_ERROR__SELF_ADDRESSED,
  PENNY_POST_ERROR__STAMP_ALREADY_USED,
} from '../src'
import { createFundedSigner } from './create-funded-signer'
import {
  accountExists,
  errorCodeOf,
  freshCardId,
  giveTokens,
  loadDeployer,
  programDataAddress,
  REAL_SGT_MINT,
  rpc,
  rpcSubscriptions,
  send,
  SGT_GROUP,
  SGT_MINT_AUTHORITY,
  SKR,
  SKR_MINT,
  skrBalance,
  skrSupply,
  TOKEN_2022_PROGRAM_ADDRESS,
  tokenAccountOf,
  validatorTime,
} from './harness'

// Anchor's own code for a failed `has_one` check.
const ANCHOR_HAS_ONE = 2001

const TERMS = { burnBps: 1_000, expressFee: 2n * SKR, floorPrice: 1n * SKR }
const READER_PRICE = 5n * SKR
const KOLKATA = 330
const CONTENT_HASH = new Uint8Array(32).fill(7)
const PILLAR_BOX = 2

describe('penny_post', () => {
  let admin: KeyPairSigner
  let sender: KeyPairSigner
  let reader: KeyPairSigner
  let stranger: KeyPairSigner
  let senderToken: Address

  beforeAll(async () => {
    admin = await loadDeployer()
    ;[sender, reader, stranger] = await Promise.all([
      createFundedSigner({ rpc, rpcSubscriptions }),
      createFundedSigner({ rpc, rpcSubscriptions }),
      createFundedSigner({ rpc, rpcSubscriptions }),
    ])
    await giveTokens(sender.address, SKR_MINT, 1_000n * SKR)
    await giveTokens(stranger.address, SKR_MINT, 10n * SKR)
    senderToken = await tokenAccountOf(sender.address)
  })

  // --- helpers ---------------------------------------------------------------

  async function openLetterbox(owner: KeyPairSigner, price = READER_PRICE) {
    const instruction = await getOpenLetterboxInstructionAsync({
      owner,
      price,
      readingKey: new Uint8Array(32).fill(1),
      utcOffsetMinutes: KOLKATA,
    })
    await send(owner, [instruction])
  }

  /** A new reader with a letterbox, for tests that should not share the daily limit with others. */
  async function freshReader(utcOffsetMinutes = KOLKATA) {
    const owner = await createFundedSigner({ rpc, rpcSubscriptions })
    const instruction = await getOpenLetterboxInstructionAsync({
      owner,
      price: READER_PRICE,
      readingKey: new Uint8Array(32).fill(1),
      utcOffsetMinutes,
    })
    await send(owner, [instruction])
    return owner
  }

  async function postCard(options: {
    express?: boolean
    from?: KeyPairSigner
    maxExpressFee?: bigint
    postage: bigint
    seal?: Address
    sgtToken?: Address
    to: Address
    token?: Address
  }) {
    const from = options.from ?? sender
    const cardId = freshCardId()
    const instruction = await getPostCardInstructionAsync({
      cardId,
      contentHash: CONTENT_HASH,
      express: options.express ?? false,
      maxExpressFee: options.maxExpressFee ?? TERMS.expressFee,
      postage: options.postage,
      postageMint: SKR_MINT,
      recipient: options.to,
      sender: from,
      senderSeal: options.seal,
      sgtToken: options.sgtToken,
      senderToken: options.token ?? (from === sender ? senderToken : undefined),
      stamp: PILLAR_BOX,
    })
    await send(from, [instruction])
    const [card] = await findCardPda({ cardId, sender: from.address })
    const [vault] = await findVaultPda({ card })
    return { card, vault }
  }

  async function openCard(by: KeyPairSigner, card: Address, from: Address, options: { withToken?: boolean } = {}) {
    const withToken = options.withToken ?? true
    const open = await getOpenCardInstructionAsync({
      card,
      postageMint: SKR_MINT,
      recipient: by,
      recipientToken: withToken ? await tokenAccountOf(by.address) : undefined,
      sender: from,
    })
    // The app does the same: make sure the reader has somewhere to be paid.
    const createToken = await getCreateAssociatedTokenIdempotentInstructionAsync({
      mint: SKR_MINT,
      owner: by.address,
      payer: by,
    })
    await send(by, withToken ? [createToken, open] : [open])
  }

  async function returnCard(by: KeyPairSigner, card: Address, from: Address = sender.address) {
    const instruction = await getReturnCardInstructionAsync({
      caller: by,
      card,
      postageMint: SKR_MINT,
      sender: from,
      senderToken: await tokenAccountOf(from),
    })
    await send(by, [instruction])
  }

  // --- the post office -------------------------------------------------------

  it('will not open the post office for anyone but the upgrade authority', async () => {
    const instruction = await getOpenPostOfficeInstructionAsync({
      admin: stranger,
      postageMint: SKR_MINT,
      programData: await programDataAddress(),
      sgtGroup: SGT_GROUP,
      sgtMintAuthority: SGT_MINT_AUTHORITY,
      terms: TERMS,
    })
    expect(await errorCodeOf(send(stranger, [instruction]))).toBe(PENNY_POST_ERROR__NOT_UPGRADE_AUTHORITY)
  })

  it('opens the post office for the upgrade authority', async () => {
    const instruction = await getOpenPostOfficeInstructionAsync({
      admin,
      postageMint: SKR_MINT,
      programData: await programDataAddress(),
      sgtGroup: SGT_GROUP,
      sgtMintAuthority: SGT_MINT_AUTHORITY,
      terms: TERMS,
    })
    await send(admin, [instruction])

    const postOffice = await fetchPostOffice(rpc, instruction.accounts[1].address)
    expect(postOffice.data.postageMint).toBe(SKR_MINT)
    expect(postOffice.data.burnBps).toBe(1_000)
    expect(postOffice.data.floorPrice).toBe(1n * SKR)
  })

  it('caps the burn share at a fifth', async () => {
    const instruction = await getSetTermsInstructionAsync({ admin, terms: { ...TERMS, burnBps: 2_001 } })
    expect(await errorCodeOf(send(admin, [instruction]))).toBe(PENNY_POST_ERROR__BURN_SHARE_TOO_HIGH)
  })

  it('lets only the admin change the terms', async () => {
    const instruction = await getSetTermsInstructionAsync({ admin: stranger, terms: TERMS })
    expect(await errorCodeOf(send(stranger, [instruction]))).toBe(ANCHOR_HAS_ONE)
  })

  // --- letterboxes -----------------------------------------------------------

  it("opens a letterbox at the reader's price", async () => {
    await openLetterbox(reader)
    const [letterbox] = await findLetterboxPda({ owner: reader.address })
    const { data } = await fetchLetterbox(rpc, letterbox)
    expect(data.owner).toBe(reader.address)
    expect(data.price).toBe(READER_PRICE)
    expect(data.utcOffsetMinutes).toBe(KOLKATA)
  })

  it('will not let a price drop below the floor', async () => {
    const instruction = await getSetLetterboxInstructionAsync({
      owner: reader,
      price: SKR / 2n,
      readingKey: new Uint8Array(32).fill(1),
      utcOffsetMinutes: KOLKATA,
    })
    expect(await errorCodeOf(send(reader, [instruction]))).toBe(PENNY_POST_ERROR__PRICE_BELOW_FLOOR)
  })

  // --- posting ---------------------------------------------------------------

  it('will not post a card to its own sender', async () => {
    const attempt = postCard({ express: true, postage: 10n * SKR, to: sender.address })
    expect(await errorCodeOf(attempt)).toBe(PENNY_POST_ERROR__SELF_ADDRESSED)
  })

  it("will not take postage below the reader's price", async () => {
    const attempt = postCard({ express: true, postage: READER_PRICE - 1n, to: reader.address })
    expect(await errorCodeOf(attempt)).toBe(PENNY_POST_ERROR__POSTAGE_TOO_LOW)
  })

  it('will not burn a bigger express fee than the sender agreed to', async () => {
    const attempt = postCard({
      express: true,
      maxExpressFee: TERMS.expressFee - 1n,
      postage: READER_PRICE,
      to: reader.address,
    })
    expect(await errorCodeOf(attempt)).toBe(PENNY_POST_ERROR__EXPRESS_FEE_TOO_HIGH)

    // The limit only matters for an express card.
    const patient = await freshReader()
    await postCard({ maxExpressFee: 0n, postage: READER_PRICE, to: patient.address })
  })

  it('will not post a free card from a wallet with no seal', async () => {
    const attempt = postCard({ postage: 0n, to: reader.address })
    expect(await errorCodeOf(attempt)).toBe(PENNY_POST_ERROR__NO_SEAL)
  })

  // --- opening ---------------------------------------------------------------

  it('pays the reader and burns a tenth when an express card is opened', async () => {
    const senderBefore = await skrBalance(sender.address)
    const supplyBefore = await skrSupply()

    const { card, vault } = await postCard({ express: true, postage: 10n * SKR, to: reader.address })

    // Ten SKR went into the vault and the two SKR express fee was burned.
    expect(await skrBalance(sender.address)).toBe(senderBefore - 12n * SKR)
    expect(await skrSupply()).toBe(supplyBefore - 2n * SKR)

    await openCard(reader, card, sender.address)

    expect(await skrBalance(reader.address)).toBe(9n * SKR)
    expect(await skrSupply()).toBe(supplyBefore - 3n * SKR)
    expect(await accountExists(card)).toBe(false)
    expect(await accountExists(vault)).toBe(false)

    const [letterbox] = await findLetterboxPda({ owner: reader.address })
    const { data } = await fetchLetterbox(rpc, letterbox)
    expect(data.received).toBe(1)
    expect(data.opened).toBe(1)
    expect(data.earned).toBe(9n * SKR)
  })

  it('keeps the burn share a card was posted under, whatever the terms become', async () => {
    const patient = await freshReader()
    const { card } = await postCard({ express: true, postage: 10n * SKR, to: patient.address })

    // The admin doubles the burn while the card is on the doormat.
    await send(admin, [await getSetTermsInstructionAsync({ admin, terms: { ...TERMS, burnBps: 2_000 } })])
    try {
      await openCard(patient, card, sender.address)
      expect(await skrBalance(patient.address)).toBe(9n * SKR)
    } finally {
      await send(admin, [await getSetTermsInstructionAsync({ admin, terms: TERMS })])
    }
  })

  it('lets nobody but the reader open a card', async () => {
    const { card } = await postCard({ express: true, postage: 10n * SKR, to: reader.address })
    const instruction = await getOpenCardInstructionAsync({
      card,
      postageMint: SKR_MINT,
      recipient: stranger,
      recipientToken: await tokenAccountOf(stranger.address),
      sender: sender.address,
    })
    expect(await errorCodeOf(send(stranger, [instruction]))).toBe(ANCHOR_HAS_ONE)
  })

  it('empties a vault that somebody sent stray tokens to', async () => {
    const before = await skrBalance(reader.address)
    const { card, vault } = await postCard({ express: true, postage: 10n * SKR, to: reader.address })

    // If the vault were closed by the postage amount alone, this would lock the card.
    const stray = getTransferInstruction({
      amount: 1n * SKR,
      authority: stranger,
      destination: vault,
      source: await tokenAccountOf(stranger.address),
    })
    await send(stranger, [stray])

    await openCard(reader, card, sender.address)
    expect(await skrBalance(reader.address)).toBe(before + 10n * SKR)
    expect(await accountExists(vault)).toBe(false)
  })

  // --- the daily limit -------------------------------------------------------

  it('takes three paid cards a day and no more', async () => {
    const busyReader = await createFundedSigner({ rpc, rpcSubscriptions })
    await openLetterbox(busyReader)

    for (let i = 0; i < 3; i++) {
      await postCard({ express: true, postage: READER_PRICE, to: busyReader.address })
    }
    const fourth = postCard({ express: true, postage: READER_PRICE, to: busyReader.address })
    expect(await errorCodeOf(fourth)).toBe(PENNY_POST_ERROR__LETTERBOX_FULL)
  })

  it('cannot be talked past the limit by mixing express and ordinary cards', async () => {
    // A reader for whom it is two in the afternoon. An ordinary card posted
    // now arrives tomorrow, and an express card arrives today.
    const secondOfDay = Number((await validatorTime()) % 86_400n)
    const busyReader = await freshReader(Math.round((14 * 3_600 - secondOfDay) / 60))

    await postCard({ postage: READER_PRICE, to: busyReader.address })
    await postCard({ express: true, postage: READER_PRICE, to: busyReader.address })
    await postCard({ postage: READER_PRICE, to: busyReader.address })

    for (const express of [true, false]) {
      const fourth = postCard({ express, postage: READER_PRICE, to: busyReader.address })
      expect(await errorCodeOf(fourth)).toBe(PENNY_POST_ERROR__LETTERBOX_FULL)
    }
  })

  // --- returning -------------------------------------------------------------

  it('lets the reader send a card straight back, with a full refund', async () => {
    const before = await skrBalance(sender.address)
    const { card, vault } = await postCard({ postage: 10n * SKR, to: reader.address })
    expect(await skrBalance(sender.address)).toBe(before - 10n * SKR)

    await returnCard(reader, card)

    expect(await skrBalance(sender.address)).toBe(before)
    expect(await accountExists(card)).toBe(false)
    expect(await accountExists(vault)).toBe(false)
  })

  it('cannot be made to refund anyone but the sender', async () => {
    const { card } = await postCard({ postage: 10n * SKR, to: reader.address })
    const instruction = await getReturnCardInstructionAsync({
      caller: reader,
      card,
      postageMint: SKR_MINT,
      sender: stranger.address,
      senderToken: await tokenAccountOf(stranger.address),
    })
    // The card's address is derived from its real sender, so naming another one fails the seeds check.
    await expect(send(reader, [instruction])).rejects.toThrow()
    await returnCard(reader, card)
  })

  // --- the Genesis Token and the free stamp ----------------------------------

  it('will not accept a mint that Token-2022 does not own as a Genesis Token', async () => {
    const instruction = await getVerifyLetterboxInstructionAsync({
      owner: reader,
      sgtMint: SKR_MINT,
      sgtToken: await tokenAccountOf(reader.address),
    })
    expect(await errorCodeOf(send(reader, [instruction]))).toBe(PENNY_POST_ERROR__NOT_GENESIS_TOKEN)
  })

  it('will not accept an account the Genesis Token has already left', async () => {
    // Moving the token leaves an empty account behind in the old wallet.
    await giveTokens(reader.address, REAL_SGT_MINT, 0n, TOKEN_2022_PROGRAM_ADDRESS)
    const instruction = await getVerifyLetterboxInstructionAsync({
      owner: reader,
      sgtMint: REAL_SGT_MINT,
      sgtToken: await tokenAccountOf(reader.address, REAL_SGT_MINT, TOKEN_2022_PROGRAM_ADDRESS),
    })
    expect(await errorCodeOf(send(reader, [instruction]))).toBe(PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD)
  })

  describe('with a real Genesis Token', () => {
    let seeker: KeyPairSigner
    let secondWallet: KeyPairSigner
    let seal: Address
    let freeCard: Address

    const holdingOf = (owner: KeyPairSigner) => tokenAccountOf(owner.address, REAL_SGT_MINT, TOKEN_2022_PROGRAM_ADDRESS)

    async function verify(owner: KeyPairSigner) {
      await giveTokens(owner.address, REAL_SGT_MINT, 1n, TOKEN_2022_PROGRAM_ADDRESS)
      const instruction = await getVerifyLetterboxInstructionAsync({
        owner,
        sgtMint: REAL_SGT_MINT,
        sgtToken: await tokenAccountOf(owner.address, REAL_SGT_MINT, TOKEN_2022_PROGRAM_ADDRESS),
      })
      await send(owner, [instruction])
    }

    beforeAll(async () => {
      ;[seeker, secondWallet] = await Promise.all([
        createFundedSigner({ rpc, rpcSubscriptions }),
        createFundedSigner({ rpc, rpcSubscriptions }),
      ])
      await openLetterbox(seeker)
      await openLetterbox(secondWallet)
      ;[seal] = await findSealPda({ sgtMint: REAL_SGT_MINT })
    })

    it('ties the seal to the wallet that holds the token', async () => {
      await verify(seeker)

      const { data } = await fetchSeal(rpc, seal)
      expect(data.holder).toBe(seeker.address)
      expect(data.memberNumber).toBe(20n)

      const [letterbox] = await findLetterboxPda({ owner: seeker.address })
      expect((await fetchLetterbox(rpc, letterbox)).data.sealMint).toBe(REAL_SGT_MINT)
    })

    it("will not verify a wallet against somebody else's token", async () => {
      const instruction = await getVerifyLetterboxInstructionAsync({
        owner: reader,
        sgtMint: REAL_SGT_MINT,
        sgtToken: await tokenAccountOf(seeker.address, REAL_SGT_MINT, TOKEN_2022_PROGRAM_ADDRESS),
      })
      expect(await errorCodeOf(send(reader, [instruction]))).toBe(PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD)
    })

    it('posts one free card a day on the seal', async () => {
      const sgtToken = await holdingOf(seeker)
      ;({ card: freeCard } = await postCard({ from: seeker, postage: 0n, seal, sgtToken, to: reader.address }))
      expect((await fetchCard(rpc, freeCard)).data.postage).toBe(0n)

      const second = postCard({ from: seeker, postage: 0n, seal, sgtToken, to: reader.address })
      expect(await errorCodeOf(second)).toBe(PENNY_POST_ERROR__STAMP_ALREADY_USED)
    })

    it('will not post a free card unless the token is in the wallet right now', async () => {
      const free = (sgtToken?: Address) => postCard({ from: seeker, postage: 0n, seal, sgtToken, to: reader.address })

      // Not shown at all.
      expect(await errorCodeOf(free())).toBe(PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD)

      // Somebody else's.
      await giveTokens(secondWallet.address, REAL_SGT_MINT, 1n, TOKEN_2022_PROGRAM_ADDRESS)
      expect(await errorCodeOf(free(await holdingOf(secondWallet)))).toBe(PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD)

      // The token has moved on, and the new wallet has not verified yet. The
      // seal still names the old holder, who no longer has anything to show.
      await giveTokens(seeker.address, REAL_SGT_MINT, 0n, TOKEN_2022_PROGRAM_ADDRESS)
      expect(await errorCodeOf(free(await holdingOf(seeker)))).toBe(PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD)
    })

    it('gives no second stamp when the token moves to another wallet', async () => {
      await verify(secondWallet)
      expect((await fetchSeal(rpc, seal)).data.holder).toBe(secondWallet.address)

      const again = postCard({
        from: secondWallet,
        postage: 0n,
        seal,
        sgtToken: await holdingOf(secondWallet),
        to: reader.address,
      })
      expect(await errorCodeOf(again)).toBe(PENNY_POST_ERROR__STAMP_ALREADY_USED)
    })

    it('will not let the old holder use the seal', async () => {
      const attempt = postCard({
        from: seeker,
        postage: 0n,
        seal,
        sgtToken: await holdingOf(seeker),
        to: reader.address,
      })
      expect(await errorCodeOf(attempt)).toBe(PENNY_POST_ERROR__SEAL_NOT_YOURS)
    })

    it('burns stray tokens left on a free card when it goes back', async () => {
      const [vault] = await findVaultPda({ card: freeCard })
      const stray = getTransferInstruction({
        amount: 1n,
        authority: stranger,
        destination: vault,
        source: await tokenAccountOf(stranger.address),
      })
      await send(stranger, [stray])
      const supplyBefore = await skrSupply()

      // The sender of a free card may hold no SKR account, so none is named.
      const giveBack = await getReturnCardInstructionAsync({
        caller: reader,
        card: freeCard,
        postageMint: SKR_MINT,
        sender: seeker.address,
      })
      await send(reader, [giveBack])

      expect(await accountExists(freeCard)).toBe(false)
      expect(await accountExists(vault)).toBe(false)
      expect(await skrSupply()).toBe(supplyBefore - 1n)
    })
  })
})
