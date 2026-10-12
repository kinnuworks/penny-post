import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { copy } from '../../copy'
import { describeProblem } from '../../utils/describe-problem'
import { ellipsify } from '../../utils/ellipsify'
import { formatTokens } from '../../utils/format-tokens'
import { useNow } from '../../utils/use-now'
import { tokenName } from '../post/token-name'
import { useMyLetterbox, usePostOffice, useSkrName } from '../post/use-post'
import { closesAt, shareAfterBurn, utcDay, type PostedCircular } from './circular-chain'
import { untilClose } from './until-close'
import { useAnswerCircular, useCircular, useCollectCircular } from './use-circular'

// The day's circular, pinned above the doormat: one question for every Seeker,
// and what answering it is worth. Yesterday's share is collected from here too.
export function CircularCard() {
  const router = useRouter()
  const now = useNow()
  const today = utcDay(now)
  const office = usePostOffice()
  const mine = useMyLetterbox()
  const current = useCircular(today)
  const previous = useCircular(today - 1)
  const answer = useAnswerCircular()
  const collect = useCollectCircular()

  if (!office.data || current.isLoading) {
    return null
  }
  const token = tokenName(office.data.postageMint)
  const decimals = office.data.decimals
  const hasSeal = !!mine.data?.seal
  // An answer that still exists for a closed day is a share nobody has collected.
  const waiting = previous.data && previous.data.myChoice !== null ? previous.data.circular : null
  const view = current.data

  return (
    <View className="mb-5 gap-3">
      {waiting ? (
        <View className="rounded-card border border-rule bg-paper-raised px-5 py-4">
          <Text className="font-body text-body text-ink">
            {copy.circular.waiting(formatTokens(shareAfterBurn(waiting), decimals), token)}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-2 self-start"
            disabled={collect.isPending}
            hitSlop={10}
            onPress={() => collect.mutate(waiting)}
          >
            <Text className="font-label text-label text-accent-ink underline">
              {collect.isPending ? copy.circular.collecting : copy.circular.collect}
            </Text>
          </Pressable>
          {collect.error ? (
            <Text className="mt-2 font-body text-body text-accent-ink">{describeProblem(collect.error)}</Text>
          ) : null}
        </View>
      ) : null}

      {view ? (
        <Question
          circular={view.circular}
          decimals={decimals}
          hasSeal={hasSeal}
          isBusy={answer.isPending}
          myChoice={view.myChoice}
          now={now}
          onAnswer={(choice) => answer.mutate({ alsoCollect: waiting ?? undefined, choice, day: today })}
          problem={answer.error ? describeProblem(answer.error) : null}
          token={token}
        />
      ) : (
        <View className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="font-caption text-caption text-ink-faint">{copy.circular.none}</Text>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push('/ask')}>
            <Text className="font-caption text-caption text-ink-soft underline">{copy.circular.ask}</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

function Question({
  circular,
  decimals,
  hasSeal,
  isBusy,
  myChoice,
  now,
  onAnswer,
  problem,
  token,
}: {
  circular: PostedCircular
  decimals: number
  hasSeal: boolean
  isBusy: boolean
  myChoice: number | null
  now: number
  onAnswer: (choice: number) => void
  problem: string | null
  token: string
}) {
  const sponsor = useSkrName(circular.sponsor)
  const hasAnswered = myChoice !== null
  const canAnswer = hasSeal && !hasAnswered

  return (
    <View className="rounded-card border border-ink bg-paper-raised px-5 py-5">
      <Text className="font-caption text-caption uppercase tracking-widest text-ink-faint">
        {copy.circular.caption}
        {'  ·  '}
        {copy.circular.from(sponsor.data ?? ellipsify(circular.sponsor))}
      </Text>
      <Text className="mt-2 font-title text-heading text-ink">{circular.question}</Text>

      <View className="mt-4 gap-2">
        {circular.options.map((option, index) => {
          const isMine = myChoice === index
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canAnswer || isBusy, selected: isMine }}
              className={`flex-row items-center justify-between rounded-card border px-4 py-3 ${isMine ? 'border-accent' : 'border-rule'} ${canAnswer ? 'active:bg-paper-sunk' : ''}`}
              disabled={!canAnswer || isBusy}
              key={option}
              onPress={() => onAnswer(index)}
            >
              <Text className="flex-1 font-hand text-hand text-ink">{option}</Text>
              {/* The count stays hidden until this phone has answered, so nobody just follows the crowd. */}
              {hasAnswered || !hasSeal ? (
                <Text className="font-label text-label text-ink-soft">{circular.tallies[index]}</Text>
              ) : null}
            </Pressable>
          )
        })}
      </View>

      <Text className="mt-4 font-body text-body text-ink-soft">
        {copy.circular.pot(formatTokens(circular.pot, decimals), token)}{' '}
        {circular.answers === 0 ? copy.circular.noneYet : copy.circular.soFar(circular.answers)}
      </Text>
      {isBusy ? <Text className="mt-2 font-body text-body text-ink-soft">{copy.circular.answering}</Text> : null}
      {hasAnswered ? (
        <Text className="mt-2 font-body text-body text-ink">
          {copy.circular.youSaid(circular.options[myChoice] ?? '')}{' '}
          {copy.circular.shareNow(formatTokens(shareAfterBurn(circular), decimals), token)}{' '}
          {copy.circular.paidWhen(untilClose(now, closesAt(circular.day)))}
        </Text>
      ) : null}
      {!hasSeal ? (
        <Text className="mt-2 font-caption text-caption text-ink-faint">{copy.circular.seekersOnly}</Text>
      ) : null}
      {problem ? <Text className="mt-2 font-body text-body text-accent-ink">{problem}</Text> : null}
    </View>
  )
}
