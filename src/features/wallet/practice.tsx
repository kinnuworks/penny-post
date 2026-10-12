import { getAddressDecoder, type Address, type TransactionPartialSigner } from '@solana/kit'
import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import nacl from 'tweetnacl'

// A practice wallet: a throwaway key made on this phone, for trying the app on
// a test network without installing or switching a wallet. It signs by itself,
// so nothing asks for approval. It is never offered on mainnet, and nobody
// should send it anything of value.

const SEED_KEY = 'penny-post.practice-seed.v1'
const ON_KEY = 'penny-post.practice-on.v1'

interface Practice {
  /** The practice wallet's signer while it is in use, otherwise null. */
  signer: TransactionPartialSigner | null
  start: () => Promise<void>
  stop: () => Promise<void>
}

const PracticeContext = createContext<Practice>({ signer: null, start: async () => {}, stop: async () => {} })

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

/** The practice key, made the first time it is asked for and kept in the phone's secure storage. */
async function loadOrCreateSigner(): Promise<TransactionPartialSigner> {
  let seedHex = await SecureStore.getItemAsync(SEED_KEY)
  if (!seedHex || seedHex.length !== 64) {
    seedHex = toHex(nacl.randomBytes(32))
    await SecureStore.setItemAsync(SEED_KEY, seedHex)
  }
  const pair = nacl.sign.keyPair.fromSeed(fromHex(seedHex))
  const address = getAddressDecoder().decode(pair.publicKey) as Address
  return {
    address,
    signTransactions: async (transactions) =>
      transactions.map((transaction) => ({
        [address]: nacl.sign.detached(new Uint8Array(transaction.messageBytes), pair.secretKey),
      })) as never,
  }
}

export function PracticeWalletProvider({ children }: { children: ReactNode }) {
  const [signer, setSigner] = useState<TransactionPartialSigner | null>(null)

  // Come back to the practice wallet if that is how the app was last used.
  useEffect(() => {
    void SecureStore.getItemAsync(ON_KEY)
      .then(async (on) => {
        if (on === '1') {
          setSigner(await loadOrCreateSigner())
        }
      })
      .catch(() => undefined)
  }, [])

  const start = useCallback(async () => {
    const made = await loadOrCreateSigner()
    await SecureStore.setItemAsync(ON_KEY, '1').catch(() => undefined)
    setSigner(made)
  }, [])
  const stop = useCallback(async () => {
    await SecureStore.deleteItemAsync(ON_KEY).catch(() => undefined)
    setSigner(null)
  }, [])

  const value = useMemo(() => ({ signer, start, stop }), [signer, start, stop])
  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>
}

export function usePracticeWallet(): Practice {
  return useContext(PracticeContext)
}
