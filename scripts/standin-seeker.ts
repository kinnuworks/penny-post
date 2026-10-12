/**
 * A stand-in for the Seeker Genesis Token, for networks that have no real one.
 *
 * A real Genesis Token is a Token-2022 mint that belongs to Solana Mobile's
 * token group. Devnet has no such group, so the post office there is opened
 * with a group made here, and test wallets are handed member tokens of it. The
 * program checks a stand-in exactly as it checks a real one. Only the group
 * address differs, and that is fixed when the post office opens.
 *
 * The stock `spl-token` tool does the minting. It signs with the wallet at
 * ~/.config/solana/id.json, which becomes the group's authority.
 */

import { type Address, address } from '@solana/kit'
import { execFileSync } from 'node:child_process'

function splToken(rpcUrl: string, args: string[]): string {
  return execFileSync('spl-token', ['-u', rpcUrl, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function addressIn(output: string): Address {
  const match = /Address:\s+([1-9A-HJ-NP-Za-km-z]{32,44})/.exec(output)
  if (!match) {
    throw new Error(`spl-token did not say what it made:\n${output}`)
  }
  return address(match[1])
}

/** Makes the token group that stand-in Genesis Tokens will belong to. */
export function makeStandInGroup(rpcUrl: string): Address {
  const group = addressIn(splToken(rpcUrl, ['create-token', '--program-2022', '--enable-group', '--decimals', '0']))
  splToken(rpcUrl, ['initialize-group', group, '1000000'])
  return group
}

/** Mints a new member of `group` and puts it in `owner`'s wallet. Returns the member's mint. */
export function giveStandInSeeker(rpcUrl: string, group: Address, owner: Address): Address {
  const mint = addressIn(splToken(rpcUrl, ['create-token', '--program-2022', '--enable-member', '--decimals', '0']))
  splToken(rpcUrl, ['initialize-member', mint, group])
  splToken(rpcUrl, [
    'create-account',
    mint,
    '--owner',
    owner,
    '--fee-payer',
    `${process.env.HOME}/.config/solana/id.json`,
  ])
  splToken(rpcUrl, ['mint', mint, '1', '--recipient-owner', owner])
  return mint
}
