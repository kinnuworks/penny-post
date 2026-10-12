import { Image } from 'react-native'
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import type { StampArt as Art } from '../features/card/stamps'
import { cardStock } from '../theme'

const WIDTH = 72
const HEIGHT = 88
const BITE = 3.2
const BITE_GAP = 8

const printed: Partial<Record<Art, number>> = {
  express: require('../../assets/stamp-express.webp'),
  kite: require('../../assets/stamp-kite.webp'),
  'penny-red': require('../../assets/stamp-penny-red.webp'),
  'pillar-box': require('../../assets/stamp-pillar-box.webp'),
}
/** Width over height of the printed stamps. */
const PRINT_SHAPE = 1145 / 1374

// A postage stamp. Four of them are printed pictures. Any other is drawn:
// perforated edge, a ruled frame, one small picture in two inks, and `backing`
// is the colour it sits on, used to cut the perforations out of its edge.
export function StampArt({
  art,
  backing,
  label,
  size = 1,
}: {
  art: Art
  backing: string
  label: string
  size?: number
}) {
  const { accent, face, ink } = cardStock
  const print = printed[art]
  if (print) {
    const width = WIDTH * size * 1.06
    return (
      <Image
        accessibilityLabel={`${label} stamp`}
        resizeMode="contain"
        source={print}
        style={{ height: width / PRINT_SHAPE, width }}
      />
    )
  }

  return (
    <Svg
      accessibilityLabel={`${label} stamp`}
      height={HEIGHT * size}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH * size}
    >
      <Rect fill={face} height={HEIGHT} width={WIDTH} />
      {perforations().map(([cx, cy]) => (
        <Circle cx={cx} cy={cy} fill={backing} key={`${cx}-${cy}`} r={BITE} />
      ))}
      <Rect fill="none" height={HEIGHT - 16} stroke={ink} strokeWidth={1} width={WIDTH - 16} x={8} y={8} />
      <G>{picture(art, accent, ink)}</G>
      <SvgText
        fill={ink}
        fontFamily="Lora_700Bold"
        fontSize={6.5}
        letterSpacing={1.2}
        textAnchor="middle"
        x={WIDTH / 2}
        y={HEIGHT - 13}
      >
        {label.toUpperCase()}
      </SvgText>
    </Svg>
  )
}

function perforations(): [number, number][] {
  const points: [number, number][] = []
  for (let x = BITE_GAP / 2; x < WIDTH; x += BITE_GAP) {
    points.push([x, 0], [x, HEIGHT])
  }
  for (let y = BITE_GAP / 2; y < HEIGHT; y += BITE_GAP) {
    points.push([0, y], [WIDTH, y])
  }
  return points
}

function picture(art: Art, accent: string, ink: string) {
  switch (art) {
    case 'penny-red':
      // After the Penny Red of 1841: a solid red ground and the price, one penny.
      return (
        <>
          <Rect fill={accent} height={50} width={44} x={14} y={14} />
          <Rect fill="none" height={42} stroke={cardStock.face} strokeWidth={0.8} width={36} x={18} y={18} />
          <SvgText fill={cardStock.face} fontFamily="Lora_700Bold" fontSize={26} textAnchor="middle" x={36} y={48}>
            1d
          </SvgText>
        </>
      )
    case 'runner':
      // A mail runner mid-stride, mailbag on a staff over the shoulder.
      return (
        <>
          <Circle cx={38} cy={24} fill={ink} r={4} />
          <Path d="M38 28 L35 44 L27 58 M35 44 L44 56" fill="none" stroke={ink} strokeLinecap="round" strokeWidth={3} />
          <Path d="M37 32 L47 38 M37 32 L29 39" fill="none" stroke={ink} strokeLinecap="round" strokeWidth={2.5} />
          <Line stroke={ink} strokeLinecap="round" strokeWidth={1.5} x1={22} x2={50} y1={34} y2={22} />
          <Circle cx={22} cy={37} fill={accent} r={5.5} />
          <Line stroke={ink} strokeWidth={1} x1={16} x2={56} y1={62} y2={62} />
        </>
      )
    case 'pillar-box':
      return (
        <>
          <Path d="M25 24 Q36 14 47 24 Z" fill={accent} />
          <Rect fill={accent} height={36} width={22} x={25} y={24} />
          <Rect fill={ink} height={4} rx={1} width={14} x={29} y={31} />
          <Rect fill={cardStock.face} height={7} width={8} x={32} y={41} />
          <Rect fill={ink} height={4} width={28} x={22} y={60} />
        </>
      )
    case 'kite':
      return (
        <>
          <Path d="M36 16 L50 34 L36 54 L22 34 Z" fill={accent} />
          <Path d="M36 16 L36 54 M22 34 L50 34" fill="none" stroke={cardStock.face} strokeWidth={1} />
          <Path d="M36 54 Q30 58 36 62 Q42 65 34 68" fill="none" stroke={ink} strokeLinecap="round" strokeWidth={1.3} />
        </>
      )
    case 'express':
      // Airmail slashes and an arrow that has somewhere to be.
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Path d={`M${16 + i * 11} 30 l7 0 l-6 12 l-7 0 Z`} fill={i % 2 === 0 ? accent : ink} key={i} />
          ))}
          <Path
            d="M16 54 L50 54 M43 48 L51 54 L43 60"
            fill="none"
            stroke={ink}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
          />
        </>
      )
  }
}
