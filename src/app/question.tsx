import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { QuestionScreen } from '../features/circular/question-screen'

export default function Question() {
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-paper" style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}>
      <QuestionScreen />
    </View>
  )
}
