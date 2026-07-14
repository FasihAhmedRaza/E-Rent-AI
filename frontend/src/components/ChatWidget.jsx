import { useLocation } from 'react-router-dom'
import { useAssistant } from '../lib/assistant'
import Conversation from './Conversation'
import ChatComposer from './ChatComposer'
import Mark from './Mark'

export default function ChatWidget() {
  const { widgetOpen, setWidgetOpen, toFullPage, t, lang, listening, busy } = useAssistant()
  const { pathname } = useLocation()
  if (pathname === '/assistant') return null // full page already shows the assistant

  const status = listening ? t.asstListening : busy ? t.asstThinking : t.asstReady

  return (
    <>
      <button className={'chat-fab' + (widgetOpen ? ' open' : '')} onClick={() => setWidgetOpen((o) => !o)} title={t.asstTitle} type="button">
        {widgetOpen
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 0-7 7v3a7 7 0 0 0 14 0V9a7 7 0 0 0-7-7z" /><path d="M9 13a3 3 0 0 0 6 0" /></svg>}
      </button>

      {widgetOpen && (
        <div className="chat-pop" dir={t.dir}>
          <div className="cw-head">
            <div className="asst-orb sm"><Mark /></div>
            <div className="cw-id">
              <b>{lang === 'ar' ? 'مساعد التقييم الذكي' : 'Valuation Assistant'}</b>
              <span className={listening || busy ? 'live' : ''}>{status}</span>
            </div>
            <button className="cw-ico" onClick={toFullPage} title={lang === 'ar' ? 'فتح الصفحة الكاملة' : 'Open full page'} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M21 3l-9 9M9 21H3v-6M3 21l9-9" /></svg>
            </button>
            <button className="cw-ico" onClick={() => setWidgetOpen(false)} title={lang === 'ar' ? 'إغلاق' : 'Close'} type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <Conversation />
          <ChatComposer compact />
        </div>
      )}
    </>
  )
}
