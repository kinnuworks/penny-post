import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { copy } from '../copy'
import { usePalette } from '../theme'

export type Tab = 'home' | 'archive' | 'send' | 'profile'

const ROUTES: Record<Tab, '/' | '/kept' | '/write' | '/profile'> = {
  home: '/',
  archive: '/kept',
  send: '/write',
  profile: '/profile',
}

// The four rooms of the post office. Home stays at the bottom of the stack and
// the other three take turns on top of it, so Back always leads home.
export function TabBar({ current }: { current: Tab }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const palette = usePalette()

  function go(tab: Tab) {
    if (tab === current) {
      return
    }
    if (tab === 'home') {
      router.dismissTo('/')
    } else if (current === 'home') {
      router.push(ROUTES[tab])
    } else {
      router.replace(ROUTES[tab])
    }
  }

  return (
    <View
      className="flex-row border-t border-rule bg-paper px-2 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      {(Object.keys(ROUTES) as Tab[]).map((tab) => {
        const isCurrent = tab === current
        const color = isCurrent ? palette.accent : palette.inkSoft
        return (
          <Pressable
            accessibilityLabel={copy.tabs[tab]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isCurrent }}
            className="flex-1 items-center gap-1 py-1"
            hitSlop={6}
            key={tab}
            onPress={() => go(tab)}
          >
            <Icon color={color} filled={isCurrent} tab={tab} />
            <Text className={`font-caption text-[12px] ${isCurrent ? 'text-accent' : 'text-ink-soft'}`}>
              {copy.tabs[tab]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function Icon({ color, filled, tab }: { color: string; filled: boolean; tab: Tab }) {
  const line = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.6,
  } as const
  return (
    <Svg height={24} viewBox="0 0 24 24" width={24}>
      {tab === 'home' ? (
        <Path d="M4 11l8-7 8 7v8.5H14.5V14h-5v5.5H4z" {...line} fill={filled ? color : 'none'} />
      ) : tab === 'archive' ? (
        <>
          <Path d="M4.5 5h15v4h-15zM6 9v10h12V9" {...line} />
          <Path d="M10 13h4" {...line} />
        </>
      ) : tab === 'send' ? (
        <Path d="M20 4L3.5 10.5l6.5 2.7 2.7 6.5zM10 13.2L20 4" {...line} />
      ) : (
        <>
          <Circle cx={12} cy={8.5} r={3.6} {...line} fill={filled ? color : 'none'} />
          <Path d="M5 20c0-3.6 3.1-5.8 7-5.8s7 2.2 7 5.8" {...line} fill={filled ? color : 'none'} />
        </>
      )}
    </Svg>
  )
}
