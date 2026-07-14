import { useStore } from '../lib/store'
import { T } from '../lib/i18n'

// Always-visible line explaining how the figures on the current view are calculated:
// commercial units = live market rent from real listings; land = sale price with a 5 to 8% yield.
export default function BasisNote({ style }) {
  const { lang, isCommercial } = useStore()
  const t = T[lang]
  return (
    <div className="basis-note" style={style}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
      <span>{isCommercial ? t.marketRentNote : t.officialData}</span>
    </div>
  )
}
