import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readGroupMember, SGT_GROUP } from './genesis-token'

// The same accounts, copied from mainnet, that the program's Rust tests use.
const fixtures = new URL('../../../anchor/programs/penny_post/tests/fixtures/', import.meta.url)

function fixture(name: string): Uint8Array {
  const hex = readFileSync(new URL(name, fixtures), 'utf8').trim()
  return Uint8Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16))
}

describe('readGroupMember', () => {
  it('reads a stand-in member mint made with the stock token tool, as used on devnet', () => {
    const member = readGroupMember(fixture('standin_member_mint.hex'))
    expect(member).toEqual({
      group: 'AKwJKaLo3G6qCsb3V318mwLJoqSqYT3WZgy7Go94uQax',
      memberNumber: 1n,
      mint: 'CeHmPhe9fyqH3cFbGJmRtV4cFctG5fbrCUhzdYApMZhJ',
    })
  })

  it('reads a real Genesis Token mint the way the program does', () => {
    const member = readGroupMember(fixture('sgt_mint_5mXbkqKz.hex'))
    expect(member).toEqual({
      group: SGT_GROUP,
      memberNumber: 20n,
      mint: '5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj',
    })
  })

  it('finds no membership in a token account', () => {
    expect(readGroupMember(fixture('sgt_holding_full.hex'))).toBeNull()
  })

  it('finds no membership in a mint with no extensions', () => {
    expect(readGroupMember(fixture('sgt_mint_5mXbkqKz.hex').subarray(0, 82))).toBeNull()
  })

  it('gives up on a length that runs past the account', () => {
    const data = fixture('sgt_mint_5mXbkqKz.hex')
    data[166 + 2] = 0xff
    data[166 + 3] = 0xff
    expect(readGroupMember(data)).toBeNull()
  })

  it('reads nothing from empty data', () => {
    expect(readGroupMember(new Uint8Array())).toBeNull()
  })
})
