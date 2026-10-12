import type { Address } from '@solana/kit'
import { useQuery } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { useState } from 'react'
import { Image, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabBar } from '../components/tab-bar'
import { copy } from '../copy'
import { FlipCard } from '../features/card/flip-card'
import { PostcardBack, PostcardFront } from '../features/card/postcard'
import { listKept, loadKept, type KeptEntry } from '../features/kept/kept-store'
import { tokenName } from '../features/post/token-name'
import { usePostOffice } from '../features/post/use-post'
import { ellipsify } from '../utils/ellipsify'
import { formatTokens } from '../utils/format-tokens'
import { paperShadow } from '../theme'
import { postmarkDate } from '../utils/postmark-date'

const tray = require('../../assets/empty-archive.webp')

// Every card the reader has opened. They live on this phone only.
export default function Kept() {
  const insets = useSafeAreaInsets()
  const { account } = useMobileWallet()
  const owner = account?.address
  const kept = useQuery({
    enabled: !!owner,
    queryKey: ['kept', owner],
    queryFn: () => (owner ? listKept(owner) : []),
  })

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-10 pt-8">
        <Text className="font-script text-script text-ink">{copy.kept.title}</Text>
        <Text className="mb-6 mt-1 font-body text-body text-ink-soft">{copy.kept.sub}</Text>

        {owner && kept.data && kept.data.length > 0 ? (
          <View className="gap-9">
            {kept.data.map((entry, index) => (
              <KeptCardView entry={entry} key={entry.card} owner={owner} tilt={index % 2 === 0 ? -1 : 1} />
            ))}
          </View>
        ) : kept.isLoading ? null : (
          <View className="items-center pt-8">
            <Image
              accessibilityElementsHidden
              importantForAccessibility="no"
              resizeMode="contain"
              source={tray}
              style={{ height: 210, width: 270 }}
            />
            <Text className="mt-4 w-full text-center font-hand text-hand text-ink">{copy.kept.empty}</Text>
          </View>
        )}
      </ScrollView>
      <TabBar current="archive" />
    </View>
  )
}

function KeptCardView({ entry, owner, tilt }: { entry: KeptEntry; owner: Address; tilt: number }) {
  const office = usePostOffice()
  // The picture first, if there is one. Tapping turns it over.
  const [turnedTo, setSide] = useState<'front' | 'back' | null>(null)
  const content = useQuery({
    queryKey: ['kept-card', owner, entry.card],
    queryFn: () => loadKept(owner, entry.card),
  })

  if (!content.data) {
    return null
  }
  const paid = BigInt(entry.paid)
  const side = turnedTo ?? (content.data.photo ? 'front' : 'back')

  return (
    <View>
      <View style={[paperShadow, { borderRadius: 8, transform: [{ rotate: `${tilt}deg` }] }]}>
        <FlipCard
          back={
            <PostcardBack
              card={content.data}
              postmark={{ date: postmarkDate(entry.openedAt), place: 'Penny Post' }}
              to="You"
            />
          }
          front={<PostcardFront photo={content.data.photo} />}
          onTurn={setSide}
          showing={side}
        />
      </View>
      <Text className="mt-4 font-body text-body text-ink-soft">
        {copy.letterbox.from(content.data.fromName ?? ellipsify(entry.from))}
        {paid > 0n && office.data
          ? `. ${copy.kept.paid(formatTokens(paid, office.data.decimals), tokenName(office.data.postageMint))}.`
          : ''}
      </Text>
    </View>
  )
}
