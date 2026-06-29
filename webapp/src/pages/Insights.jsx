import { useMemo, useRef, useState } from 'react'
import { useStore, areaAvgRent } from '../lib/store'
import { T } from '../lib/i18n'
import { fmt } from '../lib/format'

// exec-card icons (mirror the prototype's execIcon())
const EXEC_ICONS = {
  plots: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  yield: <><path d="M3 17l6-6 4 4 8-8" /><path d="M16 7h5v5" /></>,
  price: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  hot: <path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3.5 1-3.5s3.5 1.5 4-5.5z" />,
  top: <path d="M3 21h18M5 21V8l7-4 7 4v13" />,
}
const ExecIcon = ({ k }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {EXEC_ICONS[k] || null}
  </svg>
)
const UpArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
)

export default function Insights() {
  const { data, areas, listings, kpis, lang, yld, area, setArea, isCommercial } = useStore()
  const t = T[lang]
  const rtl = lang === 'ar'
  const [tip, setTip] = useState(null) // {x,y,name,rent,trend,ppsf}
  const wrapRef = useRef(null)

  const nameOf = (a) => (rtl ? a.ar : a.en)
  // avg annual rent per area (land value × yield; commercial = market rent), across all types
  const avgRent = (a) => areaAvgRent(a, 'all', yld)

  // ---- 1) Exec dashboard ---------------------------------------------------
  const exec = useMemo(() => {
    if (!areas.length) return null
    const k = kpis || {}
    let hot = areas[0], top = areas[0]
    areas.forEach((a) => {
      if ((a.trend ?? -Infinity) > (hot.trend ?? -Infinity)) hot = a
      if ((a.ppsf ?? -Infinity) > (top.ppsf ?? -Infinity)) top = a
    })
    const count = isCommercial ? ((k.rent_listings || 0) + (k.sale_listings || 0)) : k.sale
    const medppsf = isCommercial ? k.median_rent_ppsf : k.median_ppsf
    const cards = [
      { ic: 'plots', l: isCommercial ? (lang === 'ar' ? 'إجمالي العروض' : 'Total listings') : t.exTotalPlots, v: fmt(count), s: t.exAreas + ': ' + areas.length },
      { ic: 'price', l: isCommercial ? t.kAvgFC : t.exAvgPrice, v: fmt(medppsf) + ' ' + t.cur, s: t.sqft },
      { ic: 'hot', l: t.exHottest, v: nameOf(hot), trend: hot.trend },
      { ic: 'top', l: t.exTopArea, v: nameOf(top), s: fmt(top.ppsf) + ' ' + t.cur + '/' + t.sqft },
    ]
    if (!isCommercial) cards.splice(1, 0, { ic: 'yield', l: t.exAvgYield, v: (yld * 100).toFixed(1) + '%', s: '5–8% ' + t.yieldL, gold: true })
    return cards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, kpis, lang, yld, isCommercial])

  // ---- 2) Opportunity map (SVG scatter) ------------------------------------
  const opp = useMemo(() => {
    if (!areas.length) return null
    const W = 760, H = 430, pl = 54, pr = 18, pt = 22, pb = 46
    const iw = W - pl - pr, ih = H - pt - pb
    const xs = areas.map((a) => a.ppsf || 0)
    const ys = areas.map((a) => a.trend || 0)
    const rs = areas.map((a) => avgRent(a))
    const xMin = Math.min(...xs) * 0.9, xMax = Math.max(...xs) * 1.05
    const yMin = Math.min(...ys) - 0.5, yMax = Math.max(...ys) + 0.5
    const rMax = Math.max(...rs) || 1
    const X = (v) => rtl
      ? pl + iw - ((v - xMin) / ((xMax - xMin) || 1)) * iw
      : pl + ((v - xMin) / ((xMax - xMin) || 1)) * iw
    const Y = (v) => pt + ih - ((v - yMin) / ((yMax - yMin) || 1)) * ih
    const R = (v) => 5 + Math.sqrt(v / rMax) * 12

    const yLines = [], xLabels = []
    for (let i = 0; i <= 4; i++) {
      const yv = yMin + (yMax - yMin) * i / 4
      yLines.push({ yv, yy: Y(yv) })
    }
    for (let i = 0; i <= 4; i++) {
      const xv = xMin + (xMax - xMin) * i / 4
      xLabels.push({ xv, xx: X(xv) })
    }
    const halfX = X((xMin + xMax) / 2)
    // best-value zone = low price + high trend (top-start corner)
    const zoneX = rtl ? halfX : pl
    // selected bubble drawn last (on top), labelled
    const order = areas.slice().sort((a, b) => (a.key === area ? 1 : 0) - (b.key === area ? 1 : 0))
    const bubbles = order.map((a) => ({
      key: a.key,
      name: nameOf(a),
      cx: X(a.ppsf || 0),
      cy: Y(a.trend || 0),
      r: R(avgRent(a)),
      up: (a.trend || 0) >= 0,
      sel: a.key === area,
      rent: avgRent(a),
      trend: a.trend || 0,
      ppsf: a.ppsf || 0,
    }))
    return { W, H, pl, pr, pt, pb, iw, ih, yLines, xLabels, zoneX, halfX, bubbles }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas, area, lang, yld])

  const showTip = (b, e) => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (!r) return
    setTip({
      x: e.clientX - r.left,
      y: e.clientY - r.top - 14,
      name: b.name,
      text: `${fmt(b.rent)} ${t.cur} · ${b.trend > 0 ? '+' : ''}${b.trend}% · ${fmt(b.ppsf)}/${t.sqft}`,
    })
  }

  // ---- 3) Area comparison --------------------------------------------------
  const sortedByPpsf = useMemo(
    () => areas.slice().sort((a, b) => (b.ppsf || 0) - (a.ppsf || 0)),
    [areas]
  )
  const [picks, setPicks] = useState(['', '', ''])
  // default selects to the top-3 areas (by price/sqft) once data is ready
  const effPicks = useMemo(() => {
    const top3 = sortedByPpsf.slice(0, 3).map((a) => a.key)
    return picks.map((p, i) => p || top3[i] || '')
  }, [picks, sortedByPpsf])

  const byKey = useMemo(() => {
    const m = {}
    areas.forEach((a) => { m[a.key] = a })
    return m
  }, [areas])

  const ranks = useMemo(() => {
    const m = {}
    sortedByPpsf.forEach((a, i) => { m[a.key] = i + 1 })
    return m
  }, [sortedByPpsf])

  const plotsOf = (a) => (listings || []).filter((l) => l.area === a.key).length

  const cmpRows = useMemo(() => {
    const a = (k) => byKey[k]
    const ppsfLbl = isCommercial ? (lang === 'ar' ? 'الإيجار/قدم' : 'Rent/sqft') : t.arraSale
    const rows = [
      { l: ppsfLbl, f: (k) => fmt(a(k).ppsf) + ' ' + t.cur, best: (k) => -(a(k).ppsf || 0) },
      { l: t.compAvgRent, f: (k) => fmt(avgRent(a(k))) + ' ' + t.cur, best: (k) => avgRent(a(k)) },
      { l: isCommercial ? t.unitsWord : t.compPlots, f: (k) => fmt(plotsOf(a(k))), best: (k) => plotsOf(a(k)) },
      { l: t.compTrend, f: (k) => (a(k).trend > 0 ? '+' : '') + a(k).trend + '%', best: (k) => a(k).trend },
      { l: t.compRank, f: (k) => '#' + ranks[k], best: (k) => -ranks[k] },
    ]
    if (!isCommercial) rows.splice(2, 0, { l: t.yieldL, f: () => (yld * 100).toFixed(1) + '%', best: () => null })
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byKey, ranks, t, yld, listings, isCommercial, lang])

  const selKeys = effPicks.filter((k) => k && byKey[k])

  if (!data || data.error) {
    return <section className="view" id="v-insights" />
  }

  return (
    <section className="view" id="v-insights">
      {/* 1) Exec stat cards */}
      <div className="exec-grid" id="execStats">
        {exec && exec.map((c, i) => (
          <div className={'exec-card' + (c.gold ? ' gold' : '')} key={i}>
            <div className="exec-ic"><ExecIcon k={c.ic} /></div>
            <div className="exec-l">{c.l}</div>
            <div className="exec-v">{c.v}</div>
            <div className="exec-s">
              {c.trend != null
                ? <span className="trend up"><UpArrow />{(c.trend > 0 ? '+' : '') + c.trend}%</span>
                : c.s}
            </div>
          </div>
        ))}
      </div>

      {/* 2) Opportunity map */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-h">
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="7" cy="15" r="2.5" /><circle cx="17" cy="8" r="3" /><path d="M3 21h18" />
          </svg>
          <span>{t.oppTitle}</span>
        </div>
        <p className="sec-s">{t.oppSub}</p>
        <div id="oppChart">
          {opp && (
            <div className="opp-wrap" ref={wrapRef}>
              <div className={'opp-tip' + (tip ? ' show' : '')} id="oppTip"
                style={tip ? { left: tip.x, top: tip.y } : undefined}>
                {tip && <><b>{tip.name}</b><span>{tip.text}</span></>}
              </div>
              <svg viewBox={`0 0 ${opp.W} ${opp.H}`} className="opp-svg" preserveAspectRatio="xMidYMid meet">
                {/* best-value zone (low price + high trend) */}
                <rect x={opp.zoneX} y={opp.pt} width={opp.iw / 2} height={opp.ih / 2} rx="8" className="opp-zone" />
                <text x={rtl ? opp.W - opp.pr - 10 : opp.pl + 10} y={opp.pt + 17}
                  className="opp-zonelbl" textAnchor={rtl ? 'end' : 'start'}>★ {t.oppBest}</text>
                {/* gridlines + Y labels */}
                {opp.yLines.map((g, i) => (
                  <g key={'y' + i}>
                    <line x1={opp.pl} y1={g.yy} x2={opp.W - opp.pr} y2={g.yy} className="opp-grid" />
                    <text x={rtl ? opp.W - opp.pr + 6 : opp.pl - 8} y={g.yy + 4}
                      className="opp-ax" textAnchor={rtl ? 'start' : 'end'}>{g.yv.toFixed(1)}%</text>
                  </g>
                ))}
                {/* X labels */}
                {opp.xLabels.map((g, i) => (
                  <text key={'x' + i} x={g.xx} y={opp.H - opp.pb + 22} className="opp-ax" textAnchor="middle">
                    {Math.round(g.xv)}
                  </text>
                ))}
                {/* axes */}
                <line x1={opp.pl} y1={opp.pt} x2={opp.pl} y2={opp.H - opp.pb} className="opp-axis" />
                <line x1={opp.pl} y1={opp.H - opp.pb} x2={opp.W - opp.pr} y2={opp.H - opp.pb} className="opp-axis" />
                {/* axis titles */}
                <text x={opp.pl + opp.iw / 2} y={opp.H - 6} className="opp-axt" textAnchor="middle">{isCommercial ? (lang === 'ar' ? 'الإيجار (درهم/قدم)' : 'Rent (AED/sqft)') : t.oppX}</text>
                <text transform={`translate(${rtl ? opp.W - 12 : 15},${opp.pt + opp.ih / 2}) rotate(${rtl ? 90 : -90})`}
                  className="opp-axt" textAnchor="middle">{t.oppY}</text>
                {/* bubbles */}
                {opp.bubbles.map((b) => (
                  <g key={b.key} className={'opp-b' + (b.sel ? ' sel' : '')} style={{ cursor: 'pointer' }}
                    onClick={() => setArea(b.key)}
                    onMouseEnter={(e) => showTip(b, e)}
                    onMouseMove={(e) => showTip(b, e)}
                    onMouseLeave={() => setTip(null)}>
                    <circle cx={b.cx} cy={b.cy} r={b.r}
                      fill={b.up ? '#2E9E70' : '#E08A86'}
                      fillOpacity={b.sel ? 0.95 : 0.4}
                      stroke={b.sel ? '#C2982F' : '#fff'} strokeWidth={b.sel ? 3 : 1} />
                    {b.sel && (
                      <text x={b.cx} y={b.cy - b.r - 6} className="opp-lbl" textAnchor="middle">{b.name}</text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* 3) Area comparison */}
      <div className="card">
        <div className="sec-h">
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" />
          </svg>
          <span>{t.compTitle}</span>
        </div>
        <p className="sec-s">{t.compSub}</p>
        <div className="cmp-pick">
          {[0, 1, 2].map((i) => (
            <div className="sel" key={i}>
              <select value={effPicks[i]}
                onChange={(e) => setPicks((p) => { const n = p.slice(); n[i] = e.target.value; return n })}>
                <option value="">—</option>
                {areas.map((a) => (
                  <option value={a.key} key={a.key}>{nameOf(a)}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div id="cmpOut">
          {selKeys.length > 0 && (
            <div className="cmp-tbl-wrap">
              <table className="cmp-tbl">
                <thead>
                  <tr>
                    <th></th>
                    {selKeys.map((k) => <th key={k}>{nameOf(byKey[k])}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {cmpRows.map((row, ri) => {
                    let bestK = null, bestV = -Infinity
                    if (row.best(selKeys[0]) !== null) {
                      selKeys.forEach((k) => {
                        const v = row.best(k)
                        if (v != null && v > bestV) { bestV = v; bestK = k }
                      })
                    }
                    return (
                      <tr key={ri}>
                        <td className="cmp-l">{row.l}</td>
                        {selKeys.map((k) => (
                          <td key={k} className={k === bestK ? 'cmp-best' : ''}>{row.f(k)}</td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
