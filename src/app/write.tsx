import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { copy } from '../copy'
import { WriteScreen, type Draft } from '../features/write/write-screen'

export default function Write() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  // Posting is wired to the program in the next step. Until then the counter
  // says so plainly instead of pretending the card went anywhere.
  function post(_draft: Draft) {
    setError(copy.write.notOpenYet)
  }

  return (
    <View className="flex-1 bg-paper" style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}>
      <WriteScreen error={error} isPosting={false} onBack={() => router.back()} onPost={post} />
    </View>
  )
}
