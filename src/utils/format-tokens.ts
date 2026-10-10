/** 12500000 with six decimals becomes "12.5". Trailing zeros are dropped. */
export function formatTokens(amount: bigint, decimals: number): string {
  const unit = 10n ** BigInt(decimals)
  const whole = (amount / unit).toLocaleString('en-US')
  const fraction = (amount % unit).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}
