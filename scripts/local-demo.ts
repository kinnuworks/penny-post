/**
 * A pen pal for the local fork, so one phone can try both sides of the post.
 *
 *   pnpm local-demo reader
 *       Makes the pen pal a wallet with a letterbox and prints its address.
 *       Write to that address from the phone.
 *
 *   pnpm local-demo send --to <wallet> [--message "..."] [--photo card.jpg] [--express]
 *       Posts a card from the pen pal to a wallet, paying that reader's price,
 *       and files its contents with the local card store.
 *
 * Needs `pnpm anchor:localnet`, `pnpm post-office open --cluster localnet` and
 * `pnpm local-card-store` running. Nothing here touches a real network.
 */

import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromPrivateKeyBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type KeyPairSigner,
} from '@solana/kit'
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hashCard, type CardContent } from '../src/features/card/card'
import { newReadingKey, packCard } from '../src/features/card/envelope'
import { EXPRESS_STAMP_ID } from '../src/features/card/stamps'
import {
  buildOpenLetterbox,
  buildPostCard,
  fetchLetterbox,
  fetchPostOffice,
  newCardId,
  priceToReach,
} from '../src/features/post/chain'

const RPC_URL = 'http://127.0.0.1:8899'
const CARD_STORE_URL = 'http://127.0.0.1:8787'
const KEY_FILE = join(tmpdir(), 'penny-post-local-pen-pal.key')
const PILLAR_BOX = 2

const rpc = createSolanaRpc(RPC_URL)
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions: createSolanaRpcSubscriptions('ws://127.0.0.1:8900'),
})

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function cheat(method: string, params: unknown[]) {
  const response = await fetch(RPC_URL, {
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  const body = (await response.json()) as { error?: { message: string } }
  if (body.error) {
    fail(`${method}: ${body.error.message}`)
  }
}

async function send(payer: KeyPairSigner, instructions: Instruction[]) {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send()
  const transaction = await pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(payer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(instructions, tx),
    (tx) => signTransactionMessageWithSigners(tx),
  )
  assertIsTransactionWithBlockhashLifetime(transaction)
  await sendAndConfirm(transaction, { commitment: 'confirmed' })
}

/** The pen pal's wallet. Its key lives in the temp folder and is worth nothing anywhere else. */
async function penPal(): Promise<KeyPairSigner> {
  if (!existsSync(KEY_FILE)) {
    writeFileSync(KEY_FILE, randomBytes(32).toString('hex'), { mode: 0o600 })
  }
  const signer = await createKeyPairSignerFromPrivateKeyBytes(Buffer.from(readFileSync(KEY_FILE, 'utf8'), 'hex'))
  const postOffice = await fetchPostOffice(rpc)
  if (!postOffice) {
    fail('Open the post office first: pnpm post-office open --cluster localnet')
  }
  await cheat('surfnet_setAccount', [signer.address, { lamports: 5_000_000_000 }])
  await cheat('surfnet_setTokenAccount', [
    signer.address,
    postOffice.postageMint,
    { amount: 1_000_000_000 },
    TOKEN_PROGRAM_ADDRESS,
  ])
  return signer
}

async function main() {
  const command = process.argv[2]
  const wallet = await penPal()
  const postOffice = (await fetchPostOffice(rpc))!

  if (command === 'reader') {
    if (!(await fetchLetterbox(rpc, wallet.address))) {
      await send(
        wallet,
        await buildOpenLetterbox({
          owner: wallet,
          price: 12_000_000n,
          // Nobody holds the other half of this key, so cards sealed to it stay sealed.
          readingKey: newReadingKey().publicKey,
          utcOffsetMinutes: 330,
        }),
      )
    }
    console.log(`The pen pal's letterbox is up. Write to ${wallet.address}`)
    return
  }

  if (command === 'send') {
    const to = option('to')
    if (!to) {
      fail('Say who it is for: --to <wallet>')
    }
    const recipient = address(to)
    const express = process.argv.includes('--express')
    const photo = option('photo')
    const card: CardContent = {
      version: 1,
      photo: photo ? readFileSync(photo).toString('base64') : null,
      message: option('message') ?? 'Wish you were here. The chai is terrible and the view makes up for it.',
      strokes: [],
      stampId: express ? EXPRESS_STAMP_ID : PILLAR_BOX,
      fromName: null,
      writtenAt: Math.floor(Date.now() / 1000),
    }

    const letterbox = await fetchLetterbox(rpc, recipient)
    const bytes = packCard(card, letterbox ? new Uint8Array(letterbox.readingKey) : null)
    const { card: cardAddress, instructions } = await buildPostCard({
      cardId: newCardId(),
      contentHash: hashCard(bytes),
      express,
      maxExpressFee: postOffice.expressFee,
      postage: priceToReach(postOffice, letterbox),
      postageMint: postOffice.postageMint,
      recipient,
      sender: wallet,
      stamp: card.stampId,
    })
    await send(wallet, instructions)

    const stored = await fetch(`${CARD_STORE_URL}/functions/v1/cards/${cardAddress}?cluster=devnet`, {
      // A copy as a plain buffer, which every fetch accepts as a body.
      body: bytes.slice().buffer,
      headers: { 'content-type': 'application/octet-stream' },
      method: 'PUT',
    })
    console.log(`Posted ${cardAddress} to ${recipient}${express ? ', express' : ''}. Card store said ${stored.status}.`)
    return
  }

  fail('Commands: reader, send')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
