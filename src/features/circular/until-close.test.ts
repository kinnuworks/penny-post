import { describe, expect, it } from 'vitest'
import { closesAt, shareAfterBurn, smallestOutbid, utcDay } from './circular-chain'
import { untilClose } from './until-close'

describe('untilClose', () => {
  it('counts in minutes inside the last hour', () => {
    expect(untilClose(0, 40 * 60)).toBe('in 40 minutes')
    expect(untilClose(0, 30)).toBe('any minute now')
    expect(untilClose(100, 50)).toBe('any minute now')
  })

  it('rounds to hours beyond that', () => {
    expect(untilClose(0, 60 * 60)).toBe('in about an hour')
    expect(untilClose(0, 9 * 3_600 + 600)).toBe('in about 9 hours')
  })
})

describe('the circular clock and sums', () => {
  // 2026-10-10T00:00:00Z
  const midnight = 1_791_590_400

  it('files a moment under its UTC day, and closes that day at the next midnight', () => {
    const day = utcDay(midnight + 3_600)
    expect(utcDay(midnight)).toBe(day)
    expect(utcDay(midnight - 1)).toBe(day - 1)
    expect(closesAt(day)).toBe(midnight + 86_400)
  })

  it('shares a pot equally and takes the burn from each share', () => {
    const circular = { answers: 3, burnBps: 1_000, pot: 100_000_001n }
    expect(shareAfterBurn(circular as never)).toBe(30_000_000n)
    expect(shareAfterBurn({ ...circular, answers: 0 } as never)).toBe(0n)
  })

  it('asks a tenth more to take a day over, and always at least one unit more', () => {
    expect(smallestOutbid({ pot: 200_000_000n } as never)).toBe(220_000_000n)
    expect(smallestOutbid({ pot: 5n } as never)).toBe(6n)
  })
})
