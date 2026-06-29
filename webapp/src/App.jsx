import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store'
import { T } from './lib/i18n'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import FilterBar from './components/FilterBar'
import Overview from './pages/Overview'
import Listings from './pages/Listings'
import MapPage from './pages/Map'
import Studio from './pages/Studio'
import Insights from './pages/Insights'
import Trends from './pages/Trends'
import Assistant from './pages/Assistant'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import { AuthProvider, useAuth } from './lib/auth'
import { AssistantProvider } from './lib/assistant'
import ChatWidget from './components/ChatWidget'

const WITH_FILTER = ['/', '/map', '/listings', '/trends']

function Shell() {
  const { data, lang } = useStore()
  const t = T[lang]
  const { pathname } = useLocation()
  return (
    <div className="app" dir={t.dir}>
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className={'content' + (pathname === '/assistant' ? ' flush' : '')}>
          {!data ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Loading Ajman land data…</div>
          ) : data.error ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Could not load data.</div>
          ) : (
            <>
              {WITH_FILTER.includes(pathname) && <FilterBar />}
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/listings" element={<Listings />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/trends" element={<Trends />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/studio" element={<Studio />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </>
          )}
        </div>
      </div>
      <ChatWidget />
    </div>
  )
}

function Gate() {
  const { session, loading, recovery } = useAuth()
  if (loading) return (
    <div className="auth-wrap"><div className="auth-aurora" />
      <div style={{ color: '#cfe3df', fontWeight: 700, position: 'relative' }}>Loading…</div></div>
  )
  if (recovery) return <ResetPassword />
  if (!session) return <Login />
  return <StoreProvider><AssistantProvider><Shell /></AssistantProvider></StoreProvider>
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
