// Last-known server data, so the app opens instantly (and works) with no signal.

export function readCache<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem('rally.cache.' + key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem('rally.cache.' + key, JSON.stringify(value))
  } catch { /* quota or blocked: fine, we just won't have a cache */ }
}
