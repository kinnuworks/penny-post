import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Address } from '@solana/kit'

// The days this phone has answered the question, kept on the phone. The chain
// forgets an answer once its share is collected, so the run of mornings is
// remembered here. It is only for showing a streak and has no say over money.

const key = (owner: Address) => `penny-post/answered-days/v1/${owner}`
const KEEP = 120

export async function loadAnswerLog(owner: Address): Promise<number[]> {
  try {
    const stored = await AsyncStorage.getItem(key(owner))
    const days: unknown = stored ? JSON.parse(stored) : []
    return Array.isArray(days) ? days.filter((day): day is number => Number.isInteger(day)) : []
  } catch {
    return []
  }
}

/** Notes that `day` (a UTC day number) was answered. Safe to call twice. */
export async function recordAnswer(owner: Address, day: number): Promise<number[]> {
  const days = await loadAnswerLog(owner)
  if (days.includes(day)) {
    return days
  }
  const next = [...days, day].sort((a, b) => a - b).slice(-KEEP)
  await AsyncStorage.setItem(key(owner), JSON.stringify(next)).catch(() => undefined)
  return next
}

/**
 * How many mornings in a row have been answered. A run still counts if today
 * has not been answered yet, since there is the rest of the day to do it.
 */
export function streakOf(days: readonly number[], today: number): number {
  const answered = new Set(days)
  let day = answered.has(today) ? today : today - 1
  let run = 0
  while (answered.has(day)) {
    run++
    day--
  }
  return run
}
