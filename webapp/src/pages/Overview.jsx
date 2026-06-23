import { useStore, statsFor, areaAvgRent } from '../lib/store'
import { T, TYPES } from '../lib/i18n'
import { fmt, money } from '../lib/format'

export default function Overview() {
  const { data, lang, area, type, setArea, yld } = useStore()
  const t = T[lang]
  const a = data.areas.find((x) => x.key === area) || data.areas[0]
  const s = statsFor(a, type, yld)
  if (!s) return null
  const nm = (x) => (lang === 'ar' ? x.ar : x.en)
  const typeName = type === 'all' ? t.allTypes : TYPES[type][lang]
  const pos = s.high > s.low ? ((s.avg - s.low) / (s.high - s.low)) * 100 : 50

  const ranked = [...data.areas].map((x) => ({ x, rent: areaAvgRent(x, type, yld) }))
    .filter((r) => r.rent > 0).sort((r1, r2) => r2.rent - r1.rent)
  const maxRent = ranked[0]?.rent || 1
  const cheapest = ranked[ranked.length - 1]
  const priciest = ranked[0]

  const kpis = [
    { l: t.kLow, v: money(s.low), f: t.kLowF, cur: t.cur },
    { l: t.kAvg, v: money(s.avg), f: `${fmt(s.ppsf)} ${t.cur}/${t.sqft} · ${t.kAvgF}`, gold: true, cur: t.cur },
    { l: t.kHigh, v: money(s.high), f: t.kHighF, cur: t.cur },
    { l: t.kTrend, trend: s.trend, f: t.officialData.split('·')[0] },
  ]

  return (
    <>
      <div className="card hero">
        <div className="hero-top">
          <div>
            <div className="eyebrow">{t.rangeEyebrow}</div>
            <h2>{t.areaPrefix}{nm(a)}{t.heroMid}{typeName}</h2>
          </div>
          <div className="hero-rt">
            <span className="basis">{t.basisA}<b className="num">{fmt(s.n)}</b>{t.basisB}</span>
            <div className="hero-tags">
              <span className="hero-chip">{lang === 'ar' ? 'العائد' : 'Yield'} <b>5–8%</b></span>
              <span className="hero-chip">{fmt(s.ppsf)} <b>{t.cur}/{t.sqft}</b></span>
            </div>
          </div>
        </div>
        <div className="range">
          <div className="track" style={{ background: 'linear-gradient(90deg,#2E8B81,#C2982F)' }}>
            <span className="cap low" /><span className="cap high" />
            <div className="avgm" style={{ insetInlineStart: pos + '%' }}>
              <div className="f">{t.cur} {money(s.avg)}</div><div className="d" />
            </div>
          </div>
          <div className="rlabels">
            <div className="rl lo"><span className="k">{t.lowLbl}</span><span className="v"><span className="num">{fmt(s.low)}</span><span className="cur">{t.perYear}</span></span></div>
            <div className="rl hi"><span className="k">{t.highLbl}</span><span className="v"><span className="num">{fmt(s.high)}</span><span className="cur">{t.perYear}</span></span></div>
          </div>
        </div>
      </div>

      <div className="grid g-3" id="kpis">
        {kpis.map((k, i) => (
          <div className={'card kpi' + (k.gold ? ' gold' : '')} key={i}>
            <div className="kl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>{k.l}</div>
            {k.trend !== undefined
              ? <div className="kv"><span className={'trend ' + (k.trend >= 0 ? 'up' : 'down')}>{k.trend >= 0 ? '▲' : '▼'} {Math.abs(k.trend)}%</span></div>
              : <div className="kv num">{k.v} <span style={{ fontSize: '.9rem', color: 'var(--muted)' }}>{k.cur}</span></div>}
            <div className="kf">{k.f}</div>
          </div>
        ))}
      </div>

      <div className="grid g-main" style={{ marginTop: 16 }}>
        <div className="card chart-card" style={{ padding: 20 }}>
          <div className="sec-h"><svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="12" y="7" width="3" height="10" /><rect x="17" y="13" width="3" height="4" /></svg>{t.chartTitle}</div>
          <p className="sec-s">{t.chartSub}</p>
          <div className="bars">
            {ranked.slice(0, 12).map((r, i) => (
              <div className={'bar-row' + (r.x.key === a.key ? ' active' : '')} key={r.x.key} onClick={() => setArea(r.x.key)}>
                <span className="bar-rank num">{i + 1}</span>
                <span className="bar-name">{nm(r.x)}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: (r.rent / maxRent * 100) + '%', background: 'linear-gradient(90deg,var(--teal),var(--pine))' }} /></div>
                <span className="bar-val num">{money(r.rent)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card ai" style={{ padding: 22 }}>
          <div className="sec-h"><span className="lhs"><span className="spark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9z" /></svg></span>{t.aiTitle}</span></div>
          <p className="sec-s">{t.aiSub}</p>
          <p className="ai-body">
            {nm(a)} {lang === 'ar' ? 'متوسط إيجارها' : 'averages'} <b className="num">{t.cur} {money(s.avg)}</b>/{lang === 'ar' ? 'سنة' : 'yr'} {lang === 'ar' ? 'عبر' : 'across'} <b className="num">{fmt(s.n)}</b> {lang === 'ar' ? 'قطعة' : 'plots'} ({fmt(s.ppsf)} {t.cur}/{t.sqft}).
          </p>
          <ul className="ai-list">
            <li><span className="tk" />{t.bestValueA}<b>{nm(cheapest.x)}</b> — {t.cur} {money(cheapest.rent)}{t.bestValueB}</li>
            <li><span className="tk" />{t.demandNear}<b>{nm(priciest.x)}</b> ({fmt(priciest.x.ppsf)} {t.cur}/{t.sqft})</li>
            <li><span className="tk" />{t.officialData}</li>
          </ul>
        </div>
      </div>

      <div className="foot"><div className="sources">{t.sources} <b>{t.deptName}</b></div><span className="demo-tag">{t.demo}</span></div>
    </>
  )
}
