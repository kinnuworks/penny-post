import { Image, Text, View } from 'react-native'

const ink = require('../../assets/postmark.webp')

// A round cancel mark with its wavy lines, and the date struck in the middle
// of the ring. Rotated a few degrees, because nobody at a counter stamps straight.
export function Postmark({ date, place, tilt = -8 }: { date: string; place: string; tilt?: number }) {
  return (
    <View
      accessibilityLabel={`Postmarked ${place}, ${date}`}
      style={{ height: 96, opacity: 0.85, transform: [{ rotate: `${tilt}deg` }], width: 96 }}
    >
      <Image resizeMode="contain" source={ink} style={{ height: 96, width: 96 }} />
      {/* The ring sits left of centre in the picture, so the date does too. */}
      <View
        style={{ alignItems: 'center', height: 96, justifyContent: 'center', left: 9, position: 'absolute', width: 56 }}
      >
        <Text
          adjustsFontSizeToFit
          numberOfLines={2}
          style={{
            color: '#4a2e1f',
            fontFamily: 'Lora_700Bold',
            fontSize: 9,
            letterSpacing: 0.6,
            lineHeight: 11,
            textAlign: 'center',
            width: 40,
          }}
        >
          {date.toUpperCase()}
        </Text>
      </View>
    </View>
  )
}
