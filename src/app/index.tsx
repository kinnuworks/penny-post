import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LetterboxScreen } from '../features/letterbox/letterbox-screen'
import { WelcomeScreen } from '../features/welcome/welcome-screen'
import { describeWalletError } from '../utils/describe-wallet-error'

export default function App() {
  const insets = useSafeAreaInsets()
  const { account, connect } = useMobileWallet()
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  // A wallet prompt can be declined, time out, or find no wallet at all. Run it
  // here so a rejection never escapes as an unhandled promise, and the reader
  // is told what happened in plain words.
  async function run(action: () => Promise<unknown>) {
    if (isBusy) {
      return
    }
    setIsBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(describeWalletError(e))
    } finally {
      setIsBusy(false)
    }
  }

  if (!account) {
    return (
      <View className="flex-1 bg-ink">
        <WelcomeScreen error={error} isBusy={isBusy} onConnect={() => void run(connect)} />
        <StatusBar style="dark" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      <LetterboxScreen address={account.address} />
      <StatusBar style="auto" />
    </View>
  )
}
