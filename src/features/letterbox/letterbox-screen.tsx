import type { Address } from '@solana/kit'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Envelope } from '../../components/envelope'
import { InkButton } from '../../components/ink-button'
import { Paper } from '../../components/paper'
import { StampArt } from '../../components/stamp-art'
import { SunDoodle, SunStamp } from '../../components/sun'
import { TabBar } from '../../components/tab-bar'
import { copy } from '../../copy'
import { usePalette } from '../../theme'
import { describeProblem } from '../../utils/describe-problem'
import { ellipsify } from '../../utils/ellipsify'
import { formatTokens, formatTokensRoughly } from '../../utils/format-tokens'
import { useNow } from '../../utils/use-now'
import { stampById } from '../card/stamps'
import { shareAfterBurn, utcDay } from '../circular/circular-chain'
import { useCircular, useCollectCircular } from '../circular/use-circular'
import type { PostedCard } from '../post/chain'
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
  useTestKit,
} from '../post/use-post'

// The doormat: the day's question in its envelope, then whatever people sent.
export function LetterboxScreen({ address }: { address: Address }) {
  const router = useRouter()
  const now = useNow()
  const office = usePostOffice()
  const mine = useMyLetterbox()
  const doormat = useDoormat()
  const openLetterbox = useOpenLetterbox()
  const testKit = useTestKit()
  const myName = useSkrName(address)
  const palette = usePalette()
  useFlushOutbox()

  const token = office.data ? tokenName(office.data.postageMint) : ''
  const decimals = office.data?.decimals ?? 0
  const letterbox = mine.data?.letterbox ?? null
  const seal = mine.data?.seal ?? null
  const cards = doormat.data ?? []
  const offset = deviceUtcOffsetMinutes()
  const today = utcDay(now)
  const question = useCircular(today)
  const arrived = cards.filter((card) => Number(card.deliverAt) <= now).length

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

  const isLoading = office.isLoading || mine.isLoading

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-10 pt-8">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="font-script text-script text-ink">
              {copy.home.greeting(new Date(now * 1000).getHours())}
            </Text>
            <Text className="font-display text-display text-ink" numberOfLines={1}>
              {myName.data ?? ellipsify(address)}
            </Text>
          </View>
          <View className="pt-1">
            <SunDoodle size={68} />
          </View>
        </View>
        <Text className="mb-6 mt-2 font-body text-body text-ink-soft">
          {arrived > 0 ? copy.home.arrived : question.data ? copy.home.questionOnly : copy.home.nothing}
        </Text>

        {isLoading ? null : !office.data ? (
          <Paper className="px-6 py-6">
            <Text className="font-body text-body text-ink-soft">{copy.letterbox.closedHere}</Text>
          </Paper>
        ) : (
          <View className="gap-5">
            {/* Off mainnet there is no SKR and no Seeker, so the counter lends a visitor both. */}
            {token !== 'SKR' && !seal ? (
              <View className="rounded-card border border-dashed border-ink-faint px-5 py-5">
                <Text className="font-title text-heading text-ink">{copy.testKit.title}</Text>
                {testKit.isSuccess ? (
                  <Text className="mt-2 font-body text-body text-ink-soft">
                    {copy.testKit.given} {letterbox ? copy.testKit.nextSeeker : copy.testKit.nextLetterbox}
                  </Text>
                ) : (
                  <>
                    <Text className="mb-4 mt-2 font-body text-body text-ink-soft">{copy.testKit.body}</Text>
                    <InkButton
                      disabled={testKit.isPending}
                      label={testKit.isPending ? copy.testKit.asking : copy.testKit.ask}
                      onPress={() => testKit.mutate()}
                      tone="plain"
                    />
                    {testKit.error ? (
                      <Text className="mt-3 font-body text-body text-accent-ink">{describeProblem(testKit.error)}</Text>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}

            {!letterbox ? (
              <Paper className="px-6 py-6">
                <Text className="font-title text-heading text-ink">{copy.letterbox.noBoxTitle}</Text>
                <Text className="mb-5 mt-2 font-body text-body text-ink-soft">{copy.letterbox.noBoxBody}</Text>
                <InkButton
                  disabled={openLetterbox.isPending}
                  label={openLetterbox.isPending ? copy.letterbox.puttingUp : copy.letterbox.putUp}
                  onPress={() => openLetterbox.mutate()}
                />
                {openLetterbox.error ? (
                  <Text className="mt-3 font-body text-body text-accent-ink">
                    {describeProblem(openLetterbox.error)}
                  </Text>
                ) : null}
              </Paper>
            ) : (
              <>
                <Yesterday decimals={decimals} token={token} today={today} />

                {question.data ? (
                  <Envelope
                    accessibilityLabel={`${copy.home.question}. ${formatTokens(question.data.circular.pot, decimals)} ${token} ${copy.home.toShare}.`}
                    edge
                    onPress={() => router.push('/question')}
                    stamp={<SunStamp backing={palette.paperRaised} size={66} />}
                  >
                    <Text className="font-title text-heading text-ink">{copy.home.question}</Text>
                    <Text className="mt-2 font-caption text-caption text-ink-soft">{copy.home.toShare}</Text>
                    <Text className="font-display text-title text-ink">
                      {formatTokens(question.data.circular.pot, decimals)} {token}
                    </Text>
                    <Text className="mt-1 font-caption text-caption text-ink-soft">
                      {question.data.myChoice !== null
                        ? copy.home.answered(
                            formatTokensRoughly(shareAfterBurn(question.data.circular), decimals),
                            token,
                          )
                        : copy.home.notAnswered}
                    </Text>
                  </Envelope>
                ) : question.isLoading ? null : (
                  <Paper className="px-6 py-5">
                    <Text className="font-body text-body text-ink-soft">{copy.circular.none}</Text>
                    <View className="mt-3">
                      <InkButton label={copy.circular.ask} onPress={() => router.push('/ask')} tone="plain" />
                    </View>
                  </Paper>
                )}

                {cards.map((card, index) => (
                  <CardEnvelope
                    card={card}
                    decimals={decimals}
                    key={card.address}
                    now={now}
                    offset={offset}
                    onOpen={() => router.push(`/card/${card.address}`)}
                    tilt={index % 2 === 0 ? -0.6 : 0.6}
                    token={token}
                  />
                ))}

                {cards.length === 0 ? (
                  <View className="items-center pt-2">
                    <Paper className="px-6 py-4" tilt={-2}>
                      <Text className="text-center font-hand text-hand text-ink">{copy.home.noCards}</Text>
                      <Text className="mt-1 text-center font-caption text-caption text-ink-faint">
                        {copy.letterbox.nextPost(describeDelivery(nextDelivery(now, offset), now, offset))}
                      </Text>
                    </Paper>
                  </View>
                ) : null}
              </>
            )}
          </View>
        )}
      </ScrollView>
      <TabBar current="home" />
    </View>
  )
}

// A share from a question that has closed, waiting to be collected.
function Yesterday({ decimals, token, today }: { decimals: number; token: string; today: number }) {
  const previous = useCircular(today - 1)
  const collect = useCollectCircular()
  // An answer that still exists for a closed day is a share nobody has collected.
  const waiting = previous.data && previous.data.myChoice !== null ? previous.data.circular : null
  if (!waiting) {
    return null
  }
  return (
    <Paper className="px-6 py-5">
      <Text className="font-body text-body text-ink">
        {copy.circular.waiting(formatTokensRoughly(shareAfterBurn(waiting), decimals), token)}
      </Text>
      <View className="mt-4">
        <InkButton
          disabled={collect.isPending}
          label={collect.isPending ? copy.circular.collecting : copy.circular.collect}
          onPress={() => collect.mutate(waiting)}
        />
      </View>
      {collect.error ? (
        <Text className="mt-3 font-body text-body text-accent-ink">{describeProblem(collect.error)}</Text>
      ) : null}
    </Paper>
  )
}

// A card still in its envelope: who it is from, what is inside, and its stamp.
function CardEnvelope({
  card,
  decimals,
  now,
  offset,
  onOpen,
  tilt,
  token,
}: {
  card: PostedCard
  decimals: number
  now: number
  offset: number
  onOpen: () => void
  tilt: number
  token: string
}) {
  const palette = usePalette()
  const name = useSkrName(card.sender)
  const from = copy.letterbox.from(name.data ?? ellipsify(card.sender))
  const stamp = stampById(card.stamp)
  const hasArrived = Number(card.deliverAt) <= now
  const inside =
    card.postage > 0n
      ? copy.letterbox.paidInside(formatTokens(card.postage, decimals), token)
      : copy.letterbox.freeStamp
  const status = hasArrived ? inside : copy.letterbox.arrives(describeDelivery(Number(card.deliverAt), now, offset))

  return (
    <View style={{ opacity: hasArrived ? 1 : 0.6 }}>
      <Envelope
        accessibilityLabel={`${copy.home.postcard}. ${from}. ${status}.`}
        onPress={hasArrived ? onOpen : undefined}
        stamp={<StampArt art={stamp.art} backing={palette.paperRaised} label={stamp.name} size={0.78} />}
        tilt={tilt}
      >
        <Text className="font-title text-heading text-ink">{copy.home.postcard}</Text>
        <Text className="mt-1 font-hand text-hand text-ink">{from}</Text>
        <Text className="font-caption text-caption text-ink-soft">{status}</Text>
      </Envelope>
    </View>
  )
}
