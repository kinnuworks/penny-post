import { useRef, useState } from 'react'
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { InkButton } from '../../components/ink-button'
import { Rise } from '../../components/motion'
import { SunDoodle, SunStamp } from '../../components/sun'
import { copy } from '../../copy'
import { paperShadow, usePalette } from '../../theme'

const envelope = require('../../../assets/envelope.webp')
const prints = require('../../../assets/polaroids.webp')

// Three pages shown once, before the wallet is asked for anything: what comes
// in the post, and why it is worth opening.
export function IntroScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets()
  const palette = usePalette()
  const { width } = useWindowDimensions()
  const pager = useRef<ScrollView>(null)
  const [page, setPage] = useState(0)
  const pages = copy.intro.pages
  const isLast = page === pages.length - 1

  return (
    <View className="flex-1 bg-paper" style={{ paddingBottom: insets.bottom + 20, paddingTop: insets.top + 8 }}>
      <View className="h-11 flex-row items-center justify-end px-6">
        {isLast ? null : (
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onDone}>
            <Text className="font-label text-label text-ink-soft">{copy.intro.skip}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
        pagingEnabled
        ref={pager}
        showsHorizontalScrollIndicator={false}
      >
        {pages.map((content, index) => (
          <View className="flex-1 justify-center px-8" key={content.title} style={{ width }}>
            <View className="h-[280px] items-center justify-center">
              {index === 0 ? (
                <View className="items-center justify-center">
                  <View style={{ position: 'absolute' }}>
                    <SunDoodle color={palette.accent} ring={false} size={300} stroke={0.6} />
                  </View>
                  <View style={{ transform: [{ rotate: '-6deg' }] }}>
                    <SunStamp size={164} />
                  </View>
                </View>
              ) : index === 1 ? (
                <View style={[paperShadow, { borderRadius: 6, transform: [{ rotate: '-3deg' }] }]}>
                  <Image resizeMode="contain" source={envelope} style={{ height: 174, width: 300 }} />
                  <View style={{ position: 'absolute', right: 16, top: 12, transform: [{ rotate: '5deg' }] }}>
                    <SunStamp size={58} />
                  </View>
                </View>
              ) : (
                <Image resizeMode="contain" source={prints} style={{ height: 250, width: 320 }} />
              )}
            </View>
            <Rise key={`${content.title}-${page === index}`}>
              <Text className="mt-8 w-full text-center font-script text-[44px] leading-[50px] text-ink">
                {content.title}
              </Text>
              <Text className="mt-4 w-full text-center font-body text-[17px] leading-[26px] text-ink-soft">
                {content.body}
              </Text>
            </Rise>
          </View>
        ))}
      </ScrollView>

      <View className="mb-6 flex-row justify-center gap-2">
        {pages.map((content, index) => (
          <View className={`h-2 rounded-full ${index === page ? 'w-6 bg-ink' : 'w-2 bg-rule'}`} key={content.title} />
        ))}
      </View>
      <View className="px-7">
        <InkButton
          arrow
          label={isLast ? copy.intro.connect : copy.intro.next}
          onPress={() => {
            if (isLast) {
              onDone()
              return
            }
            pager.current?.scrollTo({ animated: true, x: (page + 1) * width })
            setPage(page + 1)
          }}
        />
      </View>
    </View>
  )
}
