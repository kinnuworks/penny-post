import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { InkButton } from '../../components/ink-button'
import { StampArt } from '../../components/stamp-art'
import { copy } from '../../copy'
import { usePalette } from '../../theme'
import { describeProblem } from '../../utils/describe-problem'
import { ellipsify } from '../../utils/ellipsify'
import { formatTokens } from '../../utils/format-tokens'
import { useNow } from '../../utils/use-now'
import { stampById } from '../card/stamps'
import { hasFreeStamp, type PostedCard } from '../post/chain'
import { describeDelivery, deviceUtcOffsetMinutes, nextDelivery } from '../post/delivery'
import { askToRing, setMorningBells } from '../post/morning-bell'
import { tokenName } from '../post/token-name'
import {
  useDoormat,
  useFlushOutbox,
  useMyLetterbox,
  useOpenLetterbox,
  usePostOffice,
  useSkrName,
  useVerifyLetterbox,
} from '../post/use-post'

// The doormat: what has arrived, what is on its way, and the counter where the
// next card gets written.
export function LetterboxScreen({
  address,
  isBusy,
  onLeave,
}: {
  address: string
  isBusy: boolean
  onLeave: () => void
}) {
  const router = useRouter()
  const now = useNow()
  const office = usePostOffice()
  const mine = useMyLetterbox()
  const doormat = useDoormat()
  const openLetterbox = useOpenLetterbox()
  const verify = useVerifyLetterbox()
  useFlushOutbox()

  const token = office.data ? tokenName(office.data.postageMint) : ''
  const decimals = office.data?.decimals ?? 0
  const letterbox = mine.data?.letterbox ?? null
  const seal = mine.data?.seal ?? null
  const cards = doormat.data ?? []
  const offset = deviceUtcOffsetMinutes()

  // Once there is a letterbox, ask whether the morning bell may ring, and keep
  // the coming week's bells in step with what is known to be in the post.
  const hasLetterbox = !!letterbox
  const arrivals = cards
    .map((card) => Number(card.deliverAt))
    .filter((arrival) => arrival > now)
    .join(',')
  useEffect(() => {
    if (!hasLetterbox) {
      return
    }
    const times = arrivals ? arrivals.split(',').map(Number) : []
    void askToRing()
      .then(() => setMorningBells(Math.floor(Date.now() / 1000), deviceUtcOffsetMinutes(), times))
      .catch(() => undefined)
  }, [hasLetterbox, arrivals])

  return (
    <ScrollView className="flex-1" contentContainerClassName="flex-grow justify-between px-6 pb-8 pt-10">
      <View>
        <Text className="font-caption text-caption uppercase tracking-widest text-ink-faint">
          {copy.wallet.address(ellipsify(address))}
          {seal ? `  ·  ${copy.letterbox.seeker(seal.memberNumber.toLocaleString('en-US'))}` : ''}
        </Text>
        <Text className="mb-1 mt-1 font-title text-title text-ink">{copy.letterbox.heading}</Text>
        {letterbox && office.data ? (
          <Text className="mb-5 font-body text-body text-ink-soft">
            {copy.letterbox.price(formatTokens(letterbox.price, decimals), token)}
          </Text>
        ) : (
          <View className="mb-5" />
        )}

        {office.isLoading || mine.isLoading ? null : !office.data ? (
          <Notice>{copy.letterbox.closedHere}</Notice>
        ) : !letterbox ? (
          <View className="rounded-card border border-rule bg-paper-raised px-5 py-6">
            <Text className="font-title text-heading text-ink">{copy.letterbox.noBoxTitle}</Text>
            <Text className="mb-5 mt-2 font-body text-body text-ink-soft">{copy.letterbox.noBoxBody}</Text>
            <InkButton
              disabled={openLetterbox.isPending}
              label={openLetterbox.isPending ? copy.letterbox.puttingUp : copy.letterbox.putUp}
              onPress={() => openLetterbox.mutate()}
            />
            {openLetterbox.error ? (
              <Text className="mt-3 font-body text-body text-accent-ink">{describeProblem(openLetterbox.error)}</Text>
            ) : null}
          </View>
        ) : cards.length === 0 ? (
          <View className="rounded-card border border-rule bg-paper-raised px-5 py-8">
            <Text className="font-hand text-hand text-ink">{copy.letterbox.empty}</Text>
            <Text className="mt-3 font-body text-body text-ink-soft">{copy.letterbox.emptyHint}</Text>
            <View className="my-5 h-px bg-rule" />
            <Text className="font-caption text-caption text-ink-faint">
              {copy.letterbox.nextPost(describeDelivery(nextDelivery(now, offset), now, offset))}
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {cards.map((card) => (
              <CardRow
                card={card}
                decimals={decimals}
                key={card.address}
                now={now}
                offset={offset}
                onOpen={() => router.push(`/card/${card.address}`)}
                token={token}
              />
            ))}
          </View>
        )}
      </View>

      <View className="mt-8 gap-3">
        {seal ? (
          <Text className="font-body text-body text-ink-soft">
            {hasFreeStamp(seal, now) ? copy.counter.stampReady : copy.counter.stampUsed}
          </Text>
        ) : letterbox ? (
          <>
            <TextLink
              label={verify.isPending ? copy.letterbox.claimingStamp : copy.letterbox.claimStamp}
              onPress={() => (verify.isPending ? undefined : verify.mutate())}
            />
            {verify.error ? (
              <Text className="font-body text-body text-accent-ink">{describeProblem(verify.error)}</Text>
            ) : null}
          </>
        ) : null}
        <InkButton disabled={isBusy || !office.data} label={copy.counter.write} onPress={() => router.push('/write')} />
        <View className="flex-row justify-between pt-1">
          <TextLink label={copy.letterbox.kept} onPress={() => router.push('/kept')} />
          <TextLink label={copy.wallet.leave} onPress={onLeave} />
        </View>
      </View>
    </ScrollView>
  )
}

// A card lying face down: who it is from, what is inside, and its stamp.
function CardRow({
  card,
  decimals,
  now,
  offset,
  onOpen,
  token,
}: {
  card: PostedCard
  decimals: number
  now: number
  offset: number
  onOpen: () => void
  token: string
}) {
  const palette = usePalette()
  const name = useSkrName(card.sender)
  const from = copy.letterbox.from(name.data ?? ellipsify(card.sender))
  const stamp = stampById(card.stamp)
  const arrived = Number(card.deliverAt) <= now
  const inside =
    card.postage > 0n
      ? copy.letterbox.paidInside(formatTokens(card.postage, decimals), token)
      : copy.letterbox.freeStamp
  const status = arrived
    ? copy.letterbox.onDoormat
    : copy.letterbox.arrives(describeDelivery(Number(card.deliverAt), now, offset))

  return (
    <Pressable
      accessibilityHint={arrived ? 'Opens the card' : undefined}
      accessibilityLabel={`${from}. ${inside}. ${status}.`}
      accessibilityRole="button"
      className={`flex-row items-center justify-between rounded-card border border-rule bg-paper-raised px-4 py-3 ${arrived ? 'active:bg-paper-sunk' : 'opacity-60'}`}
      disabled={!arrived}
      onPress={onOpen}
    >
      <View className="flex-1 pr-3">
        <Text className="font-caption text-caption uppercase tracking-widest text-ink-faint">{status}</Text>
        <Text className="font-hand text-hand text-ink">{from}</Text>
        <Text className="font-body text-body text-ink-soft">{inside}</Text>
      </View>
      <StampArt art={stamp.art} backing={palette.paperRaised} label={stamp.name} size={0.62} />
    </Pressable>
  )
}

function Notice({ children }: { children: string }) {
  return (
    <View className="rounded-card border border-rule bg-paper-raised px-5 py-6">
      <Text className="font-body text-body text-ink-soft">{children}</Text>
    </View>
  )
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress}>
      <Text className="font-label text-label text-ink-soft underline">{label}</Text>
    </Pressable>
  )
}
