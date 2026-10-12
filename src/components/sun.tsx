import { Image } from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'
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

const stamp = require('../../assets/stamp-sun.webp')

// The stamp on the day's question: orange, perforated, with a rising sun.
export function SunStamp({ size = 64 }: { size?: number }) {
  return <Image accessibilityLabel="Stamp with a rising sun" source={stamp} style={{ height: size, width: size }} />
}
