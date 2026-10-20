import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Join } from './pages/Join'
import { Passport } from './pages/Passport'
import { StampActivity } from './pages/StampActivity'
import { supabaseConfigured } from './lib/supabase'
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

function SetupNeeded() {
  return (
    <main className="paper flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md space-y-3 rounded-2xl border border-rule bg-paper p-6">
        <h1 className="font-serif text-2xl">Almost there</h1>
        <p>
          This site isn't connected to its database yet. Add <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> as environment variables (see the README), then redeploy.
        </p>
      </div>
    </main>
  )
}

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join" element={<JoinRoute />} />
          <Route
            path="/passport"
            element={
              <RequireStudent>
                <Passport />
              </RequireStudent>
            }
          />
          <Route
            path="/stamp/:key"
            element={
              <RequireStudent>
                <StampActivity />
              </RequireStudent>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
