import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import { Image, useColorScheme, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { paperShadow, usePalette } from '../theme'
import { Give } from './motion'

const photo = require('../../assets/envelope.webp')
const photoDark = require('../../assets/envelope-dark.webp')
/** The colour of the photographed paper where a stamp sits, for biting perforations out of it. */
export const ENVELOPE_TONE = '#e3d0b3'
/** The photograph's own shape, so it is never stretched. */
const SHAPE = 1100 / 640

// An envelope on the doormat: a photograph of a real one, the stamp top right,
// what it holds written on a label across the lower half, and a round button
// that says it can be opened. By lamplight the same envelope is shown darker.
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
      {
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
            source={isDark ? photoDark : photo}
            style={{ bottom: 0, height: undefined, left: 0, position: 'absolute', right: 0, top: 0, width: undefined }}
          />
          {stamp ? (
            <View style={{ position: 'absolute', right: 20, top: 16, transform: [{ rotate: '4deg' }] }}>{stamp}</View>
          ) : null}
          {/* An address label, so the writing does not have to fight the fold line. */}
          <View
            style={{
              backgroundColor: isDark ? 'rgba(30, 25, 21, 0.74)' : 'rgba(252, 246, 233, 0.78)',
              borderColor: isDark ? 'rgba(243, 232, 213, 0.14)' : 'rgba(120, 92, 54, 0.18)',
              borderRadius: 6,
              borderWidth: 1,
              bottom: 14,
              left: 16,
              paddingHorizontal: 12,
              paddingVertical: 8,
              position: 'absolute',
              right: 80,
            }}
          >
            {children}
          </View>
          <View style={{ bottom: 20, position: 'absolute', right: 22 }}>{open}</View>
        </View>
      }
    </Give>
  )
}
