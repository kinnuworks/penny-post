import {
  appendTransactionMessageInstructions,
  assertIsTransactionMessageWithSingleSendingSigner,
  createTransactionMessage,
  getBase58Decoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  signature,
  type Instruction,
  type Signature,
  type TransactionSigner,
} from '@solana/kit'
import { useMobileWallet } from '@wallet-ui/react-native-kit'
import { waitForConfirmation } from '../../utils/wait-for-confirmation'

/**
 * Sends instructions through the wallet with Mobile Wallet Adapter, then waits
 * until the cluster confirms them.
 *
 * A signature coming back from the wallet only means the wallet agreed. The
 * transaction can still fail on-chain, so nothing is treated as done until
 * `waitForConfirmation` has seen it land without an error.
 */
export function useSend() {
  const { account, client, getTransactionSigner } = useMobileWallet()

  return async function send(build: (signer: TransactionSigner) => Promise<Instruction[]>): Promise<Signature> {
    if (!account) {
      throw new Error('No wallet is connected.')
    }
    const {
      context: { slot: minContextSlot },
      value: latestBlockhash,
    } = await client.rpc.getLatestBlockhash().send()

    // The wallet's sending signer must be the only signer in the transaction,
    // so the same instance pays the fee and is handed to the instruction builders.
    const signer = getTransactionSigner(account.address, minContextSlot)
    const instructions = await build(signer)

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    )
    assertIsTransactionMessageWithSingleSendingSigner(message)

    const signatureBytes = await signAndSendTransactionMessageWithSigners(message)
    const sent = signature(getBase58Decoder().decode(signatureBytes))
    await waitForConfirmation(client.rpc, sent)
    return sent
  }
}
