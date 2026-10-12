import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path } from 'react-native-svg'
import { copy } from '../copy'
import { paperShadow, usePalette } from '../theme'
import { Give } from './motion'

export type Tab = 'home' | 'archive' | 'send' | 'profile'

const ROUTES: Record<Tab, '/' | '/kept' | '/write' | '/profile'> = {
  home: '/',
  archive: '/kept',
  send: '/write',
  profile: '/profile',
}

// The four rooms of the post office, on a bar that floats above the page. The
// room you are in is an inked pill with its name. Home stays at the bottom of
// the stack and the other three take turns on top of it, so Back leads home.
export function TabBar({ current }: { current: Tab }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const palette = usePalette()

  function go(tab: Tab) {
    if (tab === current) {
      return
    }
    void Haptics.selectionAsync()
    if (tab === 'home') {
      router.dismissTo('/')
    } else if (current === 'home') {
      router.push(ROUTES[tab])
    } else {
      router.replace(ROUTES[tab])
    }
  }

  return (
    <View className="px-5 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 10) + 4 }}>
      <View
        className="flex-row items-center justify-between rounded-full border border-rule bg-paper-raised p-[6px]"
        style={paperShadow}
      >
        {(Object.keys(ROUTES) as Tab[]).map((tab) => {
          const isCurrent = tab === current
          return (
            <Give
              accessibilityLabel={copy.tabs[tab]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isCurrent }}
              depth={0.92}
              hitSlop={6}
              key={tab}
              onPress={() => go(tab)}
            >
              <View
                className={`h-[48px] flex-row items-center justify-center gap-2 rounded-full ${isCurrent ? 'bg-ink px-5' : 'w-[58px]'}`}
              >
                <Icon color={isCurrent ? palette.paper : palette.inkSoft} tab={tab} />
                {isCurrent ? <Text className="font-label text-[14px] text-paper">{copy.tabs[tab]}</Text> : null}
              </View>
            </Give>
          )
        })}
      </View>
    </View>
  )
}

function Icon({ color, tab }: { color: string; tab: Tab }) {
  const line = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.7,
  } as const
  return (
    <Svg height={22} viewBox="0 0 24 24" width={22}>
      {tab === 'home' ? (
        <Path d="M4 11l8-7 8 7v8.5H14.5V14h-5v5.5H4z" {...line} />
      ) : tab === 'archive' ? (
        <>
          <Path d="M4.5 5h15v4h-15zM6 9v10h12V9" {...line} />
          <Path d="M10 13h4" {...line} />
        </>
      ) : tab === 'send' ? (
        <Path d="M20 4L3.5 10.5l6.5 2.7 2.7 6.5zM10 13.2L20 4" {...line} />
      ) : (
        <>
          <Circle cx={12} cy={8.5} r={3.6} {...line} />
          <Path d="M5 20c0-3.6 3.1-5.8 7-5.8s7 2.2 7 5.8" {...line} />
        </>
      )}
    </Svg>
  )
}
