import type { ReactNode } from 'react'
import { Image, View, type ViewStyle } from 'react-native'
import { paperShadow } from '../theme'

const grain = require('../../assets/grain.png')

// A piece of paper lying on the table: tan stock, a little grain, a soft
// shadow. Envelopes, question cards and notes are all cut from it.
export function Paper({
  children,
  className = '',
  style,
  tilt = 0,
}: {
  children?: ReactNode
  className?: string
  style?: ViewStyle
  tilt?: number
}) {
  return (
    <View
      className={`overflow-hidden rounded-card border border-rule bg-paper-raised ${className}`}
      style={[paperShadow, tilt ? { transform: [{ rotate: `${tilt}deg` }] } : null, style]}
    >
      <Image
        accessibilityElementsHidden
        importantForAccessibility="no"
        resizeMode="stretch"
        source={grain}
        style={{ bottom: 0, height: undefined, left: 0, position: 'absolute', right: 0, top: 0, width: undefined }}
      />
      {children}
    </View>
  )
}
