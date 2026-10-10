import type { Address } from '@solana/kit'
import { useQuery } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { copy } from '../copy'
import { FlipCard } from '../features/card/flip-card'
import { PostcardBack, PostcardFront } from '../features/card/postcard'
import { listKept, loadKept, type KeptEntry } from '../features/kept/kept-store'
import { tokenName } from '../features/post/token-name'
import { usePostOffice } from '../features/post/use-post'
import { ellipsify } from '../utils/ellipsify'
import { formatTokens } from '../utils/format-tokens'
import { postmarkDate } from '../utils/postmark-date'

// Every card the reader has opened. They live on this phone only.
export default function Kept() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { account } = useMobileWallet()
  const owner = account?.address
  const kept = useQuery({
    enabled: !!owner,
    queryKey: ['kept', owner],
    queryFn: () => (owner ? listKept(owner) : []),
  })

  return (
    <View className="flex-1 bg-paper" style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}>
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-10 pt-6">
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
          <Text className="font-caption text-caption uppercase tracking-widest text-ink-faint">{copy.kept.back}</Text>
        </Pressable>
        <Text className="mb-5 mt-1 font-title text-title text-ink">{copy.kept.title}</Text>

        {owner && kept.data && kept.data.length > 0 ? (
          <View className="gap-8">
            {kept.data.map((entry) => (
              <KeptCardView entry={entry} key={entry.card} owner={owner} />
            ))}
          </View>
        ) : kept.isLoading ? null : (
          <Text className="font-body text-body text-ink-soft">{copy.kept.empty}</Text>
        )}
      </ScrollView>
    </View>
  )
}

function KeptCardView({ entry, owner }: { entry: KeptEntry; owner: Address }) {
  const office = usePostOffice()
  const [side, setSide] = useState<'front' | 'back'>('back')
  const content = useQuery({
    queryKey: ['kept-card', owner, entry.card],
    queryFn: () => loadKept(owner, entry.card),
  })

  if (!content.data) {
    return null
  }
  const paid = BigInt(entry.paid)

  return (
    <View>
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
      <Text className="mt-2 font-body text-body text-ink-soft">
        {copy.letterbox.from(content.data.fromName ?? ellipsify(entry.from))}
        {paid > 0n && office.data
          ? `. ${copy.kept.paid(formatTokens(paid, office.data.decimals), tokenName(office.data.postageMint))}.`
          : ''}
      </Text>
    </View>
  )
}
