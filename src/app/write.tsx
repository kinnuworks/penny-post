import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { InkButton } from '../components/ink-button'
import { SunStamp } from '../components/sun'
import { TabBar } from '../components/tab-bar'
import { copy } from '../copy'
import { useDrawPenPal, usePostCard, type PostedReceipt } from '../features/post/use-post'
import { WriteScreen } from '../features/write/write-screen'
import { describeProblem } from '../utils/describe-problem'
import { ellipsify } from '../utils/ellipsify'

export default function Write() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const postCard = usePostCard()
  const drawPenPal = useDrawPenPal()
  const [receipt, setReceipt] = useState<PostedReceipt | null>(null)
  // A new key gives the counter a clean card after "write another".
  const [round, setRound] = useState(0)

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      {receipt ? (
        <Posted
          onAnother={() => {
            setReceipt(null)
            setRound((current) => current + 1)
          }}
          onHome={() => router.dismissTo('/')}
          receipt={receipt}
        />
      ) : (
        <WriteScreen
          error={postCard.error ? describeProblem(postCard.error) : null}
          isPosting={postCard.isPending}
          key={round}
          onDrawStranger={() => drawPenPal.mutateAsync()}
          onPost={(draft) => postCard.mutate(draft, { onSuccess: setReceipt })}
        />
      )}
      <TabBar current="send" />
    </View>
  )
}

// What the counter says once the card has gone, and what kind of post it went by.
function Posted({ onAnother, onHome, receipt }: { onAnother: () => void; onHome: () => void; receipt: PostedReceipt }) {
  return (
    <View className="flex-1 justify-between px-7 pb-8 pt-14">
      <View className="items-center">
        <View style={{ transform: [{ rotate: '-6deg' }] }}>
          <SunStamp size={112} />
        </View>
        <Text
          className="mt-8 w-full text-center font-script text-[54px] leading-[62px] text-ink"
          textBreakStrategy="simple"
        >
          {copy.posted.title}
        </Text>
        <Text className="mt-3 w-full text-center font-hand text-hand text-ink">
          {receipt.express ? copy.counter.postedExpress : copy.counter.posted}
        </Text>
        <Text className="mt-3 text-center font-body text-body text-ink-soft">
          {receipt.sealed ? copy.posted.sealed : copy.posted.openCard}
        </Text>
        {receipt.delivered ? null : (
          <Text className="mt-4 text-center font-body text-body text-accent-ink">{copy.posted.waiting}</Text>
        )}
        <Text className="mt-6 text-center font-caption text-caption text-ink-faint" selectable>
          {copy.posted.receipt(ellipsify(receipt.signature, 6))}
        </Text>
      </View>
      <View className="gap-3">
        <InkButton label={copy.posted.another} onPress={onAnother} />
        <InkButton label={copy.posted.home} onPress={onHome} tone="plain" />
      </View>
    </View>
  )
}
