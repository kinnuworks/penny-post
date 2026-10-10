import type { Address } from '@solana/kit'

const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'

/**
 * What to call the postage token. On mainnet the post office runs on SKR. On
 * devnet it runs on a stand-in with no value, and the app says so.
 */
export function tokenName(postageMint: Address): string {
  return postageMint === SKR_MINT ? 'SKR' : 'test SKR'
}
