import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type JoinInput, type SaveInput } from '../lib/api'
import type { EventInfo, JoinResult, StampKey, Student, Submission } from '../lib/types'

interface SessionValue {
  loading: boolean
  event: EventInfo | null
  student: Student | null
  submissions: Partial<Record<StampKey, Submission>>
  /** Set when stamps couldn't be loaded (e.g. weak signal). */
  loadError: boolean
  reload(): Promise<void>
  join(input: JoinInput): Promise<JoinResult>
  saveSubmission(input: SaveInput): Promise<void>
  leave(): void
}

const SESSION_KEY = 'postcards:session'

interface Saved {
  event: EventInfo
  student: Student
}

/** Remembers who's logged in on this browser, so reopening the page goes straight to the passport. */
function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Saved) : null
  } catch {
    return null
  }
}

function writeSaved(s: Saved | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Private browsing: they'll just log in again next time.
  }
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [saved] = useState(readSaved)
  const [event, setEvent] = useState<EventInfo | null>(saved?.event ?? null)
  const [student, setStudent] = useState<Student | null>(saved?.student ?? null)
  const [subs, setSubs] = useState<Submission[]>([])
  const [loading, setLoading] = useState(!!saved)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async (s: Student, eventId: string) => {
    setLoadError(false)
    try {
      const [fresh, list] = await Promise.all([api.fetchEvent(eventId), api.fetchSubmissions(s)])
      setSubs(list)
      if (fresh) {
        setEvent(fresh)
        writeSaved({ event: fresh, student: s })
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (saved) void load(saved.student, saved.event.id)
  }, [saved, load])

  const reload = useCallback(async () => {
    if (student && event) await load(student, event.id)
  }, [student, event, load])

  const join = useCallback(
    async (input: JoinInput) => {
      const result = await api.joinEvent(input)
      if (result.ok) {
        writeSaved({ event: result.event, student: result.student })
        setEvent(result.event)
        setStudent(result.student)
        setSubs([])
        setLoading(true)
        await load(result.student, result.event.id)
      }
      return result
    },
    [load],
  )

  const saveSubmission = useCallback(
    async (input: SaveInput) => {
      if (!student) throw new Error('Not logged in')
      const saved = await api.saveSubmission(student, input)
      setSubs((prev) => [...prev.filter((s) => s.stampKey !== saved.stampKey), saved])
    },
    [student],
  )

  const leave = useCallback(() => {
    writeSaved(null)
    setStudent(null)
    setEvent(null)
    setSubs([])
  }, [])

  const submissions = useMemo(() => Object.fromEntries(subs.map((s) => [s.stampKey, s])), [subs])

  return (
    <SessionContext.Provider value={{ loading, event, student, submissions, loadError, reload, join, saveSubmission, leave }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext)
  if (!v) throw new Error('useSession outside SessionProvider')
  return v
}
