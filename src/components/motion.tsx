import { useEffect, useState, type ReactNode } from 'react'
import * as Haptics from 'expo-haptics'
import {
  Animated,
  Easing,
  Image,
  Pressable,
  useColorScheme,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

// The few movements the app allows itself. Things arrive by rising a little
// into place, and anything pressed gives slightly under the thumb.

/** Fades its children in and lifts them into place. `delay` staggers a list. */
export function Rise({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode
  delay?: number
  style?: StyleProp<ViewStyle>
}) {
  const [arrived] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.timing(arrived, {
      delay,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start()
  }, [arrived, delay])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: arrived,
          transform: [{ translateY: arrived.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

/** A pressable that sinks a little while held. */
export function Give({
  children,
  depth = 0.97,
  style,
  ...pressable
}: Omit<PressableProps, 'children' | 'style'> & { children: ReactNode; depth?: number; style?: StyleProp<ViewStyle> }) {
  const [scale] = useState(() => new Animated.Value(1))
  const to = (value: number) =>
    Animated.spring(scale, { friction: 7, tension: 220, toValue: value, useNativeDriver: true }).start()

  return (
    <Pressable
      {...pressable}
      onPressIn={(event) => {
        to(depth)
        pressable.onPressIn?.(event)
      }}
      onPressOut={(event) => {
        to(1)
        pressable.onPressOut?.(event)
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  )
}

/**
 * Lands its children the way post lands on a doormat: dropped from above,
 * a little askew, with one small bounce and a tick under the thumb.
 */
export function Drop({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [fall] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const landing = setTimeout(() => {
      Animated.spring(fall, { friction: 6.5, tension: 62, toValue: 1, useNativeDriver: true }).start()
      setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined), 240)
    }, delay)
    return () => clearTimeout(landing)
  }, [delay, fall])

  return (
    <Animated.View
      style={{
        opacity: fall.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-130, 0] }) },
          { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}

const envelope = require('../../assets/envelope.webp')
const ENVELOPE_SHAPE = 1100 / 640
/** How much of the envelope's height is its front pocket, which the card slides out from behind. */
const POCKET = 0.42

/**
 * Brings its children out of an envelope. The card rises from behind the
 * envelope's front, then the envelope drops away. By lamplight, where the
 * envelope is drawn and not photographed, the card simply rises.
 */
export function OutOfEnvelope({ children }: { children: ReactNode }) {
  const isDark = useColorScheme() === 'dark'
  const [width, setWidth] = useState(0)
  const [out] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (width === 0) {
      return
    }
    Animated.timing(out, {
      delay: 160,
      duration: 1_050,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start()
    const tick = setTimeout(() => void Haptics.selectionAsync().catch(() => undefined), 420)
    return () => clearTimeout(tick)
  }, [out, width])

  const height = width / ENVELOPE_SHAPE
  // The envelope waits where the card will be, then falls away once the card is clear of it.
  const away = {
    opacity: out.interpolate({ inputRange: [0, 0.55, 0.95, 1], outputRange: [1, 1, 0, 0] }),
    transform: [
      {
        translateY: out.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [height * 0.3, height * 0.42, height * 1.5],
        }),
      },
    ],
  }

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {isDark || width === 0 ? null : (
        <Animated.View pointerEvents="none" style={[{ height, left: 0, position: 'absolute', top: 0, width }, away]}>
          <Image resizeMode="stretch" source={envelope} style={{ height, width }} />
        </Animated.View>
      )}
      <Animated.View
        style={{
          opacity: out.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: out.interpolate({ inputRange: [0, 0.6, 1], outputRange: [height * 0.34, 0, 0] }) },
            { scale: out.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 1, 1] }) },
          ],
        }}
      >
        {children}
      </Animated.View>
      {isDark || width === 0 ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              height: height * POCKET,
              left: 0,
              overflow: 'hidden',
              position: 'absolute',
              top: height * (1 - POCKET),
              width,
            },
            away,
          ]}
        >
          <Image
            resizeMode="stretch"
            source={envelope}
            style={{ height, position: 'absolute', top: -height * (1 - POCKET), width }}
          />
        </Animated.View>
      )}
    </View>
  )
}
