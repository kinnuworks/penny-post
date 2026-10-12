import * as Haptics from 'expo-haptics'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg'
import { copy } from '../../copy'

// The first thing anyone sees: a letterbox on a hill at sunrise, waiting.
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
          <Text className="mt-3 text-center font-body text-[20px] leading-[28px] text-[#3a2a1c]">
            {copy.welcome.line}
          </Text>
        </View>

        <View>
          {error ? <Text className="mb-3 text-center font-body text-body text-[#fff3dc]">{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isBusy }}
            className={`min-h-[56px] flex-row items-center justify-center rounded-full bg-[#fbf3e2] px-6 active:opacity-90 ${isBusy ? 'opacity-70' : ''}`}
            disabled={isBusy}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onConnect()
            }}
          >
            <Text className="font-label text-[17px] text-[#2a1d14]">
              {isBusy ? copy.welcome.connecting : copy.welcome.connect}
            </Text>
          </Pressable>
          <Text className="mt-4 text-center font-caption text-caption text-[#f3e3c6]">{copy.welcome.foot}</Text>
        </View>
      </View>
    </View>
  )
}

function Sunrise() {
  return (
    <Svg height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 360 780" width="100%">
      <Defs>
        <LinearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#f0a85e" />
          <Stop offset="0.3" stopColor="#f6c283" />
          <Stop offset="0.52" stopColor="#fbe2ae" />
          <Stop offset="1" stopColor="#f6c283" />
        </LinearGradient>
        <LinearGradient id="dusk" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor="#1c150d" stopOpacity="0" />
          <Stop offset="1" stopColor="#1c150d" stopOpacity="0.72" />
        </LinearGradient>
        <LinearGradient id="box" x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0" stopColor="#8a5330" />
          <Stop offset="1" stopColor="#5f3719" />
        </LinearGradient>
      </Defs>

      <Rect fill="url(#sky)" height={780} width={360} />
      <Circle cx={132} cy={392} fill="#fff4cf" opacity={0.35} r={58} />
      <Circle cx={132} cy={392} fill="#fff4cf" opacity={0.55} r={36} />
      <Circle cx={132} cy={392} fill="#fffbe8" r={20} />

      {/* Far hills, then nearer ones, each a little darker. */}
      <Path d="M0 420 L60 384 L112 408 L178 362 L240 402 L300 376 L360 410 L360 780 L0 780 Z" fill="#c79a82" />
      <Path d="M0 452 L70 418 L140 446 L214 410 L290 450 L360 424 L360 780 L0 780 Z" fill="#a67e69" />
      <Ellipse cx={180} cy={470} fill="#f9dca6" opacity={0.5} rx={200} ry={10} />
      <Path d="M0 500 L88 466 L170 498 L250 470 L360 506 L360 780 L0 780 Z" fill="#6f6a48" />
      <Path d="M0 566 Q90 520 190 556 T360 540 L360 780 L0 780 Z" fill="#4c4a30" />
      <Path d="M0 640 Q120 580 230 620 T360 610 L360 780 L0 780 Z" fill="#2f2c1c" />

      {/* The letterbox on its post. */}
      <Rect fill="#3d2513" height={150} rx={2} width={12} x={226} y={548} />
      <Path d="M168 478 L304 478 L312 494 L160 494 Z" fill="#4a2a13" />
      <Rect fill="url(#box)" height={66} rx={4} width={136} x={168} y={492} />
      <Rect fill="#2a180b" height={7} rx={3.5} width={74} x={199} y={506} />
      <Rect fill="#e9d3a6" height={24} rx={2} width={100} x={186} y={524} />
      <SvgText
        fill="#4a2a13"
        fontFamily="Lora_700Bold"
        fontSize={10.5}
        letterSpacing={1.6}
        textAnchor="middle"
        x={236}
        y={540.5}
      >
        PENNY POST
      </SvgText>
      {/* The little flag, up: there is post. */}
      <Rect fill="#3d2513" height={34} width={3} x={306} y={470} />
      <Path d="M309 470 L328 477 L309 484 Z" fill="#d9622b" />

      {/* Grass in front, catching the light. */}
      {[18, 46, 82, 120, 152, 262, 296, 332].map((x, index) => (
        <Path
          d={`M${x} 690 q4 -26 ${index % 2 ? 9 : -7} -40 M${x + 6} 690 q2 -20 ${index % 2 ? -8 : 10} -30`}
          fill="none"
          key={x}
          stroke="#8a7a3c"
          strokeLinecap="round"
          strokeWidth={2}
        />
      ))}

      <Rect fill="url(#dusk)" height={330} width={360} y={450} />
    </Svg>
  )
}
