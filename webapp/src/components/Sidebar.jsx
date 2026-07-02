import { NavLink } from 'react-router-dom'
import { useStore } from '../lib/store'
import { T } from '../lib/i18n'

const I = (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>

const ICONS = {
  overview: I(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  map: I(<><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
  listings: I(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="1.2" /><circle cx="3.5" cy="12" r="1.2" /><circle cx="3.5" cy="18" r="1.2" /></>),
  trends: I(<><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 6-7" /></>),
  insights: I(<><circle cx="7" cy="14" r="3" /><circle cx="16" cy="9" r="3.5" /><path d="M3 21h18" /></>),
  assistant: I(<><path d="M12 2a7 7 0 0 0-7 7v3a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7z" /><path d="M9 13a3 3 0 0 0 6 0" /></>),
  studio: I(<><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9z" /></>),
}
const NAV = [
  ['/', 'overview', 'navOverview'], ['/map', 'map', 'navMap'], ['/listings', 'listings', 'navListings'],
  ['/trends', 'trends', 'navTrends'], ['/insights', 'insights', 'navInsights'],
  ['/assistant', 'assistant', 'navAsst'], ['/studio', 'studio', 'navStudio'],
]

export default function Sidebar() {
  const { lang } = useStore()
  const t = T[lang]
  return (
    <aside className="sidebar">
      <div className="s-brand">
        <img className="s-brand-logo" src="/logos/iv-logo-on-dark-transparent.svg" alt={t.brand} />
      </div>
      <nav className="nav">
        <span className="nav-label">{t.navLabel}</span>
        {NAV.map(([to, key, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className="nav-item">
            {ICONS[key]}<span>{t[label]}</span>
          </NavLink>
        ))}
      </nav>
      <div className="s-foot"><div className="s-internal"><span className="dot" />{t.internal}</div></div>
    </aside>
  )
}
