import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { usePracticeWallet } from './practice'

/**
 * The wallet the app is talking to. Normally that is the reader's own, through
 * Mobile Wallet Adapter. On a test network it can instead be the practice
 * wallet kept on this phone, which answers to the same names so the rest of
 * the app does not need to know which one it has.
 */
export function useWallet() {
  const mobile = useMobileWallet()
  const practice = usePracticeWallet()
  if (practice.signer) {
    return {
      ...mobile,
      account: { address: practice.signer.address },
      disconnect: practice.stop,
      isPractice: true as const,
      practiceSigner: practice.signer,
    }
  }
  return { ...mobile, isPractice: false as const, practiceSigner: null }
}
