import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, statsFor, areaAvgRent } from '../lib/store'
import { T, TYPES } from '../lib/i18n'
import { fmt, money } from '../lib/format'

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

  useEffect(() => { if (convRef.current) convRef.current.scrollTop = convRef.current.scrollHeight }, [msgs])

  const rankByRent = (typeKey) =>
    data.areas.map((a) => ({ a, rent: areaAvgRent(a, typeKey, yld) })).filter((x) => x.rent > 0).sort((x, y) => y.rent - x.rent)

  const areaCard = (a, typeKey, title) => {
    const s = statsFor(a, typeKey, yld) || statsFor(a, 'all', yld)
    const ranked = rankByRent('all')
    const rank = ranked.findIndex((x) => x.a.key === a.key) + 1
    return {
      card: {
        title, area: lang === 'ar' ? a.ar : a.en, rent: s.avg, areaKey: a.key,
        cells: [
          { l: lang === 'ar' ? 'سعر القدم' : 'Price/sqft', v: fmt(s.ppsf) + ' ' + t.cur },
          { l: lang === 'ar' ? 'النطاق' : 'Range', v: money(s.low) + '–' + money(s.high) },
          { l: lang === 'ar' ? 'القطع' : 'Plots', v: fmt(s.n) },
          { l: lang === 'ar' ? 'الترتيب' : 'Rank', v: '#' + rank + ' / ' + ranked.length },
        ],
      },
    }
  }

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
    const ranked = rankByRent(typeKey)
    if (!ranked.length) return { text: t.asstNoMatch }
    if (/cheap|lowest|أرخص|أقل/.test(s)) return areaCard(ranked[ranked.length - 1].a, typeKey, (lang === 'ar' ? 'الأرخص · ' : 'Cheapest · ') + tname)
    if (/expensive|highest|priciest|أعلى|أغلى|اغلى/.test(s)) return areaCard(ranked[0].a, typeKey, (lang === 'ar' ? 'الأعلى · ' : 'Most expensive · ') + tname)
    if (/compare|vs|قارن/.test(s) && areaHit) {
      const avg = Math.round(ranked.reduce((x, y) => x + y.rent, 0) / ranked.length)
      const r = areaAvgRent(areaHit, typeKey, yld)
      const diff = avg ? Math.round((r - avg) / avg * 100) : 0
      return {
        card: {
          title: lang === 'ar' ? 'مقارنة بمتوسط عجمان' : 'vs Ajman average', area: lang === 'ar' ? areaHit.ar : areaHit.en, rent: r, areaKey: areaHit.key,
          cells: [
            { l: lang === 'ar' ? 'متوسط عجمان' : 'Ajman avg', v: t.cur + ' ' + money(avg) },
            { l: lang === 'ar' ? 'الفرق' : 'Difference', v: (diff >= 0 ? '+' : '') + diff + '%' },
            { l: lang === 'ar' ? 'سعر القدم' : 'Price/sqft', v: fmt(areaHit.ppsf) + ' ' + t.cur },
            { l: lang === 'ar' ? 'القطع' : 'Plots', v: fmt(areaHit.n) },
          ],
        },
      }
    }
    if (areaHit) return areaCard(areaHit, typeKey, lang === 'ar' ? areaHit.ar : areaHit.en)
    if (/top|rank|أعلى الإيجارات/.test(s)) return areaCard(ranked[0].a, typeKey, lang === 'ar' ? 'الأعلى إيجاراً' : 'Highest rents')
    return { text: t.asstNoMatch }
  }

  const speak = (txt) => {
    if (muted || !window.speechSynthesis || !txt) return
    try { const u = new SpeechSynthesisUtterance(txt); u.lang = lang === 'ar' ? 'ar-AE' : 'en-US'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u) } catch (e) { /* ignore */ }
  }

  const send = (text) => {
    const q = (text ?? input).trim()
    if (!q) return
    setInput('')
    const a = answer(q)
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', ...a }])
    speak(a.card ? `${a.card.area}. ${t.cur} ${money(a.card.rent)} ${lang === 'ar' ? 'سنوياً' : 'per year'}` : a.text)
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
      <div className="ac-area">{c.area}</div>
      <div className="ac-rent num">{t.cur} {money(c.rent)} <small>/{lang === 'ar' ? 'سنة' : 'yr'} · {lang === 'ar' ? 'متوسط' : 'avg'}</small></div>
      <div className="ac-grid">{c.cells.map((x, i) => <div className="ac-cell" key={i}><span>{x.l}</span><b className="num">{x.v}</b></div>)}</div>
      <button className="ac-act" onClick={() => goArea(c.areaKey)}>{lang === 'ar' ? 'عرض المنطقة' : 'View area'} →</button>
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
