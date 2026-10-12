# Submission text

Paste from here into the hackathon form. Anything in square brackets is a blank. Fill it with what is true on the day, or cut the sentence it sits in.

## Name

Penny Post

## One line

A letterbox for every `.skr` name. The post comes once a day: one question for every Seeker, and cards from people who paid to reach you.

## Short description

Every Seeker came with an address, and nobody writes to it. Penny Post gives each `.skr` name a letterbox, and the post comes once a day.

Each morning there is one card for everyone: a question. Whoever asked it put up SKR. Every Seeker can answer once, checked on-chain against its Seeker Genesis Token, and when the day closes the phones that answered share the pot.

The rest of the post is from people. You write a card with a photo on the front and your own handwriting on the back. A stranger pays the reader's own price in SKR, and the reader keeps 90% when they turn the card over. A card nobody opens goes back to its sender after seven days, postage included.

## Longer description

**The problem.** A Seeker owner's wallet is a public address that anyone can send anything to, so it fills with junk. Chat apps on Solana have copied chat, where reaching someone costs nothing and the reader pays with attention. And an app with nothing new in it tomorrow is an app nobody opens tomorrow.

**What we built.** A post office with the old rules. Post comes once a day. The sender buys the stamp, and the reader is paid.

- **One card for everyone.** Anyone can put a question to every Seeker for a day by putting up a pot of SKR. Each Genesis Token answers once. When the day closes the pot is split equally among the phones that answered, less a 10% burn. If nobody answers, the pot goes back. A day that has not started can be taken over by a pot a tenth larger, and the first asker is refunded in the same transaction.
- **Cards from people.** Cards are delivered at 08:00 in the reader's time zone, enforced by the program. Seeker owners get one free stamp a day. Anyone else pays the reader's price, which sits in escrow until the reader signs for the card. A letterbox takes three paid cards a day and no more, so a reader can raise their price and never be flooded.

**Why it brings people back.** There is post every morning even on day one, because the question goes to everyone. Answering takes ten seconds and pays. One signature collects yesterday's share and answers today's.

**How it differs from paid DMs.** A paid DM is a gate on a chat. Here nothing is instant, the money is held in escrow and returned if the card is not opened, the reader keeps it instead of a platform, and the daily question means the letterbox is never empty.

**How it uses the Solana Mobile Stack.**

- Every signature goes through Mobile Wallet Adapter. Each transaction is dry-run first, so a card the program would refuse never opens the wallet, and a refusal reads as a plain sentence.
- The Seeker Genesis Token is checked inside the program, which reads the token's mint and the holder's account itself. The free stamp and the daily answer are both counted against the token, so one phone gets one of each whichever wallet holds it.
- SKR is the postage. It is paid to readers and a share is burned. Nothing is staked.
- Letterboxes are addressed by `.skr` name, looked up on mainnet in both directions.
- Letters to someone with a letterbox are sealed to a key made on their phone and kept in its secure storage. The camera and touch handwriting make the card.

**What is real today.** The program has 31 unit tests and 54 end-to-end tests, run on a fork of mainnet against the real SKR mint and six real Genesis Tokens. It is deployed to devnet at `D5LZ7kUmpXhE2hsKHnse9itthWHX6j8o4EkGcfz2MLAD`, and the post office opened there on 12 October 2026. A question is scheduled for every day of the next three weeks. Every flow has been run from the signed release build on Android with Solana Mobile's reference wallet, against that deployment. [The app was run on [phone models].]

**Try it.** Install the APK with a wallet set to devnet. The letterbox offers a test kit (a little SOL, 300 test SKR and a test Genesis Token), because devnet has neither SKR nor Seekers. Take it, put up a letterbox, tap "I have a Seeker" and answer today's question.

**What it is not.** Nobody outside the project has reviewed the code. It is on devnet, where SKR and the Genesis Token are stand-ins, and the builder does not own a Seeker. An open postcard to someone without a letterbox is stored unencrypted. A question's answers are public on-chain, even though the app hides the count until you have answered. On devnet one server function holds a wallet of test tokens to hand to visitors; on mainnet no server would hold a key. All of this is written up in SECURITY.md, along with six faults we found in our own program and fixed.

**Next.** The Solana dApp Store, within thirty days of the results.

## Links

- APK: [URL]
- Repository: https://github.com/kinnuworks/penny-post
- Demo video: [URL]
- Pitch deck: [URL]

## Before pressing submit

- The repository has to be visible to the judges. It is private now. Either make it public or grant access through the Radiants GitHub app, whichever the form asks for.
- The pitch deck link is private until it is shared from its Share menu.
- Install the APK from its public link on a phone that has never had the app, and answer the day's question or post one card.
- Read the transcript the platform makes of the video, and fix anything it misheard.
