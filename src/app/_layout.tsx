// The crypto polyfill has to be in place before any wallet code loads.
import '../../polyfill'
import '../global.css'

import { Besley_600SemiBold } from '@expo-google-fonts/besley/600SemiBold'
import { Besley_700Bold } from '@expo-google-fonts/besley/700Bold'
import { Kalam_400Regular } from '@expo-google-fonts/kalam/400Regular'
import { Mukta_400Regular } from '@expo-google-fonts/mukta/400Regular'
import { Mukta_500Medium } from '@expo-google-fonts/mukta/500Medium'
import { Mukta_600SemiBold } from '@expo-google-fonts/mukta/600SemiBold'
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
import { NetworkProvider } from '../features/network/network-provider'

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
    Besley_600SemiBold,
    Besley_700Bold,
    Kalam_400Regular,
    Mukta_400Regular,
    Mukta_500Medium,
    Mukta_600SemiBold,
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
    <QueryClientProvider client={queryClient}>
      <NetworkProvider
        networks={networks}
        render={({ selectedNetwork }) => (
          <MobileWalletProvider cluster={selectedNetwork} identity={identity}>
            <Stack screenOptions={{ animation: 'slide_from_bottom', headerShown: false }} />
          </MobileWalletProvider>
        )}
      />
    </QueryClientProvider>
  )
}
