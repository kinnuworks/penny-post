import {
  appendTransactionMessageInstructions,
  assertIsTransactionMessageWithSingleSendingSigner,
  createTransactionMessage,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  signTransactionMessageWithSigners,
  signature,
  type Instruction,
  type Signature,
  type TransactionSigner,
} from '@solana/kit'
import { useWallet } from '../wallet/use-wallet'
import { waitForConfirmation } from '../../utils/wait-for-confirmation'
import { dryRun } from './dry-run'

/**
 * Dry-runs the instructions, sends them through the wallet with Mobile Wallet
 * Adapter, then waits until the cluster confirms them.
 *
 * A signature coming back from the wallet only means the wallet agreed. The
 * transaction can still fail on-chain, so nothing is treated as done until
 * `waitForConfirmation` has seen it land without an error.
 */
export function useSend() {
  const { account, client, getTransactionSigner, practiceSigner } = useWallet()

  return async function send(build: (signer: TransactionSigner) => Promise<Instruction[]>): Promise<Signature> {
    if (!account) {
      throw new Error('No wallet is connected.')
    }
    const {
      context: { slot: minContextSlot },
      value: latestBlockhash,
    } = await client.rpc.getLatestBlockhash().send()

    // The practice wallet signs here on the phone and the app sends the result itself.
    if (practiceSigner) {
      const instructions = await build(practiceSigner)
      await dryRun(client.rpc, account.address, instructions)
      const signed = await pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(practiceSigner, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        (m) => appendTransactionMessageInstructions(instructions, m),
        (m) => signTransactionMessageWithSigners(m),
      )
      const sent = getSignatureFromTransaction(signed)
      await client.rpc
        .sendTransaction(getBase64EncodedWireTransaction(signed), {
          encoding: 'base64',
          preflightCommitment: 'confirmed',
        })
        .send()
      await waitForConfirmation(client.rpc, sent)
      return sent
    }

    // The wallet's sending signer must be the only signer in the transaction,
    // so the same instance pays the fee and is handed to the instruction builders.
    const signer = getTransactionSigner(account.address, minContextSlot)
    const instructions = await build(signer)

    // Ask the cluster first. A card the program would refuse never reaches the wallet.
    await dryRun(client.rpc, account.address, instructions)

    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(signer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    )
    assertIsTransactionMessageWithSingleSendingSigner(message)

    let sent: Signature
    try {
      const signatureBytes = await signAndSendTransactionMessageWithSigners(message)
      sent = signature(getBase58Decoder().decode(signatureBytes))
    } catch (error) {
      // The wallet said no, was closed, or was never there. Nothing was sent.
      // The rejection goes to the caller, whose pending state ends with it.
      throw error instanceof Error ? error : new Error(String(error))
    }
    await waitForConfirmation(client.rpc, sent)
    return sent
  }
}
