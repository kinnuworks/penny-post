import { useColorScheme } from 'react-native'

// The same tokens as src/global.css, for the places a class name cannot reach:
// SVG fills and strokes. Change a colour in both files or in neither.
const light = {
  paper: '#faf3e5',
  paperRaised: '#f4e8d2',
  paperSunk: '#eadbc0',
  ink: '#262220',
  inkSoft: '#5e544a',
  inkFaint: '#9b8d7c',
  rule: '#e0d0b3',
  accent: '#e0862d',
  accentInk: '#b85c14',
  onAccent: '#fff9ec',
  sun: '#efae45',
}

const dark: Palette = {
  paper: '#1e1915',
  paperRaised: '#2b241d',
  paperSunk: '#16120f',
  ink: '#f3e8d5',
  inkSoft: '#c2b29c',
  inkFaint: '#7f7161',
  rule: '#3b3027',
  accent: '#f0a04a',
  accentInk: '#f0a04a',
  onAccent: '#1e1915',
  sun: '#efae45',
}

export type Palette = typeof light

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light
}

// A card is always card stock, whatever the room's lighting. Its own colours
// do not change with the theme, the way a real postcard looks the same under a lamp.
export const cardStock = {
  face: '#f8efdc',
  ink: '#262220',
  inkSoft: '#5e544a',
  rule: '#dccba9',
  // Stamps keep their own red, whatever the app's accent is.
  accent: '#c9502e',
  sun: '#efae45',
} as const

/** The soft shadow under anything made of paper. */
export const paperShadow = { boxShadow: '0px 6px 14px rgba(88, 58, 24, 0.16)' } as const
