import { useRef, useState } from 'react'
import { View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { MAX_STROKES, WRITING_BOX } from '../card/card'
import { cardStock } from '../../theme'

type Point = { x: number; y: number }

// A patch of card to write on with a finger. Each stroke is kept as SVG path
// data in WRITING_BOX units, so it draws the same on any screen.
export function HandwritingPad({ onChange, strokes }: { onChange: (strokes: string[]) => void; strokes: string[] }) {
  const [live, setLive] = useState<string | null>(null)
  const points = useRef<Point[]>([])
  const scale = useRef(1)

  function measure(event: LayoutChangeEvent) {
    scale.current = WRITING_BOX.width / event.nativeEvent.layout.width
  }

  function pointFrom(event: GestureResponderEvent): Point {
    const { locationX, locationY } = event.nativeEvent
    return {
      x: clamp(locationX * scale.current, 0, WRITING_BOX.width),
      y: clamp(locationY * scale.current, 0, WRITING_BOX.height),
    }
  }

  function begin(event: GestureResponderEvent) {
    points.current = [pointFrom(event)]
    setLive(toPath(points.current))
  }

  function move(event: GestureResponderEvent) {
    points.current.push(pointFrom(event))
    setLive(toPath(points.current))
  }

  function end() {
    if (points.current.length > 0 && strokes.length < MAX_STROKES) {
      onChange([...strokes, toPath(points.current)])
    }
    points.current = []
    setLive(null)
  }

  return (
    <View
      accessibilityLabel="Writing area. Write your message with a finger."
      onLayout={measure}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => {
        begin(event)
        // Returning true stops the page from scrolling under the pen on Android.
        return true
      }}
      onResponderMove={move}
      onResponderRelease={end}
      onResponderTerminate={end}
      onResponderTerminationRequest={() => false}
      onStartShouldSetResponder={() => true}
      style={{
        aspectRatio: WRITING_BOX.width / WRITING_BOX.height,
        backgroundColor: cardStock.face,
        borderColor: cardStock.rule,
        borderRadius: 6,
        borderWidth: 1,
        width: '100%',
      }}
    >
      <Svg height="100%" pointerEvents="none" viewBox={`0 0 ${WRITING_BOX.width} ${WRITING_BOX.height}`} width="100%">
        {/* Faint rules to write along, like the lines on an air letter. */}
        {[1, 2, 3, 4, 5, 6].map((line) => (
          <Path
            d={`M14 ${line * 44} L${WRITING_BOX.width - 14} ${line * 44}`}
            key={line}
            stroke={cardStock.rule}
            strokeWidth={1}
          />
        ))}
        {[...strokes, ...(live ? [live] : [])].map((stroke, index) => (
          <Path
            d={stroke}
            fill="none"
            key={index}
            stroke={cardStock.ink}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.4}
          />
        ))}
      </Svg>
    </View>
  )
}

/** A dot for a tap, and for a drag a line smoothed through the midpoints. */
export function toPath(points: Point[]): string {
  const [first, ...rest] = points
  if (!first) {
    return ''
  }
  if (rest.length === 0) {
    return `M${n(first.x)} ${n(first.y)} L${n(first.x + 0.1)} ${n(first.y + 0.1)}`
  }
  let path = `M${n(first.x)} ${n(first.y)}`
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i]
    const next = points[i + 1]
    path += ` Q${n(current.x)} ${n(current.y)} ${n((current.x + next.x) / 2)} ${n((current.y + next.y) / 2)}`
  }
  const last = points[points.length - 1]
  return `${path} L${n(last.x)} ${n(last.y)}`
}

function n(value: number): string {
  return String(Math.round(value * 10) / 10)
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}
