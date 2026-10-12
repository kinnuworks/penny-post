import type { Address } from '@solana/kit'
import { CARD_STORE_URL } from '../../config'

// The devnet counter. Devnet has no SKR and no Seekers, so somebody trying the
// app there is handed stand-ins: a little SOL, some test SKR and a test Genesis
// Token. There is no counter on mainnet. See supabase/functions/counter.

/**
 * Asks the counter for a test kit. `had` means this wallet was given one
 * before, and `none-left` means the pile of test Genesis Tokens is gone.
 */
export async function askForTestKit(wallet: Address): Promise<'given' | 'had' | 'none-left'> {
  const response = await fetch(`${CARD_STORE_URL}/functions/v1/counter/kit`, {
    body: JSON.stringify({ wallet }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (response.status === 409) {
    return 'had'
  }
  if (response.status === 410) {
    return 'none-left'
  }
  if (!response.ok) {
    throw new Error(`The counter is not answering (${response.status}).`)
  }
  return 'given'
}
