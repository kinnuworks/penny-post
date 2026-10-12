import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { InkButton } from '../../components/ink-button'
import { copy } from '../../copy'
import { usePalette } from '../../theme'
import { describeProblem } from '../../utils/describe-problem'
import { formatTokens, parseTokens } from '../../utils/format-tokens'
import { useNow } from '../../utils/use-now'
import { tokenName } from '../post/token-name'
import { usePostOffice } from '../post/use-post'
import {
  MAX_OPTION_LENGTH,
  MAX_OPTIONS,
  MAX_QUESTION_LENGTH,
  MIN_OPTIONS,
  smallestOutbid,
  smallestPot,
  utcDay,
} from './circular-chain'
import { useCircular, usePostCircular } from './use-circular'

const byteLength = (text: string) => new TextEncoder().encode(text).length

// Where somebody puts a question to every Seeker: the question, its answers,
// the pot, and which day it goes out.
export function AskScreen({ onDone }: { onDone: () => void }) {
  const palette = usePalette()
  const now = useNow()
  const today = utcDay(now)
  const office = usePostOffice()
  const todays = useCircular(today)
  const tomorrows = useCircular(today + 1)
  const post = usePostCircular()

  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [potText, setPotText] = useState<string | null>(null)
  const [wantsTomorrow, setWantsTomorrow] = useState(false)

  if (!office.data) {
    return null
  }
  const token = tokenName(office.data.postageMint)
  const decimals = office.data.decimals

  // A question that is open cannot be replaced, so today is only on offer while it is free.
  const todayTaken = !!todays.data
  const day = todayTaken || wantsTomorrow ? today + 1 : today
  const holder = day === today ? null : (tomorrows.data?.circular ?? null)
  const least = holder ? smallestOutbid(holder) : smallestPot(office.data)
  const pot = parseTokens(potText ?? formatTokens(least, decimals), decimals)

  const answers = options.map((option) => option.trim())
  const isWellFormed =
    question.trim().length > 0 &&
    byteLength(question) <= MAX_QUESTION_LENGTH &&
    answers.every((option) => option.length > 0 && byteLength(option) <= MAX_OPTION_LENGTH) &&
    new Set(answers).size === answers.length
  const complaint =
    pot === null ? copy.ask.notAnAmount : pot < least ? copy.ask.potFloor(formatTokens(least, decimals), token) : null

  if (post.isSuccess) {
    return (
      <View className="flex-1 justify-between px-6 pb-8 pt-10">
        <View>
          <Text className="font-display text-display text-ink">{copy.ask.sent}</Text>
          <Text className="mt-4 font-body text-body text-ink-soft">
            {copy.ask.sentBody(day === today ? copy.ask.today.toLowerCase() : copy.ask.tomorrow.toLowerCase())}
          </Text>
        </View>
        <InkButton label={copy.ask.back} onPress={onDone} />
      </View>
    )
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-6 pb-10 pt-10" keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" hitSlop={10} onPress={onDone}>
        <Text className="font-caption text-caption uppercase tracking-widest text-ink-faint">{copy.ask.back}</Text>
      </Pressable>
      <Text className="mt-1 font-title text-title text-ink">{copy.ask.title}</Text>
      <Text className="mt-2 font-body text-body text-ink-soft">{copy.ask.intro}</Text>

      <Label>{copy.ask.questionLabel}</Label>
      <TextInput
        accessibilityLabel={copy.ask.questionLabel}
        className="min-h-[88px] rounded-card border border-rule bg-paper-raised px-4 py-3 font-hand text-hand text-ink"
        maxLength={MAX_QUESTION_LENGTH}
        multiline
        onChangeText={setQuestion}
        placeholder={copy.ask.questionPlaceholder}
        placeholderTextColor={palette.inkFaint}
        textAlignVertical="top"
        value={question}
      />

      <Label>{copy.ask.answersLabel}</Label>
      <View className="gap-2">
        {options.map((option, index) => (
          <TextInput
            accessibilityLabel={copy.ask.answerPlaceholder(index + 1)}
            className="rounded-card border border-rule bg-paper-raised px-4 py-3 font-body text-body text-ink"
            // The list only ever grows at the end, so a row's place is its identity.
            key={index}
            maxLength={MAX_OPTION_LENGTH}
            onChangeText={(text) => setOptions(options.map((existing, at) => (at === index ? text : existing)))}
            placeholder={copy.ask.answerPlaceholder(index + 1)}
            placeholderTextColor={palette.inkFaint}
            value={option}
          />
        ))}
      </View>
      {options.length < MAX_OPTIONS ? (
        <Pressable
          accessibilityRole="button"
          className="mt-3 self-start"
          hitSlop={10}
          onPress={() => setOptions([...options, ''])}
        >
          <Text className="font-label text-label text-ink-soft underline">{copy.ask.addAnswer}</Text>
        </Pressable>
      ) : null}

      <Label>{copy.ask.dayLabel}</Label>
      {todayTaken ? (
        <Text className="mb-2 font-body text-body text-ink-soft">{copy.ask.open}</Text>
      ) : (
        <DayRow
          isOn={day === today}
          label={copy.ask.today}
          note={copy.ask.free}
          onPress={() => {
            setWantsTomorrow(false)
            setPotText(null)
          }}
        />
      )}
      <DayRow
        isOn={day === today + 1}
        label={copy.ask.tomorrow}
        note={
          tomorrows.data ? copy.ask.taken(formatTokens(tomorrows.data.circular.pot, decimals), token) : copy.ask.free
        }
        onPress={() => {
          setWantsTomorrow(true)
          setPotText(null)
        }}
      />
      {holder ? (
        <Text className="mt-2 font-body text-body text-ink-soft">
          {copy.ask.outbid(formatTokens(least, decimals), token)}
        </Text>
      ) : null}

      <Label>{copy.ask.potLabel}</Label>
      <View className="flex-row items-center gap-3">
        <TextInput
          accessibilityLabel={copy.ask.potLabel}
          className="flex-1 rounded-card border border-rule bg-paper-raised px-4 py-3 font-body text-body text-ink"
          keyboardType="decimal-pad"
          maxLength={18}
          onChangeText={setPotText}
          value={potText ?? formatTokens(least, decimals)}
        />
        <Text className="font-label text-label text-ink">{token}</Text>
      </View>
      <Text className={`mt-2 font-body text-body ${complaint ? 'text-accent-ink' : 'text-ink-soft'}`}>
        {complaint ?? copy.ask.potFloor(formatTokens(least, decimals), token)}
      </Text>

      <View className="mt-8">
        <InkButton
          disabled={!isWellFormed || !!complaint || post.isPending}
          label={post.isPending ? copy.ask.sending : copy.ask.send}
          onPress={() => {
            if (pot !== null) {
              post.mutate({
                day,
                options: answers.slice(0, Math.max(MIN_OPTIONS, answers.length)),
                pot,
                question: question.trim(),
              })
            }
          }}
        />
        {post.error ? (
          <Text className="mt-3 font-body text-body text-accent-ink">{describeProblem(post.error)}</Text>
        ) : null}
      </View>
    </ScrollView>
  )
}

function Label({ children }: { children: string }) {
  return <Text className="mb-2 mt-7 font-label text-label text-ink">{children}</Text>
}

function DayRow({ isOn, label, note, onPress }: { isOn: boolean; label: string; note: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isOn }}
      className={`mb-2 flex-row items-center justify-between rounded-card border px-4 py-3 ${isOn ? 'border-ink bg-paper-raised' : 'border-rule'}`}
      onPress={onPress}
    >
      <Text className="font-label text-label text-ink">{label}</Text>
      <Text className="font-caption text-caption text-ink-faint">{note}</Text>
    </Pressable>
  )
}
