import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link, NavLink } from 'react-router'
import { supabase } from '../../lib/supabase'

type AuthState = { status: 'loading' } | { status: 'out' } | { status: 'not_admin' } | { status: 'admin'; session: Session }

function useAdminAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  useEffect(() => {
    const check = async (session: Session | null) => {
      if (!session) return setState({ status: 'out' })
      const { data } = await supabase.rpc('is_admin')
      setState(data ? { status: 'admin', session } : { status: 'not_admin' })
    }
    void supabase.auth.getSession().then(({ data }) => check(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { void check(session) })
    return () => data.subscription.unsubscribe()
  }, [])
  return state
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="page pt-10">
      <form
        className="card space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          setBusy(false)
          if (error) setError(error.message)
        }}
      >
        <h1 className="text-2xl font-extrabold text-leaf-800">Organiser login</h1>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pw">Password</label>
          <input id="pw" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {error && <p className="font-semibold text-petal">{error}</p>}
      </form>
    </div>
  )
}

/** Wraps every /admin page: login form, admin check, and the admin nav. */
export function AdminShell({ children }: { children: ReactNode }) {
  const auth = useAdminAuth()
  if (auth.status === 'loading') return <p className="page pt-10 text-center">Loading…</p>
  if (auth.status === 'out') return <Login />
  if (auth.status === 'not_admin') {
    return (
      <div className="page space-y-4 pt-10 text-center">
        <p className="text-lg font-bold">This account is not an organiser.</p>
        <p>Add it to the <code>admins</code> table (see README), then reload.</p>
        <button className="btn-secondary" onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </div>
    )
  }
  const tab = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 font-bold ${isActive ? 'bg-white text-leaf-800' : 'text-white'}`
  return (
    <div className="min-h-dvh">
      <nav className="no-print sticky top-0 z-30 bg-leaf-800 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2">
          <Link to="/admin" className="mr-auto font-extrabold">Organiser</Link>
          <NavLink to="/admin" end className={tab}>Home</NavLink>
          <NavLink to="/admin/qr" className={tab}>QR codes</NavLink>
          <button className="px-3 py-2 text-sm underline" onClick={() => void supabase.auth.signOut()}>Sign out</button>
        </div>
      </nav>
      {children}
    </div>
  )
}

export function AdminHome() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-2xl font-extrabold">Organiser dashboard</h1>
      <div className="card space-y-2">
        <p>Stage 1 includes the QR print sheets. The phase controls, live board, content editors and photo review come in Stage 2.</p>
        <Link to="/admin/qr" className="btn-primary sm:w-auto">Print QR codes</Link>
      </div>
    </div>
  )
}
