import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type JoinInput } from '../lib/api'
import * as local from '../lib/localDb'
import { onSyncFinished, startSync, syncNow } from '../lib/sync'
import type { EventInfo, JoinResult, StampKey, Student, Submission } from '../lib/types'

interface SessionValue {
  loading: boolean
  event: EventInfo | null
  student: Student | null
  submissions: Partial<Record<StampKey, Submission>>
  join(input: JoinInput): Promise<JoinResult>
  saveSubmission(stampKey: StampKey, photo: Blob, reflection: string): Promise<void>
  leave(): Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [subs, setSubs] = useState<Submission[]>([])

  const reloadSubs = useCallback(async (studentRowId: string | undefined) => {
    setSubs(studentRowId ? await local.getSubmissions(studentRowId) : [])
  }, [])

  useEffect(() => {
    void (async () => {
      const s = await local.getSession()
      if (s) {
        setEvent(s.event)
        setStudent(s.student)
        await reloadSubs(s.student.id)
        // Pick up organiser edits to the seasonal stamp when there's signal.
        api.fetchEvent(s.event.id).then((fresh) => {
          if (!fresh) return
          setEvent(fresh)
          void local.setSession({ event: fresh, student: s.student })
        })
      }
      setLoading(false)
      startSync()
    })()
  }, [reloadSubs])

  useEffect(() => onSyncFinished(() => void reloadSubs(student?.id)), [student, reloadSubs])

  const join = useCallback(
    async (input: JoinInput) => {
      const result = await api.joinEvent(input)
      if (result.ok) {
        await local.setSession({ event: result.event, student: result.student })
        await local.mergeServerSubmissions(result.student.id, result.submissions)
        setEvent(result.event)
        setStudent(result.student)
        await reloadSubs(result.student.id)
      }
      return result
    },
    [reloadSubs],
  )

  const saveSubmission = useCallback(
    async (stampKey: StampKey, photo: Blob, reflection: string) => {
      if (!student) return
      const existing = subs.find((s) => s.stampKey === stampKey)
      const now = new Date().toISOString()
      await local.putSubmission({
        id: existing?.id ?? crypto.randomUUID(),
        studentId: student.id,
        stampKey,
        photo,
        reflection,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        sync: 'pending',
      })
      await reloadSubs(student.id)
      void syncNow()
    },
    [student, subs, reloadSubs],
  )

  const leave = useCallback(async () => {
    if (student) await local.clearSyncedForStudent(student.id)
    await local.setSession(null)
    setStudent(null)
    setEvent(null)
    setSubs([])
  }, [student])

  const submissions = useMemo(() => Object.fromEntries(subs.map((s) => [s.stampKey, s])), [subs])

  return (
    <SessionContext.Provider value={{ loading, event, student, submissions, join, saveSubmission, leave }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext)
  if (!v) throw new Error('useSession outside SessionProvider')
  return v
}
