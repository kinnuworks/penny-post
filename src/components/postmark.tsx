import { Text, View } from 'react-native'

// A round cancel mark: place around the rim, date across the middle. Rotated a
// few degrees, because nobody at a counter stamps straight.
export function Postmark({ date, place, tilt = -8 }: { date: string; place: string; tilt?: number }) {
  return (
    <View
      accessibilityLabel={`Postmarked ${place}, ${date}`}
      className="h-24 w-24 items-center justify-center rounded-full border-2 border-ink-soft opacity-80"
      style={{ transform: [{ rotate: `${tilt}deg` }] }}
    >
      <View className="h-[84px] w-[84px] items-center justify-center rounded-full border border-ink-soft">
        {/* A long place name shrinks to fit the ring instead of being cut off. */}
        <Text
          adjustsFontSizeToFit
          className="px-1.5 font-postmark text-postmark uppercase tracking-wide text-ink-soft"
          minimumFontScale={0.6}
          numberOfLines={1}
        >
          {place}
        </Text>
        <View className="my-1 h-px w-14 bg-ink-soft" />
        <Text className="font-postmark text-postmark uppercase tracking-widest text-ink-soft">{date}</Text>
      </View>
    </View>
  )
}
