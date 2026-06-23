import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { T, TYPES } from '../lib/i18n'
import { fmt, money } from '../lib/format'

const SRC_CLASS = { bayut: 'bayut', dubizzle: 'dub', propertyfinder: 'pf' }
const SRC_NAME = { bayut: 'Bayut', dubizzle: 'Dubizzle', propertyfinder: 'Property Finder' }
const EXT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>

export default function Listings() {
  const { data, lang, area, type, setType, search, yld } = useStore()
  const t = T[lang]
  const [sortKey, setSortKey] = useState('rent')
  const [sortDir, setSortDir] = useState(-1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const areaName = useMemo(
    () => Object.fromEntries(data.areas.map((a) => [a.key, lang === 'ar' ? a.ar : a.en])),
    [data, lang]
  )
  const q = (search || '').trim().toLowerCase()
  const aname = areaName[area] || ''

  const rows = useMemo(() => {
    const r = data.listings
      .filter((l) => l.lt === 'sale' && l.value && l.size && (type === 'all' || l.type === type)
        // searching → match across ALL areas; otherwise scope to the selected area
        && (q ? (l.title || '').toLowerCase().includes(q) : l.area === area))
      .map((l) => ({ ...l, rent: l.value * yld }))
    r.sort((x, y) => {
      const xv = x[sortKey], yv = y[sortKey]
      if (typeof xv === 'string') return xv.localeCompare(yv) * sortDir
      return ((xv || 0) - (yv || 0)) * sortDir
    })
    return r
  }, [data, area, type, yld, sortKey, sortDir, q])

  useEffect(() => { setPage(1) }, [area, type, sortKey, sortDir, pageSize, q])

  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const cur = Math.min(page, pages)
  const start = (cur - 1) * pageSize
  const slice = rows.slice(start, start + pageSize)

  const sort = (k) => { if (sortKey === k) setSortDir((d) => -d); else { setSortKey(k); setSortDir(-1) } }
  const arrow = (k) => (sortKey === k ? (sortDir < 0 ? ' ↓' : ' ↑') : '')
  const open = (url) => url && window.open(url, '_blank', 'noopener,noreferrer')

  return (
    <>
      <div className="tbl-tools">
        <div className="pills">
          <button className={'pill-f' + (type === 'all' ? ' active' : '')} onClick={() => setType('all')}>{t.allTypes}</button>
          {Object.keys(TYPES).map((k) => (
            <button key={k} className={'pill-f' + (type === k ? ' active' : '')} onClick={() => setType(k)}>{TYPES[k][lang]}</button>
          ))}
        </div>
        <div className="tbl-act">
          <span className="basis-chip">
            {q ? <>“{search.trim()}” · <b className="num">{total}</b> {lang === 'ar' ? 'نتيجة' : 'results'}</>
               : <>{aname} · <b className="num">{total}</b> {t.forRent}</>}
          </span>
        </div>
      </div>

      <div className="list-hint">{EXT}<span>
        {q
          ? (lang === 'ar' ? `بحث في كل عجمان عن "${search.trim()}" — اضغط أي عرض لفتح الإعلان الأصلي` : `Searching all of Ajman for “${search.trim()}” — click any listing to open the original ad`)
          : (lang === 'ar' ? 'اضغط على أي عرض لفتح الإعلان الأصلي على Bayut / Dubizzle / Property Finder' : 'Click any listing to open the original ad on Bayut / Dubizzle / Property Finder')}
      </span></div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th onClick={() => sort('title')} className={sortKey === 'title' ? 'sorted' : ''}>{t.thProp}</th>
              <th>{t.thSub}</th>
              <th onClick={() => sort('size')} className={'r' + (sortKey === 'size' ? ' sorted' : '')}>{t.thSize}{arrow('size')}</th>
              <th onClick={() => sort('value')} className={'r' + (sortKey === 'value' ? ' sorted' : '')}>{lang === 'ar' ? 'سعر البيع' : 'Sale price'}{arrow('value')}</th>
              <th onClick={() => sort('rent')} className={'r' + (sortKey === 'rent' ? ' sorted' : '')}>{t.thRent}{arrow('rent')}</th>
              <th onClick={() => sort('ppsf')} className={'r' + (sortKey === 'ppsf' ? ' sorted' : '')}>{t.thSqft}{arrow('ppsf')}</th>
              <th>{t.thSrc}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {slice.map((l) => (
              <tr key={l.id} onClick={() => open(l.url)}>
                <td className="pname"><span className="pn-title">{(l.title || '—').slice(0, 64)}</span><span className="ps">{TYPES[l.type]?.[lang] || t.forRent}</span></td>
                <td>{areaName[l.area] || <span className="muted">{l.area_raw || '—'}</span>}</td>
                <td className="r num">{fmt(l.size)}</td>
                <td className="r num">{t.cur} {money(l.value)}</td>
                <td className="r rent">{t.cur} {money(l.rent)}</td>
                <td className="r num">{fmt(l.ppsf)}</td>
                <td><span className={'src ' + (SRC_CLASS[l.src] || 'bayut')}><i />{SRC_NAME[l.src] || l.src}</span></td>
                <td className="r"><span className="view-link">{lang === 'ar' ? 'فتح الإعلان' : 'View ad'} {EXT}</span></td>
              </tr>
            ))}
            {total === 0 && <tr><td colSpan="8" className="empty">{t.noRes}</td></tr>}
          </tbody>
        </table>
        </div>

        {total > 0 && (
          <div className="pager">
            <div className="pg-l">
              <span>{lang === 'ar' ? `عرض ${start + 1}–${start + slice.length} من ${total}` : `Showing ${start + 1}–${start + slice.length} of ${total}`}</span>
              <select className="pg-size sel" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ marginInlineStart: 6 }}>
                {[25, 50, 100].map((n) => <option key={n} value={n}>{n}/{lang === 'ar' ? 'صفحة' : 'page'}</option>)}
              </select>
            </div>
            <div className="pg-btns">
              <button disabled={cur <= 1} onClick={() => setPage(cur - 1)}>← {lang === 'ar' ? 'السابق' : 'Prev'}</button>
              <span>{lang === 'ar' ? `صفحة ${cur} / ${pages}` : `Page ${cur} / ${pages}`}</span>
              <button disabled={cur >= pages} onClick={() => setPage(cur + 1)}>{lang === 'ar' ? 'التالي' : 'Next'} →</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
