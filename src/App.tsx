import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { supabaseConfigured } from './lib/supabase'
import { Admin } from './pages/Admin'
import { Garden } from './pages/Garden'
import { Join } from './pages/Join'
import { Passport } from './pages/Passport'
import { Plant } from './pages/Plant'
import { Postcard } from './pages/Postcard'
import { StampActivity } from './pages/StampActivity'
import { SessionProvider, useSession } from './state/session'

function RequireStudent({ children }: { children: ReactNode }) {
  const { loading, student } = useSession()
  const location = useLocation()
  if (loading) return <Splash />
  if (!student) return <Navigate to={`/join${location.search}`} replace />
  return children
}

function Home() {
  const { loading, student } = useSession()
  const location = useLocation()
  if (loading) return <Splash />
  return <Navigate to={student ? '/passport' : `/join${location.search}`} replace />
}

function JoinRoute() {
  const { loading, student } = useSession()
  if (loading) return <Splash />
  return student ? <Navigate to="/passport" replace /> : <Join />
}

function Splash() {
  return <div className="min-h-dvh bg-cover" aria-busy="true" />
}

const student = (el: ReactNode) => <RequireStudent>{el}</RequireStudent>

function NotConnected() {
  return (
    <main className="paper flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md space-y-3 rounded-2xl border border-rule bg-paper p-6 text-center">
        <h1 className="font-serif text-2xl">Postcards from Singapore</h1>
        <p className="text-ink-soft">This site isn't connected to its database yet. Please check back soon.</p>
        <p className="text-sm text-ink-soft">
          Organisers: set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> and redeploy (see the README).
        </p>
      </div>
    </main>
  )
}

export default function App() {
  if (!supabaseConfigured) return <NotConnected />
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<JoinRoute />} />
          <Route path="/passport" element={student(<Passport />)} />
          <Route path="/stamp/:key" element={student(<StampActivity />)} />
          <Route path="/postcard" element={student(<Postcard />)} />
          <Route path="/plant" element={student(<Plant />)} />
          <Route path="/garden" element={<Garden />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
