import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { InkButton } from '../components/ink-button'
import { copy } from '../copy'
import { usePostCard, type PostedReceipt } from '../features/post/use-post'
import { WriteScreen } from '../features/write/write-screen'
import { describeProblem } from '../utils/describe-problem'

export default function Write() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const postCard = usePostCard()
  const [receipt, setReceipt] = useState<PostedReceipt | null>(null)
  // A new key gives the counter a clean card after "write another".
  const [round, setRound] = useState(0)

  return (
    <View className="flex-1 bg-paper" style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}>
      {receipt ? (
        <Posted
          onAnother={() => {
            setReceipt(null)
            setRound((current) => current + 1)
          }}
          onHome={() => router.back()}
          receipt={receipt}
        />
      ) : (
        <WriteScreen
          error={postCard.error ? describeProblem(postCard.error) : null}
          isPosting={postCard.isPending}
          key={round}
          onBack={() => router.back()}
          onPost={(draft) => postCard.mutate(draft, { onSuccess: setReceipt })}
        />
      )}
    </View>
  )
}

// What the counter says once the card has gone, and what kind of post it went by.
function Posted({ onAnother, onHome, receipt }: { onAnother: () => void; onHome: () => void; receipt: PostedReceipt }) {
  return (
    <View className="flex-1 justify-between px-6 pb-8 pt-10">
      <View>
        <Text className="font-display text-display text-ink">{copy.posted.title}</Text>
        <Text className="mt-4 font-hand text-hand text-ink">
          {receipt.express ? copy.counter.postedExpress : copy.counter.posted}
        </Text>
        <Text className="mt-4 font-body text-body text-ink-soft">
          {receipt.sealed ? copy.posted.sealed : copy.posted.openCard}
        </Text>
        {receipt.delivered ? null : (
          <Text className="mt-4 font-body text-body text-accent-ink">{copy.posted.waiting}</Text>
        )}
      </View>
      <View className="gap-3">
        <InkButton label={copy.posted.another} onPress={onAnother} />
        <InkButton label={copy.posted.home} onPress={onHome} tone="plain" />
      </View>
    </View>
  )
}
