import { useStore } from '../lib/store'
import { T } from '../lib/i18n'

// Always-visible line explaining how the figures on the current view are calculated:
// commercial units = live market rent from real listings; land = sale price with a 5 to 8% yield.
// If the selected area has no listings of its own, we show its parent area's figures and
// say so plainly (the portals often list only the parent name, without the sub-area number).
export default function BasisNote({ style }) {
  const { lang, isCommercial, areas, area } = useStore()
  const t = T[lang]
  const a = (areas || []).find((x) => x.key === area)
  const parent = a && a.fromParent
  return (
    <>
      {parent && (
        <div className="basis-note parent" style={style}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
          <span>{lang === 'ar'
            ? `الأرقام المعروضة لمنطقة ${parent} كاملة. المواقع العقارية لا تفصل الأرقام الفرعية لهذه المنطقة.`
            : `Figures shown are for ${parent} as a whole. The property portals do not split this area by number.`}</span>
        </div>
      )}
      <div className="basis-note" style={style}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        <span>{isCommercial ? t.marketRentNote : t.officialData}</span>
      </div>
    </>
  )
}
