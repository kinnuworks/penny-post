import { useColorScheme } from 'react-native'

// The same tokens as src/global.css, for the places a class name cannot reach:
// SVG fills and strokes. Change a colour in both files or in neither.
const light = {
  paper: '#f4ebdd',
  paperRaised: '#fbf5ea',
  paperSunk: '#e9ddc9',
  ink: '#241c17',
  inkSoft: '#5e5146',
  inkFaint: '#9a8b7b',
  rule: '#d9cbb4',
  accent: '#d4412b',
  accentInk: '#b5321f',
  onAccent: '#fbf5ea',
}

const dark: Palette = {
  paper: '#1f1915',
  paperRaised: '#2a221c',
  paperSunk: '#171210',
  ink: '#f1e6d4',
  inkSoft: '#bfaf9a',
  inkFaint: '#7d6f60',
  rule: '#3a2f27',
  accent: '#ee6a4f',
  accentInk: '#ee6a4f',
  onAccent: '#1f1915',
}

export type Palette = typeof light

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light
}

// A card is always card stock, whatever the room's lighting. Its own colours
// do not change with the theme, the way a real postcard looks the same under a lamp.
export const cardStock = {
  face: '#fbf5ea',
  ink: '#241c17',
  inkSoft: '#5e5146',
  rule: '#d9cbb4',
  accent: '#d4412b',
} as const
