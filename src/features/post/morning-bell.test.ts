import { describe, expect, it, vi } from 'vitest'

// The planning is plain arithmetic. The native notifications module is not
// needed to test it, and does not exist outside a phone.
vi.mock('expo-notifications', () => ({}))

const { bellFor, planMornings } = await import('./morning-bell')

// 2026-10-10T00:00:00Z
const MIDNIGHT_UTC = 1_791_590_400
const HOUR = 3_600
const DAY = 86_400
const KOLKATA = 330
/** 08:00 in Kolkata is 02:30 UTC. */
const EIGHT_IN_KOLKATA = MIDNIGHT_UTC + 2.5 * HOUR

describe('planMornings', () => {
  it('plans a week of eight o’clocks on the reader’s clock', () => {
    const mornings = planMornings(MIDNIGHT_UTC, KOLKATA, [])
    expect(mornings).toHaveLength(7)
    expect(mornings[0].at).toBe(EIGHT_IN_KOLKATA)
    expect(mornings[6].at).toBe(EIGHT_IN_KOLKATA + 6 * DAY)
    expect(mornings.every((morning) => morning.cards === 0)).toBe(true)
  })

  it('counts each card on the morning it arrives', () => {
    const mornings = planMornings(MIDNIGHT_UTC, KOLKATA, [EIGHT_IN_KOLKATA, EIGHT_IN_KOLKATA, EIGHT_IN_KOLKATA + DAY])
    expect(mornings.map((morning) => morning.cards)).toEqual([2, 1, 0, 0, 0, 0, 0])
  })

  it('leaves out a card that has already arrived', () => {
    const mornings = planMornings(MIDNIGHT_UTC + 3 * HOUR, KOLKATA, [EIGHT_IN_KOLKATA])
    expect(mornings[0].at).toBe(EIGHT_IN_KOLKATA + DAY)
    expect(mornings[0].cards).toBe(0)
  })

  it('counts an express card that lands between posts with the next morning', () => {
    const mornings = planMornings(MIDNIGHT_UTC, KOLKATA, [EIGHT_IN_KOLKATA + 5 * HOUR])
    expect(mornings.map((morning) => morning.cards)).toEqual([0, 1, 0, 0, 0, 0, 0])
  })
})

describe('bellFor', () => {
  it('says how much post there is', () => {
    expect(bellFor({ at: 0, cards: 1 }).body).toBe('One card on the doormat.')
    expect(bellFor({ at: 0, cards: 3 }).body).toBe('3 cards on the doormat.')
  })

  it('does not claim post it does not know about', () => {
    const quiet = bellFor({ at: 0, cards: 0 })
    expect(quiet.title).not.toMatch(/has come/)
  })
})
