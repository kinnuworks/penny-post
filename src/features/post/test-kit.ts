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

/**
 * Asks the counter to post this wallet its welcome card, so a new letterbox
 * has something in it. True if a card is on its way. The counter sends one
 * per wallet and only where a letterbox exists.
 */
export async function askForWelcomeCard(wallet: Address): Promise<boolean> {
  const response = await fetch(`${CARD_STORE_URL}/functions/v1/counter/welcome`, {
    body: JSON.stringify({ wallet }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  return response.ok
}

/** Names for the two wallets that write to every newcomer on devnet. */
const AT_THE_COUNTER: Record<string, string> = {
  CMNefAXQ6rsnkRpfjeSEa5t6U74hvb5TxtCNJdxjHfXs: 'the pen pal',
  GXzvBgPbGLR9FZYRCaExn2aZQ4ktyERWY4YbXBs7GzVq: 'the postmaster',
}

/** What to call a sender: their .skr name, a name the post office knows them by, or their address shortened. */
export function nameOf(sender: string, skrName: string | null | undefined): string {
  return skrName ?? AT_THE_COUNTER[sender] ?? `${sender.slice(0, 4)}..${sender.slice(-4)}`
}
