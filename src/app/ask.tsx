import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AskScreen } from '../features/circular/ask-screen'

export default function Ask() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-paper" style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}>
      <AskScreen onDone={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  )
}
