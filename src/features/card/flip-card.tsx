import * as Haptics from 'expo-haptics'
import { useEffect, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const TURN_MS = 520

// Turns a card over like a hand would: around its long edge, with a small tap
// in the fingers when it lands.
export function FlipCard({
  back,
  front,
  onTurn,
  showing,
}: {
  back: ReactNode
  front: ReactNode
  onTurn: (side: 'front' | 'back') => void
  showing: 'front' | 'back'
}) {
  const turn = useSharedValue(showing === 'back' ? 1 : 0)

  const frontStyle = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden',
    transform: [{ perspective: 1200 }, { rotateX: `${interpolate(turn.value, [0, 1], [0, 180])}deg` }],
  }))
  const backStyle = useAnimatedStyle(() => ({
    backfaceVisibility: 'hidden',
    transform: [{ perspective: 1200 }, { rotateX: `${interpolate(turn.value, [0, 1], [-180, 0])}deg` }],
  }))

  // The parent says which side is up, so the card also turns by itself when a
  // picture is added or a stamp is chosen.
  useEffect(() => {
    turn.set(withTiming(showing === 'back' ? 1 : 0, { duration: TURN_MS }))
  }, [showing, turn])

  function flip() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onTurn(showing === 'front' ? 'back' : 'front')
  }

  return (
    <Pressable
      accessibilityHint="Turns the card over"
      accessibilityLabel={showing === 'front' ? 'Picture side of the card' : 'Writing side of the card'}
      accessibilityRole="button"
      onPress={flip}
    >
      <View>
        <Animated.View style={frontStyle}>{front}</Animated.View>
        <Animated.View style={[{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, backStyle]}>
          {back}
        </Animated.View>
      </View>
    </Pressable>
  )
}
