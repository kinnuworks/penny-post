import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { InkButton } from '../../components/ink-button'
import { copy } from '../../copy'
import { emptyCard, type CardContent } from '../../features/card/card'
import { FlipCard } from '../../features/card/flip-card'
import { PostcardBack, PostcardFront } from '../../features/card/postcard'
import { tokenName } from '../../features/post/token-name'
import { useDoormat, useOpenCard, usePostOffice, useReturnCard, useSkrName } from '../../features/post/use-post'
import { describeProblem } from '../../utils/describe-problem'
import { ellipsify } from '../../utils/ellipsify'
import { formatTokens } from '../../utils/format-tokens'
import { postmarkDate } from '../../utils/postmark-date'

// One card from the doormat. It lies face down until the reader signs for it.
// Signing is what pays the reader and turns the card over.
export default function CardScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { address } = useLocalSearchParams<{ address: string }>()
  const office = usePostOffice()
  const doormat = useDoormat()
  const openCard = useOpenCard()
  const returnCard = useReturnCard()

  const [opened, setOpened] = useState<{ content: CardContent; paid: bigint; signature: string } | null>(null)
  const [side, setSide] = useState<'front' | 'back'>('back')
  const [wasReturned, setWasReturned] = useState(false)

  // Kept from the first render: once the card is opened it leaves the doormat.
  const [card] = useState(() => doormat.data?.find((entry) => entry.address === address) ?? null)
  const senderName = useSkrName(card?.sender)
  const token = office.data ? tokenName(office.data.postageMint) : ''
  const decimals = office.data?.decimals ?? 0
  const isBusy = openCard.isPending || returnCard.isPending
  const problem = openCard.error ?? returnCard.error

  const goHome = () => router.back()

  return (
    <View className="flex-1 bg-paper" style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}>
      <ScrollView className="flex-1" contentContainerClassName="flex-grow justify-between px-6 pb-8 pt-6">
        <View>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={goHome}>
            <Text className="font-caption text-caption uppercase tracking-widest text-ink-faint">{copy.open.done}</Text>
          </Pressable>
          <Text className="mb-5 mt-1 font-title text-title text-ink">{copy.open.title}</Text>

          {!card ? (
            <Text className="font-body text-body text-ink-soft">{copy.open.gone}</Text>
          ) : opened ? (
            <>
              <FlipCard
                back={
                  <PostcardBack
                    card={opened.content}
                    postmark={{ date: postmarkDate(Number(card.postedAt)), place: 'Penny Post' }}
                    to="You"
                  />
                }
                front={<PostcardFront photo={opened.content.photo} />}
                onTurn={setSide}
                showing={side}
              />
              <Text className="mt-2 text-center font-caption text-caption text-ink-faint">{copy.write.turnHint}</Text>
              <Text className="mt-6 font-body text-body text-ink">
                {opened.paid > 0n ? copy.open.paid(formatTokens(opened.paid, decimals), token) : copy.open.free}
              </Text>
              <Text className="mt-2 font-caption text-caption text-ink-faint" selectable>
                {copy.open.receipt(ellipsify(opened.signature, 6))}
              </Text>
            </>
          ) : (
            <>
              {/* Face down: the stamp and the address show, the message does not. */}
              <PostcardBack
                card={emptyCard(card.stamp)}
                postmark={{ date: postmarkDate(Number(card.postedAt)), place: 'Penny Post' }}
                to="You"
              />
              <Text className="mt-6 font-hand text-hand text-ink">
                {copy.letterbox.from(senderName.data ?? ellipsify(card.sender))}
              </Text>
              <Text className="font-body text-body text-ink-soft">
                {card.postage > 0n
                  ? copy.letterbox.paidInside(formatTokens(card.postage, decimals), token)
                  : copy.letterbox.freeStamp}
              </Text>
              <Text className="mt-3 font-body text-body text-ink-soft">
                {wasReturned ? copy.open.returned : copy.open.hint}
              </Text>
            </>
          )}

          {problem ? (
            <Text className="mt-4 font-body text-body text-accent-ink">{describeProblem(problem)}</Text>
          ) : null}
        </View>

        <View className="mt-8 gap-3">
          {card && !opened && !wasReturned ? (
            <>
              <InkButton
                disabled={isBusy}
                label={openCard.isPending ? copy.open.signing : copy.open.sign}
                onPress={() =>
                  openCard.mutate(card, {
                    onSuccess: (result) => {
                      setOpened(result)
                      // Start on the picture if there is one, then let them turn it.
                      setSide(result.content.photo ? 'front' : 'back')
                    },
                  })
                }
              />
              <InkButton
                disabled={isBusy}
                label={returnCard.isPending ? copy.open.sendingBack : copy.open.sendBack}
                onPress={() => returnCard.mutate(card, { onSuccess: () => setWasReturned(true) })}
                tone="plain"
              />
            </>
          ) : (
            <InkButton label={copy.open.done} onPress={goHome} tone={opened ? 'accent' : 'plain'} />
          )}
        </View>
      </ScrollView>
    </View>
  )
}
