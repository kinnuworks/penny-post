import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import Svg, { Path, Polyline } from 'react-native-svg'
import { usePalette } from '../theme'
import { Paper } from './paper'

// An envelope on the doormat. The flap is two pencil lines meeting in the
// middle, the stamp sits top right, and a round button says it can be opened.
export function Envelope({
  accessibilityLabel,
  children,
  edge = false,
  onPress,
  stamp,
  tilt = 0,
}: {
  accessibilityLabel: string
  children: ReactNode
  /** Airmail trim down the left side, for the one envelope that matters most today. */
  edge?: boolean
  onPress?: () => void
  stamp?: ReactNode
  tilt?: number
}) {
  const palette = usePalette()

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={() => {
        void Haptics.selectionAsync()
        onPress?.()
      }}
    >
      {({ pressed }) => (
        <Paper style={{ opacity: pressed ? 0.92 : 1 }} tilt={tilt}>
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
          {edge ? <View className="absolute bottom-0 left-0 top-0 w-[5px] bg-accent" /> : null}
          {stamp ? <View style={{ position: 'absolute', right: 14, top: 14 }}>{stamp}</View> : null}
          <View className="flex-row items-end justify-between px-6 pb-5 pt-[86px]">
            <View className="flex-1 pr-4">{children}</View>
            {onPress ? (
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
            ) : null}
          </View>
        </Paper>
      )}
    </Pressable>
  )
}
