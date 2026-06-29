import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, statsFor, areaAvgRent } from '../lib/store'
import { T, TYPES, TYPES_COMMERCIAL } from '../lib/i18n'
import { fmt, money } from '../lib/format'
import { askGemini } from '../lib/ai'

const EXT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>
const SRC_CLASS = { bayut: 'bayut', dubizzle: 'dub', propertyfinder: 'pf' }
const SRC_NAME = { bayut: 'Bayut', dubizzle: 'Dubizzle', propertyfinder: 'Property Finder' }
const UNIT_SYN = {
  office: ['office', 'offices', 'مكتب'],
  shop: ['shop', 'shops', 'retail', 'محل'],
  warehouse: ['warehouse', 'warehouses', 'storage', 'مستودع', 'مخزن'],
  showroom: ['showroom', 'showrooms', 'معرض'],
  commercial_building: ['building', 'buildings', 'مبنى'],
  commercial_villa: ['commercial villa', 'villa', 'فيلا'],
  labour_camp: ['labour', 'labor', 'staff accommodation', 'سكن عمال'],
  factory: ['factory', 'factories', 'مصنع'],
}
const LAND_SYN = {
  commercial: ['commercial land', 'commercial plot', 'أرض تجارية'],
  industrial: ['industrial', 'صناعي'],
  residential: ['residential', 'سكني'],
  mixed: ['mixed', 'متعدد'],
}

// horizontal, swipe-left/right carousel of real listing cards (each opens the original ad)
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

export default function Assistant() {
  const { data, areas, kpis, lang, yld, setArea, setType, isCommercial } = useStore()
  const t = T[lang]
  const nav = useNavigate()
  const [msgs, setMsgs] = useState([{ role: 'bot', text: t.asstWelcome }])
  const [input, setInput] = useState('')
  const [muted, setMuted] = useState(false)
  const [listening, setListening] = useState(false)
  const [chips, setChips] = useState([])
  const convRef = useRef(null)
  const recog = useRef(null)
  const nm = (a) => (lang === 'ar' ? a.ar : a.en)

  useEffect(() => { if (convRef.current) convRef.current.scrollTop = convRef.current.scrollHeight }, [msgs])

  const rankByRent = (typeKey) =>
    areas.map((a) => ({ a, rent: areaAvgRent(a, typeKey, yld) })).filter((x) => x.rent > 0).sort((x, y) => y.rent - x.rent)

  const srcNote = (a) => {
    const s = a.sources || {}
    const parts = []
    if (s.bayut) parts.push('Bayut ' + fmt(s.bayut))
    if (s.dubizzle) parts.push('Dubizzle ' + fmt(s.dubizzle))
    if (s.propertyfinder) parts.push('PF ' + fmt(s.propertyfinder))
    const trend = (a.trend >= 0 ? '+' : '') + a.trend + '%'
    return (lang === 'ar' ? `الاتجاه 6 أشهر ${trend} · سعر القدم: ` : `6‑mo trend ${trend} · AED/sqft: `) + parts.join(' · ')
  }

  const areaCard = (a, typeKey, title) => {
    const s = statsFor(a, typeKey, yld) || statsFor(a, 'all', yld)
    const ranked = rankByRent('all')
    const rank = ranked.findIndex((x) => x.a.key === a.key) + 1
    return {
      card: {
        title, area: nm(a), rent: s.avg, areaKey: a.key,
        cells: [
          { l: lang === 'ar' ? 'سعر القدم' : 'Price/sqft', v: fmt(s.ppsf) + ' ' + t.cur },
          { l: lang === 'ar' ? 'النطاق' : 'Rent range', v: money(s.low) + '–' + money(s.high) },
          { l: isCommercial ? t.unitsWord : (lang === 'ar' ? 'القطع' : 'Plots'), v: fmt(s.n) },
          { l: lang === 'ar' ? 'الترتيب' : 'Rank', v: '#' + rank + ' / ' + ranked.length },
        ],
        note: srcNote(a),
      },
    }
  }

  const marketCard = (typeKey) => {
    const ranked = rankByRent(typeKey)
    if (!ranked.length) return { text: t.asstNoMatch }
    const rents = ranked.map((x) => x.rent).slice().sort((x, y) => x - y)
    const medRent = rents[Math.floor(rents.length / 2)]
    const cheapest = ranked[ranked.length - 1].a
    const priciest = ranked[0].a
    const totalCount = isCommercial ? ((kpis.rent_listings || 0) + (kpis.sale_listings || 0)) : kpis.sale
    const medPpsf = isCommercial ? kpis.median_rent_ppsf : kpis.median_ppsf
    return {
      card: {
        title: typeKey === 'all'
          ? (isCommercial ? (lang === 'ar' ? 'سوق الوحدات التجارية' : 'Ajman commercial market') : (lang === 'ar' ? 'سوق أراضي عجمان' : 'Ajman land market'))
          : (TYPES[typeKey] ? TYPES[typeKey][lang] : typeKey) + (lang === 'ar' ? ' — السوق' : ' market'),
        area: lang === 'ar' ? 'كل عجمان' : 'All of Ajman', rent: medRent, toOverview: true,
        cells: [
          { l: lang === 'ar' ? 'المناطق' : 'Areas', v: fmt(ranked.length) },
          { l: isCommercial ? t.unitsWord : (lang === 'ar' ? 'إجمالي القطع' : 'Total plots'), v: fmt(totalCount) },
          { l: lang === 'ar' ? 'الأرخص' : 'Cheapest', v: nm(cheapest) },
          { l: lang === 'ar' ? 'الأعلى' : 'Most expensive', v: nm(priciest) },
        ],
        note: isCommercial
          ? (lang === 'ar' ? `متوسط الإيجار/قدم ${fmt(medPpsf)} د.إ · إيجار سوقي مباشر` : `Median ${fmt(medPpsf)} AED/sqft · live market rent`)
          : (lang === 'ar' ? `متوسط سعر القدم ${fmt(medPpsf)} د.إ · الإيجار = القيمة × عائد 5–8٪` : `Median ${fmt(medPpsf)} AED/sqft · rent = value × 5–8% yield`),
      },
    }
  }

  const topCard = (typeKey) => {
    const ranked = rankByRent(typeKey).slice(0, 5)
    return {
      card: {
        title: (lang === 'ar' ? 'أعلى المناطق إيجاراً' : 'Top areas by rent') + (typeKey !== 'all' && TYPES[typeKey] ? ' · ' + TYPES[typeKey][lang] : ''),
        list: ranked.map((x) => ({ key: x.a.key, name: nm(x.a), rent: x.rent })),
      },
    }
  }

  const yieldCard = () => ({
    card: {
      title: isCommercial ? (lang === 'ar' ? 'كيف يُقاس الإيجار' : 'How rent is measured') : (lang === 'ar' ? 'كيف يُحسب الإيجار' : 'How rent is calculated'),
      cells: isCommercial ? [
        { l: lang === 'ar' ? 'الأساس' : 'Basis', v: lang === 'ar' ? 'إيجار السوق' : 'Market rent' },
        { l: lang === 'ar' ? 'متوسط الإيجار/قدم' : 'Median rent/sqft', v: fmt(kpis.median_rent_ppsf) },
        { l: lang === 'ar' ? 'المناطق' : 'Areas', v: fmt(areas.length) },
        { l: lang === 'ar' ? 'العروض' : 'Listings', v: fmt((kpis.rent_listings || 0) + (kpis.sale_listings || 0)) },
      ] : [
        { l: lang === 'ar' ? 'نطاق العائد' : 'Yield band', v: '5–8%' },
        { l: lang === 'ar' ? 'الافتراضي' : 'Default', v: '6.5%' },
        { l: lang === 'ar' ? 'متوسط سعر القدم' : 'Median AED/sqft', v: fmt(kpis.median_ppsf) },
        { l: lang === 'ar' ? 'المناطق' : 'Areas', v: fmt(areas.length) },
      ],
      note: isCommercial
        ? (lang === 'ar' ? 'إيجار الوحدات التجارية مأخوذ مباشرة من عروض السوق الحقيقية (Bayut، Dubizzle، Property Finder).' : 'Commercial unit rent is taken directly from real market listings (Bayut, Dubizzle & Property Finder).')
        : (lang === 'ar' ? 'إيجار الأرض السنوي = سعر بيع الأرض × العائد. أسعار البيع حقيقية من Bayut وDubizzle وProperty Finder.' : 'Annual land rent = land sale value × yield. Sale prices are real, from Bayut, Dubizzle & Property Finder.'),
      toOverview: true,
    },
  })

  function answer(text) {
    const s = text.toLowerCase()
    const typeKey = isCommercial ? 'all' : (/industrial|صناعي/.test(s) ? 'industrial' : /residential|سكني/.test(s) ? 'residential'
      : /commercial|تجاري/.test(s) ? 'commercial' : /mixed|متعدد/.test(s) ? 'mixed' : 'all')
    const tname = typeKey === 'all' ? (isCommercial ? (lang === 'ar' ? 'الوحدات التجارية' : 'commercial units') : (lang === 'ar' ? 'الأراضي' : 'land')) : TYPES[typeKey][lang]
    let areaHit = areas.find((a) => s.includes(a.en.toLowerCase()) || (a.ar && text.includes(a.ar)))
    if (!areaHit) areaHit = areas.find((a) => {
      const base = a.en.toLowerCase().replace(/\s*\d+$/, '').replace(/^al\s+/, '').trim()
      return base.length >= 4 && s.includes(base)
    })
    if (/yield|عائد|how .*calculat|methodolog|كيف.*حسب/.test(s)) return yieldCard()
    if (/compare|versus|\bvs\b|قارن/.test(s) && areaHit) {
      const ranked = rankByRent(typeKey)
      const avg = Math.round(ranked.reduce((x, y) => x + y.rent, 0) / ranked.length)
      const r = areaAvgRent(areaHit, typeKey, yld)
      const diff = avg ? Math.round((r - avg) / avg * 100) : 0
      return {
        card: {
          title: lang === 'ar' ? 'مقارنة بمتوسط عجمان' : 'vs Ajman average', area: nm(areaHit), rent: r, areaKey: areaHit.key,
          cells: [
            { l: lang === 'ar' ? 'متوسط عجمان' : 'Ajman avg', v: t.cur + ' ' + money(avg) },
            { l: lang === 'ar' ? 'الفرق' : 'Difference', v: (diff >= 0 ? '+' : '') + diff + '%' },
            { l: lang === 'ar' ? 'سعر القدم' : 'Price/sqft', v: fmt(areaHit.ppsf) + ' ' + t.cur },
            { l: isCommercial ? t.unitsWord : (lang === 'ar' ? 'القطع' : 'Plots'), v: fmt(areaHit.n) },
          ],
          note: srcNote(areaHit),
        },
      }
    }
    const ranked = rankByRent(typeKey)
    if (ranked.length) {
      if (/(top|list|rank|which areas|all areas)/.test(s) && /(rent|expensive|high|price|أعلى|قائمة)/.test(s)) return topCard(typeKey)
      if (/cheap|lowest|\blow\b|affordab|budget|أرخص|أقل|رخيص/.test(s)) return areaCard(ranked[ranked.length - 1].a, typeKey, (lang === 'ar' ? 'الأرخص · ' : 'Cheapest · ') + tname)
      if (/expensive|highest|priciest|premium|best|top|أعلى|أغلى|اغلى/.test(s)) return areaCard(ranked[0].a, typeKey, (lang === 'ar' ? 'الأعلى · ' : 'Most expensive · ') + tname)
    }
    if (areaHit) return areaCard(areaHit, typeKey, nm(areaHit))
    if (typeKey !== 'all') return marketCard(typeKey)
    // fallback → always a useful card
    return marketCard('all')
  }

  const openAd = (l) => { if (l && l.url) window.open(l.url, '_blank', 'noopener,noreferrer') }
  const allAreaName = (k) => {
    const src = (data?.areas || []).concat(data?.commercial?.areas || [])
    const a = src.find((x) => x.key === k)
    return a ? (lang === 'ar' ? a.ar : a.en) : k
  }

  // parse a price ceiling from the query: "within 1 million", "under 500k", "200000", "1.5m"
  const priceCap = (text) => {
    const s = text.toLowerCase().replace(/,/g, '')
    const m = s.match(/(?:under|within|below|less than|max|up to|upto|budget(?:\s*of)?|cheaper than|<=?|أقل\s*من|حتى)\s*(?:aed|درهم)?\s*(\d+(?:\.\d+)?)\s*(million|mil|mn|m|thousand|k)?/)
      || s.match(/(\d+(?:\.\d+)?)\s*(million|mil|mn|m|thousand|k)\b/)
      || s.match(/\b(\d{4,})\b/)
    if (!m) return null
    let n = parseFloat(m[1]); const u = m[2] || ''
    if (u[0] === 'm') n *= 1e6; else if (u[0] === 'k' || u.startsWith('thous')) n *= 1e3
    return Math.round(n)
  }
  const detectType = (s) => {
    for (const [k, syns] of Object.entries(UNIT_SYN)) if (syns.some((w) => s.includes(w))) return { key: k, comm: true }
    for (const [k, syns] of Object.entries(LAND_SYN)) if (syns.some((w) => s.includes(w))) return { key: k, comm: false }
    return null
  }

  // suggestion chips — start as category defaults, then follow the conversation
  const defaultChips = () => (isCommercial
    ? [lang === 'ar' ? 'أرخص منطقة للمكاتب' : 'Cheapest area for offices',
       lang === 'ar' ? 'إيجارات المستودعات' : 'Warehouse rents',
       lang === 'ar' ? 'أعلى الإيجارات التجارية' : 'Highest commercial rents',
       lang === 'ar' ? 'كيف يُقاس الإيجار' : 'How is rent measured']
    : [t.sugg1, t.sugg2, t.sugg3, t.sugg4])

  const nextChips = (q) => {
    const s = q.toLowerCase()
    const td = detectType(s)
    const areaSrc = (data?.areas || []).concat(data?.commercial?.areas || [])
    const areaHit = areaSrc.find((a) => s.includes((a.en || '').toLowerCase()) || (a.ar && q.includes(a.ar)))
    const aN = areaHit ? (lang === 'ar' ? areaHit.ar : areaHit.en) : null
    const out = []
    if (td) {
      const map = td.comm ? TYPES_COMMERCIAL : TYPES
      const tl = map[td.key]?.[lang] || td.key
      out.push(lang === 'ar' ? `${tl} للبيع` : `${tl} for sale`)
      out.push(lang === 'ar' ? `أرخص منطقة لـ${tl}` : `Cheapest area for ${String(tl).toLowerCase()}`)
      const sib = td.comm ? (td.key === 'warehouse' ? 'office' : td.key === 'office' ? 'shop' : 'warehouse')
        : (td.key === 'commercial' ? 'industrial' : 'commercial')
      const sl = map[sib]?.[lang] || sib
      out.push(lang === 'ar' ? `إيجارات ${sl}` : `${sl} rents`)
    }
    if (aN) {
      out.push(lang === 'ar' ? `قارن ${aN} بالمتوسط` : `Compare ${aN} with the average`)
      out.push(lang === 'ar' ? `الاتجاه في ${aN}` : `Trend in ${aN}`)
    }
    for (const d of defaultChips()) { if (out.length >= 4) break; if (!out.includes(d)) out.push(d) }
    return out.slice(0, 4)
  }

  useEffect(() => { setChips(defaultChips()) /* reset to category defaults */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommercial, lang])

  // "show me warehouses within 1 million" → a scrollable carousel of real matching listings
  const listingQuery = (text) => {
    const s = text.toLowerCase()
    if (/compare|versus|\bvs\b|قارن|trend|اتجاه|yield|عائد|average|متوسط/.test(s)) return null
    const cap = priceCap(text)
    const td = detectType(s)
    const browse = /\bshow|list|listing|find|display|browse|اعرض|أعرض|عرض|ابحث|اعطني|أعطني/.test(s)
    const ltWanted = /for rent|to rent|rental|for lease|إيجار|للايجار|للإيجار/.test(s) ? 'rent'
      : /for sale|to buy|\bbuy\b|\bsale\b|للبيع|للشراء/.test(s) ? 'sale' : null
    if (!browse && cap == null && !(td && ltWanted)) return null

    const comm = td ? td.comm : isCommercial
    const dataset = td ? (td.comm ? (data?.commercial?.listings || []) : (data?.listings || [])) : (listings || [])
    const areaSrc = (data?.areas || []).concat(data?.commercial?.areas || [])
    const areaHit = areaSrc.find((a) => s.includes((a.en || '').toLowerCase()) || (a.ar && text.includes(a.ar)))
    const desc = /highest|expensive|premium|biggest|largest|أعلى|أغلى/.test(s)
    let rows = dataset.filter((l) => l.value && l.size
      && (td ? l.type === td.key : true)
      && (ltWanted ? l.lt === ltWanted : true)
      && (areaHit ? l.area === areaHit.key : true)
      && (cap != null ? l.value <= cap : true))
    rows = rows.sort((a, b) => (desc ? (b.value - a.value) : (a.value - b.value))).slice(0, 24)

    const tlabel = td ? ((td.comm ? TYPES_COMMERCIAL : TYPES)[td.key]?.[lang] || td.key)
      : (comm ? (lang === 'ar' ? 'وحدات تجارية' : 'commercial units') : (lang === 'ar' ? 'أراضٍ' : 'land'))
    const capTxt = cap != null ? (lang === 'ar' ? ` ضمن ${t.cur} ${money(cap)}` : ` within ${t.cur} ${money(cap)}`) : ''
    const inArea = areaHit ? ` · ${lang === 'ar' ? areaHit.ar : areaHit.en}` : ''
    if (!rows.length) return { text: lang === 'ar' ? `لا توجد عروض مطابقة (${tlabel}${capTxt}). جرّب نطاقاً أو نوعاً مختلفاً.` : `No matching listings for ${tlabel}${capTxt}. Try a different range or type.` }
    const prices = rows.map((r) => r.value)
    const mn = Math.min(...prices), mx = Math.max(...prices)
    const cheapest = rows.reduce((a, b) => (a.value <= b.value ? a : b))
    const cArea = allAreaName(cheapest.area)
    const intro = lang === 'ar'
      ? `إليك ${rows.length} عرضاً لـ${tlabel}${inArea}${capTxt} من Bayut وDubizzle وProperty Finder. تتراوح الأسعار من ${t.cur} ${money(mn)} إلى ${t.cur} ${money(mx)}، وأرخصها نحو ${t.cur} ${money(cheapest.value)} في ${cArea}. مرّر البطاقات يميناً/يساراً واضغط «فتح» لعرض الإعلان الأصلي.`
      : `Here are ${rows.length} ${String(tlabel).toLowerCase()} listings${inArea}${capTxt} from Bayut, Dubizzle and Property Finder. Prices range from ${t.cur} ${money(mn)} to ${t.cur} ${money(mx)}, with the most affordable around ${t.cur} ${money(cheapest.value)} in ${cArea}. Scroll the cards left or right and tap Open to view the original ad.`
    return {
      cards: rows, comm, intro,
      title: `${tlabel}${capTxt}${inArea}`,
      sub: lang === 'ar' ? `${rows.length} عرض من Bayut · Dubizzle · Property Finder — مرّر يميناً/يساراً` : `${rows.length} listings from Bayut · Dubizzle · Property Finder — scroll left/right`,
    }
  }

  const speak = (txt) => {
    if (muted || !window.speechSynthesis || !txt) return
    try { const u = new SpeechSynthesisUtterance(txt); u.lang = lang === 'ar' ? 'ar-AE' : 'en-US'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u) } catch (e) { /* ignore */ }
  }

  // both datasets so follow-ups stay on-topic regardless of the Land/Commercial toggle
  const buildContext = () => {
    const land = (data?.areas || []).map((a) =>
      `${a.en} | rent ${Math.round((a.vavg || 0) * 0.065)} AED/yr | ${a.ppsf} AED/sqft | ${a.n} plots | trend ${a.trend >= 0 ? '+' : ''}${a.trend}%`)
    const comm = (data?.commercial?.areas || []).map((a) => {
      const r = a.rent || {}
      return `${a.en} | rent ${r.avg || 0} AED/yr | ${r.ppsf || 0} AED/sqft | ${r.n || 0} units | trend ${a.trend >= 0 ? '+' : ''}${a.trend}%`
    })
    return [
      `When the user says "these", "it", "that", or "them", they mean the most recent thing discussed in the conversation — resolve it from the chat history, NOT from a default. Only if a question has no prior context, assume the ${isCommercial ? 'COMMERCIAL UNITS' : 'LAND'} section. Use whichever dataset below fits.`,
      '',
      'LAND PLOTS (annual rent = land sale value × 5–8% yield, default 6.5%):',
      land.join('\n') || '(none)',
      '',
      'COMMERCIAL UNITS (real annual MARKET RENT; types: office, shop, warehouse, showroom, building, villa, floor, labour accommodation, factory):',
      comm.join('\n') || '(none)',
    ].join('\n')
  }

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q) return
    setInput('')
    setChips(nextChips(q)) // chips follow the conversation
    // short conversation memory (prior turns) for multi-turn context
    const history = (msgs || []).filter((m) => !m.pending).slice(-8).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      text: m.text || m.title || m.card?.title || m.card?.area || '',
    })).filter((h) => h.text)

    // listing-browse intent → written intro + scrollable carousel of real listings
    const lc = listingQuery(q)
    if (lc) {
      if (lc.cards) {
        setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: lc.intro }, { role: 'bot', cards: lc.cards, comm: lc.comm, title: lc.title, sub: lc.sub }])
        speak(lc.intro)
      } else {
        setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: lc.text }])
        speak(lc.text)
      }
      return
    }
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: t.asstThinking, pending: true }])
    let final
    try {
      const ans = await askGemini({ question: q, context: buildContext(), lang, history }) // Gemini with memory
      final = { role: 'bot', text: ans }
    } catch {
      final = { role: 'bot', ...answer(q) } // no key / offline → instant data cards
    }
    setMsgs((m) => {
      const c = [...m]
      for (let i = c.length - 1; i >= 0; i--) if (c[i].pending) { c[i] = final; return c }
      c.push(final); return c
    })
    speak(final.text || final.card?.area || '')
  }

  const mic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setMsgs((m) => [...m, { role: 'bot', text: t.asstUnsupported }]); return }
    if (listening) { recog.current?.stop(); return }
    const r = new SR(); recog.current = r
    r.lang = lang === 'ar' ? 'ar-AE' : 'en-US'; r.interimResults = false
    r.onstart = () => setListening(true)
    r.onend = () => setListening(false)
    r.onerror = () => { setListening(false); setMsgs((m) => [...m, { role: 'bot', text: t.asstMicDenied || t.asstUnsupported }]) }
    r.onresult = (e) => { const txt = e.results[0][0].transcript; setInput(txt); send(txt) }
    r.start()
  }

  const goArea = (k) => { setArea(k); setType('all'); nav('/') }

  const Card = ({ c }) => (
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
        : c.toOverview ? <button className="ac-act" onClick={() => nav('/')}>{lang === 'ar' ? 'فتح اللوحة' : 'Open dashboard'} →</button> : null}
    </div>
  )

  return (
    <div className="card asst">
      <div className="asst-head">
        <div className="asst-orb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 0-7 7v3a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7z" /><path d="M9 13a3 3 0 0 0 6 0" /></svg></div>
        <div><h3>{t.asstTitle}</h3><p>{t.asstSub}</p></div>
        <div className={'asst-status' + (listening ? ' live' : '')}><i />{listening ? t.asstListening : t.asstReady}</div>
        <button className={'mute-btn' + (muted ? ' muted' : '')} onClick={() => { setMuted((m) => !m); window.speechSynthesis?.cancel() }} title={muted ? t.unmute : t.mute}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4z" />{muted ? <path d="m23 9-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}</svg>
        </button>
      </div>
      <div className="conv" ref={convRef}>
        {msgs.map((m, i) => (
          <div className={'msg ' + m.role + ((m.card || m.cards) ? ' is-card' : '')} key={i}>
            {m.cards
              ? <ListingCarousel title={m.title} sub={m.sub} items={m.cards} comm={m.comm} lang={lang} t={t} areaName={allAreaName} onOpen={openAd} />
              : m.card ? <Card c={m.card} /> : m.text}
          </div>
        ))}
      </div>
      <div className="suggs">
        {(chips.length ? chips : defaultChips()).map((s, i) => <button className="sugg" key={i} onClick={() => send(s)}>{s}</button>)}
      </div>
      <div className="asst-input">
        <button className={'mic-btn' + (listening ? ' listening' : '')} onClick={mic} title="Speak"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" /></svg></button>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder={lang === 'ar' ? 'اكتب سؤالك…' : 'Type your question…'} />
        <button className="send-btn" onClick={() => send()} title="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg></button>
      </div>
    </div>
  )
}
