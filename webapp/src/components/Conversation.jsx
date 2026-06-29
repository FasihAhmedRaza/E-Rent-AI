import { useEffect, useRef } from 'react'
import { useAssistant } from '../lib/assistant'
import { TYPES, TYPES_COMMERCIAL } from '../lib/i18n'
import { fmt, money } from '../lib/format'

const EXT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>
const SRC_CLASS = { bayut: 'bayut', dubizzle: 'dub', propertyfinder: 'pf' }
const SRC_NAME = { bayut: 'Bayut', dubizzle: 'Dubizzle', propertyfinder: 'Property Finder' }

function ListingCarousel({ title, sub, items, comm, lang, t, areaName, onOpen }) {
  const ref = useRef(null)
  const tName = (k) => ((comm ? TYPES_COMMERCIAL : TYPES)[k]?.[lang]) || k
  const scroll = (d) => { if (ref.current) ref.current.scrollBy({ left: d * 250, behavior: 'smooth' }) }
  return (
    <div className="ans-card cards-card">
      <div className="ac-t">{title}</div>
      {sub && <div className="ac-sub">{sub}</div>}
      <div className="ac-carousel">
        <button className="ac-arrow" onClick={() => scroll(-1)} aria-label="prev">‹</button>
        <div className="lc-row" ref={ref}>
          {items.map((l) => (
            <button className="lc" key={l.id} onClick={() => onOpen(l)} title={l.title || ''}>
              <div className="lc-top">
                <span className="lc-type">{tName(l.type)}</span>
                <span className={'lt-badge ' + (l.lt === 'rent' ? 'rent' : 'sale')}>{l.lt === 'rent' ? t.ltRent : t.ltSale}</span>
              </div>
              <div className="lc-price num">{t.cur} {money(l.value)}{l.lt === 'rent' ? <small> {t.perYearShort}</small> : ''}</div>
              <div className="lc-title">{(l.title || '—').slice(0, 64)}</div>
              <div className="lc-meta">{areaName(l.area)} · <span className="num">{fmt(l.size)}</span> {t.sqft} · <span className="num">{fmt(l.ppsf)}</span>/{t.sqft}</div>
              <div className="lc-foot"><span className={'src ' + (SRC_CLASS[l.src] || 'bayut')}><i />{SRC_NAME[l.src] || l.src}</span><span className="lc-open">{lang === 'ar' ? 'فتح' : 'Open'} {EXT}</span></div>
            </button>
          ))}
        </div>
        <button className="ac-arrow" onClick={() => scroll(1)} aria-label="next">›</button>
      </div>
    </div>
  )
}

function Card({ c, lang, t, goArea, nav }) {
  return (
    <div className="ans-card">
      <div className="ac-t">{c.title}</div>
      {c.list ? (
        <div className="ac-list">
          {c.list.map((r, i) => (
            <button className="ac-lrow" key={r.key} onClick={() => goArea(r.key)}>
              <span className="ac-lrank num">{i + 1}</span>
              <span className="ac-lname">{r.name}</span>
              <span className="ac-lrent num">{t.cur} {money(r.rent)}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {c.area && <div className="ac-area">{c.area}</div>}
          {c.rent != null && <div className="ac-rent num">{t.cur} {money(c.rent)} <small>/{lang === 'ar' ? 'سنة' : 'yr'} · {lang === 'ar' ? 'متوسط' : 'avg'}</small></div>}
          {c.cells && <div className="ac-grid">{c.cells.map((x, i) => <div className="ac-cell" key={i}><span>{x.l}</span><b className="num">{x.v}</b></div>)}</div>}
        </>
      )}
      {c.note && <div className="ac-note">{c.note}</div>}
      {c.areaKey ? <button className="ac-act" onClick={() => goArea(c.areaKey)}>{lang === 'ar' ? 'عرض المنطقة' : 'View area'} →</button>
        : c.toOverview ? <button className="ac-act" onClick={() => goArea(null)}>{lang === 'ar' ? 'فتح اللوحة' : 'Open dashboard'} →</button> : null}
    </div>
  )
}

export default function Conversation() {
  const { msgs, lang, t, goArea, openAd, allAreaName } = useAssistant()
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [msgs])

  return (
    <div className="conv" ref={ref}>
      {msgs.map((m, i) => (
        <div className={'msg ' + m.role + ((m.card || m.cards) ? ' is-card' : '')} key={i}>
          {m.role === 'bot' && !(m.card || m.cards) && <span className="msg-orb" aria-hidden>✦</span>}
          {m.cards
            ? <ListingCarousel title={m.title} sub={m.sub} items={m.cards} comm={m.comm} lang={lang} t={t} areaName={allAreaName} onOpen={openAd} />
            : m.card ? <Card c={m.card} lang={lang} t={t} goArea={goArea} />
              : (m.pending ? <span className="typing"><i /><i /><i /></span> : m.text)}
        </div>
      ))}
    </div>
  )
}
