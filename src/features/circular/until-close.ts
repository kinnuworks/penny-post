/** "in about 9 hours", "in 40 minutes": how long until a moment, said the way you would say it out loud. */
export function untilClose(now: number, closeAt: number): string {
  const minutes = Math.ceil((closeAt - now) / 60)
  if (minutes <= 1) {
    return 'any minute now'
  }
  if (minutes < 60) {
    return `in ${minutes} minutes`
  }
  const hours = Math.round(minutes / 60)
  return hours === 1 ? 'in about an hour' : `in about ${hours} hours`
}
