# Security

Dak holds other people's postage for up to a week, so this file says plainly what protects it and what has not been checked.

## Status

The program has unit tests for its arithmetic, its delivery clock and its Genesis Token parser. It has not been compiled against a validator yet, it has no integration tests yet, and nobody outside the project has reviewed it. Do not send it funds you would mind losing.

## What the program trusts

- The SPL Token program, for moving and burning postage. The postage mint is a classic SPL Token mint, so there are no transfer hooks or transfer fees to account for.
- The Token-2022 program, for one thing only: that a `TokenGroupMember` extension on a mint it owns was written with the group authority's signature.
- The Solana clock, for delivery and expiry times.
- The program's upgrade authority, to open the post office once and to set prices within fixed limits.

It does not trust the app, the server, or any account a caller passes without a check.

## Threats and what answers them

| Threat                                                        | Answer                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Someone opens the post office first and names their own token | `open_post_office` requires the signer to be the program's upgrade authority, read from the program data account.              |
| A sender dodges the reader's price by omitting the letterbox  | The letterbox address is pinned by PDA seeds. A missing letterbox is detected by ownership and treated as "not opened".        |
| A sender takes postage back after the reader has opened       | Opening pays out and closes the card and vault in one transaction.                                                             |
| Someone other than the reader collects the postage            | `open_card` requires the reader's signature and a token account owned by the reader, for the right mint.                       |
| A refund is steered to the wrong wallet                       | `return_card` can be called by anyone after expiry, but the refund and rent can only go to the sender recorded on the card.    |
| Stray tokens sent to a vault block its closing                | Opening and returning both empty the vault by its actual balance.                                                              |
| A shared pool is drained through one bad card                 | There is no pool. Each card has its own vault with the card as authority.                                                      |
| One phone claims many free stamps by moving its Genesis Token | The stamp is counted on a seal keyed by the token's mint. A new holder inherits the day already used.                          |
| A look-alike mint poses as a Genesis Token                    | The mint must be owned by Token-2022, carry a member entry naming itself and the real group, and have the real mint authority. |
| The admin raises the burn share to take everything            | The burn share is capped at 20% in the program. The postage token and group cannot be changed after opening.                   |
| A stranger's card carries a wallet-draining link              | App rule, not built yet: text from strangers is shown as plain text, and nothing in a stranger's card can be tapped.           |
| The app shows "sent" for a card that failed on-chain          | App rule, not built yet: wait for confirmation and check the transaction's result before saying anything.                      |

## Known limits

- A sender's SOL rent for the card and vault (about 0.004 SOL) is locked until the card is opened or returned.
- An old holder's letterbox keeps its `seal_mint` field after the token moves on. Clients must check the seal's `holder`, and the program does so before granting a free stamp.
- The free stamp resets at midnight UTC, the same moment for everyone.
- The reading key for sealed letters is derived from one wallet signature over a message that names this app. Another app that tricked a reader into signing the same message could derive the same key. The message is app-specific to make that request look wrong, and the key is stored only in the phone's secure storage.

## Reporting

Open a private security advisory on the repository, or write to the address on the maintainer's GitHub profile. Please do not open a public issue for anything that could cost a reader money.
