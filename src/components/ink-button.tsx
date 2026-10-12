import * as Haptics from 'expo-haptics'
import { Pressable, Text } from 'react-native'

type Tone = 'accent' | 'plain'

// The one button shape in the app: a pill, filled with ink for the thing to do
// next and outlined for the other way out.
export function InkButton({
  disabled,
  label,
  onPress,
  tone = 'accent',
}: {
  disabled?: boolean
  label: string
  onPress: () => void
  tone?: Tone
}) {
  const surface =
    tone === 'accent' ? 'bg-ink active:opacity-80' : 'border border-ink bg-transparent active:bg-paper-sunk'
  const text = tone === 'accent' ? 'text-paper' : 'text-ink'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress()
      }}
      className={`min-h-[54px] items-center justify-center rounded-full px-6 ${surface} ${disabled ? 'opacity-50' : ''}`}
    >
      {/* Full width and centred. Sized to its own text, Android can measure a
          label one pixel short and drop its last word onto a line nobody sees. */}
      <Text className={`w-full text-center font-label text-label ${text}`} textBreakStrategy="simple">
        {label}
      </Text>
    </Pressable>
  )
}
