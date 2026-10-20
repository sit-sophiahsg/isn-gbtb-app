import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Join } from './pages/Join'
import { Passport } from './pages/Passport'
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

export default function App() {
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
