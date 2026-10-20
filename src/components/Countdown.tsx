import { useEffect, useState } from 'react'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function Countdown({ endsAt }: { endsAt: string }) {
  const now = useNow()
  const left = Math.max(0, new Date(endsAt).getTime() - now)
  const m = Math.floor(left / 60000)
  const s = Math.floor((left % 60000) / 1000)
  const urgent = left < 5 * 60000
  return (
    <span className={`tabular-nums font-extrabold ${urgent ? 'text-petal' : ''}`}>
      {left === 0 ? "Time's up" : `${m}:${String(s).padStart(2, '0')} left`}
    </span>
  )
}
