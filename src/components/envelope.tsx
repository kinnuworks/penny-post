import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import { Image, useColorScheme, View } from 'react-native'
import Svg, { Path, Polyline } from 'react-native-svg'
import { paperShadow, usePalette } from '../theme'
import { Give } from './motion'
import { Paper } from './paper'

const photo = require('../../assets/envelope.webp')
/** The colour of the photographed paper where a stamp sits, for biting perforations out of it. */
export const ENVELOPE_TONE = '#e3d0b3'
/** The photograph's own shape, so it is never stretched. */
const SHAPE = 1100 / 640

// An envelope on the doormat: the stamp top right, what it holds written
// across the lower half, and a round button that says it can be opened. In
// daylight it is a photograph of a real one. By lamplight it is drawn, so the
// app's light text still reads on it.
export function Envelope({
  accessibilityLabel,
  children,
  onPress,
  stamp,
  tilt = 0,
}: {
  accessibilityLabel: string
  children: ReactNode
  onPress?: () => void
  stamp?: ReactNode
  tilt?: number
}) {
  const palette = usePalette()
  const isDark = useColorScheme() === 'dark'

  const open = onPress ? (
    <View className="h-11 w-11 items-center justify-center rounded-full bg-ink">
      <Svg height={18} viewBox="0 0 18 18" width={18}>
        <Path
          d="M3 9h12M10 4l5 5-5 5"
          fill="none"
          stroke={palette.paper}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
        />
      </Svg>
    </View>
  ) : null

  return (
    <Give
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={() => {
        void Haptics.selectionAsync()
        onPress?.()
      }}
    >
      {isDark ? (
        <Paper tilt={tilt}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ height: 76, left: 0, position: 'absolute', right: 0, top: 0 }}
          >
            <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 40" width="100%">
              <Polyline
                fill="none"
                points="0,0 50,34 100,0"
                stroke={palette.rule}
                strokeWidth={0.7}
                vectorEffect="non-scaling-stroke"
              />
            </Svg>
          </View>
          {stamp ? <View style={{ position: 'absolute', right: 14, top: 14 }}>{stamp}</View> : null}
          <View className="flex-row items-end justify-between px-6 pb-5 pt-[86px]">
            <View className="flex-1 pr-4">{children}</View>
            {open}
          </View>
        </Paper>
      ) : (
        <View
          style={[
            paperShadow,
            { aspectRatio: SHAPE, borderRadius: 6, transform: tilt ? [{ rotate: `${tilt}deg` }] : undefined },
          ]}
        >
          <Image
            accessibilityElementsHidden
            importantForAccessibility="no"
            resizeMode="stretch"
            source={photo}
            style={{ bottom: 0, height: undefined, left: 0, position: 'absolute', right: 0, top: 0, width: undefined }}
          />
          {stamp ? (
            <View style={{ position: 'absolute', right: 20, top: 16, transform: [{ rotate: '4deg' }] }}>{stamp}</View>
          ) : null}
          <View style={{ bottom: 18, left: 24, position: 'absolute', right: 84 }}>{children}</View>
          <View style={{ bottom: 20, position: 'absolute', right: 22 }}>{open}</View>
        </View>
      )}
    </Give>
  )
}
