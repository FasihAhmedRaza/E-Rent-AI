import { useStore, areaHasData } from '../lib/store'
import { T, TYPES, TYPES_COMMERCIAL } from '../lib/i18n'
import { fmt } from '../lib/format'
import { PICKABLE_TOLS } from '../lib/comparables'

export default function FilterBar() {
  const { areas, kpis, lang, area, setArea, type, setType,
          isCommercial, hasCommercial, setCategory,
          size, setSize, sizeSqft, sizeActive, sizeBand, tolIdx, setTolIdx } = useStore()
  const t = T[lang]
  if (!areas || !areas.length) return null
  const ar = lang === 'ar'

  // commercial: only offer unit types that actually have listings (from kpis.by_type)
  const typeMap = isCommercial ? TYPES_COMMERCIAL : TYPES
  const typeKeys = isCommercial
    ? Object.keys(typeMap).filter((k) => (kpis.by_type || {})[k])
    : Object.keys(typeMap)

  const thing = isCommercial ? (ar ? 'وحدات' : 'units') : (ar ? 'قطع أراضٍ' : 'plots')

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
            {areas.map((a) => {
              const label = ar ? a.ar : a.en
              const empty = !areaHasData(a)
              const why = sizeActive ? t.sizeNoData : (ar ? 'لا بيانات بعد' : 'no data yet')
              return <option key={a.key} value={a.key}>{label}{empty ? ' · ' + why : ''}</option>
            })}
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

      {/* size box: compare only with listings of a similar size */}
      <div className="field size-field">
        <label>{isCommercial ? t.sizeLblC : t.sizeLbl}</label>
        <div className="size-row">
          <div className="size-in">
            <input type="text" inputMode="numeric" autoComplete="off" placeholder={t.sizePh}
              value={size} onChange={(e) => setSize(e.target.value)} />
            <span className="size-unit">{t.sqft}</span>
            {!!size && (
              <button type="button" className="size-clear" title={t.sizeClear}
                aria-label={t.sizeClear} onClick={() => setSize('')}>×</button>
            )}
          </div>
          {sizeActive && (
            <div className="sel tol-sel">
              <select value={tolIdx} title={t.sizeMatch} aria-label={t.sizeMatch}
                onChange={(e) => setTolIdx(Number(e.target.value))}>
                {Array.from({ length: PICKABLE_TOLS }, (_, i) => (
                  <option key={i} value={i}>{t['tol' + i]}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {sizeActive && sizeBand && (
        <div className="basis-note size-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 6H3" /><path d="M17 12H7" /><path d="M14 18h-4" /></svg>
          <span>
            {ar
              ? `تُعرض ${thing} بمساحة ${fmt(sizeBand.lo)} إلى ${fmt(sizeBand.hi)} قدم، قريبة من ${fmt(sizeSqft)} قدم.`
              : `Showing ${thing} sized ${fmt(sizeBand.lo)} to ${fmt(sizeBand.hi)} sqft, close to your ${fmt(sizeSqft)} sqft.`}
            {sizeBand.widened && (ar
              ? ` تم توسيع النطاق إلى ±${Math.round(sizeBand.tol * 100)}٪ للحصول على عدد كافٍ من العروض المشابهة.`
              : ` Widened to ±${Math.round(sizeBand.tol * 100)}% so there are enough comparable listings.`)}
            <button type="button" className="size-reset" onClick={() => setSize('')}>{t.sizeClear}</button>
          </span>
        </div>
      )}
    </div>
  )
}
