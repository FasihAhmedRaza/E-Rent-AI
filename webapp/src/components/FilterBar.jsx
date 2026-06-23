import { useStore } from '../lib/store'
import { T, TYPES } from '../lib/i18n'

export default function FilterBar() {
  const { data, lang, area, setArea, type, setType } = useStore()
  const t = T[lang]
  if (!data || !data.areas) return null
  return (
    <div className="filterbar">
      <div className="field">
        <label>{t.areaLbl}</label>
        <div className="sel">
          <select value={area || ''} onChange={(e) => setArea(e.target.value)}>
            {data.areas.map((a) => <option key={a.key} value={a.key}>{lang === 'ar' ? a.ar : a.en}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>{t.typeLbl}</label>
        <div className="sel">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">{t.allTypes}</option>
            {Object.keys(TYPES).map((k) => <option key={k} value={k}>{TYPES[k][lang]}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
