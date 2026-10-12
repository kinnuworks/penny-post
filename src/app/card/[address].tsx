import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { InkButton } from '../../components/ink-button'
import { OutOfEnvelope } from '../../components/motion'
import { ScreenHeader } from '../../components/screen-header'
import { paperShadow } from '../../theme'
import { copy } from '../../copy'
import { emptyCard, type CardContent } from '../../features/card/card'
import { FlipCard } from '../../features/card/flip-card'
import { PostcardBack, PostcardFront } from '../../features/card/postcard'
import { nameOf } from '../../features/post/test-kit'
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

  const [opened, setOpened] = useState<{ content: CardContent; paid: bigint; signature: string | null } | null>(null)
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
      <ScrollView className="flex-1" contentContainerClassName="flex-grow justify-between px-6 pb-8">
        <View>
          <ScreenHeader backLabel={copy.open.done} onBack={goHome} title={copy.open.title} />
          <View className="h-5" />

          {!card ? (
            <Text className="font-body text-body text-ink-soft">{copy.open.gone}</Text>
          ) : opened ? (
            <>
              <View style={[paperShadow, { borderRadius: 8, transform: [{ rotate: '-1.2deg' }] }]}>
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
              </View>
              <Text className="mt-4 text-center font-caption text-caption text-ink-faint">{copy.write.turnHint}</Text>
              <Text className="mt-6 text-center font-script text-[38px] leading-[44px] text-ink">
                {opened.paid > 0n ? copy.open.yours(formatTokens(opened.paid, decimals), token) : copy.open.freeShort}
              </Text>
              <Text className="mt-1 text-center font-body text-body text-ink-soft">
                {opened.paid > 0n ? copy.open.inWallet : copy.open.free}
              </Text>
              {opened.signature ? (
                <Text className="mt-3 text-center font-caption text-caption text-ink-faint" selectable>
                  {copy.open.receipt(ellipsify(opened.signature, 6))}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              {/* Face down: the stamp and the address show, the message does not. */}
              <OutOfEnvelope>
                <View>
                  {/* Another card underneath, so this one reads as the top of a small pile. */}
                  <View
                    className="absolute bottom-0 left-0 right-0 top-0 rounded-[8px] border border-rule bg-paper-sunk"
                    style={{ transform: [{ rotate: '2.5deg' }] }}
                  />
                  <View style={[paperShadow, { borderRadius: 8, transform: [{ rotate: '-1.5deg' }] }]}>
                    <PostcardBack
                      card={emptyCard(card.stamp)}
                      postmark={{ date: postmarkDate(Number(card.postedAt)), place: 'Penny Post' }}
                      to="You"
                    />
                  </View>
                </View>
              </OutOfEnvelope>
              <Text className="mt-8 text-center font-script text-[36px] leading-[42px] text-ink">
                {copy.letterbox.from(nameOf(card.sender, senderName.data))}
              </Text>
              <Text className="mt-1 text-center font-body text-body text-ink-soft">
                {card.postage > 0n
                  ? copy.letterbox.paidInside(formatTokens(card.postage, decimals), token)
                  : copy.letterbox.freeStamp}
              </Text>
              <Text className="mt-3 text-center font-body text-body text-ink-soft">
                {wasReturned ? copy.open.returned : copy.open.hint}
              </Text>
            </>
          )}

          {problem ? (
            <Text className="mt-4 text-center font-body text-body text-accent-ink">{describeProblem(problem)}</Text>
          ) : null}
        </View>

        <View className="mt-8 gap-3">
          {card && !opened && !wasReturned ? (
            <>
              <InkButton
                disabled={isBusy}
                arrow
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
            <>
              {opened && card ? (
                <InkButton
                  arrow
                  label={copy.open.writeBack}
                  onPress={() => router.replace({ pathname: '/write', params: { to: card.sender } })}
                />
              ) : null}
              <InkButton label={copy.open.done} onPress={goHome} tone="plain" />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
