import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, statsFor, areaAvgRent } from '../lib/store'
import { T, TYPES } from '../lib/i18n'
import { fmt, money } from '../lib/format'
import { askGemini } from '../lib/ai'

export default function Assistant() {
  const { data, lang, yld, setArea, setType } = useStore()
  const t = T[lang]
  const nav = useNavigate()
  const [msgs, setMsgs] = useState([{ role: 'bot', text: t.asstWelcome }])
  const [input, setInput] = useState('')
  const [muted, setMuted] = useState(false)
  const [listening, setListening] = useState(false)
  const convRef = useRef(null)
  const recog = useRef(null)
  const nm = (a) => (lang === 'ar' ? a.ar : a.en)

  useEffect(() => { if (convRef.current) convRef.current.scrollTop = convRef.current.scrollHeight }, [msgs])

  const rankByRent = (typeKey) =>
    data.areas.map((a) => ({ a, rent: areaAvgRent(a, typeKey, yld) })).filter((x) => x.rent > 0).sort((x, y) => y.rent - x.rent)

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
          { l: lang === 'ar' ? 'القطع' : 'Plots', v: fmt(s.n) },
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
    return {
      card: {
        title: typeKey === 'all' ? (lang === 'ar' ? 'سوق أراضي عجمان' : 'Ajman land market') : TYPES[typeKey][lang] + (lang === 'ar' ? ' — السوق' : ' market'),
        area: lang === 'ar' ? 'كل عجمان' : 'All of Ajman', rent: medRent, toOverview: true,
        cells: [
          { l: lang === 'ar' ? 'المناطق' : 'Areas', v: fmt(ranked.length) },
          { l: lang === 'ar' ? 'إجمالي القطع' : 'Total plots', v: fmt(data.kpis.sale) },
          { l: lang === 'ar' ? 'الأرخص' : 'Cheapest', v: nm(cheapest) },
          { l: lang === 'ar' ? 'الأعلى' : 'Most expensive', v: nm(priciest) },
        ],
        note: (lang === 'ar' ? `متوسط سعر القدم ${fmt(data.kpis.median_ppsf)} د.إ · الإيجار = القيمة × عائد 5–8٪` : `Median ${fmt(data.kpis.median_ppsf)} AED/sqft · rent = value × 5–8% yield`),
      },
    }
  }

  const topCard = (typeKey) => {
    const ranked = rankByRent(typeKey).slice(0, 5)
    return {
      card: {
        title: (lang === 'ar' ? 'أعلى المناطق إيجاراً' : 'Top areas by rent') + (typeKey !== 'all' ? ' · ' + TYPES[typeKey][lang] : ''),
        list: ranked.map((x) => ({ key: x.a.key, name: nm(x.a), rent: x.rent })),
      },
    }
  }

  const yieldCard = () => ({
    card: {
      title: lang === 'ar' ? 'كيف يُحسب الإيجار' : 'How rent is calculated',
      cells: [
        { l: lang === 'ar' ? 'نطاق العائد' : 'Yield band', v: '5–8%' },
        { l: lang === 'ar' ? 'الافتراضي' : 'Default', v: '6.5%' },
        { l: lang === 'ar' ? 'متوسط سعر القدم' : 'Median AED/sqft', v: fmt(data.kpis.median_ppsf) },
        { l: lang === 'ar' ? 'المناطق' : 'Areas', v: fmt(data.areas.length) },
      ],
      note: lang === 'ar' ? 'إيجار الأرض السنوي = سعر بيع الأرض × العائد. أسعار البيع حقيقية من Bayut وDubizzle وProperty Finder.' : 'Annual land rent = land sale value × yield. Sale prices are real, from Bayut, Dubizzle & Property Finder.',
      toOverview: true,
    },
  })

  function answer(text) {
    const s = text.toLowerCase()
    const typeKey = /industrial|صناعي/.test(s) ? 'industrial' : /residential|سكني/.test(s) ? 'residential'
      : /commercial|تجاري/.test(s) ? 'commercial' : /mixed|متعدد/.test(s) ? 'mixed' : 'all'
    const tname = typeKey === 'all' ? (lang === 'ar' ? 'الأراضي' : 'land') : TYPES[typeKey][lang]
    let areaHit = data.areas.find((a) => s.includes(a.en.toLowerCase()) || (a.ar && text.includes(a.ar)))
    if (!areaHit) areaHit = data.areas.find((a) => {
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
            { l: lang === 'ar' ? 'القطع' : 'Plots', v: fmt(areaHit.n) },
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

  const speak = (txt) => {
    if (muted || !window.speechSynthesis || !txt) return
    try { const u = new SpeechSynthesisUtterance(txt); u.lang = lang === 'ar' ? 'ar-AE' : 'en-US'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u) } catch (e) { /* ignore */ }
  }

  const buildContext = () => data.areas.map((a) => {
    const s = statsFor(a, 'all', yld)
    return `${a.en} | rent ${Math.round(s.avg)} AED/yr | ${a.ppsf} AED/sqft | ${a.n} plots | trend ${a.trend >= 0 ? '+' : ''}${a.trend}%`
  }).join('\n')

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q) return
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: t.asstThinking, pending: true }])
    let final
    try {
      const ans = await askGemini({ question: q, context: buildContext(), lang }) // real Gemini AI
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
          <div className={'msg ' + m.role + (m.card ? ' is-card' : '')} key={i}>
            {m.card ? <Card c={m.card} /> : m.text}
          </div>
        ))}
      </div>
      <div className="suggs">
        {[t.sugg1, t.sugg2, t.sugg3, t.sugg4].map((s, i) => <button className="sugg" key={i} onClick={() => send(s)}>{s}</button>)}
      </div>
      <div className="asst-input">
        <button className={'mic-btn' + (listening ? ' listening' : '')} onClick={mic} title="Speak"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" /></svg></button>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder={lang === 'ar' ? 'اكتب سؤالك…' : 'Type your question…'} />
        <button className="send-btn" onClick={() => send()} title="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg></button>
      </div>
    </div>
  )
}
