# Submission text

Paste from here into the hackathon form. Anything in square brackets is a blank. Fill it with what is true on the day, or cut the sentence it sits in.

## Name

Penny Post

## One line

A letterbox for every `.skr` name. The post comes once a day, and strangers pay the reader to write.

## Short description

Every Seeker came with an address, and nobody writes to it. Penny Post gives each `.skr` name a letterbox. You write a card with a photo on the front and your own handwriting on the back, and it arrives at eight the next morning, in the reader's time zone.

Seeker owners get one free stamp a day, checked on-chain against their Seeker Genesis Token. Anyone else pays the reader's own price in SKR. The postage waits in a vault that belongs to that one card. When the reader signs for it, 90% is theirs and 10% is burned. A card nobody opens goes back to its sender after seven days, postage included.

## Longer description

**The problem.** A Seeker owner's wallet is a public address that anyone can send anything to, so it fills with junk. Messaging apps on Solana have copied chat, where the cost of reaching someone is nothing and the reader pays with attention.

**What we built.** A postal service with the old rules. Post comes once a day. The sender buys the stamp. The reader sets what a stranger's stamp costs, and keeps the money. A letterbox takes three paid cards a day and no more, so a reader can raise their price and never be flooded.

**Why it brings people back.** There is one moment each day when something may have arrived, and the phone rings a bell for it at eight. Cards are written by hand, so each one took somebody a minute. If you have nobody to write to, you can ask for a stranger. You get whoever has waited longest, and you join the line for the next card.

**How it uses the Solana Mobile Stack.**

- Every signature goes through Mobile Wallet Adapter. Each transaction is dry-run first, so a card the program would refuse never opens the wallet.
- The free daily stamp is tied to the Seeker Genesis Token. The program reads the token's mint and the holder's account itself, and counts the stamp against the token. One phone gets one stamp, whichever wallet holds it.
- Letterboxes are addressed by `.skr` name, looked up on mainnet in both directions.
- Postage is paid in SKR. Nothing is staked.
- Letters to someone with a letterbox are sealed to a key made on their phone and kept in its secure storage.

**What is real today.** The program has 25 unit tests and 41 end-to-end tests, run on a fork of mainnet against the real SKR mint and a real Genesis Token. [It is deployed to mainnet at `D5LZ7kUmpXhE2hsKHnse9itthWHX6j8o4EkGcfz2MLAD`, and the post office opened on [date].] [[N] cards have been posted and [N] SKR has reached readers.] [The app was run on [phone models].]

**What it is not.** Nobody outside the project has reviewed the code. An open postcard to someone without a letterbox is stored unencrypted. Both limits are written up in SECURITY.md.

**Next.** The Solana dApp Store, within thirty days of the results.

## Links

- APK: [URL]
- Repository: https://github.com/kinnuworks/penny-post
- Demo video: [URL]
- Pitch deck: [URL]

## Before pressing submit

- The repository has to be visible to the judges. It is private now. Either make it public or grant access through the Radiants GitHub app, whichever the form asks for.
- The pitch deck link is private until it is shared from its Share menu.
- Install the APK from its public link on a phone that has never had the app, and post one card.
- Read the transcript the platform makes of the video, and fix anything it misheard.
