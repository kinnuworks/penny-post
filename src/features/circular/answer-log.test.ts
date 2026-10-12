import { describe, expect, it } from 'vitest'
import { streakOf } from './answer-log'

describe('streakOf', () => {
  it('counts a run that ends today', () => {
    expect(streakOf([10, 11, 12], 12)).toBe(3)
  })
  it('keeps a run alive when today is not answered yet', () => {
    expect(streakOf([10, 11], 12)).toBe(2)
  })
  it('ends a run after a missed day', () => {
    expect(streakOf([8, 9, 11], 12)).toBe(1)
    expect(streakOf([8, 9], 12)).toBe(0)
  })
  it('is nothing for an empty log', () => {
    expect(streakOf([], 12)).toBe(0)
  })
})
