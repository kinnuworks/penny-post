// The same clock the program keeps: the post comes at 08:00 in the reader's
// own time zone. Kept in step with `next_delivery` in anchor/programs/dak/src/state.rs.

const SECONDS_PER_DAY = 86_400
const DELIVERY_SECOND_OF_DAY = 8 * 3_600

/** Next 08:00 in the reader's time zone, strictly after `now`. Unix seconds in and out. */
export function nextDelivery(now: number, utcOffsetMinutes: number): number {
  const offset = utcOffsetMinutes * 60
  const local = now + offset
  const dayStart = Math.floor(local / SECONDS_PER_DAY) * SECONDS_PER_DAY
  let delivery = dayStart + DELIVERY_SECOND_OF_DAY
  if (delivery <= local) {
    delivery += SECONDS_PER_DAY
  }
  return delivery - offset
}

/** This phone's offset from UTC in minutes, east positive. Kolkata is 330. */
export function deviceUtcOffsetMinutes(date = new Date()): number {
  return -date.getTimezoneOffset()
}

/** "this morning at 8", "tomorrow at 8", said the way you would say it out loud. */
export function describeDelivery(deliverAt: number, now: number, utcOffsetMinutes: number): string {
  const offset = utcOffsetMinutes * 60
  const dayOf = (timestamp: number) => Math.floor((timestamp + offset) / SECONDS_PER_DAY)
  const days = dayOf(deliverAt) - dayOf(now)
  if (days <= 0) {
    return 'this morning at 8'
  }
  if (days === 1) {
    return 'tomorrow at 8'
  }
  return `in ${days} days, at 8`
}
