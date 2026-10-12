import { usePracticeWallet } from '../features/wallet/practice'
import { useWallet } from '../features/wallet/use-wallet'
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
  const { account, chain, connect } = useWallet()
  const practice = usePracticeWallet()
  // Which wallet the reader chose on the welcome screen: their own, or the practice one.
  const [wantsPractice, setWantsPractice] = useState(false)
  const enter = () => (wantsPractice ? void run(practice.start) : void run(connect))
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
            isPractice={wantsPractice}
            onDone={() => {
              setHasSeenIntro(true)
              setIsShowingIntro(false)
              void AsyncStorage.setItem(INTRO_SEEN_KEY, '1').catch(() => undefined)
              enter()
            }}
          />
          <StatusBar style="auto" />
        </>
      )
    }
    const begin = (withPractice: boolean) => {
      setWantsPractice(withPractice)
      if (hasSeenIntro) {
        void run(withPractice ? practice.start : connect)
      } else {
        setIsShowingIntro(true)
      }
    }
    return (
      <View className="flex-1 bg-ink">
        <WelcomeScreen
          error={error}
          isBusy={isBusy}
          onConnect={() => begin(false)}
          // A practice wallet is only for test networks. It is never offered where the money is real.
          onPractice={chain === 'solana:mainnet' ? undefined : () => begin(true)}
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
