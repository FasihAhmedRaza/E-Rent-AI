import { useStore } from '../lib/store'
import { T, TYPES, TYPES_COMMERCIAL } from '../lib/i18n'

export default function FilterBar() {
  const { areas, kpis, lang, area, setArea, type, setType,
          isCommercial, hasCommercial, setCategory } = useStore()
  const t = T[lang]
  if (!areas || !areas.length) return null

  // commercial: only offer unit types that actually have listings (from kpis.by_type)
  const typeMap = isCommercial ? TYPES_COMMERCIAL : TYPES
  const typeKeys = isCommercial
    ? Object.keys(typeMap).filter((k) => (kpis.by_type || {})[k])
    : Object.keys(typeMap)

  return (
    <div className="filterbar">
      {hasCommercial && (
        <div className="field">
          <label>{t.categoryLbl}</label>
          <div className="seg">
            <button type="button" className={isCommercial ? '' : 'on'} onClick={() => setCategory('land')}>{t.catLand}</button>
            <button type="button" className={isCommercial ? 'on' : ''} onClick={() => setCategory('commercial')}>{t.catCommercial}</button>
          </div>
        </div>
      )}
      <div className="field">
        <label>{t.areaLbl}</label>
        <div className="sel">
          <select value={area || ''} onChange={(e) => setArea(e.target.value)}>
            {areas.map((a) => <option key={a.key} value={a.key}>{lang === 'ar' ? a.ar : a.en}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{isCommercial ? t.typeLblC : t.typeLbl}</label>
        <div className="sel">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">{t.allTypes}</option>
            {typeKeys.map((k) => <option key={k} value={k}>{typeMap[k][lang]}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
