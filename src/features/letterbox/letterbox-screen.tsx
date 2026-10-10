import { Text, View } from 'react-native'
import { InkButton } from '../../components/ink-button'
import { copy } from '../../copy'
import { ellipsify } from '../../utils/ellipsify'
import { useNow } from '../../utils/use-now'
import { describeDelivery, deviceUtcOffsetMinutes, nextDelivery } from '../post/delivery'

// The doormat. Cards will land here once the program is deployed; until then
// this shows the empty state and when the next post is due.
export function LetterboxScreen({
  address,
  isBusy,
  onLeave,
  onWrite,
}: {
  address: string
  isBusy: boolean
  onLeave: () => void
  onWrite: () => void
}) {
  const now = useNow()
  const offset = deviceUtcOffsetMinutes()
  const when = describeDelivery(nextDelivery(now, offset), now, offset)

  return (
    <View className="flex-1 justify-between px-6 pb-8 pt-10">
      <View>
        <Text className="font-caption text-caption uppercase tracking-widest text-ink-faint">
          {copy.wallet.address(ellipsify(address))}
        </Text>
        <Text className="mb-6 mt-1 font-title text-title text-ink">{copy.letterbox.heading}</Text>

        <View className="rounded-card border border-rule bg-paper-raised px-5 py-8">
          <Text className="font-hand text-hand text-ink">{copy.letterbox.empty}</Text>
          <Text className="mt-3 font-body text-body text-ink-soft">{copy.letterbox.emptyHint}</Text>
          <View className="my-5 h-px bg-rule" />
          <Text className="font-caption text-caption text-ink-faint">{copy.letterbox.nextPost(when)}</Text>
        </View>
      </View>

      <View className="gap-3">
        <Text className="font-body text-body text-ink-soft">{copy.counter.stampReady}</Text>
        <InkButton disabled={isBusy} label={copy.counter.write} onPress={onWrite} />
        <InkButton disabled={isBusy} label={copy.wallet.leave} onPress={onLeave} tone="plain" />
      </View>
    </View>
  )
}
