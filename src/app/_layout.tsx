// The crypto polyfill has to be in place before any wallet code loads.
import '../../polyfill'
import '../global.css'

import { Caveat_500Medium } from '@expo-google-fonts/caveat/500Medium'
import { Caveat_700Bold } from '@expo-google-fonts/caveat/700Bold'
import { Lora_400Regular } from '@expo-google-fonts/lora/400Regular'
import { Lora_500Medium } from '@expo-google-fonts/lora/500Medium'
import { Lora_600SemiBold } from '@expo-google-fonts/lora/600SemiBold'
import { Lora_700Bold } from '@expo-google-fonts/lora/700Bold'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  AppIdentity,
  createSolanaDevnet,
  createSolanaLocalnet,
  createSolanaMainnet,
  MobileWalletProvider,
} from '@wallet-ui/react-native-kit'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NetworkProvider } from '../features/network/network-provider'
import { PracticeWalletProvider } from '../features/wallet/practice'

void SplashScreen.preventAutoHideAsync()

// Devnet comes first while the program is only deployed there. SKR and .skr
// names live on mainnet, so the release build puts mainnet first.
const mainnetUrl = process.env.EXPO_PUBLIC_MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com'
// A validator on the developer's own machine goes first when its address is
// set. It is reached from the phone with `adb reverse tcp:8899 tcp:8899`.
const localnetUrl = process.env.EXPO_PUBLIC_LOCALNET_RPC_URL
const networks = [
  ...(localnetUrl ? [createSolanaLocalnet(localnetUrl)] : []),
  createSolanaDevnet(),
  createSolanaMainnet({ url: mainnetUrl }),
]

// The wallet shows this name and address when it asks the reader to sign.
const identity: AppIdentity = { name: 'Penny Post', uri: 'https://github.com/kinnuworks/penny-post' }
const queryClient = new QueryClient()

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    Caveat_500Medium,
    Caveat_700Bold,
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])

  // Hold the splash until the type is ready, so nothing reflows on first paint.
  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    // The handwriting pad's pen is a native gesture, which needs this at the root.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <NetworkProvider
          networks={networks}
          render={({ selectedNetwork }) => (
            <MobileWalletProvider cluster={selectedNetwork} identity={identity}>
              <PracticeWalletProvider>
                <Stack screenOptions={{ animation: 'fade_from_bottom', headerShown: false }} />
              </PracticeWalletProvider>
            </MobileWalletProvider>
          )}
        />
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
