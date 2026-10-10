import * as Haptics from 'expo-haptics'
import { Pressable, Text } from 'react-native'

type Tone = 'accent' | 'plain'

// The one button shape in the app: a flat inked block with square-ish corners,
// like a rubber stamp's face.
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
    tone === 'accent' ? 'bg-accent active:bg-accent-ink' : 'border border-ink bg-transparent active:bg-paper-sunk'
  const text = tone === 'accent' ? 'text-on-accent' : 'text-ink'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress()
      }}
      className={`min-h-[52px] items-center justify-center rounded-card px-6 ${surface} ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={`font-label text-label ${text}`}>{label}</Text>
    </Pressable>
  )
}
