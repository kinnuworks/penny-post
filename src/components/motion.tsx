import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Easing, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'

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
