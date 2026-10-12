import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LetterboxScreen } from '../features/letterbox/letterbox-screen'
import { IntroScreen } from '../features/welcome/intro-screen'
import { WelcomeScreen } from '../features/welcome/welcome-screen'
import { describeWalletError } from '../utils/describe-wallet-error'

const INTRO_SEEN_KEY = 'penny-post/intro-seen/v1'

export default function App() {
  const insets = useSafeAreaInsets()
  const { account, connect } = useMobileWallet()
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  // Assume it has been seen until storage says otherwise, so a returning reader never sees it flash.
  const [hasSeenIntro, setHasSeenIntro] = useState(true)
  const [isShowingIntro, setIsShowingIntro] = useState(false)
  useEffect(() => {
    void AsyncStorage.getItem(INTRO_SEEN_KEY)
      .then((seen) => setHasSeenIntro(seen === '1'))
      .catch(() => undefined)
  }, [])

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
    // The three pages of introduction are shown once, before the first connection.
    if (isShowingIntro) {
      return (
        <>
          <IntroScreen
            onDone={() => {
              setHasSeenIntro(true)
              setIsShowingIntro(false)
              void AsyncStorage.setItem(INTRO_SEEN_KEY, '1').catch(() => undefined)
              void run(connect)
            }}
          />
          <StatusBar style="auto" />
        </>
      )
    }
    return (
      <View className="flex-1 bg-ink">
        <WelcomeScreen
          error={error}
          isBusy={isBusy}
          onConnect={() => (hasSeenIntro ? void run(connect) : setIsShowingIntro(true))}
        />
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
