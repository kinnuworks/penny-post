import { copy } from '../copy'
import { formatError } from './format-error'

// Turns a wallet failure into a sentence a person can act on. The raw message
// is never shown: it can carry addresses and internal detail.
export function describeWalletError(error: unknown): string {
  const message = formatError(error).toLowerCase()

  if (isDeclined(error)) {
    return copy.errors.declined
  }
  if (message.includes('no wallet') || message.includes('not found') || message.includes('no installed wallet')) {
    return copy.errors.noWallet
  }
  return copy.errors.generic
}

/** True if the person turned the wallet prompt down, so nothing was signed. */
export function isDeclined(error: unknown): boolean {
  const message = formatError(error).toLowerCase()
  return message.includes('declined') || message.includes('cancel') || message.includes('rejected')
}
