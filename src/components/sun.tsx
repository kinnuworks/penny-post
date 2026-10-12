import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import { cardStock } from '../theme'

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315]

function ray(cx: number, cy: number, from: number, to: number, degrees: number): [number, number, number, number] {
  const angle = (degrees * Math.PI) / 180
  return [
    cx + Math.cos(angle) * from,
    cy + Math.sin(angle) * from,
    cx + Math.cos(angle) * to,
    cy + Math.sin(angle) * to,
  ]
}

// A sun drawn with a pen in the margin: a ring and eight short strokes.
// Without the ring it is only the rays, to put behind something else.
export function SunDoodle({
  color = cardStock.sun,
  ring = true,
  size = 56,
  stroke = 2.4,
}: {
  color?: string
  ring?: boolean
  size?: number
  stroke?: number
}) {
  return (
    <Svg accessibilityElementsHidden height={size} importantForAccessibility="no" viewBox="0 0 56 56" width={size}>
      {ring ? <Circle cx={28} cy={28} fill="none" r={9} stroke={color} strokeWidth={stroke} /> : null}
      {RAYS.map((degrees) => {
        const [x1, y1, x2, y2] = ray(28, 28, ring ? 15 : 21, degrees % 90 === 0 ? 26 : 24, degrees + 8)
        return (
          <Line
            key={degrees}
            stroke={color}
            strokeLinecap="round"
            strokeWidth={stroke}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
          />
        )
      })}
    </Svg>
  )
}

const BITE = 2.6
const GAP = 7

// The stamp on the day's question: a perforated square with a rising sun.
// `backing` is the colour it sits on, used to bite the perforations out.
export function SunStamp({ backing, size = 64 }: { backing: string; size?: number }) {
  const edge = 56
  const bites: [number, number][] = []
  for (let at = GAP / 2; at < edge; at += GAP) {
    bites.push([at, 0], [at, edge], [0, at], [edge, at])
  }
  return (
    <Svg accessibilityLabel="Stamp with a rising sun" height={size} viewBox={`0 0 ${edge} ${edge}`} width={size}>
      <Rect fill={cardStock.face} height={edge} width={edge} />
      {bites.map(([cx, cy]) => (
        <Circle cx={cx} cy={cy} fill={backing} key={`${cx}-${cy}`} r={BITE} />
      ))}
      <Rect fill={cardStock.sun} height={edge - 14} width={edge - 14} x={7} y={7} />
      <Path d="M17 35 a11 11 0 0 1 22 0" fill="none" stroke={cardStock.face} strokeLinecap="round" strokeWidth={2.2} />
      <Line stroke={cardStock.face} strokeLinecap="round" strokeWidth={2.2} x1={14} x2={42} y1={39} y2={39} />
      {[200, 235, 270, 305, 340].map((degrees) => {
        const [x1, y1, x2, y2] = ray(28, 35, 15, 19.5, degrees)
        return (
          <Line
            key={degrees}
            stroke={cardStock.face}
            strokeLinecap="round"
            strokeWidth={2.2}
            x1={x1}
            x2={x2}
            y1={y1}
            y2={y2}
          />
        )
      })}
    </Svg>
  )
}
