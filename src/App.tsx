import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { configured } from './lib/supabase'
import { RallyProvider, useRally } from './lib/data'
import { Layout } from './components/Layout'
import { Toaster } from './components/toast'
import { JoinPage, JoinTokenPage } from './pages/Join'
import { StampCardPage } from './pages/StampCard'
import { GroupPage } from './pages/Group'
import { CheckpointPage } from './pages/Checkpoint'
import { ScanLandingPage, ScanPage } from './pages/Scan'
import { lazy, Suspense, type ReactNode } from 'react'

// Admin code is only downloaded by organisers, keeping participants' first load small.
const AdminShell = lazy(() => import('./pages/admin/AdminAuth').then((m) => ({ default: m.AdminShell })))
const AdminHome = lazy(() => import('./pages/admin/AdminAuth').then((m) => ({ default: m.AdminHome })))
const QrSheets = lazy(() => import('./pages/admin/QrSheets').then((m) => ({ default: m.QrSheets })))

function Admin({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="page pt-10 text-center">Loading…</p>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  )
}

function NotConfigured() {
  return (
    <div className="page space-y-3 pt-10">
      <h1 className="text-2xl font-extrabold">Almost there</h1>
      <p>
        The app isn't connected to Supabase yet. Copy <code>.env.example</code> to <code>.env.local</code>, fill in{' '}
        <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, and restart. See the README.
      </p>
    </div>
  )
}

/** Participant pages that need a joined group; otherwise show the join screen. */
function NeedsGroup({ children }: { children: ReactNode }) {
  const { session, ready } = useRally()
  if (!session) return ready ? <JoinPage /> : <p className="page pt-10 text-center font-bold">Loading…</p>
  return <>{children}</>
}

export default function App() {
  if (!configured) return <NotConfigured />
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/admin" element={<Admin><AdminHome /></Admin>} />
        <Route path="/admin/qr" element={<Admin><QrSheets /></Admin>} />
        <Route
          path="*"
          element={
            <RallyProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<NeedsGroup><StampCardPage /></NeedsGroup>} />
                  <Route path="/join" element={<JoinPage />} />
                  <Route path="/join/:token" element={<JoinTokenPage />} />
                  <Route path="/group" element={<NeedsGroup><GroupPage /></NeedsGroup>} />
                  <Route path="/checkpoint/:id" element={<NeedsGroup><CheckpointPage /></NeedsGroup>} />
                  <Route path="/scan" element={<NeedsGroup><ScanPage /></NeedsGroup>} />
                  <Route path="/s/:token" element={<ScanLandingPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </RallyProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
