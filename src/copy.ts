// Every word the app says lives here, so the voice stays in one hand.
// Written the way the person behind a post office counter would talk.

export const copy = {
  appName: 'Dak',
  tagline: 'The post comes once a day.',

  welcome: {
    title: 'You have an address. Nobody has written to it yet.',
    body: 'Dak is a letterbox for your wallet. Friends write for free. Anyone else pays postage, and the postage is yours when you turn the card over.',
    connect: 'Show me my letterbox',
    connecting: 'Finding your wallet',
  },

  letterbox: {
    heading: 'Your letterbox',
    empty: 'Nothing today. The postman did look.',
    emptyHint: 'Write to someone and the morning post gets a lot more interesting.',
    nextPost: (when: string) => `Next post: ${when}`,
    paidCard: (amount: string) => `A stranger paid ${amount} SKR to reach you. Turn it over and it's yours.`,
  },

  counter: {
    write: 'Write a card',
    stampReady: "Today's stamp is on the counter. It won't keep.",
    stampUsed: "You've used today's stamp. There's another tomorrow.",
    posted: 'In the box. It goes out with the morning post.',
    postedExpress: 'Gone by express. It is on their doormat now.',
  },

  wallet: {
    sign: 'Sign for it',
    leave: 'Lock up and leave',
    address: (name: string) => `Addressed to ${name}`,
  },

  notification: {
    title: 'The post has come.',
    body: (count: number) => (count === 1 ? 'One card on the doormat.' : `${count} cards on the doormat.`),
  },

  errors: {
    generic: 'The post office is shut for a minute. Your card is safe. Try again.',
    declined: 'No signature, no post. Nothing was sent.',
    noWallet: 'There is no wallet on this phone to sign with yet.',
  },
} as const
