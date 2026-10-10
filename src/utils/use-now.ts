import { useEffect, useState } from 'react'

/** The current time in Unix seconds, refreshed once a minute. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60_000)
    return () => clearInterval(timer)
  }, [])

  return now
}
