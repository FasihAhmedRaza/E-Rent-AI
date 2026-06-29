import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore, statsFor, areaAvgRent } from './store'
import { T, TYPES, TYPES_COMMERCIAL } from './i18n'
import { fmt, money } from './format'
import { askGemini } from './ai'

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

const Ctx = createContext(null)
export const useAssistant = () => useContext(Ctx)

export function AssistantProvider({ children }) {
  const { data, areas, listings, kpis, lang, yld, isCommercial, setArea, setType } = useStore()
  const t = T[lang]
  const nav = useNavigate()
  const loc = useLocation()

  const [msgs, setMsgs] = useState([{ role: 'bot', text: t.asstWelcome }])
  const [input, setInput] = useState('')
  const [muted, setMuted] = useState(false)
  const [listening, setListening] = useState(false)
  const [chips, setChips] = useState([])
  const [busy, setBusy] = useState(false)
  const [widgetOpen, setWidgetOpen] = useState(false)
  const recog = useRef(null)
  const nm = (a) => (lang === 'ar' ? a.ar : a.en)

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
    return marketCard('all')
  }

  const openAd = (l) => { if (l && l.url) window.open(l.url, '_blank', 'noopener,noreferrer') }
  const allAreaName = (k) => {
    const src = (data?.areas || []).concat(data?.commercial?.areas || [])
    const a = src.find((x) => x.key === k)
    return a ? (lang === 'ar' ? a.ar : a.en) : k
  }

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
    return { cards: rows, comm, intro, title: `${tlabel}${capTxt}${inArea}`, sub: lang === 'ar' ? `${rows.length} عرض من Bayut · Dubizzle · Property Finder — مرّر يميناً/يساراً` : `${rows.length} listings from Bayut · Dubizzle · Property Finder — scroll left/right` }
  }

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

  // ---- voice ----
  const speak = (txt) => {
    if (muted || !window.speechSynthesis || !txt) return
    try { const u = new SpeechSynthesisUtterance(txt); u.lang = lang === 'ar' ? 'ar-AE' : 'en-US'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u) } catch (e) { /* ignore */ }
  }
  const stopVoice = () => {
    try { window.speechSynthesis && window.speechSynthesis.cancel() } catch (e) { /* ignore */ }
    try { recog.current && recog.current.stop() } catch (e) { /* ignore */ }
    setListening(false)
  }

  // stop any speech/recognition on unmount + page refresh/close (fixes voice running in background)
  useEffect(() => {
    try { window.speechSynthesis && window.speechSynthesis.cancel() } catch (e) { /* ignore */ }
    const onHide = () => {
      try { window.speechSynthesis && window.speechSynthesis.cancel() } catch (e) { /* ignore */ }
      try { recog.current && recog.current.stop() } catch (e) { /* ignore */ }
    }
    const onVis = () => { if (document.hidden) onHide() }
    window.addEventListener('pagehide', onHide) // pagehide covers refresh/close (unload is blocked by Permissions-Policy)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      onHide()
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  // stop voice when navigating between pages
  useEffect(() => { stopVoice() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [loc.pathname])
  // chips reset to category defaults
  useEffect(() => { setChips(defaultChips()) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isCommercial, lang])

  // opts.voice = the query came from the mic → speak the reply. Typed/chip queries stay silent.
  const send = async (text, opts = {}) => {
    const q = (text ?? input).trim()
    if (!q || busy) return
    setInput('')
    setChips(nextChips(q))
    const history = msgs.filter((m) => !m.pending).slice(-8).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      text: m.text || m.title || m.card?.title || m.card?.area || '',
    })).filter((h) => h.text)

    const lc = listingQuery(q)
    if (lc) {
      if (lc.cards) {
        setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: lc.intro }, { role: 'bot', cards: lc.cards, comm: lc.comm, title: lc.title, sub: lc.sub }])
        if (opts.voice) speak(lc.intro)
      } else {
        setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: lc.text }])
        if (opts.voice) speak(lc.text)
      }
      return
    }
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: t.asstThinking, pending: true }])
    setBusy(true)
    let final
    try {
      const ans = await askGemini({ question: q, context: buildContext(), lang, history })
      final = { role: 'bot', text: ans }
    } catch {
      final = { role: 'bot', ...answer(q) }
    }
    setBusy(false)
    setMsgs((m) => {
      const c = [...m]
      for (let i = c.length - 1; i >= 0; i--) if (c[i].pending) { c[i] = final; return c }
      c.push(final); return c
    })
    if (opts.voice) speak(final.text || final.card?.area || '')
  }

  const mic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setMsgs((m) => [...m, { role: 'bot', text: t.asstUnsupported }]); return }
    if (listening) { try { recog.current && recog.current.stop() } catch (e) { /* ignore */ } return }
    const r = new SR(); recog.current = r
    r.lang = lang === 'ar' ? 'ar-AE' : 'en-US'; r.interimResults = false
    r.onstart = () => setListening(true)
    r.onend = () => setListening(false)
    r.onerror = () => { setListening(false); setMsgs((m) => [...m, { role: 'bot', text: t.asstMicDenied || t.asstUnsupported }]) }
    r.onresult = (e) => { const txt = e.results[0][0].transcript; setInput(txt); send(txt, { voice: true }) }
    r.start()
  }

  const goArea = (k) => { if (k) { setArea(k); setType('all') } setWidgetOpen(false); nav('/') }
  const toFullPage = () => { setWidgetOpen(false); nav('/assistant') }
  const toggleMute = () => { setMuted((m) => !m); try { window.speechSynthesis && window.speechSynthesis.cancel() } catch (e) { /* ignore */ } }
  const clearChat = () => { stopVoice(); setMsgs([{ role: 'bot', text: isCommercial ? (t.asstWelcomeC || t.asstWelcome) : t.asstWelcome }]); setChips(defaultChips()) }

  return (
    <Ctx.Provider value={{
      msgs, input, setInput, chips, defaultChips, send, mic, listening, muted, toggleMute, busy,
      goArea, openAd, allAreaName, stopVoice, clearChat, toFullPage,
      lang, t, isCommercial, widgetOpen, setWidgetOpen,
    }}>
      {children}
    </Ctx.Provider>
  )
}
