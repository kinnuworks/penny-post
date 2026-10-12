# Demo script

Under three minutes. One phone, and this laptop playing the pen pal.

The judges and the platform's reviewer read a transcript of this video, so anything that matters has to be said out loud. Say the names of the things being used: Mobile Wallet Adapter, SKR, Seeker Genesis Token, and the network.

Lead with the day's question. It is the part somebody does every morning, and it explains the whole idea in ten seconds. Cards from people are the second act.

Every figure in square brackets is a blank. Fill it with the real number on the day of recording. If a number is not real yet, cut the sentence.

## Before recording

- The program is deployed and the post office is open on the network you will name in the video.
- The phone has the release APK and a wallet with a little SOL. Its wallet has a letterbox, a Genesis Token and some postage. On devnet the laptop hands these out: `pnpm post-office give --cluster devnet --to <wallet> --seeker`.
- Today's question is asked and a few phones have answered it: `pnpm pen-pal ask --cluster devnet`, then `pnpm pen-pal crowd --cluster devnet`.
- The pen pal has a letterbox to write to: `pnpm pen-pal reader --cluster devnet`.
- Do one full practice run, so nothing on camera is a prompt you have not seen.
- Record the phone with a camera on a tripod, hands in shot. A screen recording alone looks like a simulator. If a screen recording is all there is, say so in the first ten seconds.
- Upload your own captions to YouTube from this script. The platform prefers published captions over automatic ones, and automatic ones will not spell `.skr`.

## Script

### 0:00 The address nobody writes to

On screen: the letterbox, with today's question at the top.

> Every Seeker came with an address, a dot S-K-R name. Nobody writes to it. This is Penny Post. It is a letterbox for your wallet, and the post comes once a day.

### 0:12 One card for everyone

On screen: the question card. Tap an answer. The wallet opens. Approve. The card shows the count and your share.

> Every morning there is one card for everyone. Today somebody asked every Seeker a question: tea or coffee, first thing? They put up [300] SKR for whoever answers. I tap tea. Mobile Wallet Adapter opens my wallet, I approve, and I am counted.
>
> One phone gets one answer. The program checks my Seeker Genesis Token on-chain, so nobody answers ten times from ten wallets. When the day closes, every phone that answered gets an equal share. Mine is about [30] SKR, for ten seconds.

If the wallet on camera holds a stand-in Genesis Token, say this here:

> I do not own a Seeker, so on devnet my wallet holds a test Genesis Token. The program checks it the same way it checks a real one, and its tests run against real ones from mainnet.

### 0:50 The next morning

On screen: "Yesterday's question has closed. [30] SKR is waiting for you." Tap an answer on the new question. One approval.

> The next morning yesterday's share is waiting. One signature collects it and answers today's question. That is the whole habit: one tap a day, and it pays.

### 1:05 A card from a stranger

On the laptop, off camera: `pnpm pen-pal send --cluster devnet --to <wallet> --express --photo <file>`.

On screen: a card on the doormat, face down. Tap it, tap "Sign for it", approve. The card turns over.

> The rest of the post is from people. A stranger has paid my price, [25] SKR, to reach me. The card is face down. I can see who sent it and what is inside, and nothing else. I tap "Sign for it", approve, and it turns over. [22.5] SKR is mine and the rest was burned.
>
> If I had ignored it, their money would have gone back to them after a week. I set that price myself, and a letterbox takes three paid cards a day, so it cannot be flooded.

### 1:45 Writing one

On screen: write a card. Take a photo, write a few words by hand, pick the Penny Red stamp, post.

> Writing one. A photo for the front. The back I write by hand. Seeker owners get one free stamp a day. The app tells me what it will cost and when it arrives before I sign: eight tomorrow morning, in their time zone, sealed so only their phone can read it.

### 2:15 Why a builder should care

On screen: the "Ask every Seeker" screen.

> For a builder this is a way to reach Seeker owners without an airdrop. Ask every Seeker one question, or write to one person, and the SKR goes to the people who respond.

### 2:30 What is real

On screen: the test run in a terminal, then the program on the explorer.

> The program has [31] unit tests and [54] end-to-end tests, run on a fork of mainnet against real SKR and real Seeker Genesis Tokens. I went through it a second time trying to break it and found six faults. All six are fixed and listed in the repository. No server holds a key. It is live on [devnet], at the address on screen. Penny Post. The post comes once a day.

## Showing the next morning without waiting a day

The share from a question can only be collected after midnight UTC. Two honest ways to film it:

- Record the first two scenes one evening and the third the next morning. This is the real thing and the better film.
- On a local fork, move the clock. Start `pnpm anchor:localnet`, do the first two scenes, then move the validator and the phone forward a day and film the third. Say in the video that this scene was recorded on a local fork with the clock moved forward.

## After recording

- Watch it once with the sound off and once with the picture off. Each should make sense alone.
- Check the transcript on the hackathon platform before the final submit, and fix anything it misheard.
