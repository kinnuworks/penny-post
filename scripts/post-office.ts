/**
 * Running the post office from the command line. Signs with the deploy wallet
 * at ~/.config/solana/id.json, which must be the program's upgrade authority
 * to open the post office.
 *
 *   pnpm post-office show  --cluster devnet
 *   pnpm post-office open  --cluster devnet            (makes a stand-in token with no value)
 *   pnpm post-office open  --cluster mainnet           (uses SKR)
 *   pnpm post-office give  --cluster devnet --to <wallet> [--amount 500]
 *
 * `give` only works for the devnet stand-in token, which this wallet can mint.
 *
 * For a validator on this machine that forks mainnet (`pnpm anchor:localnet`):
 *
 *   pnpm post-office open  --cluster localnet          (uses the forked SKR)
 *   pnpm post-office give  --cluster localnet --to <wallet> [--amount 500] [--sol 5] [--seeker]
 *
 * There `give` writes balances straight into the fork, and `--seeker` also
 * puts a real Seeker Genesis Token in the wallet. Nothing leaves this machine.
 */

import { getCreateAccountInstruction } from '@solana-program/system'
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token'
import {
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from '@solana/kit'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { getOpenPostOfficeInstructionAsync, PENNY_POST_PROGRAM_ADDRESS } from '../anchor/src'
import { fetchPostOffice } from '../src/features/post/chain'
import { formatTokens } from '../src/utils/format-tokens'

const SKR_MINT = address('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3')
const SGT_GROUP = address('GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te')
const SGT_MINT_AUTHORITY = address('GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4')
const UPGRADEABLE_LOADER = address('BPFLoaderUpgradeab1e11111111111111111111111')

const DECIMALS = 6
const ONE = 10n ** BigInt(DECIMALS)
/** A paid card carries at least 5 tokens. Express burns 20 more. A tenth of postage is burned on opening. */
const TERMS = { burnBps: 1_000, expressFee: 20n * ONE, floorPrice: 5n * ONE }

const RPC_URLS = {
  devnet: process.env.DEVNET_RPC_URL ?? 'https://api.devnet.solana.com',
  localnet: 'http://127.0.0.1:8899',
  mainnet: process.env.MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
}
/** A real Genesis Token mint, member number 20 of the group. The fork can place it in any wallet. */
const SGT_MINT = address('5mXbkqKz883aufhAsx3p5Z1NcvD2ppZbdTTznM6oUKLj')
const TOKEN_2022_PROGRAM_ADDRESS = address('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')

type Cluster = keyof typeof RPC_URLS

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function main() {
  const command = process.argv[2]
  const cluster = option('cluster') as Cluster | undefined
  if (!cluster || !(cluster in RPC_URLS)) {
    fail('Say which network: --cluster devnet, --cluster mainnet or --cluster localnet')
  }

  const rpcUrl = RPC_URLS[cluster]
  const rpc = createSolanaRpc(rpcUrl)
  const rpcSubscriptions = createSolanaRpcSubscriptions(
    cluster === 'localnet' ? 'ws://127.0.0.1:8900' : rpcUrl.replace('https://', 'wss://'),
  )

  /** A Surfpool cheatcode, which only a local fork answers. */
  async function cheat(method: string, params: unknown[]) {
    const response = await fetch(rpcUrl, {
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
    const body = (await response.json()) as { error?: { message: string } }
    if (body.error) {
      fail(`${method}: ${body.error.message}`)
    }
  }
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })

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
    return getSignatureFromTransaction(transaction)
  }

  if (command === 'show') {
    const postOffice = await fetchPostOffice(rpc)
    if (!postOffice) {
      console.log(`The post office is not open on ${cluster}. Program: ${PENNY_POST_PROGRAM_ADDRESS}`)
      return
    }
    console.log(`Post office on ${cluster}`)
    console.log(`  program       ${PENNY_POST_PROGRAM_ADDRESS}`)
    console.log(`  admin         ${postOffice.admin}`)
    console.log(`  postage token ${postOffice.postageMint}`)
    console.log(`  floor price   ${formatTokens(postOffice.floorPrice, DECIMALS)}`)
    console.log(`  express fee   ${formatTokens(postOffice.expressFee, DECIMALS)}`)
    console.log(`  burn share    ${postOffice.burnBps / 100}%`)
    return
  }

  const keypairPath = `${homedir()}/.config/solana/id.json`
  const admin = await createKeyPairSignerFromBytes(
    new Uint8Array(JSON.parse(readFileSync(keypairPath, 'utf8')) as number[]),
  )

  if (command === 'open') {
    if (await fetchPostOffice(rpc)) {
      fail(`The post office is already open on ${cluster}. Its token cannot be changed.`)
    }

    let postageMint: Address = SKR_MINT
    if (cluster === 'devnet') {
      // Devnet has no SKR, so the post office runs on a token made here.
      const mint = await generateKeyPairSigner()
      const space = BigInt(getMintSize())
      const rent = await rpc.getMinimumBalanceForRentExemption(space).send()
      await send(admin, [
        getCreateAccountInstruction({
          lamports: rent,
          newAccount: mint,
          payer: admin,
          programAddress: TOKEN_PROGRAM_ADDRESS,
          space,
        }),
        getInitializeMint2Instruction({ decimals: DECIMALS, mint: mint.address, mintAuthority: admin.address }),
      ])
      postageMint = mint.address
      console.log(`Made a stand-in postage token: ${postageMint}`)
    }

    const [programData] = await getProgramDerivedAddress({
      programAddress: UPGRADEABLE_LOADER,
      seeds: [getAddressEncoder().encode(PENNY_POST_PROGRAM_ADDRESS)],
    })
    const signature = await send(admin, [
      await getOpenPostOfficeInstructionAsync({
        admin,
        postageMint,
        programData,
        sgtGroup: SGT_GROUP,
        sgtMintAuthority: SGT_MINT_AUTHORITY,
        terms: TERMS,
      }),
    ])
    console.log(`The post office is open on ${cluster}. ${signature}`)
    return
  }

  if (command === 'give') {
    if (cluster === 'mainnet') {
      fail('Only stand-in and forked tokens can be handed out. Real SKR has to be bought.')
    }
    const to = option('to')
    const postOffice = await fetchPostOffice(rpc)
    if (!to || !postOffice) {
      fail('Open the post office first, and say who gets the tokens: --to <wallet>')
    }
    const owner = address(to)
    const amount = BigInt(option('amount') ?? '500') * ONE

    if (cluster === 'localnet') {
      const sol = Number(option('sol') ?? '5')
      await cheat('surfnet_setAccount', [owner, { lamports: sol * 1_000_000_000 }])
      await cheat('surfnet_setTokenAccount', [
        owner,
        postOffice.postageMint,
        { amount: Number(amount) },
        TOKEN_PROGRAM_ADDRESS,
      ])
      console.log(`Gave ${sol} SOL and ${formatTokens(amount, DECIMALS)} SKR to ${owner} on the local fork.`)
      if (process.argv.includes('--seeker')) {
        await cheat('surfnet_setTokenAccount', [owner, SGT_MINT, { amount: 1 }, TOKEN_2022_PROGRAM_ADDRESS])
        console.log(`Put Seeker Genesis Token ${SGT_MINT} in that wallet.`)
      }
      return
    }
    const [token] = await findAssociatedTokenPda({
      mint: postOffice.postageMint,
      owner,
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
    })
    const signature = await send(admin, [
      await getCreateAssociatedTokenIdempotentInstructionAsync({ mint: postOffice.postageMint, owner, payer: admin }),
      getMintToInstruction({ amount, mint: postOffice.postageMint, mintAuthority: admin, token }),
    ])
    console.log(`Gave ${formatTokens(amount, DECIMALS)} stand-in tokens to ${owner}. ${signature}`)
    return
  }

  fail('Commands: show, open, give')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
