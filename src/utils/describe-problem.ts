import { copy } from '../copy'
import { PostProblem } from '../features/post/use-post'
import { describeWalletError } from './describe-wallet-error'

/** One sentence for whatever went wrong, whether the post office or the wallet said no. */
export function describeProblem(error: unknown): string {
  return error instanceof PostProblem ? copy.problems[error.reason] : describeWalletError(error)
}
