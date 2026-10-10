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
  travelTo,
} from './harness'

// Anchor's own code for a failed `has_one` check.
const ANCHOR_HAS_ONE = 2001

const TERMS = { burnBps: 1_000, expressFee: 2n * SKR, floorPrice: 1n * SKR }
const READER_PRICE = 5n * SKR
const KOLKATA = 330
const CONTENT_HASH = new Uint8Array(32).fill(7)
const PILLAR_BOX = 2
const SECONDS_PER_DAY = 86_400n

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

  async function postCard(options: {
    express?: boolean
    from?: KeyPairSigner
    postage: bigint
    seal?: Address
    to: Address
    token?: Address
  }) {
    const from = options.from ?? sender
    const cardId = freshCardId()
    const instruction = await getPostCardInstructionAsync({
      cardId,
      contentHash: CONTENT_HASH,
      express: options.express ?? false,
      postage: options.postage,
      postageMint: SKR_MINT,
      recipient: options.to,
      sender: from,
      senderSeal: options.seal,
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
      ;({ card: freeCard } = await postCard({ from: seeker, postage: 0n, seal, to: reader.address }))
      expect((await fetchCard(rpc, freeCard)).data.postage).toBe(0n)

      const second = postCard({ from: seeker, postage: 0n, seal, to: reader.address })
      expect(await errorCodeOf(second)).toBe(PENNY_POST_ERROR__STAMP_ALREADY_USED)
    })

    it('gives no second stamp when the token moves to another wallet', async () => {
      await verify(secondWallet)
      expect((await fetchSeal(rpc, seal)).data.holder).toBe(secondWallet.address)

      const again = postCard({ from: secondWallet, postage: 0n, seal, to: reader.address })
      expect(await errorCodeOf(again)).toBe(PENNY_POST_ERROR__STAMP_ALREADY_USED)
    })

    it('will not let the old holder use the seal', async () => {
      const attempt = postCard({ from: seeker, postage: 0n, seal, to: reader.address })
      expect(await errorCodeOf(attempt)).toBe(PENNY_POST_ERROR__SEAL_NOT_YOURS)
    })

    // --- the clock. These move time forward, so they run last. ----------------

    it('holds an ordinary card until eight in the morning where the reader lives', async () => {
      const { data } = await fetchCard(rpc, freeCard)
      const localSecondOfDay = (data.deliverAt + BigInt(KOLKATA * 60)) % SECONDS_PER_DAY
      expect(localSecondOfDay).toBe(8n * 3_600n)
      expect(data.expiresAt).toBe(data.deliverAt + 7n * SECONDS_PER_DAY)

      const early = openCard(reader, freeCard, seeker.address, { withToken: false })
      expect(await errorCodeOf(early)).toBe(PENNY_POST_ERROR__NOT_DELIVERED_YET)

      await travelTo(data.deliverAt + 60n)
      // A free card carries no postage, so the reader needs no token account to open it.
      await openCard(reader, freeCard, seeker.address, { withToken: false })
      expect(await accountExists(freeCard)).toBe(false)
    })

    it('goes back to its sender after a week, and anyone can carry it', async () => {
      const before = await skrBalance(sender.address)
      const { card } = await postCard({ postage: 10n * SKR, to: reader.address })
      const { data } = await fetchCard(rpc, card)

      expect(await errorCodeOf(returnCard(stranger, card))).toBe(PENNY_POST_ERROR__NOT_EXPIRED_YET)

      await travelTo(data.expiresAt + 60n)
      await returnCard(stranger, card)

      expect(await skrBalance(sender.address)).toBe(before)
      expect(await accountExists(card)).toBe(false)
    })
  })
})
