import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { InkButton } from '../../components/ink-button'
import { copy } from '../../copy'
import { usePalette } from '../../theme'
import { describeProblem } from '../../utils/describe-problem'
import { formatTokens, parseTokens } from '../../utils/format-tokens'
import { useSetPrice } from '../post/use-post'

// Where the reader names their price. The floor comes from the post office, and
// the program holds to it whatever is typed here.
export function PriceDesk({
  burnBps,
  current,
  decimals,
  floor,
  onDone,
  token,
}: {
  burnBps: number
  current: bigint
  decimals: number
  floor: bigint
  onDone: () => void
  token: string
}) {
  const palette = usePalette()
  const setPrice = useSetPrice()
  const [text, setText] = useState(formatTokens(current, decimals))

  const wanted = parseTokens(text, decimals)
  const complaint =
    wanted === null
      ? copy.price.notAnAmount
      : wanted < floor
        ? copy.price.belowFloor(formatTokens(floor, decimals), token)
        : null
  const kept = wanted !== null && !complaint ? wanted - (wanted * BigInt(burnBps)) / 10_000n : null

  return (
    <View className="mb-5 rounded-card border border-rule bg-paper-raised px-5 py-5">
      <Text className="font-title text-heading text-ink">{copy.price.title}</Text>
      <View className="mt-3 flex-row items-center gap-3">
        <TextInput
          accessibilityLabel={copy.price.title}
          autoFocus
          className="min-w-[120px] flex-1 rounded-card border border-rule bg-paper px-4 py-3 font-body text-body text-ink"
          keyboardType="decimal-pad"
          maxLength={18}
          onChangeText={(value) => {
            setPrice.reset()
            setText(value)
          }}
          placeholderTextColor={palette.inkFaint}
          selectTextOnFocus
          value={text}
        />
        <Text className="font-label text-label text-ink">{token}</Text>
      </View>
      <Text className={`mt-3 font-body text-body ${complaint ? 'text-accent-ink' : 'text-ink-soft'}`}>
        {complaint ?? copy.price.youKeep(formatTokens(kept ?? 0n, decimals), token)}
      </Text>
      <Text className="mb-5 mt-1 font-caption text-caption text-ink-faint">{copy.price.inThePost}</Text>
      <InkButton
        disabled={!!complaint || setPrice.isPending}
        label={setPrice.isPending ? copy.price.setting : copy.price.set}
        onPress={() => {
          if (wanted === null) {
            return
          }
          if (wanted === current) {
            onDone()
            return
          }
          setPrice.mutate(wanted, { onSuccess: onDone })
        }}
      />
      {setPrice.error ? (
        <Text className="mt-3 font-body text-body text-accent-ink">{describeProblem(setPrice.error)}</Text>
      ) : null}
      <Pressable accessibilityRole="button" className="mt-4 self-start" hitSlop={10} onPress={onDone}>
        <Text className="font-label text-label text-ink-soft underline">{copy.price.leave}</Text>
      </Pressable>
    </View>
  )
}
