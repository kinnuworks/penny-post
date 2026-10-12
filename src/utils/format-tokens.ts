/** 12500000 with six decimals becomes "12.5". Trailing zeros are dropped. */
export function formatTokens(amount: bigint, decimals: number): string {
  const unit = 10n ** BigInt(decimals)
  const whole = groupThousands(amount / unit)
  const fraction = (amount % unit).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

/**
 * The same, cut down to a couple of decimal places for a sentence where the
 * exact figure would only get in the way: 25714286 with six decimals reads "25.71".
 * Rounded down, so it never promises more than there is.
 */
export function formatTokensRoughly(amount: bigint, decimals: number, places = 2): string {
  const step = 10n ** BigInt(Math.max(decimals - places, 0))
  return formatTokens((amount / step) * step, decimals)
}

/**
 * 1234567 becomes "1,234,567". Done by hand because the phone's JavaScript
 * engine prints a bigint without separators whatever locale it is given.
 */
export function groupThousands(whole: bigint | number): string {
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * "12.5" with six decimals becomes 12500000. Returns null for anything that is
 * not a plain amount, or that has more decimal places than the token does.
 */
export function parseTokens(text: string, decimals: number): bigint | null {
  const match = /^(\d{1,15})(?:\.(\d*))?$/.exec(text.trim().replace(/,/g, ''))
  if (!match) {
    return null
  }
  const fraction = match[2] ?? ''
  if (fraction.length > decimals) {
    return null
  }
  return BigInt(match[1]) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0')
}
