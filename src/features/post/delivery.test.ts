import { describe, expect, it } from 'vitest'
import { describeDelivery, nextDelivery } from './delivery'

// 2026-10-10T00:00:00Z. The same cases as the Rust tests in state.rs.
const MIDNIGHT_UTC = 1_791_590_400
const HOUR = 3_600

describe('nextDelivery', () => {
  it('delivers at eight the same morning', () => {
    expect(nextDelivery(MIDNIGHT_UTC + 3 * HOUR, 0)).toBe(MIDNIGHT_UTC + 8 * HOUR)
  })

  it('rolls to tomorrow once the post has come', () => {
    expect(nextDelivery(MIDNIGHT_UTC + 8 * HOUR, 0)).toBe(MIDNIGHT_UTC + 32 * HOUR)
  })

  it("follows the reader's time zone", () => {
    expect(nextDelivery(MIDNIGHT_UTC, 330)).toBe(MIDNIGHT_UTC + 2.5 * HOUR)
    expect(nextDelivery(MIDNIGHT_UTC, -420)).toBe(MIDNIGHT_UTC + 15 * HOUR)
  })
})

describe('describeDelivery', () => {
  it('says this morning before eight', () => {
    const now = MIDNIGHT_UTC + 3 * HOUR
    expect(describeDelivery(nextDelivery(now, 0), now, 0)).toBe('this morning at 8')
  })

  it('says tomorrow after eight', () => {
    const now = MIDNIGHT_UTC + 9 * HOUR
    expect(describeDelivery(nextDelivery(now, 0), now, 0)).toBe('tomorrow at 8')
  })
})
