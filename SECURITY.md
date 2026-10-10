# Security

Penny Post holds other people's postage for up to a week, so this file says plainly what protects it and what has not been checked.

## Status

The program has 22 unit tests and 36 end-to-end tests, which run on a local fork of mainnet against the real SKR mint and a real Seeker Genesis Token. It has not been deployed, the app has not been run on a phone, and nobody outside the project has reviewed any of it. Do not send it funds you would mind losing.

## What the program trusts

- The SPL Token program, for moving and burning postage. The postage mint is a classic SPL Token mint, so there are no transfer hooks or transfer fees to account for.
- The Token-2022 program, for one thing only: that a `TokenGroupMember` extension on a mint it owns was written with the group authority's signature.
- The Solana clock, for delivery and expiry times.
- The program's upgrade authority, to open the post office once and to set prices within fixed limits.

It does not trust the app, the server, or any account a caller passes without a check.

## Threats and what answers them

| Threat                                                        | Answer                                                                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Someone opens the post office first and names their own token | `open_post_office` requires the signer to be the program's upgrade authority, read from the program data account.                             |
| A sender dodges the reader's price by omitting the letterbox  | The letterbox address is pinned by PDA seeds. A missing letterbox is detected by ownership and treated as "not opened".                       |
| A sender takes postage back after the reader has opened       | Opening pays out and closes the card and vault in one transaction.                                                                            |
| Someone other than the reader collects the postage            | `open_card` requires the reader's signature and a token account owned by the reader, for the right mint.                                      |
| A refund is steered to the wrong wallet                       | `return_card` can be called by anyone after expiry, but the refund and rent can only go to the sender recorded on the card.                   |
| Stray tokens sent to a vault block its closing                | Opening and returning both empty the vault by its actual balance.                                                                             |
| A shared pool is drained through one bad card                 | There is no pool. Each card has its own vault with the card as authority.                                                                     |
| One phone claims many free stamps by moving its Genesis Token | The stamp is counted on a seal keyed by the token's mint. A new holder inherits the day already used.                                         |
| A look-alike mint poses as a Genesis Token                    | The mint must be owned by Token-2022, carry a member entry naming itself and the real group, and have the real mint authority.                |
| The admin raises the burn share to take everything            | The burn share is capped at 20% in the program. The postage token and group cannot be changed after opening.                                  |
| A stranger's card carries a wallet-draining link              | Card text is drawn as plain text, and handwriting as strokes that are checked to be plain path commands. Nothing inside a card can be tapped. |
| The app shows "sent" for a card that failed on-chain          | A signature from the wallet is not treated as done. The app waits for the cluster to confirm the transaction and checks its result first.     |

## The card store

Card contents are too large to keep on-chain, so they are stored by one small function, `supabase/functions/cards`.

- It holds no keys and moves no money.
- It stores bytes only if their SHA-256 equals the `content_hash` of a card account that exists on-chain and belongs to this program. Posting a card costs a transaction and a stamp, so the chain limits what can be stored.
- The app does not trust it. Whatever it returns must hash to what the chain recorded, or the app refuses it.
- It takes no API key, so there is no key in the app to leak. That also means anyone can call it. Each call costs it one RPC request and at most 400 kB of reading.

## The exchange

The pen-pal exchange is a second small function, `supabase/functions/exchange`, with two tables that record who is owed a card.

- It hands a writer the wallet that has waited longest. It never sees a message.
- A writer is only counted as having sent a card after the function has read that card from the chain, from the right sender to the right reader.
- The tables have row level security on and no policies, so nothing but the function can read or write them.
- It takes no API key and does not ask for a signature, so anyone can draw on behalf of any wallet. The worst that does is use up that wallet's one draw for the day.
- It does not check a reader's price. A reader in the exchange could set a high one. The app shows the price before anything is signed, and the writer can walk away.

## Known limits

- An open postcard is stored unencrypted under its hash. The app does not show a card until the reader has signed for it, but a modified app could fetch and read one without opening it, which would leave the sender's postage unclaimed and returnable. A sealed letter can only be read by the reader's phone, and the same holds for it: that reader could read it without signing.
- A sender's SOL rent for the card and vault (about 0.004 SOL) is locked until the card is opened or returned.
- An old holder's letterbox keeps its `seal_mint` field after the token moves on. Clients must check the seal's `holder`, and the program does so before granting a free stamp.
- The free stamp resets at midnight UTC, the same moment for everyone.
- The reading key for sealed letters is made on the phone and kept in its secure storage. It is not derived from a wallet signature, because any app that got the same message signed could derive the same key. The cost is that a new phone means a new key, and a sealed letter not yet opened on the old phone cannot be read on the new one. It can still be sent back.
- Opened cards are kept on the reader's phone only. Clearing the app's data loses them.

## Reporting

Open a private security advisory on the repository, or write to the address on the maintainer's GitHub profile. Please do not open a public issue for anything that could cost a reader money.
