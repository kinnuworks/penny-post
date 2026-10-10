# Penny Post

A letterbox for every `.skr` name.

Every Seeker came with an address. Penny Post lets people write to it. The post comes once a day, at eight in the morning where the reader lives. Friends write for free. Anyone else pays postage in SKR, and the postage goes to the reader when they turn the card over.

In 1840 the Penny Post made the sender pay for a letter instead of the person receiving it. Here the sender still pays, and the reader keeps the postage. This is an entry for [Clock In](https://solanamobile.radiant.nexus/), the third Solana Mobile hackathon.

## How it works

1. You open a letterbox with one signature. It records your wallet, a key for sealed letters, and your price.
2. You write a card: a photo on the front, your handwriting on the back, a stamp in the corner.
3. A phone that holds a Seeker Genesis Token gets one free stamp a day. The stamp is counted against the token, so one phone gets one stamp however many wallets it uses.
4. Anyone without a free stamp pays the reader's price. The postage waits in a vault that belongs to that one card.
5. At 08:00 in the reader's time zone the card arrives. When the reader signs for it, 90% of the postage is theirs and 10% is burned.
6. A card nobody opens goes back to its sender after seven days, postage and rent included.

A letterbox takes three paid cards a day at most, and the reader sets the price. Cards from strangers never carry a link you can tap.

## What is built

| Part                                                                                                  | State                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `anchor/programs/penny_post`: the program, eight instructions                                         | Builds for Solana. 22 unit tests and 36 end-to-end tests pass on a fork of mainnet, against the real SKR mint and a real Genesis Token. Not deployed to any network yet. |
| Genesis Token check inside the program                                                                | Tested on a real mint and on real holdings, one full and one emptied.                                                                                                    |
| App: wallet connect, letterbox, writing a card, posting, signing for a card, sending back, kept cards | Written. Typechecks, lints and bundles. Not run on a phone yet.                                                                                                          |
| Sealed letters                                                                                        | Written, with unit tests. Not run on a phone yet.                                                                                                                        |
| `.skr` lookup, both directions                                                                        | Matches AllDomains' own library on mainnet.                                                                                                                              |
| Free daily stamp for Seeker owners                                                                    | The app finds the Genesis Token and asks the program to verify it. Its reader is tested on real accounts. Not run on a Seeker.                                           |
| `supabase/functions/cards`: the card store                                                            | Deployed. Its refusals are tested. Accepting a card is not, because that needs the program on a network.                                                                 |
| `supabase/functions/exchange`: the pen-pal exchange                                                   | Deployed. Its refusals are tested. Matching two writers is not, for the same reason.                                                                                     |
| The 08:00 bell                                                                                        | Written. The planning is unit tested. Not run on a phone yet.                                                                                                            |
| Changing your price from the letterbox                                                                | Written. The amount parsing is unit tested and the instruction is tested end to end. Not run on a phone yet.                                                             |
| A dry run before the wallet opens                                                                     | Every transaction is simulated first, and a refusal is shown as a plain sentence. Tested end to end for six refusals. Not run on a phone yet.                            |
| Release build, signed from a keystore in the environment                                              | Builds for arm64, about 58 MB. Signed with the debug key so far, because no release keystore exists yet. Not installed on a phone yet.                                   |
| Home-screen widget                                                                                    | Not started.                                                                                                                                                             |
| Devnet and mainnet deployment                                                                         | Not started.                                                                                                                                                             |

This table is kept honest. If a row says "not started", it is not in the build.

## Run it

You need Node 20 or newer, pnpm, JDK 17, the Android SDK, and an Android phone with a Solana wallet installed. Expo Go will not work, because Mobile Wallet Adapter needs a development build.

```bash
pnpm install
```

```bash
npx -y solana-mobile@latest doctor
```

```bash
pnpm run android
```

App tests and checks:

```bash
pnpm test
```

```bash
pnpm run ci
```

The program needs the Rust, Solana and Anchor toolchains, and Surfpool for the end-to-end tests. `anchor:unit` runs the Rust unit tests. `anchor:test` starts a local validator that forks mainnet and runs all three test files in order.

```bash
pnpm run anchor:unit
```

```bash
pnpm run anchor:test
```

To open the post office on a network once the program is deployed there:

```bash
pnpm post-office open --cluster devnet
```

A release APK for arm64, signed with your own keystore. The four `PENNY_POST_` variables it reads are listed at the top of `plugins/with-release-signing.js`.

```bash
pnpm run android:release
```

## The program

| Instruction        | Who signs         | What it does                                                                |
| ------------------ | ----------------- | --------------------------------------------------------------------------- |
| `open_post_office` | Upgrade authority | Runs once. Fixes the postage token and the Genesis Token group for good.    |
| `set_terms`        | Admin             | Changes the floor price, the express fee and the burn share (20% ceiling).  |
| `open_letterbox`   | Reader            | Creates the reader's letterbox with a reading key, price and time zone.     |
| `set_letterbox`    | Reader            | Changes those three settings.                                               |
| `verify_letterbox` | Reader            | Proves the wallet holds a Genesis Token and ties its seal to the letterbox. |
| `post_card`        | Sender            | Creates the card and its vault, and moves postage into the vault.           |
| `open_card`        | Reader            | Pays the reader, burns the share, closes the card and vault.                |
| `return_card`      | Anyone, or reader | Refunds the sender after expiry, or earlier if the reader sends it back.    |

Choices worth knowing about:

- Each card has its own vault and the card account is the vault's authority. There is no shared pool.
- The server never holds a key or a token, and the app ships no API key. The card store accepts a card's contents only if their SHA-256 is the hash of a card that already exists on-chain. Sealed letters reach it already encrypted.
- `post_card` pins the reader's letterbox address by its seeds, so a sender cannot leave it out to dodge the reader's price.
- `open_card` and `return_card` empty the vault by its real balance. Sending stray tokens to a vault cannot lock a card.
- The Genesis Token check reads the mint's `TokenGroupMember` extension and the holder's token account by hand, and only after confirming Token-2022 owns both. A real Genesis Token sits frozen in its account, and the check allows for that. The free stamp is keyed on the token's mint, as Solana Mobile's own guidance says it should be.

See [SECURITY.md](SECURITY.md) for the threat model and what has not been reviewed.

## Stack

Expo development build, React Native, `@solana/kit`, `@wallet-ui/react-native-kit` for Mobile Wallet Adapter, Uniwind for styling, Anchor for the program and Codama for its typed client. It started from Solana Mobile's `expo-kit-anchor` template.

## License

Apache-2.0. See [LICENSE](LICENSE).
