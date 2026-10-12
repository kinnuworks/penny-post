import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Animated, Easing, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { Give, Rise } from '../../components/motion'
import { copy } from '../../copy'

const sunset = require('../../../assets/welcome.jpg')

// The first thing anyone sees: a letterbox on a hill at sunset, waiting.
export function WelcomeScreen({
  error,
  isBusy,
  onConnect,
}: {
  error: string | null
  isBusy: boolean
  onConnect: () => void
}) {
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1">
      <View style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}>
        <Sunrise />
      </View>

      <View
        className="flex-1 justify-between px-7"
        style={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top + 56 }}
      >
        <View className="items-center">
          <Rise delay={150} style={{ alignSelf: 'stretch' }}>
            {/* Full width and centred. Sized to its own text, Android can measure it
                a pixel short and drop the second word. */}
            <Text
              adjustsFontSizeToFit
              className="w-full text-center font-script text-[72px] leading-[84px] text-[#2a1d14]"
              numberOfLines={1}
              style={{ transform: [{ rotate: '-5deg' }] }}
              textBreakStrategy="simple"
            >
              {copy.appName}
            </Text>
          </Rise>
          <Rise delay={380} style={{ alignSelf: 'stretch' }}>
            <Text className="mt-3 w-full text-center font-body text-[20px] leading-[28px] text-[#3a2a1c]">
              {copy.welcome.line}
            </Text>
          </Rise>
        </View>

        <Rise delay={650}>
          {error ? <Text className="mb-3 text-center font-body text-body text-[#fff3dc]">{error}</Text> : null}
          <Give
            accessibilityLabel={copy.welcome.connect}
            accessibilityRole="button"
            accessibilityState={{ disabled: isBusy }}
            disabled={isBusy}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onConnect()
            }}
            style={{ borderRadius: 999, boxShadow: '0px 10px 24px rgba(0, 0, 0, 0.35)' }}
          >
            <View
              className={`min-h-[58px] flex-row items-center justify-center rounded-full bg-[#fbf3e2] px-7 ${isBusy ? 'opacity-70' : ''}`}
            >
              <Text className="flex-1 text-center font-label text-[17px] text-[#2a1d14]" textBreakStrategy="simple">
                {isBusy ? copy.welcome.connecting : copy.welcome.connect}
              </Text>
            </View>
          </Give>
          <Text className="mt-4 w-full text-center font-caption text-caption text-[#f3e3c6]">{copy.welcome.foot}</Text>
        </Rise>
      </View>
    </View>
  )
}

// A real letterbox at sunset, with the foot of the picture darkened so the
// button and the line under it stay readable.
function Sunrise() {
  // The picture drifts closer and back, slowly enough to be felt more than seen.
  const [drift] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          duration: 16_000,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          duration: 16_000,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    )
    breathing.start()
    return () => breathing.stop()
  }, [drift])

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <Animated.Image
        accessibilityLabel="A wooden letterbox on a hill above the sea at sunset"
        resizeMode="cover"
        source={sunset}
        style={{
          height: '100%',
          transform: [{ scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }) }],
          width: '100%',
        }}
      />
      <View style={{ bottom: 0, height: '38%', left: 0, position: 'absolute', right: 0 }}>
        <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 10 10" width="100%">
          <Defs>
            <LinearGradient id="dusk" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor="#1c150d" stopOpacity="0" />
              <Stop offset="1" stopColor="#1c150d" stopOpacity="0.82" />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#dusk)" height={10} width={10} />
        </Svg>
      </View>
    </View>
  )
}
