import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { lastEventCode } from '../lib/eventCode'
import type { AdminRow } from '../lib/types'

const ADMIN_KEY = 'postcards:admin'
const REFRESH_MS = 15_000

interface AdminSession {
  eventId: string
  code: string
}

function readAdmin(): AdminSession | null {
  try {
    const raw = localStorage.getItem(ADMIN_KEY)
    return raw ? (JSON.parse(raw) as AdminSession) : null
  } catch {
    return null
  }
}
function writeAdmin(s: AdminSession | null) {
  try {
    if (s) localStorage.setItem(ADMIN_KEY, JSON.stringify(s))
    else localStorage.removeItem(ADMIN_KEY)
  } catch {
    // Not critical: they'll enter the passcode again.
  }
}

export function Admin() {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const saved = readAdmin()
    if (!saved) {
      setChecking(false)
      return
    }
    api
      .adminIsLoggedIn(saved.eventId)
      .then((ok) => setSession(ok ? saved : null))
      .catch(() => setSession(saved))
      .finally(() => setChecking(false))
  }, [])

  if (checking) return <main className="paper min-h-dvh" aria-busy="true" />
  if (!session)
    return (
      <Login
        onLogin={(s) => {
          writeAdmin(s)
          setSession(s)
        }}
      />
    )
  return (
    <Dashboard
      session={session}
      onLogout={() => {
        writeAdmin(null)
        setSession(null)
      }}
    />
  )
}

function Login({ onLogin }: { onLogin(s: AdminSession): void }) {
  const [code, setCode] = useState(lastEventCode())
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!code.trim() || !passcode || busy) return
    setBusy(true)
    setError(null)
    try {
      const eventId = await api.adminLogin(code.trim().toUpperCase(), passcode)
      if (eventId) onLogin({ eventId, code: code.trim().toUpperCase() })
      else setError('That event code and passcode don\'t match.')
    } catch (err) {
      console.error(err)
      setError("Couldn't connect. Check your internet and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="paper flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-rule bg-paper p-6 shadow-sm">
        <p className="font-mono text-xs tracking-[0.25em] text-ink-soft uppercase">Organisers</p>
        <h1 className="font-serif text-3xl">Admin</h1>
        <div>
          <label htmlFor="acode" className="mb-1 block font-semibold">
            Event code
          </label>
          <input
            id="acode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            className="block min-h-13 w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 font-mono text-lg"
          />
        </div>
        <div>
          <label htmlFor="apass" className="mb-1 block font-semibold">
            Passcode
          </label>
          <input
            id="apass"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoComplete="current-password"
            className="block min-h-13 w-full rounded-xl border-2 border-rule bg-paper px-4 py-3 text-lg"
          />
        </div>
        {error && (
          <p role="alert" className="font-semibold text-accent">
            {error}
          </p>
        )}
        <button disabled={busy} className="btn-primary min-h-13 w-full rounded-xl text-lg font-semibold disabled:opacity-60">
          {busy ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </main>
  )
}

function Dashboard({ session, onLogout }: { session: AdminSession; onLogout(): void }) {
  const [rows, setRows] = useState<AdminRow[] | null>(null)
  const [error, setError] = useState(false)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [filter, setFilter] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setRows(await api.adminProgress(session.eventId))
      setUpdated(new Date())
      setError(false)
    } catch (e) {
      console.error(e)
      setError(true)
    }
  }, [session.eventId])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  async function toggleHidden(row: AdminRow) {
    if (!row.flowerId) return
    setPending(row.flowerId)
    try {
      await api.adminSetFlowerHidden(row.flowerId, !row.flowerHidden)
      await load()
    } catch (e) {
      console.error(e)
      alert("Couldn't change that flower. Please try again.")
    } finally {
      setPending(null)
    }
  }

  const all = rows ?? []
  const q = filter.trim().toLowerCase()
  const shown = q ? all.filter((r) => r.studentId.includes(q) || r.firstName.toLowerCase().includes(q) || r.country.toLowerCase().includes(q)) : all
  const stats = [
    { label: 'Students joined', value: all.length },
    { label: 'All 5 stamps', value: all.filter((r) => r.stamps >= 5).length },
    { label: 'Postcards made', value: all.filter((r) => r.postcardMade).length },
    { label: 'Flowers planted', value: all.filter((r) => r.flowerId).length, note: `${all.filter((r) => r.flowerHidden).length} hidden` },
  ]

  return (
    <main className="paper min-h-dvh pb-12">
      <header className="border-b border-rule bg-cover px-4 py-4 text-gold">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] uppercase">Organiser admin</p>
            <h1 className="font-serif text-2xl">Event {session.code}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/garden?code=${session.code}`} className="flex min-h-11 items-center rounded-xl border-2 border-gold/60 px-4 font-semibold">
              Open garden
            </Link>
            <button onClick={onLogout} className="min-h-11 rounded-xl border-2 border-gold/60 px-4 font-semibold">
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-6">
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-rule bg-paper p-4">
              <p className="text-sm text-ink-soft">{s.label}</p>
              <p className="font-serif text-4xl">{s.value}</p>
              {s.note && <p className="text-sm text-ink-soft">{s.note}</p>}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">Progress</h2>
              <p className="text-sm text-ink-soft" aria-live="polite">
                {error ? "Couldn't refresh. Retrying every 15 seconds." : updated ? `Updated ${updated.toLocaleTimeString()} · refreshes every 15 seconds` : 'Loading…'}
              </p>
            </div>
            <div className="flex gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search ID, name or country"
                aria-label="Search students"
                className="min-h-11 w-64 max-w-full rounded-xl border-2 border-rule bg-paper px-3"
              />
              <button onClick={() => void load()} className="min-h-11 rounded-xl border-2 border-rule px-4 font-semibold">
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-rule bg-paper">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-rule bg-paper-2 text-sm text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-semibold">Student ID</th>
                  <th className="px-3 py-2 font-semibold">First name</th>
                  <th className="px-3 py-2 font-semibold">Country</th>
                  <th className="px-3 py-2 font-semibold">Stamps</th>
                  <th className="px-3 py-2 font-semibold">Postcard</th>
                  <th className="px-3 py-2 font-semibold">Flower</th>
                  <th className="px-3 py-2 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.studentRowId} className="border-b border-rule/60 last:border-0">
                    <td className="px-3 py-2 font-mono">{r.studentId}</td>
                    <td className="px-3 py-2 font-semibold">{r.firstName}</td>
                    <td className="px-3 py-2">{r.country}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-16 overflow-hidden rounded-full bg-paper-2">
                          <span className="block h-full bg-cover dark:bg-gold" style={{ width: `${(Math.min(r.stamps, 5) / 5) * 100}%` }} />
                        </span>
                        <span className="font-mono text-sm">{r.stamps}/5</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.postcardMade ? <span className="text-ok">✓ Made</span> : <span className="text-ink-soft">—</span>}</td>
                    <td className="px-3 py-2">
                      {r.flowerId ? (
                        <span className={`flex items-center gap-2 ${r.flowerHidden ? 'opacity-50' : ''}`}>
                          {r.flowerImageUrl && <img src={r.flowerImageUrl} alt="" className="size-10 rounded-lg bg-paper-2 object-contain" />}
                          <span>
                            {r.flowerName}
                            {r.flowerHidden && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">Hidden</span>}
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.flowerId && (
                        <button
                          onClick={() => void toggleHidden(r)}
                          disabled={pending === r.flowerId}
                          className={`min-h-10 min-w-24 rounded-lg px-3 font-semibold disabled:opacity-50 ${r.flowerHidden ? 'btn-primary' : 'border-2 border-accent text-accent'}`}
                        >
                          {pending === r.flowerId ? '…' : r.flowerHidden ? 'Unhide' : 'Hide'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {rows && shown.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-ink-soft">
                      {all.length ? 'No students match your search.' : 'No students have joined yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <DeleteAll eventId={session.eventId} onDone={load} />
      </div>
    </main>
  )
}

function DeleteAll({ eventId, onDone }: { eventId: string; onDone(): Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run() {
    if (confirm !== 'DELETE' || busy) return
    setBusy(true)
    setMessage(null)
    try {
      await api.adminDeleteAll(eventId)
      setMessage('All event data has been deleted.')
      setOpen(false)
      setConfirm('')
      await onDone()
    } catch (e) {
      console.error(e)
      setMessage('Deleting failed part-way. Please press the button again to finish.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-accent/40 p-5">
      <h2 className="font-serif text-2xl">Delete all event data</h2>
      <p className="mt-1 text-ink-soft">
        After the event, this permanently deletes every student (including student IDs), stamp, photo, postcard record and
        flower. Export anything you need from Supabase first. This can't be undone.
      </p>
      {message && (
        <p role="status" className="mt-3 font-semibold">
          {message}
        </p>
      )}
      {open ? (
        <div className="mt-4 space-y-3">
          <label htmlFor="confirm" className="block font-semibold">
            Type DELETE to confirm
          </label>
          <input
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="block min-h-12 w-full max-w-xs rounded-xl border-2 border-accent/50 bg-paper px-3 font-mono"
          />
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="min-h-12 rounded-xl border-2 border-rule px-5 font-semibold">
              Cancel
            </button>
            <button
              onClick={() => void run()}
              disabled={confirm !== 'DELETE' || busy}
              className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-white disabled:opacity-40 dark:text-paper"
            >
              {busy ? 'Deleting…' : 'Delete everything'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-4 min-h-12 rounded-xl border-2 border-accent px-5 font-semibold text-accent">
          Delete all event data…
        </button>
      )}
    </section>
  )
}
