import { useAssistant } from '../lib/assistant'

export default function ChatComposer({ compact }) {
  const { input, setInput, send, mic, listening, busy, chips, defaultChips, lang } = useAssistant()
  const list = chips.length ? chips : defaultChips()

  const submit = () => { if (!busy) send(input) }
  const onKey = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit() }
  }

  return (
    <div className={'composer' + (compact ? ' compact' : '')}>
      <div className="suggs">
        {list.map((s, i) => <button className="sugg" key={i} disabled={busy} onClick={() => !busy && send(s)}>{s}</button>)}
      </div>
      <div className="asst-input">
        <button className={'mic-btn' + (listening ? ' listening' : '')} onClick={mic} title="Speak" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" /></svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={lang === 'ar' ? 'اكتب سؤالك…' : 'Type your question…'}
        />
        <button className="send-btn" onClick={submit} title="Send" type="button" disabled={busy || !input.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
    </div>
  )
}
