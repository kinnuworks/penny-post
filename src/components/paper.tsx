import type { ReactNode } from 'react'
import { Image, useColorScheme, View, type ViewStyle } from 'react-native'
import { paperShadow } from '../theme'

const stock = require('../../assets/paper.jpg')

// A piece of paper lying on the table: aged cream stock and a soft shadow.
// Question cards, notes and tiles are all cut from it. By lamplight the photo
// of the paper is left out, so light text still reads on it.
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
  const isDark = useColorScheme() === 'dark'
  return (
    <View
      className={`overflow-hidden rounded-card border border-rule bg-paper-raised ${className}`}
      style={[paperShadow, tilt ? { transform: [{ rotate: `${tilt}deg` }] } : null, style]}
    >
      {isDark ? null : (
        <Image
          accessibilityElementsHidden
          importantForAccessibility="no"
          resizeMode="cover"
          source={stock}
          style={{ bottom: 0, height: undefined, left: 0, position: 'absolute', right: 0, top: 0, width: undefined }}
        />
      )}
      {children}
    </View>
  )
}
