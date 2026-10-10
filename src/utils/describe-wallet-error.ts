import { copy } from '../copy'
import { formatError } from './format-error'

// Turns a wallet failure into a sentence a person can act on. The raw message
// is never shown: it can carry addresses and internal detail.
export function describeWalletError(error: unknown): string {
  const message = formatError(error).toLowerCase()

  if (message.includes('declined') || message.includes('cancel') || message.includes('rejected')) {
    return copy.errors.declined
  }
  if (message.includes('no wallet') || message.includes('not found') || message.includes('no installed wallet')) {
    return copy.errors.noWallet
  }
  return copy.errors.generic
}
