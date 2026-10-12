import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import type { Instruction } from '@solana/kit'
import { findGenesisToken } from '../letterbox/genesis-token'
import { PostProblem } from '../post/problem'
import { useMyLetterbox, usePostOffice } from '../post/use-post'
import { useSend } from '../post/use-send'
import {
  buildAnswerCircular,
  buildCollectCircular,
  buildPostCircular,
  closesAt,
  fetchAnswer,
  fetchCircular,
  type PostedCircular,
} from './circular-chain'

/** A day's circular as this phone sees it. */
export interface CircularView {
  circular: PostedCircular
  /** The option this phone picked, or null if it has not answered (or has collected already). */
  myChoice: number | null
}

/** The circular for one UTC day, and this phone's answer to it. Null if nobody has asked anything. */
export function useCircular(day: number) {
  const { account, chain, client } = useMobileWallet()
  const mine = useMyLetterbox()
  const sgtMint = mine.data?.seal?.sgtMint

  return useQuery({
    enabled: !!account,
    queryKey: ['circular', chain, day, sgtMint ?? null],
    queryFn: async (): Promise<CircularView | null> => {
      const circular = await fetchCircular(client.rpc, day)
      if (!circular) {
        return null
      }
      const answer = sgtMint ? await fetchAnswer(client.rpc, circular.address, sgtMint) : null
      return { circular, myChoice: answer ? answer.choice : null }
    },
    refetchInterval: 60_000,
  })
}

/**
 * Answers a day's question. If this phone has a share waiting from another
 * day that has closed, it is collected in the same transaction, so one
 * signature a day does both.
 */
export function useAnswerCircular() {
  const { account, chain, client } = useMobileWallet()
  const send = useSend()
  const queryClient = useQueryClient()
  const postOffice = usePostOffice()
  const mine = useMyLetterbox()

  return useMutation({
    mutationFn: async ({ choice, day, alsoCollect }: { alsoCollect?: PostedCircular; choice: number; day: number }) => {
      const office = postOffice.data
      const seal = mine.data?.seal
      if (!account || !office) {
        throw new PostProblem('office-closed')
      }
      // The program checks that the Genesis Token is in this wallet right now, so it is shown where.
      const genesisToken = seal ? await findGenesisToken(client.rpc, account.address, office.sgtGroup) : null
      if (!seal || genesisToken?.mint !== seal.sgtMint) {
        throw new PostProblem('no-genesis-token')
      }
      const circular = await fetchCircular(client.rpc, day)
      if (!circular) {
        throw new PostProblem('question-closed')
      }
      return send(async (answerer) => {
        const instructions: Instruction[] = await buildAnswerCircular({
          answerer,
          choice,
          circular: circular.address,
          seal: seal.address,
          sgtMint: seal.sgtMint,
          sgtToken: genesisToken.tokenAccount,
        })
        if (alsoCollect) {
          instructions.push(
            ...(await buildCollectCircular({
              answerer,
              circular: alsoCollect.address,
              postageMint: office.postageMint,
              sgtMint: seal.sgtMint,
            })),
          )
        }
        return instructions
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['circular', chain] }),
  })
}

/** Collects this phone's share of a circular whose day has closed. */
export function useCollectCircular() {
  const { account, chain } = useMobileWallet()
  const send = useSend()
  const queryClient = useQueryClient()
  const postOffice = usePostOffice()
  const mine = useMyLetterbox()

  return useMutation({
    mutationFn: async (circular: PostedCircular) => {
      const office = postOffice.data
      const seal = mine.data?.seal
      if (!account || !office || !seal) {
        throw new PostProblem('office-closed')
      }
      if (Math.floor(Date.now() / 1000) < closesAt(circular.day)) {
        throw new PostProblem('question-open')
      }
      return send((answerer) =>
        buildCollectCircular({
          answerer,
          circular: circular.address,
          postageMint: office.postageMint,
          sgtMint: seal.sgtMint,
        }),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['circular', chain] }),
  })
}

/** Puts a question to every Seeker for a day. Naming `outbid` takes the day over from its sponsor. */
export function usePostCircular() {
  const { account, chain, client } = useMobileWallet()
  const send = useSend()
  const queryClient = useQueryClient()
  const postOffice = usePostOffice()

  return useMutation({
    mutationFn: async (input: { day: number; options: string[]; pot: bigint; question: string }) => {
      const office = postOffice.data
      if (!account || !office) {
        throw new PostProblem('office-closed')
      }
      return send(async (sponsor) => {
        // Read at the last moment: somebody else may have taken the day while this was being written.
        const taken = await fetchCircular(client.rpc, input.day)
        return buildPostCircular({
          ...input,
          outbid: taken && taken.sponsor !== sponsor.address ? taken.sponsor : undefined,
          postageMint: office.postageMint,
          sponsor,
        })
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['circular', chain] }),
  })
}
