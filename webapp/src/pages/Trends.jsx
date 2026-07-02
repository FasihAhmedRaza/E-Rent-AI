import { useMemo } from 'react'
import { useStore, statsFor, areaAvgRent } from '../lib/store'
import { T, TYPES, TYPES_COMMERCIAL } from '../lib/i18n'
import { fmt } from '../lib/format'
import BasisNote from '../components/BasisNote'

// deterministic pseudo-noise (mirrors the prototype's seeded())
const seeded = (s) => {
  const x = Math.sin(s * 97.13) * 43758.5453
  return x - Math.floor(x)
}

// teal -> pine colour ramp (mirrors the prototype's lerp())
const lerp = (t) => {
  const c = [[215, 232, 226], [46, 139, 129], [11, 74, 69]]
  const seg = t < 0.5 ? 0 : 1
  const lt = t < 0.5 ? t * 2 : (t - 0.5) * 2
  const a = c[seg], b = c[seg + 1]
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * lt)},${Math.round(a[1] + (b[1] - a[1]) * lt)},${Math.round(a[2] + (b[2] - a[2]) * lt)})`
}

export default function Trends() {
  const { areas, listings, lang, area, type, setArea, yld, isCommercial } = useStore()
  const t = T[lang]
  const rtl = lang === 'ar'
  const nm = (x) => (rtl ? x.ar : x.en)
  const typeMap = isCommercial ? TYPES_COMMERCIAL : TYPES
  const typeName = type === 'all' ? t.allTypes : (typeMap[type]?.[lang] || t.allTypes)

  const a = areas.find((x) => x.key === area) || areas[0] || { key: '', trend: 0, en: '', ar: '' }
  const s = statsFor(a, type, yld) || statsFor(a, 'all', yld)

  // --- listings for selected area+type; land uses SALE×yld, commercial uses real RENT ---
  const rents = useMemo(() => {
    const lt = isCommercial ? 'rent' : 'sale'
    const of = (ty) => listings
      .filter((l) => l.area === a.key && l.lt === lt && (ty === 'all' || l.type === ty) && l.value > 0)
      .map((l) => l.value * yld)
    const sel = type === 'all' ? of('all') : of(type)
    return sel.length ? sel : of('all')
  }, [listings, a.key, type, yld, isCommercial])

  // ---- Chart 1: simulated 6-month rent trend, ending at the current avg ----
  const line = useMemo(() => {
    const end = (s && s.avg) || 0
    const trend = a.trend || 0
    const start = end / (1 + trend / 100)
    const series = []
    for (let i = 0; i < 6; i++) {
      const base = start + (end - start) * (i / 5)
      const noise = (seeded(a.key.length * 7 + i * 3) - 0.5) * end * 0.04
      series.push(Math.max(0, Math.round(base + noise)))
    }
    series[5] = Math.round(end)

    const W = 560, H = 240, pad = 44, iw = W - pad * 2, ih = H - pad * 1.3
    const mx = Math.max(...series) * 1.12, mn = Math.min(...series) * 0.9
    const X = (i) => rtl ? (pad + iw - (i / (series.length - 1)) * iw) : (pad + (i / (series.length - 1)) * iw)
    const Y = (v) => pad * 0.5 + ih - ((v - mn) / ((mx - mn) || 1)) * ih

    const grid = [], axY = [], xLabels = [], dots = []
    for (let g = 0; g <= 4; g++) {
      const yy = pad * 0.5 + ih - (g / 4) * ih
      grid.push({ yy })
      axY.push({ x: rtl ? W - pad + 6 : pad - 8, y: yy + 4, anchor: rtl ? 'start' : 'end', v: fmt(mn + (mx - mn) * g / 4) })
    }
    let sp = ''
    for (let i = 0; i < series.length; i++) sp += (i === 0 ? 'M' : 'L') + X(i) + ',' + Y(series[i]) + ' '
    series.forEach((v, i) => {
      const px = X(i), py = Y(v), isLast = i === series.length - 1
      dots.push({ px, py, r: isLast ? 6 : 4, fill: isLast ? '#C2982F' : '#fff', stroke: isLast ? '#C2982F' : '#13615A' })
      xLabels.push({ px, y: H - 12, label: t.months[i] })
    })
    const f = X(0), lx = X(series.length - 1)
    const areaPath = `M${f},${Y(series[0])} ` + series.map((v, i) => 'L' + X(i) + ',' + Y(v)).join(' ') + ` L${lx},${pad * 0.5 + ih} L${f},${pad * 0.5 + ih} Z`
    return { W, H, grid, axY, xLabels, dots, sp, areaPath }
  }, [a.key, a.trend, s, rtl, t.months])

  // ---- Chart 2: distribution of real listing rents into ~5 price bands ----
  const dist = useMemo(() => {
    if (!rents.length) return null
    const mn = Math.min(...rents), mx = Math.max(...rents)
    const B = 5, step = (mx - mn) / B || 1
    const buckets = Array(B).fill(0)
    rents.forEach((r) => { buckets[Math.min(B - 1, Math.floor((r - mn) / step))]++ })
    const W = 560, H = 240, pad = 40, iw = W - pad * 2, ih = H - pad * 1.4
    const bw = iw / B * 0.6, gap = iw / B
    const max = Math.max(...buckets) || 1
    const bars = buckets.map((c, i) => {
      const h = (c / max) * ih
      const x = rtl ? (pad + iw - (i * gap) - bw - (gap - bw) / 2) : (pad + i * gap + (gap - bw) / 2)
      const y = pad * 0.4 + ih - h
      return { x, y, w: bw, h, c, label: fmt(mn + step * i) }
    })
    return { W, H, bars }
  }, [rents, rtl])

  // ---- Chart 3: avg rent by area for the selected type (real), top 12 ----
  const cmp = useMemo(() => {
    const rows = areas
      .map((x) => ({ k: x.key, name: nm(x), v: areaAvgRent(x, type, yld) }))
      .filter((r) => r.v > 0)
      .sort((r1, r2) => r2.v - r1.v)
    let top = rows.slice(0, 12)
    if (!top.find((r) => r.k === a.key)) {
      const sa = rows.find((r) => r.k === a.key)
      if (sa) top.push(sa)
    }
    const max = Math.max(...top.map((r) => r.v)) || 1
    const min = Math.min(...top.map((r) => r.v))
    return { top, max, min }
  }, [areas, type, yld, a.key, lang])

  if (!s || !s.n) return (
    <div className="card" style={{ padding: '48px 30px', textAlign: 'center' }}>
      <h2 style={{ margin: '2px 0 10px' }}>{nm(a)}</h2>
      <p className="sec-s">{lang === 'ar' ? 'لا توجد بيانات إيجار بعد لهذه المنطقة. اختر منطقة أخرى أو عد لاحقاً.' : 'No rent data yet for this area. Pick another area or check back later.'}</p>
    </div>
  )

  return (
    <>
      <BasisNote />
      <div className="grid g-main">
        <div className="card chart-card">
          <div className="sec-h">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 6-7" /></svg>
            <span>{t.trendTitle}</span>
          </div>
          <p className="sec-s" id="trendSub">
            {typeName} — {t.areaPrefix}{nm(a)} &nbsp;·&nbsp;{' '}
            <b style={{ color: '#9A6F1E' }}>
              ({t.trendEst}) {a.trend >= 0 ? '+' : ''}{a.trend}% / 6{rtl ? ' أشهر' : ' mo'}
            </b>
          </p>
          <div id="lineHost">
            <svg className="line-svg" viewBox={`0 0 ${line.W} ${line.H}`}>
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#2E8B81" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#2E8B81" stopOpacity="0" />
                </linearGradient>
              </defs>
              {line.grid.map((g, i) => (
                <line key={'g' + i} className="gridline" x1={44} y1={g.yy} x2={line.W - 44} y2={g.yy} />
              ))}
              <path className="larea" d={line.areaPath} />
              <path className="lpath" d={line.sp} />
              {line.dots.map((d, i) => (
                <circle key={'d' + i} cx={d.px} cy={d.py} r={d.r} fill={d.fill} stroke={d.stroke} strokeWidth="2.5" />
              ))}
              {line.axY.map((ax, i) => (
                <text key={'ay' + i} className="axlabel" x={ax.x} y={ax.y} textAnchor={ax.anchor}>{ax.v}</text>
              ))}
              {line.xLabels.map((xl, i) => (
                <text key={'xl' + i} className="axlabel" x={xl.px} y={xl.y} textAnchor="middle">{xl.label}</text>
              ))}
            </svg>
          </div>
          <p className="sec-s" style={{ marginTop: 8, marginBottom: 0, fontStyle: 'italic' }}>{t.trendNote}</p>
        </div>

        <div className="card chart-card">
          <div className="sec-h">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="20" x2="4" y2="10" /><line x1="10" y1="20" x2="10" y2="4" /><line x1="16" y1="20" x2="16" y2="13" /><line x1="22" y1="20" x2="22" y2="8" /></svg>
            <span>{t.distTitle}</span>
          </div>
          <p className="sec-s">{t.distSub}</p>
          <div id="distHost">
            {dist ? (
              <svg className="dist-svg" viewBox={`0 0 ${dist.W} ${dist.H}`}>
                {dist.bars.map((b, i) => (
                  <g key={'b' + i}>
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="6" fill="#2E8B81" />
                    <text className="axlabel" x={b.x + b.w / 2} y={b.y - 7} textAnchor="middle" style={{ fontFamily: 'Tajawal', fontWeight: 700, fill: '#0B4A45' }}>{b.c}</text>
                    <text className="axlabel" x={b.x + b.w / 2} y={dist.H - 10} textAnchor="middle">{b.label}</text>
                  </g>
                ))}
              </svg>
            ) : (
              <div className="empty">{t.noRes}</div>
            )}
          </div>
        </div>
      </div>

      <div className="card chart-card" style={{ marginTop: 16 }}>
        <div className="sec-h">
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="11" width="18" height="3" rx="1" /><rect x="3" y="16" width="12" height="3" rx="1" /><rect x="3" y="6" width="15" height="3" rx="1" /></svg>
          <span>{t.cmpTitle}</span>
        </div>
        <p className="sec-s">{t.cmpSub}</p>
        <div className="bars" id="cmpBars">
          {cmp.top.map((d, i) => {
            const col = lerp((d.v - cmp.min) / ((cmp.max - cmp.min) || 1))
            return (
              <div className={'bar-row' + (d.k === a.key ? ' active' : '')} key={d.k} onClick={() => setArea(d.k)}>
                <span className="bar-rank num">{i + 1}</span>
                <span className="bar-name">{d.name}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: (d.v / cmp.max * 100).toFixed(1) + '%', background: col }} /></div>
                <span className="bar-val num">{fmt(d.v)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="foot"><div className="sources">{t.sources} <b>{t.deptName}</b></div><span className="demo-tag">{t.demo}</span></div>
    </>
  )
}
