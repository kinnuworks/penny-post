import type { Address } from '@solana/kit'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, useColorScheme, View } from 'react-native'
import { Envelope, ENVELOPE_TONE } from '../../components/envelope'
import { InkButton } from '../../components/ink-button'
import { Drop, Rise } from '../../components/motion'
import { Paper } from '../../components/paper'
import { StampArt } from '../../components/stamp-art'
import { SunDoodle, SunStamp } from '../../components/sun'
import { TabBar } from '../../components/tab-bar'
import { copy } from '../../copy'
import { usePalette } from '../../theme'
import { describeProblem } from '../../utils/describe-problem'
import { formatTokens, formatTokensRoughly } from '../../utils/format-tokens'
import { useNow } from '../../utils/use-now'
import { stampById } from '../card/stamps'
import { shareAfterBurn, utcDay } from '../circular/circular-chain'
import { useAnswerLog, useCircular, useCollectCircular, useRememberAnswer } from '../circular/use-circular'
import type { PostedCard } from '../post/chain'
import { describeDelivery, deviceUtcOffsetMinutes, nextDelivery } from '../post/delivery'
import { askToRing, setMorningBells } from '../post/morning-bell'
import { nameOf } from '../post/test-kit'
import { isStandIn, tokenName } from '../post/token-name'
import {
  useDoormat,
  useFlushOutbox,
  useHasTestKit,
  useMyLetterbox,
  useOpenLetterbox,
  usePostOffice,
  useSkrName,
  useTestKit,
} from '../post/use-post'
import { useWallet } from '../wallet/use-wallet'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** The date as it would head a letter, for a reader with no .skr name to greet by. */
function dateLine(now: number): string {
  const date = new Date(now * 1000)
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

// The doormat: the day's question in its envelope, then whatever people sent.
export function LetterboxScreen({ address }: { address: Address }) {
  const router = useRouter()
  const now = useNow()
  const office = usePostOffice()
  const mine = useMyLetterbox()
  const doormat = useDoormat()
  const openLetterbox = useOpenLetterbox()
  const testKit = useTestKit()
  const hasKit = useHasTestKit()
  const myName = useSkrName(address)
  useFlushOutbox()

  const token = office.data ? tokenName(office.data.postageMint) : ''
  const isTest = office.data ? isStandIn(office.data.postageMint) : false
  const { isPractice } = useWallet()
  const palette = usePalette()
  const queryClient = useQueryClient()
  const [isChecking, setIsChecking] = useState(false)
  const decimals = office.data?.decimals ?? 0
  const letterbox = mine.data?.letterbox ?? null
  const seal = mine.data?.seal ?? null
  const cards = doormat.data ?? []
  const offset = deviceUtcOffsetMinutes()
  const today = utcDay(now)
  const question = useCircular(today)
  const arrived = cards.filter((card) => Number(card.deliverAt) <= now).length
  const answerLog = useAnswerLog(today)
  const streak = answerLog.data?.streak ?? 0
  useRememberAnswer(today, question.data?.myChoice != null)

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
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-10 pt-8"
        refreshControl={
          <RefreshControl
            colors={[palette.accent]}
            onRefresh={() => {
              setIsChecking(true)
              void Promise.all([
                queryClient.invalidateQueries({ queryKey: ['letterbox'] }),
                queryClient.invalidateQueries({ queryKey: ['doormat'] }),
                queryClient.invalidateQueries({ queryKey: ['circular'] }),
              ]).finally(() => setIsChecking(false))
            }}
            progressBackgroundColor={palette.paperRaised}
            refreshing={isChecking}
            tintColor={palette.accent}
          />
        }
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="font-script text-script text-ink">
              {copy.home.greeting(new Date(now * 1000).getHours())}
            </Text>
            <Text className="font-display text-display text-ink" numberOfLines={1}>
              {myName.data ?? dateLine(now)}
            </Text>
          </View>
          <View className="pt-1">
            <SunDoodle size={68} />
          </View>
        </View>
        <Text className="mt-2 font-body text-body text-ink-soft">
          {arrived > 0 ? copy.home.arrived : question.data ? copy.home.questionOnly : copy.home.nothing}
        </Text>
        {streak > 0 ? (
          <Text className="mt-1 font-label text-label text-accent-ink">{copy.home.streak(streak)}</Text>
        ) : null}
        {isTest ? (
          <View className="mt-3 flex-row">
            <View className="rounded-full border border-rule bg-paper-raised px-3 py-1">
              <Text className="font-caption text-[12px] text-ink-soft">
                {copy.letterbox.devnet}
                {isPractice ? `  ·  ${copy.letterbox.practiceWallet.toLowerCase()}` : ''}
              </Text>
            </View>
          </View>
        ) : null}
        <View className="h-5" />

        {isLoading ? (
          <View accessibilityLabel={copy.letterbox.loading} className="gap-5" style={{ opacity: 0.42 }}>
            <Envelope accessibilityLabel={copy.letterbox.loading}>
              <View className="h-[62px]" />
            </Envelope>
            <Envelope accessibilityLabel={copy.letterbox.loading}>
              <View className="h-[62px]" />
            </Envelope>
          </View>
        ) : !office.data ? (
          <Paper className="px-6 py-6">
            <Text className="font-body text-body text-ink-soft">{copy.letterbox.closedHere}</Text>
          </Paper>
        ) : (
          <View className="gap-5">
            {/* Off mainnet there is no SKR and no Seeker, so the counter lends a visitor both. */}
            {isTest && letterbox && !seal && (testKit.isSuccess || !hasKit.data) ? (
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
                <Text className="mb-5 mt-2 font-body text-body text-ink-soft">
                  {isTest ? copy.letterbox.testBody : copy.letterbox.noBoxBody}
                </Text>
                <InkButton
                  arrow={!openLetterbox.isPending}
                  disabled={openLetterbox.isPending}
                  label={
                    openLetterbox.isPending
                      ? isTest
                        ? copy.letterbox.settingUp
                        : copy.letterbox.puttingUp
                      : isTest
                        ? copy.letterbox.setUp
                        : copy.letterbox.putUp
                  }
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
                  <Drop>
                    <Envelope
                      accessibilityLabel={`${copy.home.question}. ${formatTokens(question.data.circular.pot, decimals)} ${token} ${copy.home.toShare}.`}
                      onPress={() => router.push('/question')}
                      stamp={<SunStamp size={62} />}
                    >
                      <Text className="font-title text-heading text-ink">{copy.home.question}</Text>
                      <Text className="mt-1 font-caption text-caption text-ink-soft">{copy.home.toShare}</Text>
                      <Text adjustsFontSizeToFit className="font-display text-title text-ink" numberOfLines={1}>
                        {formatTokens(question.data.circular.pot, decimals)} {token}
                      </Text>
                      <Text adjustsFontSizeToFit className="font-caption text-caption text-ink-soft" numberOfLines={1}>
                        {question.data.myChoice !== null
                          ? copy.home.answered(
                              formatTokensRoughly(shareAfterBurn(question.data.circular), decimals),
                              token,
                            )
                          : copy.home.notAnswered}
                      </Text>
                    </Envelope>
                  </Drop>
                ) : question.isLoading ? null : (
                  <Paper className="px-6 py-5">
                    <Text className="font-body text-body text-ink-soft">{copy.circular.none}</Text>
                    <View className="mt-3">
                      <InkButton label={copy.circular.ask} onPress={() => router.push('/ask')} tone="plain" />
                    </View>
                  </Paper>
                )}

                {cards.map((card, index) => (
                  <Drop delay={220 + index * 190} key={card.address}>
                    <CardEnvelope
                      card={card}
                      decimals={decimals}
                      now={now}
                      offset={offset}
                      onOpen={() => router.push(`/card/${card.address}`)}
                      tilt={index % 2 === 0 ? -0.6 : 0.6}
                      token={token}
                    />
                  </Drop>
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

// Yesterday's question, now closed: how it came out, and a share to collect if one is waiting.
function Yesterday({ decimals, token, today }: { decimals: number; token: string; today: number }) {
  const previous = useCircular(today - 1)
  const collect = useCollectCircular()
  const closed = previous.data?.circular
  if (!closed || closed.answers === 0) {
    return null
  }
  // An answer that still exists for a closed day is a share nobody has collected.
  const waiting = previous.data && previous.data.myChoice !== null ? closed : null
  const counts = closed.options.map((option, index) => ({ count: closed.tallies[index] ?? 0, option }))
  const [first, second] = [...counts].sort((a, b) => b.count - a.count)

  return (
    <Rise>
      <Paper className="px-6 py-5">
        <Text className="font-caption text-caption text-ink-soft">{copy.circular.yesterday}</Text>
        <Text className="mt-1 font-title text-[19px] leading-[25px] text-ink">{closed.question}</Text>
        <Text className="mt-2 font-hand text-hand text-ink">
          {second && first.count === second.count
            ? copy.circular.tied(first.option, second.option, first.count)
            : copy.circular.won(first.option, first.count, closed.answers)}
        </Text>
        {waiting ? (
          <>
            <Text className="mt-3 font-body text-body text-ink">
              {copy.circular.yourShare(formatTokensRoughly(shareAfterBurn(waiting), decimals), token)}
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
          </>
        ) : null}
      </Paper>
    </Rise>
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
  const isDark = useColorScheme() === 'dark'
  const palette = usePalette()
  const name = useSkrName(card.sender)
  const from = copy.letterbox.from(nameOf(card.sender, name.data))
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
        stamp={
          <StampArt
            art={stamp.art}
            backing={isDark ? palette.paperRaised : ENVELOPE_TONE}
            label={stamp.name}
            size={0.72}
          />
        }
        tilt={tilt}
      >
        <Text className="font-title text-heading text-ink">{copy.home.postcard}</Text>
        <Text adjustsFontSizeToFit className="mt-1 font-hand text-hand text-ink" numberOfLines={1}>
          {from}
        </Text>
        <Text adjustsFontSizeToFit className="font-caption text-caption text-ink-soft" numberOfLines={1}>
          {status}
        </Text>
      </Envelope>
    </View>
  )
}
