// The phone's group membership. Stored in localStorage so it survives reloads
// and the browser being killed in a pocket.

export interface GroupSession {
  groupId: string
  joinToken: string
  name: string
  emoji: string
  leaderName: string
  leaderPin?: string
}

const KEY = 'rally.session'
const PENDING_QR = 'rally.pendingQr'
const listeners = new Set<() => void>()

export function getSession(): GroupSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as GroupSession) : null
  } catch {
    return null
  }
}

export function setSession(s: GroupSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: session lasts for this tab only */
  }
  listeners.forEach((l) => l())
}

export function onSessionChange(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// A checkpoint QR scanned with the phone's own camera before joining a group.
export function setPendingQr(token: string | null) {
  try {
    if (token) sessionStorage.setItem(PENDING_QR, token)
    else sessionStorage.removeItem(PENDING_QR)
  } catch { /* ignore */ }
}

export function takePendingQr(): string | null {
  try {
    const t = sessionStorage.getItem(PENDING_QR)
    sessionStorage.removeItem(PENDING_QR)
    return t
  } catch {
    return null
  }
}
