/** A failure the reader can do something about. `reason` picks the sentence shown. */
export class PostProblem extends Error {
  constructor(
    public reason:
      | 'letterbox-full'
      | 'no-such-reader'
      | 'nobody-waiting'
      | 'to-yourself'
      | 'no-free-stamp'
      | 'no-genesis-token'
      | 'not-arrived'
      | 'office-closed'
      | 'price-changed'
      | 'sealed-for-another-phone'
      | 'short-of-postage'
      | 'short-of-sol'
      | 'too-early',
  ) {
    super(reason)
  }
}
