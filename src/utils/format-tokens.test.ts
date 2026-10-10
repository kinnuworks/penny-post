import { describe, expect, it } from 'vitest'
import { formatTokens, parseTokens } from './format-tokens'

describe('formatTokens', () => {
  it('drops trailing zeros', () => {
    expect(formatTokens(12_500_000n, 6)).toBe('12.5')
    expect(formatTokens(10_000_000n, 6)).toBe('10')
  })

  it('keeps small fractions exact', () => {
    expect(formatTokens(1n, 6)).toBe('0.000001')
    expect(formatTokens(0n, 6)).toBe('0')
  })

  it('groups thousands', () => {
    expect(formatTokens(1_234_567_000_000n, 6)).toBe('1,234,567')
  })

  it('handles a token with no decimals', () => {
    expect(formatTokens(42n, 0)).toBe('42')
  })
})

describe('parseTokens', () => {
  it('reads whole and fractional amounts', () => {
    expect(parseTokens('10', 6)).toBe(10_000_000n)
    expect(parseTokens('12.5', 6)).toBe(12_500_000n)
    expect(parseTokens(' 1,250 ', 6)).toBe(1_250_000_000n)
    expect(parseTokens('3.', 6)).toBe(3_000_000n)
  })

  it('round-trips what formatTokens prints', () => {
    for (const amount of [0n, 1n, 5_000_000n, 1_234_567_000_001n]) {
      expect(parseTokens(formatTokens(amount, 6), 6)).toBe(amount)
    }
  })

  it('refuses anything that is not a plain amount', () => {
    expect(parseTokens('', 6)).toBeNull()
    expect(parseTokens('ten', 6)).toBeNull()
    expect(parseTokens('-4', 6)).toBeNull()
    expect(parseTokens('.5', 6)).toBeNull()
    expect(parseTokens('1e6', 6)).toBeNull()
  })

  it('refuses more decimal places than the token has', () => {
    expect(parseTokens('1.0000001', 6)).toBeNull()
    expect(parseTokens('1.5', 0)).toBeNull()
  })
})
