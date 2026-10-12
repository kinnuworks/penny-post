import {
  fetchMaybeAnswer,
  fetchMaybeCircular,
  findCircularPda,
  getAnswerCircularInstruction,
  getCloseCircularInstructionAsync,
  getCollectCircularInstructionAsync,
  getPostCircularInstructionAsync,
  PENNY_POST_PROGRAM_ADDRESS,
  type Answer,
  type Circular,
  type PostOffice,
} from '@project/anchor'
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token'
import {
  getAddressEncoder,
  getProgramDerivedAddress,
  type Address,
  type createSolanaRpc,
  type Instruction,
  type TransactionSigner,
} from '@solana/kit'

// The circular: one question a day, put to every Seeker. Whoever asks pays,
// each Genesis Token answers once, and the phones that answered share the pot
// when the day closes. Plain functions over an RPC connection and a signer,
// like the rest of what the app says to the program.

type Rpc = ReturnType<typeof createSolanaRpc>

const SECONDS_PER_DAY = 86_400
/** A circular's pot is at least this many times the floor price. The program holds the same number. */
const FLOOR_MULTIPLE = 20n
/** Taking over a day needs a pot this much larger, in basis points. The program holds the same number. */
const OUTBID_BPS = 11_000n

export const MAX_QUESTION_LENGTH = 120
export const MAX_OPTION_LENGTH = 28
export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 4

/** A circular, with the address of its account. */
export interface PostedCircular extends Circular {
  address: Address
}

/** The UTC day a moment falls on, counted from the Unix epoch. A circular is filed under it. */
export function utcDay(nowSeconds: number): number {
  return Math.floor(nowSeconds / SECONDS_PER_DAY)
}

/** When a day's question stops taking answers, in Unix seconds. */
export function closesAt(day: number): number {
  return (day + 1) * SECONDS_PER_DAY
}

/** The least a sponsor can put up. */
export function smallestPot(postOffice: PostOffice): bigint {
  return postOffice.floorPrice * FLOOR_MULTIPLE
}

/** The least that takes a day over from the sponsor who has it. */
export function smallestOutbid(circular: Circular): bigint {
  const needed = (circular.pot * OUTBID_BPS) / 10_000n
  return needed > circular.pot ? needed : circular.pot + 1n
}

/** What each phone that answered receives once the burn share is taken, at the count so far. */
export function shareAfterBurn(circular: Circular): bigint {
  if (circular.answers === 0) {
    return 0n
  }
  const share = circular.pot / BigInt(circular.answers)
  return share - (share * BigInt(circular.burnBps)) / 10_000n
}

export async function fetchCircular(rpc: Rpc, day: number): Promise<PostedCircular | null> {
  const [address] = await findCircularPda({ day })
  const account = await fetchMaybeCircular(rpc, address)
  return account.exists ? { ...account.data, address } : null
}

/** Where a Genesis Token's answer to a circular lives. One address per token, so one answer per phone. */
export async function findAnswerAddress(circular: Address, sgtMint: Address): Promise<Address> {
  const encoder = getAddressEncoder()
  const [address] = await getProgramDerivedAddress({
    programAddress: PENNY_POST_PROGRAM_ADDRESS,
    seeds: [new TextEncoder().encode('answer'), encoder.encode(circular), encoder.encode(sgtMint)],
  })
  return address
}

/** This Genesis Token's answer, or null if the phone has not answered (or has already collected). */
export async function fetchAnswer(rpc: Rpc, circular: Address, sgtMint: Address): Promise<Answer | null> {
  const account = await fetchMaybeAnswer(rpc, await findAnswerAddress(circular, sgtMint))
  return account.exists ? account.data : null
}

/**
 * Puts a question to every Seeker for one UTC day. To take over a day that
 * another sponsor holds, name them in `outbid`: they get their pot and their
 * rent back in the same transaction.
 */
export async function buildPostCircular(input: {
  day: number
  options: string[]
  outbid?: Address
  postageMint: Address
  pot: bigint
  question: string
  sponsor: TransactionSigner
}): Promise<Instruction[]> {
  const post = await getPostCircularInstructionAsync({
    day: input.day,
    options: input.options,
    postageMint: input.postageMint,
    pot: input.pot,
    previousSponsor: input.outbid,
    previousSponsorToken: input.outbid ? await tokenAccount(input.outbid, input.postageMint) : undefined,
    question: input.question,
    sponsor: input.sponsor,
    sponsorToken: await tokenAccount(input.sponsor.address, input.postageMint),
  })
  if (!input.outbid) {
    return [post]
  }
  // If the first sponsor closed their token account, it is made again so the refund has somewhere to go.
  const createTokenAccount = await getCreateAssociatedTokenIdempotentInstructionAsync({
    mint: input.postageMint,
    owner: input.outbid,
    payer: input.sponsor,
  })
  return [createTokenAccount, post]
}

export async function buildAnswerCircular(input: {
  answerer: TransactionSigner
  choice: number
  circular: Address
  seal: Address
  sgtMint: Address
  sgtToken: Address
}): Promise<Instruction[]> {
  return [
    getAnswerCircularInstruction({
      answer: await findAnswerAddress(input.circular, input.sgtMint),
      answerer: input.answerer,
      choice: input.choice,
      circular: input.circular,
      seal: input.seal,
      sgtToken: input.sgtToken,
    }),
  ]
}

/** Collects a phone's share of a closed circular. The token account is made first if it does not exist. */
export async function buildCollectCircular(input: {
  answerer: TransactionSigner
  circular: Address
  postageMint: Address
  sgtMint: Address
}): Promise<Instruction[]> {
  return [
    await getCreateAssociatedTokenIdempotentInstructionAsync({
      mint: input.postageMint,
      owner: input.answerer.address,
      payer: input.answerer,
    }),
    await getCollectCircularInstructionAsync({
      answer: await findAnswerAddress(input.circular, input.sgtMint),
      answerer: input.answerer,
      answererToken: await tokenAccount(input.answerer.address, input.postageMint),
      circular: input.circular,
      postageMint: input.postageMint,
    }),
  ]
}

/** Clears away a finished circular. If nobody answered, the pot goes back to its sponsor. */
export async function buildCloseCircular(input: {
  caller: TransactionSigner
  circular: PostedCircular
  postageMint: Address
}): Promise<Instruction[]> {
  const refund = input.circular.answers === 0
  const close = await getCloseCircularInstructionAsync({
    caller: input.caller,
    circular: input.circular.address,
    postageMint: input.postageMint,
    sponsor: input.circular.sponsor,
    sponsorToken: refund ? await tokenAccount(input.circular.sponsor, input.postageMint) : undefined,
  })
  if (!refund) {
    return [close]
  }
  const createTokenAccount = await getCreateAssociatedTokenIdempotentInstructionAsync({
    mint: input.postageMint,
    owner: input.circular.sponsor,
    payer: input.caller,
  })
  return [createTokenAccount, close]
}

async function tokenAccount(owner: Address, mint: Address): Promise<Address> {
  const [address] = await findAssociatedTokenPda({ mint, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS })
  return address
}
