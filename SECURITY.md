# Security

Penny Post holds other people's postage for up to a week, so this file says plainly what protects it and what has not been checked.

## Status

The program has 30 unit tests and 54 end-to-end tests, which run on a local fork of mainnet against the real SKR mint and six real Seeker Genesis Tokens. It has not been deployed. The app has run on an Android emulator against that fork, and not yet on a physical phone. Nobody outside the project has reviewed any of it. Do not send it funds you would mind losing.

On 10 October 2026 the program was read a second time with one aim, to break it. That pass found no way to take postage, a refund or rent. It did find six smaller faults. All six are fixed and each has a test. They are listed under "Found and fixed" below.

## What the program trusts

- The SPL Token program, for moving and burning postage. The postage mint is a classic SPL Token mint, so there are no transfer hooks or transfer fees to account for.
- The Token-2022 program, for one thing only: that a `TokenGroupMember` extension on a mint it owns was written with the group authority's signature.
- The Solana clock, for delivery and expiry times.
- The program's upgrade authority. It opens the post office once, and as admin it sets the floor price, the express fee and the burn share. Only the burn share has a ceiling. The other two are limited from the sender's side: a sender names the postage and the highest express fee they will pay inside their own transaction. Like any upgradeable program, this one can also be replaced outright by its upgrade authority. Until that authority is given up or moved to a multisig, it is the largest trust in the system.

It does not trust the app, the server, or any account a caller passes without a check.

## Threats and what answers them

| Threat                                                                         | Answer                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Someone opens the post office first and names their own token                  | `open_post_office` requires the signer to be the program's upgrade authority, read from the program data account.                                                                                                                                |
| A sender dodges the reader's price by omitting the letterbox                   | The letterbox address is pinned by PDA seeds. A missing letterbox is detected by ownership and treated as "not opened".                                                                                                                          |
| A sender takes postage back after the reader has opened                        | Opening pays out and closes the card and vault in one transaction.                                                                                                                                                                               |
| Someone other than the reader collects the postage                             | `open_card` requires the reader's signature and a token account owned by the reader, for the right mint.                                                                                                                                         |
| A refund is steered to the wrong wallet                                        | `return_card` can be called by anyone after expiry, but the refund and rent can only go to the sender recorded on the card.                                                                                                                      |
| Stray tokens sent to a vault block its closing                                 | Opening and returning both empty the vault by its actual balance. On a free card, where neither side may hold a token account, strays are burned.                                                                                                |
| A shared pool is drained through one bad card                                  | There is no pool. Each card has its own vault with the card as authority.                                                                                                                                                                        |
| One phone claims many free stamps by moving its Genesis Token                  | The stamp is counted on a seal keyed by the token's mint. A new holder inherits the day already used.                                                                                                                                            |
| An old holder keeps the free stamp after the token has moved on                | A free card must name the token account, and the program checks that the token is in the sender's wallet at that moment.                                                                                                                         |
| A Token-2022 multisig is filled in to read as a Genesis Token holding          | An account of a multisig's exact length is refused, as Token-2022 itself does.                                                                                                                                                                   |
| A look-alike mint poses as a Genesis Token                                     | The mint must be owned by Token-2022 and carry a member entry naming itself and the real group. Only the group's authority can write that entry. The mint authority is compared as well, but the member entry is the part that cannot be forged. |
| The admin raises the burn share to take everything                             | The burn share is capped at 20% in the program, and a card keeps the share it was posted under. The postage token and group cannot be changed after opening.                                                                                     |
| The admin raises the express fee while a sender is signing                     | `post_card` takes the highest fee the sender will pay and refuses the card if the fee is above it.                                                                                                                                               |
| A sender gets past three paid cards a day by mixing express and ordinary cards | The day the limit counts against only moves forward, so one kind cannot reset the other's count.                                                                                                                                                 |
| A stranger's card carries a wallet-draining link                               | Card text is drawn as plain text, and handwriting as strokes that are checked to be plain path commands. Nothing inside a card can be tapped.                                                                                                    |
| The app shows "sent" for a card that failed on-chain                           | A signature from the wallet is not treated as done. The app waits for the cluster to confirm the transaction and checks its result first.                                                                                                        |
| One phone answers the day's question many times                                | An answer's address is made from the Genesis Token's mint, so a second one cannot be created. The token must be in the answering wallet at that moment.                                                                                          |
| A sponsor takes the pot back after phones have answered                        | The pot returns only if nobody answered. Otherwise it can only leave as equal shares or be burned.                                                                                                                                               |
| A sponsor who is outbid loses their pot or their rent                          | Taking over a day pays the first sponsor's pot and rent back in the same transaction. A question that is already open cannot be replaced at all.                                                                                                 |
| Rounding or stray tokens leave the pot impossible to empty                     | The last phone to collect sweeps what is left, and it is burned.                                                                                                                                                                                 |

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
- An old holder's letterbox keeps its `seal_mint` field after the token moves on. That field grants nothing. The program checks the seal's `holder` and the token account itself before it gives a free stamp.
- The floor price and the express fee have no ceiling. A hostile admin could set a floor so high that nobody posts a paid card. That would stop new post. It could not reach postage already in a vault.
- A circular's answers and counts are public on-chain. The app hides the count until a phone has answered, but anyone can read the chain. Nothing is paid for picking the popular answer, so this changes what people see and not what they earn.
- Somebody with several Seekers gets several shares of a circular. It is one answer per phone, which is what it says.
- A share nobody collects within a month of the day closing is burned, and the small rent on that answer account stays where it is.
- Three paid cards fill a reader's day. Someone could post three, leave them, and take the postage back a week later, at the cost of having it locked up. The reader can open them and keep the money instead.
- The free stamp resets at midnight UTC, the same moment for everyone.
- The reading key for sealed letters is made on the phone and kept in its secure storage. It is not derived from a wallet signature, because any app that got the same message signed could derive the same key. The cost is that a new phone means a new key, and a sealed letter not yet opened on the old phone cannot be read on the new one. It can still be sent back.
- Opened cards are kept on the reader's phone only. Clearing the app's data loses them.

## Found and fixed

Faults found by the second read on 10 October 2026, before any deployment.

| Fault                                                                                                    | Fix                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Alternating express and ordinary cards reset the daily count, so the limit of three could be passed.     | The counted day only moves forward.                                                                                             |
| The express fee was read from the admin's terms at the moment of posting, with no limit from the sender. | The sender passes the most they will pay.                                                                                       |
| The burn share was read when a card was opened, so a change could reach postage already posted.          | Each card records the share it was posted under.                                                                                |
| A seal kept granting the old holder a free stamp until the new holder verified.                          | A free card checks the token account at posting time.                                                                           |
| One base unit of the token sent to a free card's vault made the app's open and return fail.              | With no token account named, strays on a free card are burned. The app also recreates a sender's token account before a refund. |
| The hand-written reader would have accepted a Token-2022 multisig laid out to look like a holding.       | Accounts of that length are refused.                                                                                            |

## Reporting

Open a private security advisory on the repository, or write to the address on the maintainer's GitHub profile. Please do not open a public issue for anything that could cost a reader money.
