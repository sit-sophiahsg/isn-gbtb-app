import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DemoBadge } from './components/DemoBadge'
import { api } from './lib/api'
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

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        {api.demo && <DemoBadge />}
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
