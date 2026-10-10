import { createSolanaRpc, type Address } from '@solana/kit'
import { describe, expect, it } from 'vitest'
import { parseSkrName, primarySkrName, resolveRecipient, resolveSkrName } from './skr'

describe('parseSkrName', () => {
  it('reads a name however it was typed', () => {
    expect(parseSkrName('asha.skr')).toBe('asha')
    expect(parseSkrName('  Asha.SKR ')).toBe('asha')
  })

  it('refuses things that are not .skr names', () => {
    expect(parseSkrName('asha.sol')).toBeNull()
    expect(parseSkrName('.skr')).toBeNull()
    expect(parseSkrName('a.b.skr')).toBeNull()
    expect(parseSkrName('two words.skr')).toBeNull()
    expect(parseSkrName('4NmoyKKATGzcKiSijTteZDE1KpC46VzrAM2pv5mWaY2W')).toBeNull()
  })
})

// These talk to mainnet, so they only run when asked:
//   LIVE=1 pnpm test
// The expected owners were read with AllDomains' own @onsol/tldparser on 2026-10-10.
describe.runIf(process.env.LIVE === '1')('resolveSkrName against mainnet', () => {
  const rpc = createSolanaRpc(process.env.EXPO_PUBLIC_MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com')

  it('finds the owners the reference library finds', async () => {
    expect(await resolveSkrName(rpc, 'chase')).toBe('4NmoyKKATGzcKiSijTteZDE1KpC46VzrAM2pv5mWaY2W')
    expect(await resolveSkrName(rpc, 'beeman')).toBe('2c43Cag8oYcLKdSDKde9dj632LpejDAXB6DF32z9Ef7P')
    expect(await resolveSkrName(rpc, 'a2nkf')).toBe('BSyzzxu3kXiMbd3xidcWZ7B9JcX5cHwLzG2thhCodgxM')
  }, 30_000)

  it('returns null for a name nobody holds', async () => {
    expect(await resolveSkrName(rpc, 'nobody-holds-this-name-9f3a')).toBeNull()
  }, 30_000)

  it("reads a wallet's main name, and only if it still points back", async () => {
    // This wallet had beeman.skr set as its main name when the test was written.
    expect(await primarySkrName(rpc, '2c43Cag8oYcLKdSDKde9dj632LpejDAXB6DF32z9Ef7P' as Address)).toBe('beeman.skr')
    // A wallet that has never set a main name has none.
    expect(await primarySkrName(rpc, '11111111111111111111111111111111' as Address)).toBeNull()
  }, 60_000)

  it('passes a wallet address straight through', async () => {
    const wallet = '4NmoyKKATGzcKiSijTteZDE1KpC46VzrAM2pv5mWaY2W'
    expect(await resolveRecipient(rpc, wallet)).toEqual({ address: wallet, name: null })
  })
})
