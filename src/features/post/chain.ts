import {
  CARD_DISCRIMINATOR,
  fetchMaybeLetterbox,
  fetchMaybePostOffice,
  fetchMaybeSeal,
  findCardPda,
  findLetterboxPda,
  findPostOfficePda,
  findSealPda,
  getCardDecoder,
  getOpenCardInstructionAsync,
  getOpenLetterboxInstructionAsync,
  getPostCardInstructionAsync,
  getReturnCardInstructionAsync,
  getSetLetterboxInstructionAsync,
  getVerifyLetterboxInstructionAsync,
  PENNY_POST_PROGRAM_ADDRESS,
  type Card,
  type Letterbox,
  type PostOffice,
  type Seal,
} from '@project/anchor'
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token'
import {
  getBase58Decoder,
  getBase64Encoder,
  type Address,
  type Base58EncodedBytes,
  type createSolanaRpc,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit'

// Everything the app says to the program, as plain functions over an RPC
// connection and a signer. Nothing in here knows about React or about which
// wallet is signing, so the same code runs in the app and in tests.

type Rpc = ReturnType<typeof createSolanaRpc>

/** A card in the post, with the address of its account. */
export interface PostedCard extends Card {
  address: Address
}

const SENDER_OFFSET = 8n
const RECIPIENT_OFFSET = 40n

/** The post office's terms, or null if the program has not been opened on this network. */
export async function fetchPostOffice(rpc: Rpc): Promise<PostOffice | null> {
  const [address] = await findPostOfficePda()
  const account = await fetchMaybePostOffice(rpc, address)
  return account.exists ? account.data : null
}

export async function fetchLetterbox(rpc: Rpc, owner: Address): Promise<Letterbox | null> {
  const [address] = await findLetterboxPda({ owner })
  const account = await fetchMaybeLetterbox(rpc, address)
  return account.exists ? account.data : null
}

/**
 * The seal behind a letterbox, but only if this wallet still holds it. A
 * letterbox keeps its `sealMint` after the Genesis Token moves on, so the
 * seal's own `holder` is what counts.
 */
export async function fetchSealHeldBy(rpc: Rpc, letterbox: Letterbox): Promise<(Seal & { address: Address }) | null> {
  if (letterbox.sealMint === NO_SEAL) {
    return null
  }
  const [address] = await findSealPda({ sgtMint: letterbox.sealMint })
  const account = await fetchMaybeSeal(rpc, address)
  return account.exists && account.data.holder === letterbox.owner ? { ...account.data, address } : null
}

/** True if the seal's free stamp for the current UTC day is still unused. */
export function hasFreeStamp(seal: Seal, nowSeconds: number): boolean {
  return seal.lastFreeDay < BigInt(Math.floor(nowSeconds / 86_400))
}

/** Cards addressed to this wallet that have not been opened or returned. */
export function listCardsTo(rpc: Rpc, recipient: Address): Promise<PostedCard[]> {
  return listCards(rpc, RECIPIENT_OFFSET, recipient)
}

/** Cards this wallet has posted that are still in the post. */
export function listCardsFrom(rpc: Rpc, sender: Address): Promise<PostedCard[]> {
  return listCards(rpc, SENDER_OFFSET, sender)
}

async function listCards(rpc: Rpc, offset: bigint, wallet: Address): Promise<PostedCard[]> {
  const accounts = await rpc
    .getProgramAccounts(PENNY_POST_PROGRAM_ADDRESS, {
      encoding: 'base64',
      filters: [
        { memcmp: { bytes: CARD_DISCRIMINATOR_BASE58, encoding: 'base58', offset: 0n } },
        { memcmp: { bytes: wallet as string as Base58EncodedBytes, encoding: 'base58', offset } },
      ],
    })
    .send()

  const decoder = getCardDecoder()
  return accounts
    .map(({ account, pubkey }) => ({ ...decoder.decode(getBase64Encoder().encode(account.data[0])), address: pubkey }))
    .sort((a, b) => Number(a.deliverAt - b.deliverAt))
}

export async function buildOpenLetterbox(input: {
  owner: TransactionSigner
  price: bigint
  readingKey: Uint8Array
  utcOffsetMinutes: number
}): Promise<Instruction[]> {
  return [await getOpenLetterboxInstructionAsync(input)]
}

export async function buildSetLetterbox(input: {
  owner: TransactionSigner
  price: bigint
  readingKey: Uint8Array
  utcOffsetMinutes: number
}): Promise<Instruction[]> {
  return [await getSetLetterboxInstructionAsync(input)]
}

/** Ties the wallet's Genesis Token to its letterbox. The program checks the token itself. */
export async function buildVerifyLetterbox(input: {
  owner: TransactionSigner
  sgtMint: Address
  sgtToken: Address
}): Promise<Instruction[]> {
  return [await getVerifyLetterboxInstructionAsync(input)]
}

export interface PostCardInput {
  cardId: bigint
  contentHash: Uint8Array
  express: boolean
  /**
   * The express fee the sender has been shown. The program refuses the card if
   * the fee has gone above this in the meantime. Ignored unless `express` is set.
   */
  maxExpressFee: bigint
  /** Zero for a free card, which needs `seal` and `sgtToken`. */
  postage: bigint
  postageMint: Address
  recipient: Address
  /** The sender's seal, for a free card. */
  seal?: Address
  sender: TransactionSigner
  /** The token account holding the sender's Genesis Token, for a free card. */
  sgtToken?: Address
  stamp: number
}

export async function buildPostCard(input: PostCardInput): Promise<{ card: Address; instructions: Instruction[] }> {
  // A token account is only touched when tokens move: paid postage or the express fee.
  const movesTokens = input.postage > 0n || input.express
  const instruction = await getPostCardInstructionAsync({
    cardId: input.cardId,
    contentHash: input.contentHash,
    express: input.express,
    maxExpressFee: input.express ? input.maxExpressFee : 0n,
    postage: input.postage,
    postageMint: input.postageMint,
    recipient: input.recipient,
    sender: input.sender,
    senderSeal: input.seal,
    sgtToken: input.sgtToken,
    senderToken: movesTokens ? await tokenAccount(input.sender.address, input.postageMint) : undefined,
    stamp: input.stamp,
  })
  const [card] = await findCardPda({ cardId: input.cardId, sender: input.sender.address })
  return { card, instructions: [instruction] }
}

/**
 * Opens a card. If it carries postage, the reader's token account is created
 * first when it does not exist, so a reader who has never held the token can
 * still be paid.
 */
export async function buildOpenCard(input: {
  card: PostedCard
  postageMint: Address
  recipient: TransactionSigner
}): Promise<Instruction[]> {
  const paid = input.card.postage > 0n
  const open = await getOpenCardInstructionAsync({
    card: input.card.address,
    postageMint: input.postageMint,
    recipient: input.recipient,
    recipientToken: paid ? await tokenAccount(input.recipient.address, input.postageMint) : undefined,
    sender: input.card.sender,
  })
  if (!paid) {
    return [open]
  }
  const createTokenAccount = await getCreateAssociatedTokenIdempotentInstructionAsync({
    mint: input.postageMint,
    owner: input.recipient.address,
    payer: input.recipient,
  })
  return [createTokenAccount, open]
}

/**
 * Sends a card back to its sender. The reader can do this at any time. If the
 * card carries postage, the sender's token account is created first when it no
 * longer exists, so closing it cannot strand the refund.
 */
export async function buildReturnCard(input: {
  caller: TransactionSigner
  card: PostedCard
  postageMint: Address
}): Promise<Instruction[]> {
  const paid = input.card.postage > 0n
  const giveBack = await getReturnCardInstructionAsync({
    caller: input.caller,
    card: input.card.address,
    postageMint: input.postageMint,
    sender: input.card.sender,
    senderToken: paid ? await tokenAccount(input.card.sender, input.postageMint) : undefined,
  })
  if (!paid) {
    return [giveBack]
  }
  const createTokenAccount = await getCreateAssociatedTokenIdempotentInstructionAsync({
    mint: input.postageMint,
    owner: input.card.sender,
    payer: input.caller,
  })
  return [createTokenAccount, giveBack]
}

/** What a paid card must carry to reach this reader. */
export function priceToReach(postOffice: PostOffice, letterbox: Letterbox | null): bigint {
  return letterbox && letterbox.price > postOffice.floorPrice ? letterbox.price : postOffice.floorPrice
}

/** A card id nobody else will pick: the time in milliseconds, plus some noise. */
export function newCardId(): bigint {
  return BigInt(Date.now()) * 1_000n + BigInt(Math.floor(Math.random() * 1_000))
}

async function tokenAccount(owner: Address, mint: Address): Promise<Address> {
  const [address] = await findAssociatedTokenPda({ mint, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS })
  return address
}

const NO_SEAL = '11111111111111111111111111111111' as Address
const CARD_DISCRIMINATOR_BASE58 = getBase58Decoder().decode(CARD_DISCRIMINATOR) as Base58EncodedBytes
