/** 12500000 with six decimals becomes "12.5". Trailing zeros are dropped. */
export function formatTokens(amount: bigint, decimals: number): string {
  const unit = 10n ** BigInt(decimals)
  const whole = (amount / unit).toLocaleString('en-US')
  const fraction = (amount % unit).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
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
