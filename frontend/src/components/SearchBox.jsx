import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { T } from '../lib/i18n'
import { fmt, money } from '../lib/format'

const EXT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>

export default function SearchBox() {
  const { areasAll: src, listingsAll: srcL, lang, search, setSearch, setArea, setType, yld, isCommercial } = useStore()
  const t = T[lang]
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    const h = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const q = (search || '').trim().toLowerCase()
  const { areas, listings, total } = useMemo(() => {
    if (!src.length || q.length < 2) return { areas: [], listings: [], total: 0 }
    const areas = src.filter((a) =>
      (a.en || '').toLowerCase().includes(q) || (a.ar || '').includes(search.trim())).slice(0, 4)
    const matches = srcL.filter((l) => (isCommercial || l.lt === 'sale') && l.value && (l.title || '').toLowerCase().includes(q))
    return { areas, listings: matches.slice(0, 6), total: matches.length }
  }, [src, srcL, q, search, isCommercial])

  const aname = (k) => { const a = src.find((x) => x.key === k); return a ? (lang === 'ar' ? a.ar : a.en) : k }
  const pickArea = (a) => { setArea(a.key); setType('all'); setSearch(''); setOpen(false); nav('/listings') }
  const openAd = (l) => { if (l.url) window.open(l.url, '_blank', 'noopener,noreferrer') }
  const seeAll = () => { if (q.length >= 2) { setOpen(false); nav('/listings') } }

  return (
    <div className="search" ref={box}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input type="text" placeholder={t.searchPh} value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter') seeAll(); if (e.key === 'Escape') setOpen(false) }} />
      {open && q.length >= 2 && (
        <div className="search-pop">
          {areas.length > 0 && <div className="sp-h">{lang === 'ar' ? 'المناطق' : 'Areas'}</div>}
          {areas.map((a) => (
            <button key={a.key} className="sp-item" onClick={() => pickArea(a)}>
              <span className="sp-main">{lang === 'ar' ? a.ar : a.en}</span>
              <span className="sp-sub">{fmt(a.n)} {isCommercial ? t.unitsWord : t.forRent}</span>
            </button>
          ))}
          {listings.length > 0 && <div className="sp-h">{lang === 'ar' ? 'العروض' : 'Listings'}</div>}
          {listings.map((l) => (
            <button key={l.id} className="sp-item" onClick={() => openAd(l)} title={l.title || ''}>
              <span className="sp-main">{(l.title || '—').slice(0, 48)}</span>
              <span className="sp-sub">{aname(l.area)} · {t.cur} {money(l.value * yld)} {EXT}</span>
            </button>
          ))}
          {total === 0 && areas.length === 0 && <div className="sp-empty">{t.noRes}</div>}
          {total > 0 && (
            <button className="sp-all" onClick={seeAll}>
              {lang === 'ar' ? `عرض كل ${total} نتيجة` : `See all ${total} results`} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
