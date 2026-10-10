// Addresses the app talks to. None of these are secrets: the card store takes
// no API key, and an RPC URL only says which door to knock on.

/** Where card contents are stored and fetched. See supabase/functions/cards. */
export const CARD_STORE_URL = process.env.EXPO_PUBLIC_CARD_STORE_URL ?? 'https://lgyplcllrsukuawiwudv.supabase.co'

/** .skr names and SKR live on mainnet, whichever network the app is on. */
export const MAINNET_RPC_URL = process.env.EXPO_PUBLIC_MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com'

/** What a new letterbox charges a stranger, in whole tokens, until its owner says otherwise. */
export const DEFAULT_PRICE_TOKENS = 10n
