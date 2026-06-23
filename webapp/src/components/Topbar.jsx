import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { T } from '../lib/i18n'

const TITLE = { '/': 'navOverview', '/map': 'navMap', '/listings': 'navListings', '/trends': 'navTrends', '/insights': 'navInsights', '/assistant': 'navAsst', '/studio': 'navStudio' }

export default function Topbar() {
  const { lang, setLang } = useStore()
  const { signOut, user } = useAuth()
  const t = T[lang]
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <div className="topbar">
      <span className="view-title">{t[TITLE[pathname] || 'navOverview']}</span>
      <div className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input type="text" placeholder={t.searchPh} readOnly />
      </div>
      <div className="top-right">
        <div className="lang-switch">
          <button className={lang === 'ar' ? 'active' : ''} onClick={() => setLang('ar')}>العربية</button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button>
        </div>
        <div className="user" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }} title="Profile">
          <div className="ut"><div className="un">{t.userName}</div><div className="ur">{user?.email || t.userRole}</div></div>
          <div className="avatar">{t.avatar}</div>
        </div>
        <button className="mute-btn" title="Sign out" onClick={signOut} style={{ marginInlineStart: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
        </button>
      </div>
    </div>
  )
}
