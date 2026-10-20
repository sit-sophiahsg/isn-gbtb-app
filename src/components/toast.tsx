import { useEffect, useState } from 'react'

interface Toast { id: number; text: string; tone: 'ok' | 'warn' | 'error' }

let nextId = 1
const listeners = new Set<(t: Toast) => void>()

export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const t = { id: nextId++, text, tone }
  listeners.forEach((l) => l(t))
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([])
  useEffect(() => {
    const add = (t: Toast) => {
      setItems((xs) => [...xs, t])
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 4500)
    }
    listeners.add(add)
    return () => { listeners.delete(add) }
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto w-full max-w-md rounded-2xl px-4 py-3 text-base font-semibold shadow-lg ${
            t.tone === 'ok' ? 'bg-leaf-700 text-white' : t.tone === 'warn' ? 'bg-sun text-ink' : 'bg-petal text-white'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
