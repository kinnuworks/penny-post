import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ProfileScreen } from '../features/profile/profile-screen'

export default function Profile() {
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <ProfileScreen />
    </View>
  )
}
