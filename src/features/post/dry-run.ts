import {
  PENNY_POST_ERROR__EXPRESS_FEE_TOO_HIGH,
  PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD,
  PENNY_POST_ERROR__LETTERBOX_FULL,
  PENNY_POST_ERROR__NOT_DELIVERED_YET,
  PENNY_POST_ERROR__NOT_GENESIS_TOKEN,
  PENNY_POST_ERROR__POSTAGE_TOO_LOW,
  PENNY_POST_ERROR__STAMP_ALREADY_USED,
} from '@project/anchor'
import {
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
  type createSolanaRpc,
  type Instruction,
} from '@solana/kit'
import { PostProblem } from './problem'

type SolanaRpc = ReturnType<typeof createSolanaRpc>

// The validator swaps in a live blockhash for the dry run, so any well-formed one does here.
const PLACEHOLDER_LIFETIME = { blockhash: '11111111111111111111111111111111' as Blockhash, lastValidBlockHeight: 0n }

// Anchor's code for an account that should exist and does not.
const ACCOUNT_NOT_INITIALIZED = 3012
// The token program and the system program both use 1 for "not enough".
const NOT_ENOUGH = 1

const REFUSALS: Record<number, PostProblem['reason']> = {
  [PENNY_POST_ERROR__EXPRESS_FEE_TOO_HIGH]: 'price-changed',
  [PENNY_POST_ERROR__GENESIS_TOKEN_NOT_HELD]: 'no-genesis-token',
  [PENNY_POST_ERROR__LETTERBOX_FULL]: 'letterbox-full',
  [PENNY_POST_ERROR__NOT_DELIVERED_YET]: 'too-early',
  [PENNY_POST_ERROR__NOT_GENESIS_TOKEN]: 'no-genesis-token',
  [PENNY_POST_ERROR__POSTAGE_TOO_LOW]: 'price-changed',
  [PENNY_POST_ERROR__STAMP_ALREADY_USED]: 'no-free-stamp',
}

/**
 * Runs the instructions on the cluster without signing or sending them. If the
 * program would refuse, this throws before the wallet is ever opened, with a
 * reason the screen has a sentence for.
 *
 * A dry run that cannot be completed (no network, an RPC that will not
 * simulate) is not a refusal. It returns quietly and the wallet gets its turn.
 */
export async function dryRun(rpc: SolanaRpc, payer: Address, instructions: Instruction[]): Promise<void> {
  let outcome: { err: unknown; logs: readonly string[] | null }
  try {
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayer(payer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(PLACEHOLDER_LIFETIME, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    )
    const wire = getBase64EncodedWireTransaction(compileTransaction(message))
    const { value } = await rpc
      .simulateTransaction(wire, {
        commitment: 'confirmed',
        encoding: 'base64',
        replaceRecentBlockhash: true,
        sigVerify: false,
      })
      .send()
    outcome = value
  } catch {
    return
  }
  if (outcome.err) {
    throw explainRefusal(outcome.err, outcome.logs ?? [])
  }
}

/** Turns a failed dry run into a named problem where it can, and a plain error where it cannot. */
export function explainRefusal(err: unknown, logs: readonly string[]): Error {
  const text = logs.join('\n').toLowerCase()
  if (typeof err === 'string') {
    // A wallet the cluster has never seen, or one that cannot cover the fee.
    return err === 'AccountNotFound' || err.startsWith('InsufficientFunds')
      ? new PostProblem('short-of-sol')
      : new Error(`The dry run failed: ${err}`)
  }
  if (isRecord(err) && 'InsufficientFundsForRent' in err) {
    return new PostProblem('short-of-sol')
  }

  const code = customCodeOf(err)
  if (code === NOT_ENOUGH) {
    return new PostProblem(text.includes('insufficient lamports') ? 'short-of-sol' : 'short-of-postage')
  }
  // The only account a card can be missing is the token account its postage comes from.
  if (code === ACCOUNT_NOT_INITIALIZED && text.includes('sender_token')) {
    return new PostProblem('short-of-postage')
  }
  const reason = code === undefined ? undefined : REFUSALS[code]
  return reason ? new PostProblem(reason) : new Error(`The dry run failed: ${stringify(err)}`)
}

function customCodeOf(err: unknown): number | undefined {
  if (!isRecord(err) || !Array.isArray(err.InstructionError)) {
    return undefined
  }
  const detail: unknown = err.InstructionError[1]
  return isRecord(detail) && (typeof detail.Custom === 'number' || typeof detail.Custom === 'bigint')
    ? Number(detail.Custom)
    : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringify(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => (typeof inner === 'bigint' ? inner.toString() : inner))
}
