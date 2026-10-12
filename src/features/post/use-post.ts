import { findCardPda } from '@project/anchor'
import { fetchMint } from '@solana-program/token'
import { createSolanaRpc, type Address, type Signature } from '@solana/kit'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { DEFAULT_PRICE_TOKENS, MAINNET_RPC_URL } from '../../config'
import { hashCard, type CardContent } from '../card/card'
import { isSealed, isUsableReadingKey, packCard, unpackCard } from '../card/envelope'
import { EXPRESS_STAMP_ID, FREE_STAMP_ID } from '../card/stamps'
import { keep } from '../kept/kept-store'
import { findGenesisToken } from '../letterbox/genesis-token'
import { loadOrCreateReadingKey, loadReadingKey } from '../letterbox/reading-key-store'
import { parseSkrName, primarySkrName, resolveRecipient, resolveSkrName } from '../names/skr'
import { downloadCard, uploadCard, type Cluster } from './card-store'
import {
  buildOpenCard,
  buildOpenLetterbox,
  buildPostCard,
  buildReturnCard,
  buildSetLetterbox,
  buildVerifyLetterbox,
  fetchLetterbox,
  fetchPostOffice,
  fetchSealHeldBy,
  hasFreeStamp,
  listCardsTo,
  newCardId,
  priceToReach,
  type PostedCard,
} from './chain'
import { deviceUtcOffsetMinutes } from './delivery'
import { drawPenPal, flushExchange, noteForExchange } from './exchange'
import { flushOutbox, forget, keepForUpload } from './outbox'
import { PostProblem } from './problem'
import { isDeclined } from '../../utils/describe-wallet-error'
import { useSend } from './use-send'

// .skr names live on mainnet whichever network the app is pointed at.
const mainnetRpc = createSolanaRpc(MAINNET_RPC_URL)

export { PostProblem }

function clusterOf(chain: string): Cluster {
  return chain === 'solana:mainnet' ? 'mainnet' : 'devnet'
}

/** The post office's terms on the current network, with the postage token's decimals. */
export function usePostOffice() {
  const { chain, client } = useMobileWallet()
  return useQuery({
    queryKey: ['post-office', chain],
    queryFn: async () => {
      const postOffice = await fetchPostOffice(client.rpc)
      if (!postOffice) {
        return null
      }
      const mint = await fetchMint(client.rpc, postOffice.postageMint)
      return { ...postOffice, decimals: mint.data.decimals }
    },
    staleTime: 5 * 60_000,
  })
}

/** The connected wallet's letterbox, and its seal if it still holds the Genesis Token. */
export function useMyLetterbox() {
  const { account, chain, client } = useMobileWallet()
  return useQuery({
    enabled: !!account,
    queryKey: ['letterbox', chain, account?.address],
    queryFn: async () => {
      if (!account) {
        return null
      }
      const letterbox = await fetchLetterbox(client.rpc, account.address)
      if (!letterbox) {
        return null
      }
      const seal = await fetchSealHeldBy(client.rpc, letterbox)
      return { letterbox, seal }
    },
  })
}

/** Cards addressed to the connected wallet that are still in the post. */
export function useDoormat() {
  const { account, chain, client } = useMobileWallet()
  return useQuery({
    enabled: !!account,
    queryKey: ['doormat', chain, account?.address],
    queryFn: () => (account ? listCardsTo(client.rpc, account.address) : []),
    refetchInterval: 60_000,
  })
}

export interface Quote {
  /** Burned on top of the postage when the card goes express. */
  expressFee: bigint
  /** What a paid card must carry to reach this reader. */
  price: bigint
  /** True if the reader has a letterbox with a reading key, so the card can be sealed. */
  sealed: boolean
}

/**
 * What it costs to reach whoever is named in the "to" field, looked up before
 * anything is signed. Null while the name does not resolve to anyone.
 */
export function useQuote(to: string) {
  const { account, chain, client } = useMobileWallet()
  const postOffice = usePostOffice()
  const office = postOffice.data
  const wanted = to.trim()

  return useQuery({
    enabled: !!account && !!office && wanted.length >= 5,
    queryKey: ['quote', chain, wanted],
    queryFn: async (): Promise<Quote | null> => {
      if (!office) {
        return null
      }
      const reader = await resolveRecipient(mainnetRpc, wanted)
      if (!reader) {
        return null
      }
      const letterbox = await fetchLetterbox(client.rpc, reader.address)
      return {
        expressFee: office.expressFee,
        price: priceToReach(office, letterbox),
        sealed: !!letterbox && isUsableReadingKey(new Uint8Array(letterbox.readingKey)),
      }
    },
    staleTime: 60_000,
  })
}

/** Delivers anything left in the outbox from an earlier session. */
export function useFlushOutbox() {
  return useQuery({
    queryKey: ['outbox'],
    queryFn: async () => {
      const waiting = await flushOutbox()
      await flushExchange()
      return waiting
    },
    staleTime: 60_000,
  })
}

/** Draws a stranger to write to from the pen-pal exchange. */
export function useDrawPenPal() {
  const { account, chain } = useMobileWallet()

  return useMutation({
    mutationFn: async (): Promise<string> => {
      if (!account) {
        throw new PostProblem('office-closed')
      }
      const stranger = await drawPenPal(account.address, clusterOf(chain))
      if (!stranger) {
        throw new PostProblem('nobody-waiting')
      }
      // Show their name if they have one. The address works either way.
      return (await primarySkrName(mainnetRpc, stranger).catch(() => null)) ?? stranger
    },
  })
}

export function useOpenLetterbox() {
  const { account, chain } = useMobileWallet()
  const send = useSend()
  const queryClient = useQueryClient()
  const postOffice = usePostOffice()

  return useMutation({
    mutationFn: async () => {
      const office = postOffice.data
      if (!account || !office) {
        throw new PostProblem('office-closed')
      }
      const readingKey = await loadOrCreateReadingKey(account.address)
      const price = DEFAULT_PRICE_TOKENS * 10n ** BigInt(office.decimals)
      return send((owner) =>
        buildOpenLetterbox({
          owner,
          price: price > office.floorPrice ? price : office.floorPrice,
          readingKey: readingKey.publicKey,
          utcOffsetMinutes: deviceUtcOffsetMinutes(),
        }),
      )
    },
    // Refresh even after a failure: the wallet may have submitted the
    // transaction after the app stopped waiting for it.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['letterbox', chain, account?.address] }),
  })
}

/** Changes what a stranger pays to reach this letterbox. Cards already posted keep their postage. */
export function useSetPrice() {
  const { account, chain } = useMobileWallet()
  const send = useSend()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (price: bigint) => {
      if (!account) {
        throw new PostProblem('office-closed')
      }
      // The instruction rewrites the whole letterbox, so the key and the clock go along unchanged.
      const readingKey = await loadOrCreateReadingKey(account.address)
      return send((owner) =>
        buildSetLetterbox({
          owner,
          price,
          readingKey: readingKey.publicKey,
          utcOffsetMinutes: deviceUtcOffsetMinutes(),
        }),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['letterbox', chain, account?.address] }),
  })
}

/** Finds the Seeker Genesis Token in the wallet and ties its seal to the letterbox. */
export function useVerifyLetterbox() {
  const { account, chain, client } = useMobileWallet()
  const send = useSend()
  const queryClient = useQueryClient()
  const postOffice = usePostOffice()

  return useMutation({
    mutationFn: async () => {
      const office = postOffice.data
      if (!account || !office) {
        throw new PostProblem('office-closed')
      }
      const token = await findGenesisToken(client.rpc, account.address, office.sgtGroup)
      if (!token) {
        throw new PostProblem('no-genesis-token')
      }
      return send((owner) => buildVerifyLetterbox({ owner, sgtMint: token.mint, sgtToken: token.tokenAccount }))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['letterbox', chain, account?.address] }),
  })
}

export interface PostedReceipt {
  /** The transaction that posted the card. */
  signature: Signature
  card: Address
  express: boolean
  /** False if the card is on-chain but its contents are still waiting in the outbox. */
  delivered: boolean
  readerName: string | null
  sealed: boolean
}

export function usePostCard() {
  const { account, chain, client } = useMobileWallet()
  const send = useSend()
  const queryClient = useQueryClient()
  const postOffice = usePostOffice()
  const mine = useMyLetterbox()

  return useMutation({
    mutationFn: async ({ card, to }: { card: CardContent; to: string }): Promise<PostedReceipt> => {
      const office = postOffice.data
      if (!account || !office) {
        throw new PostProblem('office-closed')
      }
      const reader = await resolveRecipient(mainnetRpc, to)
      if (!reader) {
        throw new PostProblem('no-such-reader')
      }
      if (reader.address === account.address) {
        throw new PostProblem('to-yourself')
      }

      const readerLetterbox = await fetchLetterbox(client.rpc, reader.address)
      const express = card.stampId === EXPRESS_STAMP_ID
      const free = card.stampId === FREE_STAMP_ID
      const seal = mine.data?.seal ?? null
      if (free && !(seal && hasFreeStamp(seal, Math.floor(Date.now() / 1000)))) {
        throw new PostProblem('no-free-stamp')
      }
      // The program checks that the Genesis Token is still in this wallet, so it needs to be shown where.
      const genesisToken = free ? await findGenesisToken(client.rpc, account.address, office.sgtGroup) : null
      if (free && genesisToken?.mint !== seal?.sgtMint) {
        throw new PostProblem('no-genesis-token')
      }

      // The return address is the writer's own .skr name, if they have set one.
      const signed: CardContent = {
        ...card,
        fromName: await primarySkrName(mainnetRpc, account.address).catch(() => null),
      }

      // Sealed to the reader's key if they have a letterbox, an open postcard if not.
      const bytes = packCard(signed, readerLetterbox ? new Uint8Array(readerLetterbox.readingKey) : null)
      const cardId = newCardId()
      const cluster = clusterOf(chain)
      const [address] = await findCardPda({ cardId, sender: account.address })

      // Saved before the wallet is asked, so the contents survive whatever happens next.
      await keepForUpload(address, bytes, cluster)
      let posted: Signature
      try {
        posted = await send(async (sender) => {
          const { instructions } = await buildPostCard({
            cardId,
            contentHash: hashCard(bytes),
            express,
            maxExpressFee: office.expressFee,
            postage: free ? 0n : priceToReach(office, readerLetterbox),
            postageMint: office.postageMint,
            recipient: reader.address,
            seal: free ? seal?.address : undefined,
            sender,
            sgtToken: genesisToken?.tokenAccount,
            stamp: card.stampId,
          })
          return instructions
        })
      } catch (error) {
        // If the wallet said no, or the dry run refused before the wallet was
        // asked, nothing was posted. If the app only lost track of a transaction
        // that did land, the outbox still has the contents and delivers them
        // later, so they are left where they are.
        if (isDeclined(error) || error instanceof PostProblem) {
          await forget(address)
        }
        throw error
      }

      let delivered = true
      try {
        await uploadCard(address, bytes, cluster)
        await forget(address)
      } catch {
        // The card is in the post. Its contents stay in the outbox and go out later.
        delivered = false
      }
      // If this card answers a draw from the exchange, the writer joins the line.
      await noteForExchange(address, cluster)
      void flushExchange()
      return { card: address, delivered, express, readerName: reader.name, sealed: isSealed(bytes), signature: posted }
    },
    onSettled: (_receipt, error) => {
      void queryClient.invalidateQueries({ queryKey: ['letterbox', chain, account?.address] })
      if (error) {
        // A refusal can mean the terms or the reader's price moved. Read them again before the next try.
        void queryClient.invalidateQueries({ queryKey: ['post-office', chain] })
        void queryClient.invalidateQueries({ queryKey: ['quote', chain] })
      }
    },
  })
}

export function useOpenCard() {
  const { account, chain } = useMobileWallet()
  const send = useSend()
  const queryClient = useQueryClient()
  const postOffice = usePostOffice()

  return useMutation({
    mutationFn: async (card: PostedCard): Promise<{ content: CardContent; paid: bigint; signature: Signature }> => {
      const office = postOffice.data
      if (!account || !office) {
        throw new PostProblem('office-closed')
      }
      // Fetch and read the card before signing. Opening closes the on-chain
      // record of its hash, and a card that cannot be read should stay in the
      // post, where it can still be returned.
      const bytes = await downloadCard(new Uint8Array(card.contentHash))
      if (!bytes) {
        throw new PostProblem('not-arrived')
      }
      let content: CardContent
      try {
        content = unpackCard(bytes, await loadReadingKey(account.address))
      } catch {
        throw new PostProblem('sealed-for-another-phone')
      }

      // A card says who it is from, and anyone can write any name on a card. The
      // name is only kept if it really does point at the wallet that posted it.
      content = { ...content, fromName: await confirmedName(content.fromName, card.sender) }

      const signedFor = await send((recipient) => buildOpenCard({ card, postageMint: office.postageMint, recipient }))

      // The card carries the burn share it was posted under.
      const burned = (card.postage * BigInt(card.burnBps)) / 10_000n
      const paid = card.postage - burned
      await keep(account.address, {
        card: card.address,
        content,
        from: card.sender,
        openedAt: Math.floor(Date.now() / 1000),
        paid: paid.toString(),
      })
      return { content, paid, signature: signedFor }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['doormat', chain, account?.address] })
      void queryClient.invalidateQueries({ queryKey: ['kept', account?.address] })
    },
  })
}

async function confirmedName(claimed: string | null, sender: Address): Promise<string | null> {
  const label = claimed ? parseSkrName(claimed) : null
  if (!label) {
    return null
  }
  const owner = await resolveSkrName(mainnetRpc, label).catch(() => null)
  return owner === sender ? `${label}.skr` : null
}

/** The .skr name a wallet goes by, for showing who a card is from. */
export function useSkrName(wallet: Address | undefined) {
  return useQuery({
    enabled: !!wallet,
    queryKey: ['skr-name', wallet],
    queryFn: () => (wallet ? primarySkrName(mainnetRpc, wallet) : null),
    staleTime: 10 * 60_000,
  })
}

export function useReturnCard() {
  const { account, chain } = useMobileWallet()
  const send = useSend()
  const queryClient = useQueryClient()
  const postOffice = usePostOffice()

  return useMutation({
    mutationFn: async (card: PostedCard) => {
      const office = postOffice.data
      if (!account || !office) {
        throw new PostProblem('office-closed')
      }
      return send((caller) => buildReturnCard({ caller, card, postageMint: office.postageMint }))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['doormat', chain, account?.address] }),
  })
}
