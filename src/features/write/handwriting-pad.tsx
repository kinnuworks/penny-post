import { useEffect, useMemo, useRef, useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
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
  // The pen below is made once, so it reads the latest strokes from here.
  const latest = useRef({ onChange, strokes })
  useEffect(() => {
    latest.current = { onChange, strokes }
  }, [onChange, strokes])

  function measure(event: LayoutChangeEvent) {
    scale.current = WRITING_BOX.width / event.nativeEvent.layout.width
  }

  // The pen is a native gesture, and it takes the touch as soon as it lands.
  // A plain touch handler loses a downward stroke to the page's scrolling.
  //
  // The handlers below read refs, but only when a finger touches the pad and
  // never while rendering, which is what the lint rule is there to prevent.
  /* eslint-disable react-hooks/refs */
  const pen = useMemo(() => {
    const pointFrom = (x: number, y: number): Point => ({
      x: clamp(x * scale.current, 0, WRITING_BOX.width),
      y: clamp(y * scale.current, 0, WRITING_BOX.height),
    })
    return Gesture.Pan()
      .runOnJS(true)
      .maxPointers(1)
      .minDistance(0)
      .shouldCancelWhenOutside(false)
      .onBegin((event) => {
        points.current = [pointFrom(event.x, event.y)]
        setLive(toPath(points.current))
      })
      .onUpdate((event) => {
        points.current.push(pointFrom(event.x, event.y))
        setLive(toPath(points.current))
      })
      .onFinalize(() => {
        const { onChange: commit, strokes: sofar } = latest.current
        if (points.current.length > 0 && sofar.length < MAX_STROKES) {
          commit([...sofar, toPath(points.current)])
        }
        points.current = []
        setLive(null)
      })
  }, [])
  /* eslint-enable react-hooks/refs */

  return (
    <GestureDetector gesture={pen}>
      <View
        accessibilityLabel="Writing area. Write your message with a finger."
        onLayout={measure}
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
    </GestureDetector>
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
