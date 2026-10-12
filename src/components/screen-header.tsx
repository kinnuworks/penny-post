import { Pressable, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { usePalette } from '../theme'

// A back arrow on the left and the screen's name in the middle.
export function ScreenHeader({ backLabel, onBack, title }: { backLabel: string; onBack: () => void; title: string }) {
  const palette = usePalette()
  return (
    <View className="h-12 flex-row items-center justify-center">
      <Pressable
        accessibilityLabel={backLabel}
        accessibilityRole="button"
        className="absolute left-0 h-12 w-12 items-start justify-center"
        hitSlop={10}
        onPress={onBack}
      >
        <Svg height={22} viewBox="0 0 22 22" width={22}>
          <Path
            d="M13.5 4.5L7 11l6.5 6.5"
            fill="none"
            stroke={palette.ink}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        </Svg>
      </Pressable>
      <Text className="font-title text-[19px] text-ink">{title}</Text>
    </View>
  )
}
