import { useAssistant } from '../lib/assistant'
import Conversation from '../components/Conversation'
import ChatComposer from '../components/ChatComposer'

export default function Assistant() {
  const { t, lang, listening, busy, muted, toggleMute, clearChat, isCommercial } = useAssistant()
  const title = isCommercial ? (lang === 'ar' ? 'مساعد الوحدات التجارية' : 'Commercial AI Assistant') : t.asstTitle
  const status = listening ? t.asstListening : busy ? t.asstThinking : t.asstReady

  return (
    <div className="card asst asst-page">
      <div className="asst-head">
        <div className="asst-orb">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 0-7 7v3a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7z" /><path d="M9 13a3 3 0 0 0 6 0" /></svg>
        </div>
        <div className="asst-id"><h3>{title}</h3><p>{t.asstSub}</p></div>
        <div className={'asst-status' + (listening || busy ? ' live' : '')}><i />{status}</div>
        <button className={'icon-btn' + (muted ? ' on' : '')} onClick={toggleMute} title={muted ? t.unmute : t.mute} type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4z" />{muted ? <path d="m23 9-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}</svg>
        </button>
        <button className="icon-btn" onClick={clearChat} title={lang === 'ar' ? 'محادثة جديدة' : 'New chat'} type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6" /></svg>
        </button>
      </div>
      <Conversation />
      <ChatComposer />
    </div>
  )
}
