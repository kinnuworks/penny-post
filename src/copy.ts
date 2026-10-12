// Every word the app says lives here, so the voice stays in one hand.
// Written the way the person behind a post office counter would talk.

export const copy = {
  appName: 'Penny Post',
  tagline: 'The post comes once a day.',

  welcome: {
    title: 'You have an address. Nobody has written to it yet.',
    body: 'Penny Post is a letterbox for your wallet. Friends write for free. Anyone else pays postage, and the postage is yours when you turn the card over.',
    connect: 'Show me my letterbox',
    connecting: 'Finding your wallet',
  },

  letterbox: {
    heading: 'Your letterbox',
    empty: 'Nothing today. The postman did look.',
    emptyHint: 'Write to someone and the morning post gets a lot more interesting.',
    nextPost: (when: string) => `Next post: ${when}`,
    closedHere: 'The post office is not open on this network yet.',
    noBoxTitle: 'You have no letterbox yet.',
    noBoxBody:
      'Put one up and people can write to you. It takes one signature, and you set what a stranger pays to reach you.',
    putUp: 'Put up a letterbox',
    puttingUp: 'Putting it up',
    onDoormat: 'On the doormat',
    onItsWay: 'On its way',
    from: (who: string) => `From ${who}`,
    paidInside: (amount: string, token: string) => `${amount} ${token} inside`,
    freeStamp: 'Came on a free stamp',
    arrives: (when: string) => `Arrives ${when}`,
    price: (amount: string, token: string) => `A stranger pays ${amount} ${token} to reach you.`,
    seeker: (memberNumber: string) => `Seeker No. ${memberNumber}`,
    kept: 'Cards you have kept',
    claimStamp: 'I have a Seeker. Put my daily stamp on the counter.',
    claimingStamp: 'Looking for your Seeker',
  },

  circular: {
    caption: 'To every Seeker',
    from: (who: string) => `Asked by ${who}`,
    pot: (amount: string, token: string) => `${amount} ${token} is shared between every phone that answers.`,
    soFar: (count: number) => (count === 1 ? '1 phone has answered.' : `${count} phones have answered.`),
    noneYet: 'Nobody has answered yet.',
    answering: 'Sending your answer',
    youSaid: (answer: string) => `You said ${answer}.`,
    tally: (answer: string, count: number) => `${answer} ${count}`,
    shareNow: (amount: string, token: string) => `At this count your share is ${amount} ${token}.`,
    paidWhen: (when: string) => `It is paid when the day closes, ${when}.`,
    seekersOnly: 'Only a Seeker can answer. One phone, one answer.',
    waiting: (amount: string, token: string) =>
      `Yesterday's question has closed. ${amount} ${token} is waiting for you.`,
    collect: 'Collect it',
    collecting: 'Collecting',
    none: 'No question today.',
    ask: 'Ask every Seeker one',
  },

  ask: {
    title: 'Ask every Seeker',
    back: 'Back to the letterbox',
    intro:
      'Your question goes to every letterbox for one day. Each Seeker answers once, and they share your pot when the day closes. If nobody answers, the pot comes back.',
    questionLabel: 'Your question',
    questionPlaceholder: 'Tea or coffee, first thing?',
    answersLabel: 'The answers',
    answerPlaceholder: (index: number) => `Answer ${index}`,
    addAnswer: 'Add another answer',
    potLabel: 'The pot',
    potFloor: (amount: string, token: string) => `At least ${amount} ${token}.`,
    dayLabel: 'The day',
    today: 'Today',
    tomorrow: 'Tomorrow',
    free: 'Free',
    taken: (amount: string, token: string) => `Taken at ${amount} ${token}`,
    outbid: (amount: string, token: string) =>
      `That day is taken. ${amount} ${token} or more takes it over, and the first asker gets their pot back.`,
    open: 'Today already has a question, and phones are answering it.',
    notAnAmount: 'That is not an amount. Try something like 200.',
    send: 'Send it to every letterbox',
    sending: 'Sending it',
    sent: 'It is in every letterbox.',
    sentBody: (when: string) => `Seekers can answer ${when}. When the day closes they share the pot.`,
  },

  price: {
    change: 'Change it',
    title: 'What a stranger pays',
    youKeep: (amount: string, token: string) =>
      `You get ${amount} ${token} each time you sign for a card. The post office burns the rest.`,
    belowFloor: (amount: string, token: string) => `The post office will not go lower than ${amount} ${token}.`,
    notAnAmount: 'That is not an amount. Try something like 10.',
    inThePost: 'Cards already in the post keep the postage they were sent with.',
    set: 'Set the price',
    setting: 'Setting it',
    leave: 'Leave it as it is',
  },

  open: {
    title: 'A card for you',
    hint: 'Sign for it and it turns over.',
    sign: 'Sign for it',
    signing: 'Signing',
    sendBack: 'Send it back unopened',
    sendingBack: 'Sending it back',
    paid: (amount: string, token: string) => `${amount} ${token} is yours. It is in your wallet now.`,
    free: 'No postage on this one. It came on a free stamp.',
    receipt: (signature: string) => `Signed for. Receipt ${signature}`,
    done: 'Back to the letterbox',
    returned: 'Sent back. The postage went home with it.',
    gone: 'This card is no longer in the post.',
  },

  posted: {
    title: 'In the box.',
    waiting:
      'The card is posted, but its picture and message are still on this phone. They go out the next time the app is open and online.',
    sealed: 'Sealed. Only their phone can open it.',
    openCard: 'They have no letterbox yet, so it went as an open postcard, the way a real one would.',
    receipt: (signature: string) => `Certificate of posting ${signature}`,
    another: 'Write another',
    home: 'Back to the letterbox',
  },

  kept: {
    title: 'Kept',
    empty: 'Nothing here yet. Cards you open are kept on this phone.',
    back: 'Back to the letterbox',
    paid: (amount: string, token: string) => `Paid you ${amount} ${token}`,
  },

  problems: {
    'already-answered': 'This phone has answered already. One phone, one answer.',
    'bid-too-low': 'Somebody has that day, and taking it over needs a pot a tenth larger than theirs.',
    'day-taken': 'That question is already open and phones are answering it. Pick another day.',
    'pot-too-low': 'That pot is too small to go to every Seeker. Put a little more in.',
    'question-closed': 'That question has closed. There is a new one each day.',
    'question-open': 'The question is still open. Shares are paid once the day closes.',
    'letterbox-full': 'Their letterbox has had its three paid cards for that morning. Try again tomorrow.',
    'no-such-reader': 'Nobody goes by that name. Check the spelling, or use their wallet address.',
    'nobody-waiting':
      'Nobody is waiting for a card just now. Write to someone you know, and you can be first in the line.',
    'to-yourself': 'That is your own address. Writing to yourself costs a stamp and proves very little.',
    'no-free-stamp': 'There is no free stamp on the counter today. Pick another one.',
    'no-genesis-token':
      'There is no Seeker Genesis Token in this wallet. The free daily stamp is for Seeker owners. Everything else works without one.',
    'not-arrived':
      "The card is here, but its picture and message are still on the sender's phone. Try again in a minute.",
    'office-closed': 'The post office is not open on this network yet.',
    'price-changed': 'The price changed while you were writing. Post it again and the stamp will carry the new one.',
    'sealed-for-another-phone':
      'This letter was sealed for a different phone. It can be sent back, but it cannot be read here.',
    'short-of-postage': 'This wallet does not hold enough to pay for that stamp. Top it up, or pick a cheaper one.',
    'short-of-sol':
      'This wallet is short of SOL. A card needs a small deposit, and it comes back when the card is opened or returned.',
    'too-early': 'This card has not arrived yet. The post comes at eight.',
  },

  counter: {
    write: 'Write a card',
    stampReady: "Today's stamp is on the counter. It won't keep.",
    stampUsed: "You've used today's stamp. There's another tomorrow.",
    posted: 'It goes out with the morning post.',
    postedExpress: 'Gone by express. It is on their doormat now.',
  },

  write: {
    title: 'Write a card',
    back: 'Back to the letterbox',
    turnHint: 'Tap the card to turn it over.',
    toLabel: 'Who is it for?',
    toPlaceholder: 'asha.skr, or a wallet address',
    stranger: 'Nobody in mind? Write to a stranger.',
    drawing: 'Finding someone',
    strangerNote:
      'Send one, get one. This card goes to whoever has waited longest, and you join the line for the next.',
    pictureLabel: 'The picture side',
    takePhoto: 'Take a photo',
    choosePhoto: 'Choose one',
    removePhoto: 'Leave it plain',
    messageLabel: 'Your message',
    byHand: 'By hand',
    typed: 'Typed',
    typePlaceholder: 'Wish you were here.',
    clearWriting: 'Start again',
    stampLabel: 'The stamp',
    post: 'Drop it in the box',
    posting: 'Posting',
    needsRecipient: 'It needs someone to go to.',
    needsMessage: 'A blank card is a strange thing to get. Write something or add a picture.',
    arrives: (when: string) => `Arrives ${when}.`,
    arrivesExpress: 'Arrives the moment you post it.',
    quotePaid: (amount: string, token: string) =>
      `Postage is ${amount} ${token}. It is theirs when they open the card.`,
    quoteExpress: (amount: string, token: string) => `Express adds ${amount} ${token}, which is burned.`,
    quoteFree: 'This one goes on your free stamp. No postage.',
    quoteSealed: 'It will be sealed, so only their phone can read it.',
    quoteOpen: 'They have no letterbox yet, so it goes as an open postcard.',
    quoteNobody: 'Nobody goes by that name.',
    notOpenYet: 'The post office is not open yet. Your card is still here on the counter.',
  },

  wallet: {
    sign: 'Sign for it',
    leave: 'Lock up and leave',
    address: (name: string) => `Addressed to ${name}`,
  },

  notification: {
    title: 'The post has come.',
    body: (count: number) => (count === 1 ? 'One card on the doormat.' : `${count} cards on the doormat.`),
    quietTitle: "Eight o'clock.",
    quietBody: 'The post has been round. Worth a look at the doormat.',
    channel: 'The morning post',
  },

  errors: {
    generic: 'The post office is shut for a minute. Your card is safe. Try again.',
    declined: 'No signature, no post. Nothing was sent.',
    noWallet: 'There is no wallet on this phone to sign with yet.',
  },
} as const
