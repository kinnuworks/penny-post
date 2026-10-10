// The stamp book. A stamp's id is what goes on-chain in the card's `stamp` field,
// so ids are never reused or renumbered.

export type StampArt = 'penny-red' | 'pillar-box' | 'kite' | 'express' | 'runner'

export interface Stamp {
  id: number
  name: string
  art: StampArt
  /** One line for the stamp book, in the counter clerk's voice. */
  note: string
}

export const stamps: Stamp[] = [
  {
    id: 1,
    name: 'Penny Red',
    art: 'penny-red',
    note: 'One a day, on the house, for every verified Seeker. Use it or lose it.',
  },
  {
    id: 2,
    name: 'Pillar Box',
    art: 'pillar-box',
    note: 'The everyday stamp. Goes anywhere a wallet lives.',
  },
  {
    id: 3,
    name: 'Kite',
    art: 'kite',
    note: 'For good news.',
  },
  {
    id: 4,
    name: 'Express',
    art: 'express',
    note: 'Skips the morning round. On their doormat now.',
  },
  {
    id: 5,
    name: 'The Runner',
    art: 'runner',
    note: 'Mail once crossed whole countries on foot, runner to runner.',
  },
]

export const FREE_STAMP_ID = 1
export const EXPRESS_STAMP_ID = 4

export function stampById(id: number): Stamp {
  return stamps.find((stamp) => stamp.id === id) ?? stamps[1]
}
