import type { Address } from '@solana/kit'

const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'

/**
 * What to call the postage token. It is SKR everywhere. On a test network the
 * token is a stand-in with no value, and the app says so once, with a tag by
 * the greeting, rather than on every line.
 */
export function tokenName(_postageMint: Address): string {
  return 'SKR'
}

/** True where the post office runs on a stand-in for SKR: devnet, or anywhere that is not mainnet. */
export function isStandIn(postageMint: Address): boolean {
  return postageMint !== SKR_MINT
}
