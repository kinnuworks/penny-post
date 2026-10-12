/** A failure the reader can do something about. `reason` picks the sentence shown. */
export class PostProblem extends Error {
  constructor(
    public reason:
      | 'already-answered'
      | 'bid-too-low'
      | 'day-taken'
      | 'letterbox-full'
      | 'no-such-reader'
      | 'nobody-waiting'
      | 'to-yourself'
      | 'no-free-stamp'
      | 'no-genesis-token'
      | 'not-arrived'
      | 'office-closed'
      | 'pot-too-low'
      | 'price-changed'
      | 'question-closed'
      | 'question-open'
      | 'sealed-for-another-phone'
      | 'short-of-postage'
      | 'short-of-sol'
      | 'too-early',
  ) {
    super(reason)
  }
}
