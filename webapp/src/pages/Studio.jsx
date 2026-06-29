import { useMemo, useState, useEffect } from 'react'
import { useStore, baseFor, statsFor } from '../lib/store'
import { T, TYPES, TYPES_COMMERCIAL } from '../lib/i18n'
import { fmt } from '../lib/format'

/* Studio-specific strings — self-contained fallback so the page works even
   if these keys are not present in the shared i18n object. Merged over T[lang]. */
const STUDIO_STRINGS = {
  en: {
    estTitle: 'Rent estimator', estSub: 'Enter plot details to get the fair rent',
    estSizeL: 'Size (sqft)', estTargetL: 'Your target rent (optional)', estBtn: 'Estimate',
    estHint: 'Enter the plot size first', estResult: 'Estimated fair rent', estRange: 'Range',
    estPos: 'Your price vs market', estBelow: 'Below market — will lease quickly',
    estFair: 'Competitive and fair', estAbove: 'Above market — may take longer',
    repTitle: 'Area report', repSub: 'Generate a professional, shareable report',
    repBtn: 'Generate report', repPrint: 'Print / Save PDF', repClose: 'Close',
    repHead: 'Land market report', repByType: 'By land type', repTop: 'Top comparable plots', repFc: 'Forecast (est.)',
    roiTitle: 'Investment ROI calculator', roiSub: 'Enter your budget to estimate expected returns',
    roiBudget: 'Budget (AED)', roiBtn: 'Calculate ROI', roiHint: 'Enter your budget first',
    roiLand: 'Affordable land', roiRent: 'Expected annual rent', roiRoi: 'Annual ROI',
    roiPayback: 'Payback period', roiYears: 'years', roi5yr: '5-year income',
    dealUnder: 'Under', dealFair: 'Fair', dealOver: 'Over',
    rentBasis: 'Rent derived from real sale prices at a 5–8% yield', mapAvg: 'Average',
    miCount: 'Listings', miRange: 'Range', vsEstimate: 'vs estimate',
    arraSale: 'Land sale value', yieldL: 'Yield', cur: 'AED', sqft: 'sqft',
    areaLbl: 'Area', typeLbl: 'Land type', allTypes: 'All types',
    thProp: 'Plot', thSub: 'Area', thSize: 'Size (sqft)', thRent: 'Est. annual rent', thSrc: 'Source',
    deptName: 'Bayut · Dubizzle · Property Finder', demo: 'Live data', areaPrefix: '',
  },
  ar: {
    estTitle: 'مقدّر الإيجار', estSub: 'أدخل بيانات القطعة لمعرفة الإيجار العادل',
    estSizeL: 'المساحة (قدم)', estTargetL: 'إيجارك المستهدف (اختياري)', estBtn: 'تقدير',
    estHint: 'أدخل مساحة القطعة أولاً', estResult: 'الإيجار العادل المقدّر', estRange: 'النطاق',
    estPos: 'سعرك مقابل السوق', estBelow: 'أقل من السوق — سيُؤجَّر بسرعة',
    estFair: 'تنافسي وعادل', estAbove: 'أعلى من السوق — قد يستغرق وقتاً',
    repTitle: 'تقرير المنطقة', repSub: 'أنشئ تقريراً احترافياً جاهزاً للمشاركة',
    repBtn: 'إنشاء تقرير', repPrint: 'طباعة / حفظ PDF', repClose: 'إغلاق',
    repHead: 'تقرير سوق الأراضي', repByType: 'حسب نوع الأرض', repTop: 'أبرز القطع المماثلة', repFc: 'التوقّع (تقديري)',
    roiTitle: 'حاسبة العائد على الاستثمار', roiSub: 'أدخل ميزانيتك لتقدير العوائد المتوقعة',
    roiBudget: 'الميزانية (د.إ)', roiBtn: 'احسب العائد', roiHint: 'أدخل ميزانيتك أولاً',
    roiLand: 'المساحة الممكنة', roiRent: 'الإيجار السنوي المتوقع', roiRoi: 'العائد السنوي',
    roiPayback: 'فترة الاسترداد', roiYears: 'سنة', roi5yr: 'دخل 5 سنوات',
    dealUnder: 'أقل من السوق', dealFair: 'عادل', dealOver: 'أعلى من السوق',
    rentBasis: 'الإيجار محسوب من أسعار البيع الحقيقية عند عائد 5–8٪', mapAvg: 'المتوسط',
    miCount: 'عدد العروض', miRange: 'النطاق', vsEstimate: 'مقابل التقدير',
    arraSale: 'قيمة بيع الأرض', yieldL: 'العائد', cur: 'د.إ', sqft: 'قدم',
    areaLbl: 'المنطقة', typeLbl: 'نوع الأرض', allTypes: 'كل الأنواع',
    thProp: 'القطعة', thSub: 'المنطقة', thSize: 'المساحة (قدم)', thRent: 'الإيجار السنوي المقدّر', thSrc: 'المصدر',
    deptName: 'Bayut · Dubizzle · Property Finder', demo: 'بيانات مباشرة', areaPrefix: 'منطقة ',
  },
}

const SRC_NAME = { bayut: 'Bayut', dubizzle: 'Dubizzle', propertyfinder: 'Property Finder' }
const SRC_CLASS = { bayut: 'bayut', dubizzle: 'dub', propertyfinder: 'pf' }
const round500 = (n) => Math.round(n / 500) * 500

export default function Studio() {
  const { isCommercial } = useStore()
  return isCommercial ? <CommercialStudio /> : <LandStudio />
}

function LandStudio() {
  const { data, lang, area, type, yld } = useStore()
  const t = useMemo(() => ({ ...(STUDIO_STRINGS[lang] || STUDIO_STRINGS.en), ...(T[lang] || {}) }), [lang])

  const areas = data?.areas || []
  const types = ['commercial', 'industrial', 'residential', 'mixed']

  // ----- local form state, defaulting to the global area/type -----
  const defType = type && type !== 'all' && TYPES[type] ? type : 'commercial'
  const [estArea, setEstArea] = useState(area)
  const [estType, setEstType] = useState(defType)
  const [estSize, setEstSize] = useState('')
  const [estTarget, setEstTarget] = useState('')
  const [estOut, setEstOut] = useState(null)

  const [roiBudget, setRoiBudget] = useState('')
  const [roiArea, setRoiArea] = useState(area)
  const [roiType, setRoiType] = useState(defType)
  const [roiOut, setRoiOut] = useState(null)

  const [showReport, setShowReport] = useState(false)

  // keep local selects in sync when the global area first loads
  useEffect(() => {
    if (area) {
      setEstArea((a) => a || area)
      setRoiArea((a) => a || area)
    }
  }, [area])

  const areaObj = (key) => areas.find((a) => a.key === key) || null
  const aName = (key) => {
    const a = areaObj(key)
    if (!a) return '—'
    return (t.areaPrefix || '') + a[lang]
  }

  // sale price per sqft for an area/type (AED/sqft)
  const ppsfFor = (key, ty) => {
    const a = areaObj(key)
    if (!a) return 0
    const b = baseFor(a, ty && ty !== 'all' ? ty : 'all')
    return (b && b.ppsf) || a.ppsf || 0
  }

  // ============ 1) RENT ESTIMATOR ============
  const estimate = () => {
    const a = areaObj(estArea)
    const size = +estSize || 0
    if (!a || size <= 0) { setEstOut({ hint: true }); return }
    const salePerSqft = ppsfFor(estArea, estType)     // AED/sqft sale price
    const saleTotal = size * salePerSqft               // AED land value
    const r5 = round500(saleTotal * 0.05)
    const r8 = round500(saleTotal * 0.08)
    const mid = round500(saleTotal * yld)
    const target = +estTarget || 0
    let pos = null
    if (target > 0 && mid > 0) {
      const r = target / mid
      const cls = r < 0.92 ? 'under' : r > 1.08 ? 'over' : 'fair'
      const lbl = cls === 'under' ? t.estBelow : cls === 'over' ? t.estAbove : t.estFair
      const pct = Math.round((target - mid) / mid * 100)
      const ppos = Math.max(4, Math.min(96, ((target - r5) / ((r8 - r5) || 1)) * 100))
      pos = { cls, lbl, pct, ppos, r5, r8 }
    }
    setEstOut({ mid, r5, r8, salePerSqft, saleTotal, pos })
  }

  // ============ 2) ROI CALCULATOR ============
  const calcRoi = () => {
    const a = areaObj(roiArea)
    const budget = +roiBudget || 0
    if (!a || budget <= 0) { setRoiOut({ hint: true }); return }
    const pps = ppsfFor(roiArea, roiType)
    const sqft = Math.round(budget / (pps || 1))
    const yp = Math.round(yld * 1000) / 10          // e.g. 6.5
    const rent = round500(budget * yld)
    const r5 = round500(budget * 0.05)
    const r8 = round500(budget * 0.08)
    const payback = Math.round(1 / (yld || 1) * 10) / 10
    const five = rent * 5
    setRoiOut({ sqft, rent, yp, payback, r5, r8, five, pps })
  }

  // ============ 3) REPORT ============
  // listings for an area (estimated annual rent per listing)
  const listingsFor = (key, ty) => {
    const all = data?.listings || []
    return all.filter((l) => l.area === key && (!ty || ty === 'all' || l.type === ty))
  }
  // estimated annual rent for a single listing: rent listings carry annual rent in value; sale listings -> value × yld
  const listingRent = (l) => (l.lt === 'rent' ? l.value : l.value * yld)

  // Report preview (live) for the estimator-selected area (matches prototype using selArea)
  const repArea = estArea
  const preview = useMemo(() => {
    const a = areaObj(repArea)
    if (!a) return null
    const s = statsFor(a, 'all', yld)
    return { name: aName(repArea), avg: s ? s.avg : 0, n: a.n }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repArea, areas, lang, yld])

  // Full report model (computed when opening the modal)
  const report = useMemo(() => {
    const a = areaObj(repArea)
    if (!a) return null
    const s = statsFor(a, 'all', yld)
    const sale = a.ppsf || 0
    const yp = Math.round(yld * 1000) / 10
    // simulated 3-month forecast from the area trend (labelled as estimate)
    const monthly = (a.trend || 0) / 6 / 100
    const f3 = Math.round(s.avg * (1 + monthly * 2.55))
    const fcPct = Math.round((f3 - s.avg) / (s.avg || 1) * 100)
    // per-source median ppsf -> rent reference (scaled to area avg value × yld)
    const srcRef = (src) => {
      const sp = a.sources && a.sources[src]
      if (!sp || !a.ppsf) return 0
      return Math.round(a.vavg * (sp / a.ppsf) * yld)
    }
    const byType = types
      .filter((tk) => a.bytype && a.bytype[tk])
      .map((tk) => {
        const ss = statsFor(a, tk, yld)
        return { tk, low: ss.low, high: ss.high, avg: ss.avg, n: ss.n }
      })
    const top = listingsFor(repArea, 'all')
      .slice()
      .sort((x, y) => listingRent(y) - listingRent(x))
      .slice(0, 5)
      .map((l) => ({
        type: TYPES[l.type] ? TYPES[l.type][lang] : l.type,
        sub: aName(repArea),
        size: l.size,
        rent: listingRent(l),
        src: l.src,
      }))
    const today = new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
    return {
      name: aName(repArea), s, sale, yp, f3, fcPct,
      by: srcRef('bayut'), du: srcRef('dubizzle'), pf: srcRef('propertyfinder'),
      byType, top, today, summary: genSummary(a),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repArea, areas, lang, yld, data])

  function genSummary(a) {
    const s = statsFor(a, 'all', yld)
    const ranked = areas.map((x) => ({ key: x.key, v: (statsFor(x, 'all', yld) || {}).avg || 0 })).sort((x, y) => y.v - x.v)
    const rank = ranked.findIndex((x) => x.key === a.key) + 1
    const N = areas.length
    const dir = (a.trend || 0) >= 0
    // cheapest type in this area
    let cheapT = null, cmin = Infinity
    types.forEach((tk) => { if (a.bytype && a.bytype[tk]) { const av = (statsFor(a, tk, yld) || {}).avg || 0; if (av && av < cmin) { cmin = av; cheapT = tk } } })
    const cheapName = cheapT && TYPES[cheapT] ? TYPES[cheapT][lang] : (TYPES.commercial[lang])
    if (lang === 'ar') {
      return `${a.ar} ${dir ? 'تشهد ارتفاعاً' : 'تشهد تراجعاً'} بنسبة ${Math.abs(a.trend || 0)}% خلال 6 أشهر، بمتوسط إيجار أرض حوالي ${fmt(s.avg)} درهم سنوياً. ${TYPES.commercial.ar} في الحد الأعلى للسعر، بينما ${cheapName} توفّر أفضل قيمة. ترتيب المنطقة ${rank} من ${N} حسب متوسط إيجار الأرض. (الأرقام تقديرية محسوبة عند عائد 6.5٪.)`
    }
    return `${a.en} is ${dir ? 'up' : 'down'} ${Math.abs(a.trend || 0)}% over six months, with average land rent around ${fmt(s.avg)} AED/year. ${TYPES.commercial.en} sits at the top of the range, while ${cheapName} offers the best value. It ranks ${rank} of ${N} areas by average land rent. (Figures are estimates at a 6.5% yield.)`
  }

  const openReport = () => setShowReport(true)
  const closeReport = () => setShowReport(false)

  // toggle the print body class while the report modal is open
  useEffect(() => {
    if (showReport) document.body.classList.add('show-report')
    else document.body.classList.remove('show-report')
    return () => document.body.classList.remove('show-report')
  }, [showReport])

  const areaOptions = areas.map((a) => <option key={a.key} value={a.key}>{a[lang]}</option>)
  const typeOptions = types.map((tk) => <option key={tk} value={tk}>{TYPES[tk][lang]}</option>)

  return (
    <section className="view show" id="v-studio">
      <div className="grid g-main">
        {/* ---- Rent estimator ---- */}
        <div className="card" style={{ padding: 22 }}>
          <div className="sec-h">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 1v3M12 20v3M4 12H1M23 12h-3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /><circle cx="12" cy="12" r="4" /></svg>
            <span>{t.estTitle}</span>
          </div>
          <p className="sec-s">{t.estSub}</p>
          <div className="est-form">
            <div className="field">
              <label>{t.areaLbl}</label>
              <div className="sel"><select value={estArea || ''} onChange={(e) => setEstArea(e.target.value)}>{areaOptions}</select></div>
            </div>
            <div className="field">
              <label>{t.typeLbl}</label>
              <div className="sel"><select value={estType} onChange={(e) => setEstType(e.target.value)}>{typeOptions}</select></div>
            </div>
            <div className="field">
              <label>{t.estSizeL}</label>
              <input className="inp" type="number" placeholder="8000" value={estSize} onChange={(e) => setEstSize(e.target.value)} />
            </div>
            <div className="field">
              <label>{t.estTargetL}</label>
              <input className="inp" type="number" placeholder="—" value={estTarget} onChange={(e) => setEstTarget(e.target.value)} />
            </div>
          </div>
          <button className="btn" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={estimate}>{t.estBtn}</button>
          <div id="estResult">
            {estOut && estOut.hint && <div className="est-hint">{t.estHint}</div>}
            {estOut && !estOut.hint && (
              <div className="est-card">
                <div className="est-l">{t.estResult} <span style={{ fontWeight: 600, color: 'var(--muted)' }}>· 6.5% {t.yieldL}</span></div>
                <div className="est-v"><span className="num">{fmt(estOut.mid)}</span> <span className="cur">{t.cur}</span></div>
                <div className="est-range">{t.estRange} (5–8%): <span className="num">{fmt(estOut.r5)} – {fmt(estOut.r8)}</span></div>
                <div className="est-arra"><span>{t.arraSale}:</span> <b className="num">{fmt(estOut.saleTotal)} {t.cur}</b></div>
                <div className="est-note">{estNote(lang, estOut)}</div>
                {estOut.pos && (
                  <div className="est-pos">
                    <div className="est-pos-h">{t.estPos} <b className={'deal ' + estOut.pos.cls}>{estOut.pos.lbl}</b></div>
                    <div className="fair-bar"><div className="fair-dot" style={{ left: estOut.pos.ppos + '%' }} /></div>
                    <div className="fair-cap"><span className="num">{fmt(estOut.pos.r5)} · 5%</span><span className="num">{fmt(estOut.pos.r8)} · 8%</span></div>
                    <div className="est-pos-n">{estOut.pos.pct >= 0 ? '+' : ''}{estOut.pos.pct}% {t.vsEstimate}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---- Report card ---- */}
        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
          <div className="sec-h">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
            <span>{t.repTitle}</span>
          </div>
          <p className="sec-s">{t.repSub}</p>
          <div className="rep-preview" id="repPreview">
            {preview && (
              <>
                <div className="rep-prev-row"><span>{t.areaLbl}</span><b>{preview.name}</b></div>
                <div className="rep-prev-row"><span>{t.mapAvg}</span><b className="num">{fmt(preview.avg)} {t.cur}</b></div>
                <div className="rep-prev-row"><span>{t.miCount}</span><b className="num">{fmt(preview.n)}</b></div>
              </>
            )}
          </div>
          <button className="btn" style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }} onClick={openReport}>{t.repBtn}</button>
        </div>
      </div>

      {/* ---- ROI calculator ---- */}
      <div className="card" style={{ padding: 22, marginTop: 16 }}>
        <div className="sec-h">
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          <span>{t.roiTitle}</span>
        </div>
        <p className="sec-s">{t.roiSub}</p>
        <div className="roi-form">
          <div className="field">
            <label>{t.roiBudget}</label>
            <input className="inp" type="number" placeholder="5000000" value={roiBudget}
              onChange={(e) => setRoiBudget(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') calcRoi() }} />
          </div>
          <div className="field">
            <label>{t.areaLbl}</label>
            <div className="sel"><select value={roiArea || ''} onChange={(e) => setRoiArea(e.target.value)}>{areaOptions}</select></div>
          </div>
          <div className="field">
            <label>{t.typeLbl}</label>
            <div className="sel"><select value={roiType} onChange={(e) => setRoiType(e.target.value)}>{typeOptions}</select></div>
          </div>
        </div>
        <button className="btn" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={calcRoi}>{t.roiBtn}</button>
        <div id="roiResult">
          {roiOut && roiOut.hint && <div className="est-hint">{t.roiHint}</div>}
          {roiOut && !roiOut.hint && (
            <div className="est-card">
              <div className="roi-grid">
                <div className="roi-cell"><span>{t.roiLand}</span><b className="num">{fmt(roiOut.sqft)} <small>{t.sqft}</small></b></div>
                <div className="roi-cell"><span>{t.roiRent}</span><b className="num">{fmt(roiOut.rent)} <small>{t.cur}</small></b></div>
                <div className="roi-cell hot"><span>{t.roiRoi}</span><b className="num">{roiOut.yp}%</b></div>
                <div className="roi-cell"><span>{t.roiPayback}</span><b className="num">{roiOut.payback} <small>{t.roiYears}</small></b></div>
              </div>
              <div className="est-range">{t.roiRent} (5–8%): <span className="num">{fmt(roiOut.r5)} – {fmt(roiOut.r8)}</span> · {t.roi5yr}: <span className="num">{fmt(roiOut.five)} {t.cur}</span></div>
              <div className="est-arra"><span>{t.arraSale}:</span> <b className="num">{fmt(roiOut.pps)} {t.cur}/{t.sqft}</b></div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Report modal ---- */}
      <div className={'modal-bg' + (showReport ? ' show' : '')} id="reportBg" onClick={(e) => { if (e.target.id === 'reportBg') closeReport() }}>
        <div className="modal report" id="reportModal">
          {report && (
            <>
              <div className="rep-doc" id="repDoc">
                <div className="rep-head">
                  <div>
                    <div className="rep-eyebrow">{t.repHead}</div>
                    <h2>{report.name}</h2>
                    <div className="rep-date">{report.today}</div>
                  </div>
                  <div className="rep-logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#C2982F" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V8l7-4 7 4v13" /></svg>
                  </div>
                </div>
                <div className="rep-kpis">
                  <div><span>{t.kLow}</span><b className="num">{fmt(report.s.low)}</b></div>
                  <div><span>{t.kAvg}</span><b className="num">{fmt(report.s.avg)}</b></div>
                  <div><span>{t.kHigh}</span><b className="num">{fmt(report.s.high)}</b></div>
                  <div><span>{t.miCount}</span><b className="num">{fmt(report.s.n)}</b></div>
                </div>
                <div className="rep-srcs">
                  <span className="src bayut"><i></i>Bayut <b className="num">{fmt(report.by)}</b></span>
                  <span className="src dub"><i></i>Dubizzle <b className="num">{fmt(report.du)}</b></span>
                  <span className="src pf"><i></i>Property Finder <b className="num">{fmt(report.pf)}</b></span>
                  <span className="rep-fc">{t.repFc}: <b style={{ color: '#9A6F1E' }}>{report.fcPct >= 0 ? '+' : ''}{report.fcPct}% → {fmt(report.f3)} {t.cur}</b></span>
                </div>
                <div className="rep-arra">{t.rentBasis} &nbsp;·&nbsp; {t.arraSale}: <b className="num">{fmt(report.sale)} {t.cur}/{t.sqft}</b> · {t.yieldL}: <b>{report.yp}%</b></div>
                <p className="rep-summary">{report.summary}</p>
                <div className="rep-sec">{t.repByType}</div>
                <table className="rep-tbl">
                  <thead><tr><th>{t.typeLbl}</th><th>{t.miRange}</th><th>{t.mapAvg}</th><th>{t.miCount}</th></tr></thead>
                  <tbody>
                    {report.byType.map((r) => (
                      <tr key={r.tk}>
                        <td>{TYPES[r.tk][lang]}</td>
                        <td className="num">{fmt(r.low)}–{fmt(r.high)}</td>
                        <td className="num">{fmt(r.avg)}</td>
                        <td className="num">{fmt(r.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="rep-sec">{t.repTop}</div>
                <table className="rep-tbl">
                  <thead><tr><th>{t.thProp}</th><th>{t.thSub}</th><th>{t.thSize}</th><th>{t.thRent}</th><th>{t.thSrc}</th></tr></thead>
                  <tbody>
                    {report.top.map((l, i) => (
                      <tr key={i}>
                        <td>{l.type}</td>
                        <td>{l.sub}</td>
                        <td className="num">{Math.round(l.size).toLocaleString('en-US')}</td>
                        <td className="num">{fmt(l.rent)}</td>
                        <td><span className={'src ' + (SRC_CLASS[l.src] || '')}><i></i>{SRC_NAME[l.src] || l.src}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="rep-foot">{t.deptName} · Bayut · Dubizzle · {t.demo}</div>
              </div>
              <div className="rep-actions">
                <button className="btn ghost" onClick={closeReport}>{t.repClose}</button>
                <button className="btn" onClick={() => window.print()}>{t.repPrint}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

// Estimator note text (matches the prototype's bilingual wording, with an estimate caveat)
function estNote(lang, o) {
  if (lang === 'ar') {
    return `قيمة الأرض حوالي ${fmt(o.saleTotal)} درهم (${fmt(o.salePerSqft)} د.إ/قدم) بناءً على أسعار البيع. بتطبيق عائد 5–8٪ يُقدَّر الإيجار السنوي بين ${fmt(o.r5)} و${fmt(o.r8)} درهم.`
  }
  return `Land value ≈ ${fmt(o.saleTotal)} AED (${fmt(o.salePerSqft)} AED/sqft) from sale listings. Applying a 5–8% yield, the estimated annual rent is ${fmt(o.r5)}–${fmt(o.r8)} AED.`
}

// ===== Commercial units Studio: market-rent estimator + sale→rent ROI =====
function CommercialStudio() {
  const { areas, kpis, lang, area, type } = useStore()
  const t = useMemo(() => ({ ...(STUDIO_STRINGS[lang] || STUDIO_STRINGS.en), ...(T[lang] || {}) }), [lang])
  const unitTypes = Object.keys(TYPES_COMMERCIAL).filter((k) => (kpis.by_type || {})[k])
  const tName = (k) => (TYPES_COMMERCIAL[k] ? TYPES_COMMERCIAL[k][lang] : k)
  const defType = type && type !== 'all' && TYPES_COMMERCIAL[type] ? type : (unitTypes[0] || 'office')

  const [estArea, setEstArea] = useState(area)
  const [estType, setEstType] = useState(defType)
  const [estSize, setEstSize] = useState('')
  const [estOut, setEstOut] = useState(null)
  const [roiArea, setRoiArea] = useState(area)
  const [roiType, setRoiType] = useState(defType)
  const [roiBudget, setRoiBudget] = useState('')
  const [roiOut, setRoiOut] = useState(null)
  useEffect(() => { if (area) { setEstArea((a) => a || area); setRoiArea((a) => a || area) } }, [area])

  const areaObj = (k) => areas.find((a) => a.key === k) || null
  const aName = (k) => { const a = areaObj(k); return a ? ((t.areaPrefix || '') + (lang === 'ar' ? a.ar : a.en)) : '—' }
  const rentPpsf = (k, ty) => { const a = areaObj(k); if (!a) return 0; const b = baseFor(a, ty && ty !== 'all' ? ty : 'all'); return (b && b.ppsf) || a.ppsf || 0 }
  const salePpsf = (k) => { const a = areaObj(k); return (a && a.saleStats && a.saleStats.ppsf) || 0 }

  const estimate = () => {
    const a = areaObj(estArea); const size = +estSize || 0
    if (!a || size <= 0) { setEstOut({ hint: true }); return }
    const pps = rentPpsf(estArea, estType)
    const mid = round500(size * pps)
    setEstOut({ mid, lo: round500(mid * 0.85), hi: round500(mid * 1.15), pps })
  }
  const calcRoi = () => {
    const a = areaObj(roiArea); const budget = +roiBudget || 0
    if (!a || budget <= 0) { setRoiOut({ hint: true }); return }
    const sp = salePpsf(roiArea), rp = rentPpsf(roiArea, roiType)
    if (!sp || !rp) { setRoiOut({ noSale: true }); return }
    const sqft = Math.round(budget / sp)
    const rent = round500(sqft * rp)
    setRoiOut({ sqft, rent, roi: Math.round(rent / budget * 1000) / 10, payback: Math.round(budget / (rent || 1) * 10) / 10, five: rent * 5, sp, rp })
  }

  const snap = useMemo(() => {
    const a = areaObj(estArea); if (!a) return null
    const s = statsFor(a, estType !== 'all' ? estType : 'all', 1)
    const rows = unitTypes.filter((k) => a.bytype && a.bytype[k]).map((k) => { const ss = statsFor(a, k, 1); return { k, avg: ss.avg, n: ss.n } })
    return { name: aName(estArea), s, rows }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estArea, estType, areas, lang])

  const areaOptions = areas.map((a) => <option key={a.key} value={a.key}>{lang === 'ar' ? a.ar : a.en}</option>)
  const typeOptions = unitTypes.map((k) => <option key={k} value={k}>{tName(k)}</option>)
  const perYr = lang === 'ar' ? 'د.إ/سنة' : 'AED/yr'

  return (
    <section className="view show" id="v-studio">
      <div className="grid g-main">
        <div className="card" style={{ padding: 22 }}>
          <div className="sec-h">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 1v3M12 20v3M4 12H1M23 12h-3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /><circle cx="12" cy="12" r="4" /></svg>
            <span>{lang === 'ar' ? 'مقدّر الإيجار التجاري' : 'Commercial rent estimator'}</span>
          </div>
          <p className="sec-s">{lang === 'ar' ? 'أدخل نوع الوحدة والمساحة لمعرفة الإيجار السوقي' : 'Enter unit type and size to get the market rent'}</p>
          <div className="est-form">
            <div className="field"><label>{t.areaLbl}</label><div className="sel"><select value={estArea || ''} onChange={(e) => setEstArea(e.target.value)}>{areaOptions}</select></div></div>
            <div className="field"><label>{t.typeLblC}</label><div className="sel"><select value={estType} onChange={(e) => setEstType(e.target.value)}>{typeOptions}</select></div></div>
            <div className="field"><label>{t.estSizeL}</label><input className="inp" type="number" placeholder="2000" value={estSize} onChange={(e) => setEstSize(e.target.value)} /></div>
          </div>
          <button className="btn" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={estimate}>{t.estBtn}</button>
          <div id="estResult">
            {estOut && estOut.hint && <div className="est-hint">{t.estHint}</div>}
            {estOut && !estOut.hint && (
              <div className="est-card">
                <div className="est-l">{lang === 'ar' ? 'إيجار سوقي تقديري' : 'Estimated market rent'}</div>
                <div className="est-v"><span className="num">{fmt(estOut.mid)}</span> <span className="cur">{perYr}</span></div>
                <div className="est-range">{t.estRange}: <span className="num">{fmt(estOut.lo)} – {fmt(estOut.hi)}</span></div>
                <div className="est-arra"><span>{lang === 'ar' ? 'الإيجار/قدم' : 'Rent/sqft'}:</span> <b className="num">{fmt(estOut.pps)} {t.cur}</b></div>
                <div className="est-note">{t.marketRentNote}</div>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
          <div className="sec-h">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 6-7" /></svg>
            <span>{lang === 'ar' ? 'لقطة السوق' : 'Market snapshot'}</span>
          </div>
          <p className="sec-s">{snap ? snap.name : ''}</p>
          {snap && snap.s && (
            <div className="rep-preview">
              <div className="rep-prev-row"><span>{t.kAvgC}</span><b className="num">{fmt(snap.s.avg)} {t.cur}</b></div>
              <div className="rep-prev-row"><span>{t.miUnits}</span><b className="num">{fmt(snap.s.n)}</b></div>
              {snap.rows.slice(0, 6).map((r) => (
                <div className="rep-prev-row" key={r.k}><span>{tName(r.k)}</span><b className="num">{fmt(r.avg)} {t.cur} · {fmt(r.n)}</b></div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 22, marginTop: 16 }}>
        <div className="sec-h">
          <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          <span>{t.roiTitle}</span>
        </div>
        <p className="sec-s">{lang === 'ar' ? 'أدخل ميزانية الشراء لتقدير العائد من إيجار الوحدة' : 'Enter a purchase budget to estimate the rental yield'}</p>
        <div className="roi-form">
          <div className="field"><label>{t.roiBudget}</label><input className="inp" type="number" placeholder="3000000" value={roiBudget} onChange={(e) => setRoiBudget(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') calcRoi() }} /></div>
          <div className="field"><label>{t.areaLbl}</label><div className="sel"><select value={roiArea || ''} onChange={(e) => setRoiArea(e.target.value)}>{areaOptions}</select></div></div>
          <div className="field"><label>{t.typeLblC}</label><div className="sel"><select value={roiType} onChange={(e) => setRoiType(e.target.value)}>{typeOptions}</select></div></div>
        </div>
        <button className="btn" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }} onClick={calcRoi}>{t.roiBtn}</button>
        <div id="roiResult">
          {roiOut && roiOut.hint && <div className="est-hint">{t.roiHint}</div>}
          {roiOut && roiOut.noSale && <div className="est-hint">{lang === 'ar' ? 'لا توجد بيانات بيع كافية لهذه المنطقة لحساب العائد' : 'Not enough sale data in this area to compute ROI'}</div>}
          {roiOut && !roiOut.hint && !roiOut.noSale && (
            <div className="est-card">
              <div className="roi-grid">
                <div className="roi-cell"><span>{lang === 'ar' ? 'المساحة الممكنة' : 'Affordable area'}</span><b className="num">{fmt(roiOut.sqft)} <small>{t.sqft}</small></b></div>
                <div className="roi-cell"><span>{t.roiRent}</span><b className="num">{fmt(roiOut.rent)} <small>{t.cur}</small></b></div>
                <div className="roi-cell hot"><span>{t.roiRoi}</span><b className="num">{roiOut.roi}%</b></div>
                <div className="roi-cell"><span>{t.roiPayback}</span><b className="num">{roiOut.payback} <small>{t.roiYears}</small></b></div>
              </div>
              <div className="est-range">{t.roi5yr}: <span className="num">{fmt(roiOut.five)} {t.cur}</span></div>
              <div className="est-arra"><span>{lang === 'ar' ? 'سعر البيع/قدم' : 'Sale/sqft'}:</span> <b className="num">{fmt(roiOut.sp)} {t.cur}</b> · <span>{lang === 'ar' ? 'الإيجار/قدم' : 'Rent/sqft'}:</span> <b className="num">{fmt(roiOut.rp)} {t.cur}</b></div>
            </div>
          )}
        </div>
      </div>
      <div className="foot"><div className="sources">{t.sources} <b>{t.deptName}</b></div><span className="demo-tag">{t.demo}</span></div>
    </section>
  )
}
