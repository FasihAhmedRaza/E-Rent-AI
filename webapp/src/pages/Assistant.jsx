import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, areaAvgRent, statsFor } from '../lib/store'
import { T, TYPES } from '../lib/i18n'
import { fmt } from '../lib/format'

// ---- helpers (mirror the prototype's normName / parseQuery / answerFor) ----
const normName = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/^al\s+/, '')
    .replace(/[0-9٠-٩]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const stripTags = (s) => (s || '').replace(/<[^>]+>/g, '')

export default function Assistant() {
  const { data, lang, area, setArea, type, setType, yld } = useStore()
  const t = T[lang]

  const [messages, setMessages] = useState([]) // {id, who:'user'|'bot', text}
  const [input, setInput] = useState('')
  const [status, setStatus] = useState('ready') // 'ready'|'listening'|'thinking'
  const [listening, setListening] = useState(false)
  const [muted, setMuted] = useState(false)
  const [voiceUnsupported, setVoiceUnsupported] = useState(false)

  const convRef = useRef(null)
  const recogRef = useRef(null)
  const mutedRef = useRef(false)
  const warnedNoArRef = useRef(false)
  const idRef = useRef(0)
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

  useEffect(() => { mutedRef.current = muted }, [muted])

  const nextId = () => ++idRef.current

  // ---- speech synthesis ----
  const pickVoice = useCallback(() => {
    if (!synth) return null
    const voices = synth.getVoices() || []
    const want = lang === 'ar' ? 'ar' : 'en'
    const exact = lang === 'ar' ? 'ar-sa' : 'en-us'
    let v = voices.find((x) => x.lang && x.lang.toLowerCase().replace('_', '-') === exact)
    if (!v) v = voices.find((x) => x.lang && x.lang.toLowerCase().replace('_', '-').startsWith(want))
    return v || null
  }, [synth, lang])

  const doSpeak = useCallback((text) => {
    if (!synth || !text) return
    const v = pickVoice()
    if (lang === 'ar' && !v && !warnedNoArRef.current) {
      warnedNoArRef.current = true
      addBot(T[lang].asstNoArVoice)
    }
    try {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
      if (v) u.voice = v
      u.rate = 1; u.pitch = 1
      if (synth.speaking || synth.pending) {
        synth.cancel()
        setTimeout(() => { try { synth.speak(u) } catch (e) { /* noop */ } }, 90)
      } else {
        synth.speak(u)
      }
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synth, lang, pickVoice])

  const speak = useCallback((text) => {
    if (mutedRef.current) return
    doSpeak(text)
  }, [doSpeak])

  const speakNow = useCallback((text) => {
    if (mutedRef.current) { setMuted(false); mutedRef.current = false }
    doSpeak(text)
  }, [doSpeak])

  // ---- message helpers ----
  const pushMsg = (who, text) => {
    setMessages((prev) => [...prev, { id: nextId(), who, text }])
  }
  // addBot used inside callbacks; keep a stable ref-free wrapper
  function addBot(text) { pushMsg('bot', text) }

  // scroll conversation to bottom on new messages
  useEffect(() => {
    const el = convRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // ---- (re)initialise welcome message when language changes ----
  useEffect(() => {
    warnedNoArRef.current = false
    idRef.current = 0
    setMessages([{ id: nextId(), who: 'bot', text: T[lang].asstWelcome }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // ---- detect Web Speech API support ----
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    setVoiceUnsupported(!SR)
  }, [])

  // ---- query parsing & answering (rule/intent based, real numbers) ----
  const parseQuery = (q) => {
    if (!data) return { area: null, type: null, intent: 'summary' }
    const ql = q.toLowerCase()
    let aKey = null, tKey = null, intent = 'summary'
    // exact area name match (EN or AR)
    for (const a of data.areas) {
      if (ql.includes(a.en.toLowerCase()) || q.includes(a.ar)) { aKey = a.key; break }
    }
    // fuzzy area match (drop "Al ", numbers)
    if (!aKey) {
      for (const a of data.areas) {
        const bn = normName(a.en), ba = normName(a.ar)
        if ((bn.length > 2 && ql.includes(bn)) || (ba.length > 1 && q.includes(ba))) { aKey = a.key; break }
      }
    }
    // type match (EN label, AR label, or English keyword stem)
    for (const tk of Object.keys(TYPES)) {
      const ty = TYPES[tk]
      if (ql.includes(ty.en.toLowerCase()) || q.includes(ty.ar) || ql.includes(tk)) { tKey = tk; break }
    }
    if (/cheap|lowest|أرخص|أقل|affordable|best value/.test(ql)) intent = 'cheapest'
    else if (/highest|expensive|أعلى|أغلى|most/.test(ql)) intent = 'highest'
    else if (/compare|comparison|قارن|مقارنة|vs|versus/.test(ql)) intent = 'compare'
    else if (/how many|count|number of|عدد|كم/.test(ql)) intent = 'count'
    return { area: aKey, type: tKey, intent }
  }

  const findArea = (key) => data.areas.find((a) => a.key === key) || data.areas[0]
  const typeLabel = (tk) => (tk === 'all' ? t.allTypes : (TYPES[tk] ? TYPES[tk][lang] : t.allTypes))

  const answerFor = (q) => {
    const p = parseQuery(q)
    const effType = p.type || (type !== 'all' ? type : 'all')
    // sync the global selectors so the rest of the app follows along
    if (p.area) setArea(p.area)
    if (p.type) setType(p.type)

    // rank all areas by average annual rent for the effective type
    const ranked = data.areas
      .map((a) => ({ a, v: areaAvgRent(a, effType, yld) }))
      .filter((r) => r.v > 0)
      .sort((x, y) => x.v - y.v)
    const ajmanAvg = ranked.length ? Math.round(ranked.reduce((s, r) => s + r.v, 0) / ranked.length) : 0

    const ql = q.toLowerCase()
    const priceish = /rent|price|sqft|rate|value|سعر|أسعار|إيجار|إيجارات|قيمة/.test(ql)
    const matched = p.area || p.type || p.intent !== 'summary' || priceish

    let ans
    if (!matched) return t.asstNoMatch

    if (p.intent === 'cheapest' && ranked.length) {
      const c = ranked[0]
      setArea(c.a.key)
      ans = lang === 'ar'
        ? `أرخص منطقة لـ${typeLabel(effType)} هي <b>${c.a.ar}</b> بمتوسط إيجار <b>${fmt(c.v)} درهم</b> سنوياً.`
        : `The most affordable area for ${typeLabel(effType)} is <b>${c.a.en}</b>, averaging <b>${fmt(c.v)} AED</b> per year.`
    } else if (p.intent === 'highest' && ranked.length) {
      const c = ranked[ranked.length - 1]
      setArea(c.a.key)
      ans = lang === 'ar'
        ? `أعلى منطقة لـ${typeLabel(effType)} هي <b>${c.a.ar}</b> بمتوسط <b>${fmt(c.v)} درهم</b> سنوياً.`
        : `The most expensive area for ${typeLabel(effType)} is <b>${c.a.en}</b>, averaging <b>${fmt(c.v)} AED</b> per year.`
    } else if (p.intent === 'compare') {
      const a = findArea(p.area || area)
      const av = areaAvgRent(a, effType, yld)
      const diff = ajmanAvg ? Math.round(((av - ajmanAvg) / ajmanAvg) * 100) : 0
      ans = lang === 'ar'
        ? `متوسط ${typeLabel(effType)} في <b>${a.ar}</b> هو <b>${fmt(av)} درهم</b>، أي ${Math.abs(diff)}% ${diff >= 0 ? 'أعلى' : 'أقل'} من متوسط عجمان (${fmt(ajmanAvg)} درهم).`
        : `In <b>${a.en}</b>, ${typeLabel(effType)} averages <b>${fmt(av)} AED</b> — ${Math.abs(diff)}% ${diff >= 0 ? 'above' : 'below'} the Ajman average of ${fmt(ajmanAvg)} AED.`
    } else if (p.intent === 'count') {
      const a = findArea(p.area || area)
      const s = statsFor(a, effType, yld)
      const n = s ? s.n : 0
      ans = lang === 'ar'
        ? `يوجد حوالي <b>${fmt(n)}</b> ${t.asstPlots} لـ${typeLabel(effType)} في <b>${a.ar}</b>.`
        : `There are about <b>${fmt(n)}</b> ${typeLabel(effType)} ${t.asstPlots} in <b>${a.en}</b>.`
    } else {
      // summary: rent range for the (named or selected) area & type
      const a = findArea(p.area || area)
      const s = statsFor(a, effType, yld)
      if (!s) return t.asstNoMatch
      ans = lang === 'ar'
        ? `في <b>${a.ar}</b>، يتراوح إيجار ${typeLabel(effType)} من <b>${fmt(s.low)}</b> إلى <b>${fmt(s.high)} درهم</b> سنوياً، بمتوسط <b>${fmt(s.avg)}</b>، عبر ${fmt(s.n)} ${t.asstPlots}.`
        : `In <b>${a.en}</b>, ${typeLabel(effType)} ranges from <b>${fmt(s.low)}</b> to <b>${fmt(s.high)} AED</b>/year, averaging <b>${fmt(s.avg)}</b>, across ${fmt(s.n)} listings.`
    }
    return ans
  }

  const sendQuery = (q) => {
    if (!q || !q.trim()) return
    pushMsg('user', q)
    setInput('')
    setStatus('thinking')
    setTimeout(() => {
      let ans
      try {
        ans = data ? answerFor(q) : t.asstError
      } catch (e) {
        ans = t.asstError
      }
      if (!ans) ans = t.asstNoMatch
      pushMsg('bot', ans)
      try { speak(stripTags(ans)) } catch (e) { /* noop */ }
      setStatus('ready')
    }, 420)
  }

  // ---- voice input ----
  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { pushMsg('bot', t.asstUnsupported); return }
    if (listening && recogRef.current) { try { recogRef.current.stop() } catch (e) { /* noop */ } return }
    const recog = new SR()
    recog.lang = lang === 'ar' ? 'ar-AE' : 'en-US'
    recog.interimResults = false
    recog.maxAlternatives = 1
    let transcript = ''
    recog.onstart = () => { setListening(true); setStatus('listening') }
    recog.onresult = (e) => { transcript = e.results[0][0].transcript; setInput(transcript) }
    recog.onerror = (e) => {
      setListening(false); setStatus('ready')
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') pushMsg('bot', t.asstMicDenied)
    }
    recog.onend = () => {
      setListening(false); setStatus('ready')
      if (transcript && transcript.trim()) sendQuery(transcript)
    }
    recogRef.current = recog
    try { recog.start() } catch (e) { /* noop */ }
  }

  const toggleMute = () => {
    setMuted((m) => {
      const nv = !m
      if (nv && synth) { try { synth.cancel() } catch (e) { /* noop */ } }
      return nv
    })
  }

  const onKeyDown = (e) => { if (e.key === 'Enter') sendQuery(input) }

  const statusTxt = status === 'listening' ? t.asstListening : status === 'thinking' ? t.asstThinking : t.asstReady
  const suggs = [t.sugg1, t.sugg2, t.sugg3, t.sugg4]

  const MicIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
    </svg>
  )
  const SendIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
  const VolOn = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
    </svg>
  )
  const VolOff = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M22 9l-6 6M16 9l6 6" />
    </svg>
  )

  return (
    <section className="view active" id="v-assistant">
      <div className="card asst">
        <div className="asst-head">
          <div className="asst-orb">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a7 7 0 0 0-7 7v3a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7z" />
              <path d="M9 9h.01M15 9h.01M9 13a3 3 0 0 0 6 0" />
            </svg>
          </div>
          <div>
            <h3>{t.asstTitle}</h3>
            <p>{t.asstSub}</p>
          </div>
          <div className={'asst-status' + (status !== 'ready' ? ' live' : '')}>
            <i></i><span>{statusTxt}</span>
          </div>
          <button
            className={'mute-btn' + (muted ? ' muted' : '')}
            title={muted ? t.unmute : t.mute}
            onClick={toggleMute}
            type="button"
          >
            {muted ? VolOff : VolOn}
          </button>
        </div>

        <div className="conv" ref={convRef}>
          {messages.map((m) => (
            <div key={m.id} className={'msg ' + m.who}>
              {m.who === 'bot' ? (
                <>
                  <span dangerouslySetInnerHTML={{ __html: m.text }} />
                  <span className="mspeak" onClick={() => speakNow(stripTags(m.text))}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    </svg>
                    {t.listen}
                  </span>
                </>
              ) : (
                m.text
              )}
            </div>
          ))}
        </div>

        <div className="suggs">
          {suggs.map((s, i) => (
            <button key={i} className="sugg" type="button" onClick={() => sendQuery(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="asst-input">
          <button
            className={'mic-btn' + (listening ? ' listening' : '')}
            title={t.asstSub}
            onClick={toggleMic}
            type="button"
          >
            {MicIcon}
          </button>
          <input
            type="text"
            value={input}
            placeholder={t.searchPh}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button className="send-btn" title="Send" onClick={() => sendQuery(input)} type="button">
            {SendIcon}
          </button>
        </div>

        {voiceUnsupported && (
          <div className="suggs" style={{ paddingTop: 0 }}>
            <span style={{ fontSize: '.74rem', color: 'var(--muted)' }}>{t.asstUnsupported}</span>
          </div>
        )}
      </div>
    </section>
  )
}
