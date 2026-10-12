import * as Haptics from 'expo-haptics'
import { Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { usePalette } from '../theme'
import { Give } from './motion'

type Tone = 'accent' | 'plain'

// The one button shape in the app: a pill, filled with ink for the thing to do
// next and outlined for the other way out. It sinks a little when pressed.
export function InkButton({
  arrow = false,
  disabled,
  label,
  onPress,
  tone = 'accent',
}: {
  /** A small arrow after the label, for buttons that lead somewhere. */
  arrow?: boolean
  disabled?: boolean
  label: string
  onPress: () => void
  tone?: Tone
}) {
  const palette = usePalette()
  const filled = tone === 'accent'
  const surface = filled ? 'bg-ink' : 'border-[1.5px] border-ink bg-transparent'
  const text = filled ? 'text-paper' : 'text-ink'

  return (
    <Give
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress()
      }}
      style={filled && !disabled ? { borderRadius: 999, boxShadow: '0px 8px 18px rgba(38, 34, 32, 0.22)' } : undefined}
    >
      <View
        className={`min-h-[56px] flex-row items-center justify-center rounded-full px-7 ${surface} ${disabled ? 'opacity-45' : ''}`}
      >
        {/* The label takes the room that is left and centres in it. Sized to its
            own text, Android can measure it a pixel short and drop its last word. */}
        <Text className={`flex-1 text-center font-label text-[16px] ${text}`} textBreakStrategy="simple">
          {label}
        </Text>
        {arrow ? (
          <View style={{ position: 'absolute', right: 24 }}>
            <Svg height={18} viewBox="0 0 18 18" width={18}>
              <Path
                d="M3 9h12M10 4l5 5-5 5"
                fill="none"
                stroke={filled ? palette.paper : palette.ink}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
              />
            </Svg>
          </View>
        ) : null}
      </View>
    </Give>
  )
}
