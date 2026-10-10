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

| Part                                                               | State                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `anchor/programs/penny_post`: the program, eight instructions      | Written, with unit tests. Not yet compiled against a validator. |
| Genesis Token check inside the program                             | Written. Parser tested against a real mint read from mainnet.   |
| App shell: wallet connect through Mobile Wallet Adapter, letterbox | Typechecks and lints clean. First screen only.                  |
| Writing, stamping and opening cards in the app                     | Not started.                                                    |
| Sealed letters, `.skr` lookup, the pen-pal exchange                | Not started.                                                    |
| Mainnet deployment                                                 | Not started.                                                    |

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

Tests and checks:

```bash
pnpm test
```

```bash
pnpm run ci
```

The program needs the Rust, Solana and Anchor toolchains:

```bash
pnpm run anchor:unit
```

```bash
pnpm run anchor:setup
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
- The server never holds a key or a token. It stores card images, and sealed letters reach it already encrypted.
- `post_card` pins the reader's letterbox address by its seeds, so a sender cannot leave it out to dodge the reader's price.
- `open_card` and `return_card` empty the vault by its real balance. Sending stray tokens to a vault cannot lock a card.
- The Genesis Token check reads the mint's `TokenGroupMember` extension, and only after confirming Token-2022 owns the account. The free stamp is keyed on the token's mint, as Solana Mobile's own guidance says it should be.

See [SECURITY.md](SECURITY.md) for the threat model and what has not been reviewed.

## Stack

Expo development build, React Native, `@solana/kit`, `@wallet-ui/react-native-kit` for Mobile Wallet Adapter, Uniwind for styling, Anchor for the program and Codama for its typed client. It started from Solana Mobile's `expo-kit-anchor` template.

## License

Apache-2.0. See [LICENSE](LICENSE).
