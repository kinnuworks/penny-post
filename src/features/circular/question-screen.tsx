import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native'
import { InkButton } from '../../components/ink-button'
import { OutOfEnvelope } from '../../components/motion'
import { Paper } from '../../components/paper'
import { ScreenHeader } from '../../components/screen-header'
import { SunDoodle, SunStamp } from '../../components/sun'
import { copy } from '../../copy'
import { usePalette } from '../../theme'
import { describeProblem } from '../../utils/describe-problem'
import { ellipsify } from '../../utils/ellipsify'
import { formatTokens, formatTokensRoughly } from '../../utils/format-tokens'
import { useNow } from '../../utils/use-now'
import { tokenName } from '../post/token-name'
import { useMyLetterbox, usePostOffice, useSkrName, useVerifyLetterbox } from '../post/use-post'
import { closesAt, shareAfterBurn, utcDay, type PostedCircular } from './circular-chain'
import { untilClose } from './until-close'
import { useAnswerCircular, useCircular } from './use-circular'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A UTC day number as it would be written on a letter. */
function dateOf(day: number): string {
  const date = new Date(day * 86_400_000)
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

// The day's question, opened. Pick an answer and send it, and the card turns
// into a receipt: you are in, here is the count, here is your share.
export function QuestionScreen() {
  const router = useRouter()
  const now = useNow()
  const today = utcDay(now)
  const office = usePostOffice()
  const mine = useMyLetterbox()
  const current = useCircular(today)
  const previous = useCircular(today - 1)
  const answer = useAnswerCircular()
  const verify = useVerifyLetterbox()
  const [picked, setPicked] = useState<number | null>(null)

  const token = office.data ? tokenName(office.data.postageMint) : ''
  const decimals = office.data?.decimals ?? 0
  const hasSeal = !!mine.data?.seal
  const view = current.data
  const waiting = previous.data && previous.data.myChoice !== null ? previous.data.circular : null
  const back = () => router.back()

  if (view && view.myChoice !== null) {
    return (
      <YoureIn
        circular={view.circular}
        decimals={decimals}
        myChoice={view.myChoice}
        now={now}
        onBack={back}
        token={token}
      />
    )
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="flex-grow px-6 pb-8">
      <ScreenHeader backLabel={copy.question.back} onBack={back} title={copy.question.title} />

      {!view ? (
        current.isLoading ? null : (
          <Paper className="mt-4 px-6 py-6">
            <Text className="font-body text-body text-ink-soft">{copy.circular.none}</Text>
            <View className="mt-4">
              <InkButton label={copy.circular.ask} onPress={() => router.push('/ask')} tone="plain" />
            </View>
          </Paper>
        )
      ) : (
        <>
          <OutOfEnvelope>
            <Ballot circular={view.circular} disabled={answer.isPending} onPick={setPicked} picked={picked} />
          </OutOfEnvelope>

          <View className="mt-6 gap-3">
            {hasSeal ? (
              <>
                {waiting ? (
                  <Text className="text-center font-caption text-caption text-ink-soft">
                    {copy.question.alsoCollects(formatTokensRoughly(shareAfterBurn(waiting), decimals), token)}
                  </Text>
                ) : null}
                <InkButton
                  disabled={picked === null || answer.isPending}
                  arrow
                  label={answer.isPending ? copy.question.sending : copy.question.send}
                  onPress={() => {
                    if (picked !== null) {
                      answer.mutate({ alsoCollect: waiting ?? undefined, choice: picked, day: today })
                    }
                  }}
                />
              </>
            ) : (
              <>
                <Text className="text-center font-body text-body text-ink-soft">{copy.circular.seekersOnly}</Text>
                <InkButton
                  disabled={verify.isPending}
                  label={verify.isPending ? copy.question.looking : copy.question.iHaveSeeker}
                  onPress={() => verify.mutate()}
                />
              </>
            )}
            {(answer.error ?? verify.error) ? (
              <Text className="text-center font-body text-body text-accent-ink">
                {describeProblem(answer.error ?? verify.error)}
              </Text>
            ) : null}
          </View>

          <View className="mt-6">
            <Text className="text-center font-caption text-caption text-ink-soft">{copy.question.toShare}</Text>
            <Text className="mt-1 text-center font-title text-heading text-ink">
              {formatTokens(view.circular.pot, decimals)} {token}
            </Text>
            <Text className="mt-1 text-center font-caption text-caption text-ink-soft">
              {view.circular.answers === 0 ? copy.circular.noneYet : copy.circular.soFar(view.circular.answers)}
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  )
}

// The question on its card, with a row to tick for each answer.
function Ballot({
  circular,
  disabled,
  onPick,
  picked,
}: {
  circular: PostedCircular
  disabled: boolean
  onPick: (choice: number) => void
  picked: number | null
}) {
  const sponsor = useSkrName(circular.sponsor)

  return (
    <Paper className="mt-4 px-5 pb-5 pt-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3 pt-1">
          <Text className="font-caption text-caption text-ink-soft">{dateOf(circular.day)}</Text>
          <Text className="font-caption text-caption text-ink-faint">
            {copy.circular.from(sponsor.data ?? ellipsify(circular.sponsor))}
          </Text>
        </View>
        <SunStamp size={58} />
      </View>
      <Text className="mb-5 mt-4 font-title text-[24px] leading-[31px] text-ink">{circular.question}</Text>

      <View className="gap-3">
        {circular.options.map((option, index) => {
          const isPicked = picked === index
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isPicked, disabled }}
              className={`min-h-[58px] flex-row items-center justify-between rounded-[12px] border bg-paper px-5 ${isPicked ? 'border-ink' : 'border-rule'}`}
              disabled={disabled}
              key={option}
              onPress={() => onPick(index)}
            >
              <Text className="flex-1 font-caption text-[17px] text-ink">{option}</Text>
              <View
                className={`h-[22px] w-[22px] items-center justify-center rounded-full border ${isPicked ? 'border-ink' : 'border-ink-faint'}`}
              >
                {isPicked ? <View className="h-3 w-3 rounded-full bg-ink" /> : null}
              </View>
            </Pressable>
          )
        })}
      </View>
    </Paper>
  )
}

// After answering: the stamp lands, and the count and the share are shown.
function YoureIn({
  circular,
  decimals,
  myChoice,
  now,
  onBack,
  token,
}: {
  circular: PostedCircular
  decimals: number
  myChoice: number
  now: number
  onBack: () => void
  token: string
}) {
  const palette = usePalette()
  const [landing] = useState(() => new Animated.Value(0))
  const [turning] = useState(() => new Animated.Value(0))
  useEffect(() => {
    Animated.spring(landing, { friction: 5, tension: 70, toValue: 1, useNativeDriver: true }).start()
    const turn = Animated.loop(
      Animated.timing(turning, { duration: 50_000, easing: Easing.linear, toValue: 1, useNativeDriver: true }),
    )
    turn.start()
    return () => turn.stop()
  }, [landing, turning])
  const most = Math.max(1, ...circular.tallies.slice(0, circular.options.length))

  return (
    <ScrollView className="flex-1" contentContainerClassName="flex-grow items-center px-8 pb-8 pt-12">
      <Animated.View
        style={{
          opacity: landing,
          transform: [
            { scale: landing.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) },
            { rotate: landing.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '-5deg'] }) },
          ],
        }}
      >
        <View className="items-center justify-center">
          <Animated.View
            style={{
              position: 'absolute',
              transform: [{ rotate: turning.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
            }}
          >
            <SunDoodle color={palette.accent} ring={false} size={250} stroke={0.7} />
          </Animated.View>
          <SunStamp size={132} />
        </View>
      </Animated.View>

      <Text
        className="mt-8 w-full text-center font-script text-[54px] leading-[62px] text-ink"
        textBreakStrategy="simple"
      >
        {copy.question.youreIn}
      </Text>
      <Text className="mt-4 w-full text-center font-caption text-caption text-ink-soft">
        {copy.question.shareSoFar}
      </Text>
      <Text
        adjustsFontSizeToFit
        className="mt-1 w-full text-center font-display text-[44px] leading-[52px] text-ink"
        numberOfLines={1}
      >
        {formatTokensRoughly(shareAfterBurn(circular), decimals)} {token}
      </Text>
      <Text className="mt-2 w-full text-center font-body text-body text-ink-soft">
        {copy.question.paidLater(untilClose(now, closesAt(circular.day)))}
      </Text>

      <View className="mt-7 w-full gap-3">
        {circular.options.map((option, index) => {
          const count = circular.tallies[index] ?? 0
          const isMine = index === myChoice
          return (
            <View key={option}>
              <View className="flex-row items-baseline justify-between">
                <Text className={`font-caption text-[15px] ${isMine ? 'text-ink' : 'text-ink-soft'}`}>
                  {option}
                  {isMine ? `  ${copy.question.yours}` : ''}
                </Text>
                <Text className="font-label text-label text-ink-soft">{count}</Text>
              </View>
              <View className="mt-1 h-2 overflow-hidden rounded-full bg-paper-sunk">
                <View
                  className={`h-2 rounded-full ${isMine ? 'bg-accent' : 'bg-ink-faint'}`}
                  style={{ width: `${Math.max(3, (count / most) * 100)}%` }}
                />
              </View>
            </View>
          )
        })}
      </View>

      <View className="mt-8 w-56">
        <InkButton label={copy.question.back} onPress={onBack} tone="plain" />
      </View>

      <View className="mt-8">
        <Paper className="px-6 py-3" tilt={-4}>
          <Text className="text-center font-hand text-[22px] leading-[26px] text-ink-soft">
            {copy.question.tomorrow}
          </Text>
        </Paper>
      </View>
    </ScrollView>
  )
}
