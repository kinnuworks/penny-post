import { describe, expect, it } from 'vitest'
import { formatTokens } from './format-tokens'

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
