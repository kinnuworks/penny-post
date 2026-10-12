import { Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { usePalette } from '../theme'
import { Give } from './motion'

// A round back button on the left and the screen's name in the middle.
export function ScreenHeader({ backLabel, onBack, title }: { backLabel: string; onBack: () => void; title: string }) {
  const palette = usePalette()
  return (
    <View className="mt-2 h-12 flex-row items-center justify-center">
      <View className="absolute left-0">
        <Give accessibilityLabel={backLabel} accessibilityRole="button" depth={0.9} hitSlop={10} onPress={onBack}>
          <View className="h-11 w-11 items-center justify-center rounded-full border border-rule bg-paper-raised">
            <Svg height={20} viewBox="0 0 22 22" width={20}>
              <Path
                d="M13.5 4.5L7 11l6.5 6.5"
                fill="none"
                stroke={palette.ink}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.9}
              />
            </Svg>
          </View>
        </Give>
      </View>
      <Text className="font-title text-[19px] text-ink">{title}</Text>
    </View>
  )
}
