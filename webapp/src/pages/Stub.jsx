import { useStore } from '../lib/store'
import { T } from '../lib/i18n'

export default function Stub({ title }) {
  const { lang } = useStore()
  const t = T[lang]
  return (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <div className="sec-h" style={{ justifyContent: 'center' }}>{title}</div>
      <p className="sec-s" style={{ marginBottom: 0 }}>{t.soonTitle} · {t.soonBody}</p>
    </div>
  )
}
