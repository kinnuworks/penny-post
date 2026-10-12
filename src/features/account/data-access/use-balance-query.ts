import { useQuery } from '@tanstack/react-query'
import { useWallet } from '../../wallet/use-wallet'

// The connected wallet's balance in lamports.
export function useBalanceQuery() {
  const { account, chain, client } = useWallet()

  return useQuery({
    enabled: !!account,
    queryKey: ['balance', chain, account?.address],
    queryFn: async () => {
      if (!account) {
        return null
      }
      const { value } = await client.rpc.getBalance(account.address).send()
      return value
    },
  })
}
