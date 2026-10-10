import { describe, expect, it } from 'vitest'
import { explainRefusal } from './dry-run'
import { PostProblem } from './problem'

function reasonOf(err: unknown, logs: string[] = []) {
  const explained = explainRefusal(err, logs)
  return explained instanceof PostProblem ? explained.reason : null
}

describe('explainRefusal', () => {
  it('reads a program code whether it arrives as a number or a bigint', () => {
    expect(reasonOf({ InstructionError: [0, { Custom: 6007 }] })).toBe('letterbox-full')
    expect(reasonOf({ InstructionError: [1n, { Custom: 6010n }] })).toBe('no-free-stamp')
  })

  it('tells a missing deposit from missing postage by the log', () => {
    const notEnough = { InstructionError: [0, { Custom: 1 }] }
    expect(reasonOf(notEnough, ['Transfer: insufficient lamports 5, need 2039280'])).toBe('short-of-sol')
    expect(reasonOf(notEnough, ['Program log: Error: insufficient funds'])).toBe('short-of-postage')
  })

  it('treats a wallet the cluster has never seen as short of SOL', () => {
    expect(reasonOf('AccountNotFound')).toBe('short-of-sol')
    expect(reasonOf({ InsufficientFundsForRent: { account_index: 0 } })).toBe('short-of-sol')
  })

  it('does not name what it does not recognise', () => {
    expect(reasonOf({ InstructionError: [0, { Custom: 6018 }] })).toBeNull()
    expect(reasonOf({ InstructionError: [0, 'ProgramFailedToComplete'] })).toBeNull()
    expect(reasonOf('BlockhashNotFound')).toBeNull()
    expect(explainRefusal({ InstructionError: [0n, { Custom: 9n }] }, []).message).toContain('"Custom":"9"')
  })
})
