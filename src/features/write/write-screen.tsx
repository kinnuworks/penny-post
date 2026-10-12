import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { InkButton } from '../../components/ink-button'
import { StampArt } from '../../components/stamp-art'
import { copy } from '../../copy'
import { usePalette } from '../../theme'
import { describeProblem } from '../../utils/describe-problem'
import { ellipsify } from '../../utils/ellipsify'
import { formatTokens } from '../../utils/format-tokens'
import { useDebounced } from '../../utils/use-debounced'
import { useNow } from '../../utils/use-now'
import { emptyCard, isBlank, MAX_MESSAGE_LENGTH, type CardContent } from '../card/card'
import { FlipCard } from '../card/flip-card'
import { PostcardBack, PostcardFront } from '../card/postcard'
import { EXPRESS_STAMP_ID, FREE_STAMP_ID, stampById, stamps } from '../card/stamps'
import { describeDelivery, deviceUtcOffsetMinutes, nextDelivery } from '../post/delivery'
import { tokenName } from '../post/token-name'
import { usePostOffice, useQuote } from '../post/use-post'
import { HandwritingPad } from './handwriting-pad'
import { pickPhoto, type PhotoSource } from './pick-photo'

type Mode = 'hand' | 'typed'

export interface Draft {
  card: CardContent
  to: string
}

// The counter where a card gets written: who it is for, the picture, the
// message, the stamp. The card at the top is the real thing, updated as you go.
export function WriteScreen({
  error,
  isPosting,
  onBack,
  onDrawStranger,
  onPost,
}: {
  error: string | null
  isPosting: boolean
  onBack: () => void
  /** Draws a stranger from the pen-pal exchange and returns their name or address. */
  onDrawStranger: () => Promise<string>
  onPost: (draft: Draft) => void
}) {
  const palette = usePalette()
  const now = useNow()
  const [card, setCard] = useState<CardContent>(() => emptyCard(stamps[1].id))
  const [to, setTo] = useState('')
  const [mode, setMode] = useState<Mode>('hand')
  const [side, setSide] = useState<'front' | 'back'>('back')
  const [complaint, setComplaint] = useState<string | null>(null)
  const [isBusyWithPhoto, setIsBusyWithPhoto] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isForStranger, setIsForStranger] = useState(false)

  const stamp = stampById(card.stampId)
  const express = card.stampId === EXPRESS_STAMP_ID
  const free = card.stampId === FREE_STAMP_ID

  // The price is looked up as the name is typed, so the writer sees what the
  // card will cost before the wallet is ever asked to sign.
  const office = usePostOffice()
  const settledTo = useDebounced(to, 600)
  const quote = useQuote(settledTo)
  const token = office.data ? tokenName(office.data.postageMint) : ''
  const decimals = office.data?.decimals ?? 0
  // The reader's time zone is not known until their letterbox is looked up, so
  // this is an estimate in the writer's own.
  const offset = deviceUtcOffsetMinutes()
  const arrives = express
    ? copy.write.arrivesExpress
    : copy.write.arrives(describeDelivery(nextDelivery(now, offset), now, offset))

  function change(patch: Partial<CardContent>) {
    setComplaint(null)
    setCard((current) => ({ ...current, ...patch }))
  }

  async function addPhoto(source: PhotoSource) {
    if (isBusyWithPhoto) {
      return
    }
    setIsBusyWithPhoto(true)
    try {
      const photo = await pickPhoto(source)
      if (photo) {
        change({ photo })
        setSide('front')
      }
    } catch {
      setComplaint(copy.errors.generic)
    } finally {
      setIsBusyWithPhoto(false)
    }
  }

  async function drawStranger() {
    if (isDrawing) {
      return
    }
    setIsDrawing(true)
    setComplaint(null)
    try {
      setTo(await onDrawStranger())
      setIsForStranger(true)
    } catch (problem) {
      setComplaint(describeProblem(problem))
    } finally {
      setIsDrawing(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    // A card carries one or the other, so the two never overlap on the back.
    change(next === 'hand' ? { message: '' } : { strokes: [] })
  }

  function post() {
    if (to.trim().length === 0) {
      setComplaint(copy.write.needsRecipient)
      return
    }
    if (isBlank(card)) {
      setComplaint(copy.write.needsMessage)
      return
    }
    onPost({ card: { ...card, writtenAt: now }, to: to.trim() })
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-6 pb-10 pt-6" keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" hitSlop={12} onPress={onBack}>
        <Text className="font-caption text-caption uppercase tracking-widest text-ink-faint">{copy.write.back}</Text>
      </Pressable>
      <Text className="mb-5 mt-1 font-title text-title text-ink">{copy.write.title}</Text>

      <FlipCard
        back={<PostcardBack card={card} to={asWrittenOnACard(to)} />}
        front={<PostcardFront photo={card.photo} />}
        onTurn={setSide}
        showing={side}
      />
      <Text className="mt-2 text-center font-caption text-caption text-ink-faint">{copy.write.turnHint}</Text>

      <Label>{copy.write.toLabel}</Label>
      <TextInput
        accessibilityLabel={copy.write.toLabel}
        autoCapitalize="none"
        autoCorrect={false}
        className="rounded-card border border-rule bg-paper-raised px-4 py-3 font-body text-body text-ink"
        onChangeText={(value) => {
          setComplaint(null)
          setIsForStranger(false)
          setTo(value)
        }}
        placeholder={copy.write.toPlaceholder}
        placeholderTextColor={palette.inkFaint}
        value={to}
      />
      {isForStranger ? (
        <Text className="mt-2 font-body text-body text-ink-soft">{copy.write.strangerNote}</Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          className="mt-2 self-start"
          hitSlop={8}
          onPress={() => void drawStranger()}
        >
          <Text className="font-label text-label text-accent-ink underline">
            {isDrawing ? copy.write.drawing : copy.write.stranger}
          </Text>
        </Pressable>
      )}

      <Label>{copy.write.pictureLabel}</Label>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <InkButton
            disabled={isBusyWithPhoto}
            label={copy.write.takePhoto}
            onPress={() => void addPhoto('camera')}
            tone="plain"
          />
        </View>
        <View className="flex-1">
          <InkButton
            disabled={isBusyWithPhoto}
            label={copy.write.choosePhoto}
            onPress={() => void addPhoto('library')}
            tone="plain"
          />
        </View>
      </View>
      {card.photo ? (
        <Pressable
          accessibilityRole="button"
          className="mt-2 self-start"
          hitSlop={8}
          onPress={() => change({ photo: null })}
        >
          <Text className="font-label text-label text-accent-ink underline">{copy.write.removePhoto}</Text>
        </Pressable>
      ) : null}

      <View className="mb-2 mt-7 flex-row items-end justify-between">
        <Text className="font-label text-label text-ink">{copy.write.messageLabel}</Text>
        <View className="flex-row gap-4">
          <ModeTab isOn={mode === 'hand'} label={copy.write.byHand} onPress={() => switchMode('hand')} />
          <ModeTab isOn={mode === 'typed'} label={copy.write.typed} onPress={() => switchMode('typed')} />
        </View>
      </View>
      {mode === 'hand' ? (
        <>
          <HandwritingPad onChange={(strokes) => change({ strokes })} strokes={card.strokes} />
          {card.strokes.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              className="mt-2 self-start"
              hitSlop={8}
              onPress={() => change({ strokes: [] })}
            >
              <Text className="font-label text-label text-accent-ink underline">{copy.write.clearWriting}</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <TextInput
          accessibilityLabel={copy.write.messageLabel}
          className="min-h-[140px] rounded-card border border-rule bg-paper-raised px-4 py-3 font-hand text-hand text-ink"
          maxLength={MAX_MESSAGE_LENGTH}
          multiline
          onChangeText={(message) => change({ message })}
          placeholder={copy.write.typePlaceholder}
          placeholderTextColor={palette.inkFaint}
          textAlignVertical="top"
          value={card.message}
        />
      )}

      <Label>{copy.write.stampLabel}</Label>
      <ScrollView contentContainerClassName="gap-3 pr-6" horizontal showsHorizontalScrollIndicator={false}>
        {stamps.map((option) => {
          const isChosen = option.id === card.stampId
          return (
            <Pressable
              accessibilityLabel={`${option.name} stamp`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isChosen }}
              className={`rounded-stamp border-2 p-1.5 ${isChosen ? 'border-accent' : 'border-transparent'}`}
              key={option.id}
              onPress={() => {
                void Haptics.selectionAsync()
                change({ stampId: option.id })
                setSide('back')
              }}
            >
              <StampArt art={option.art} backing={palette.paper} label={option.name} />
            </Pressable>
          )
        })}
      </ScrollView>
      <Text className="mt-2 font-body text-body text-ink-soft">{stamp.note}</Text>

      <View className="my-6 h-px bg-rule" />
      <Text className="mb-3 font-body text-body text-ink-soft">{arrives}</Text>
      {quote.data ? (
        <View className="mb-3 gap-1">
          <Text className="font-body text-body text-ink">
            {free ? copy.write.quoteFree : copy.write.quotePaid(formatTokens(quote.data.price, decimals), token)}
          </Text>
          {express ? (
            <Text className="font-body text-body text-ink">
              {copy.write.quoteExpress(formatTokens(quote.data.expressFee, decimals), token)}
            </Text>
          ) : null}
          <Text className="font-body text-body text-ink-soft">
            {quote.data.sealed ? copy.write.quoteSealed : copy.write.quoteOpen}
          </Text>
        </View>
      ) : quote.isFetched && settledTo.trim().length >= 5 && settledTo === to ? (
        <Text className="mb-3 font-body text-body text-ink-soft">{copy.write.quoteNobody}</Text>
      ) : null}
      {(complaint ?? error) ? (
        <Text className="mb-3 font-body text-body text-accent-ink">{complaint ?? error}</Text>
      ) : null}
      <InkButton disabled={isPosting} label={isPosting ? copy.write.posting : copy.write.post} onPress={post} />
    </ScrollView>
  )
}

/** A name goes on the card as typed. A bare wallet address is shortened, the way you would write it by hand. */
function asWrittenOnACard(to: string): string {
  const typed = to.trim()
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(typed) ? ellipsify(typed, 4) : typed
}

function Label({ children }: { children: string }) {
  return <Text className="mb-2 mt-7 font-label text-label text-ink">{children}</Text>
}

function ModeTab({ isOn, label, onPress }: { isOn: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: isOn }} hitSlop={8} onPress={onPress}>
      <Text className={`font-label text-label ${isOn ? 'text-ink underline' : 'text-ink-faint'}`}>{label}</Text>
    </Pressable>
  )
}
