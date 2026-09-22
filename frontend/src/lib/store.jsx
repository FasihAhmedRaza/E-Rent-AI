import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { buildComparables, TOLS } from './comparables'

const Ctx = createContext(null)

// A commercial area carries rent{} + sale{} blocks. We reshape it into the SAME
// shape land uses (vlow/vavg/vhigh = annual MARKET RENT, ppsf = rent/sqft) so every
// page's statsFor()/areaAvgRent()/baseFor() works unchanged with an effective yield
// of 1 (commercial rent is already a real annual figure — no 5–8% yield applied).
const toRentShape = (a) => {
  const r = a.rent || { n: 0, ppsf: null, low: 0, avg: 0, high: 0 }
  const bytype = {}
  for (const [st, b] of Object.entries(a.bytype || {})) {
    if (b && b.rent) bytype[st] = { n: b.rent.n, ppsf: b.rent.ppsf, vlow: b.rent.low, vavg: b.rent.avg, vhigh: b.rent.high }
  }
  return { ...a, n: r.n, ppsf: r.ppsf, vlow: r.low, vavg: r.avg, vhigh: r.high, bytype, saleStats: a.sale }
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(null)
  const [lang, setLang] = useState('en')
  const [category, setCategory] = useState(() => {
    try { return localStorage.getItem('erent_cat') || 'land' } catch { return 'land' } // survives reloads
  })
  const [area, setArea] = useState(null)
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const [size, setSize] = useState('')     // what the user typed, in sqft
  const [tolIdx, setTolIdx] = useState(1)  // how close a comparable has to be (TOLS)

  useEffect(() => {
    fetch('/landData.json').then((r) => r.json()).then((d) => {
      setData(d)
      const list = (category === 'commercial' && d.commercial?.areas?.length) ? d.commercial.areas : d.areas
      setArea(list?.[0]?.key)
    }).catch(() => setData({ error: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isCommercial = category === 'commercial'
  const hasCommercial = !!(data && data.commercial && data.commercial.areas && data.commercial.areas.length)

  // raw snapshot view for the active category (commercial areas still in rent{}/sale{} shape)
  const raw = useMemo(() => {
    if (!data || data.error) return { areas: [], listings: [], kpis: {} }
    if (isCommercial && data.commercial) {
      return {
        areas: data.commercial.areas || [],
        listings: data.commercial.listings || [],
        kpis: data.commercial.kpis || {},
      }
    }
    return { areas: data.areas || [], listings: data.listings || [], kpis: data.kpis || {} }
  }, [data, isCommercial])

  // a size typed in the filter bar rebuilds every area from listings of a similar size
  const sizeSqft = useMemo(() => {
    const n = parseFloat(String(size).replace(/[^0-9.]/g, ''))
    return n > 0 ? n : 0
  }, [size])

  const sized = useMemo(() => {
    if (!sizeSqft || !area || !raw.areas.length) return null
    return buildComparables({
      areas: raw.areas, listings: raw.listings, isCommercial, area, type, size: sizeSqft, tolIdx,
    })
  }, [raw, isCommercial, area, type, sizeSqft, tolIdx])

  const areasAll = useMemo(
    () => (isCommercial ? raw.areas.map(toRentShape) : raw.areas), [raw.areas, isCommercial])
  const areas = useMemo(
    () => (!sized ? areasAll : (isCommercial ? sized.areas.map(toRentShape) : sized.areas)),
    [sized, areasAll, isCommercial])
  const listings = sized ? sized.listings : raw.listings

  // commercial rent is already annual → effective yield 1; land uses the 6.5% mid-point.
  const yld = isCommercial ? 1 : 0.065

  // switching category resets the selected area/type to valid defaults for that view
  const switchCategory = (c) => {
    try { localStorage.setItem('erent_cat', c) } catch { /* ignore */ }
    setCategory(c)
    setType('all')
    const list = c === 'commercial' ? data?.commercial?.areas : data?.areas
    setArea(list?.[0]?.key || null)
  }

  // if a stale stored category has no data (e.g. land-only snapshot), fall back to land
  useEffect(() => {
    if (data && category === 'commercial' && !(data.commercial?.areas?.length)) setCategory('land')
  }, [data, category])

  return (
    <Ctx.Provider value={{
      data, lang, setLang,
      category, setCategory: switchCategory, isCommercial, hasCommercial,
      // size aware view (what the filtered pages read)
      areas, listings, kpis: raw.kpis,
      // full market, ignoring the size box (Insights, Studio, assistant, global search)
      areasAll, listingsAll: raw.listings,
      area, setArea, type, setType, search, setSearch, yld,
      size, setSize, sizeSqft, sizeActive: !!sized, sizeBand: sized ? sized.band : null,
      tolIdx, setTolIdx, tols: TOLS,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useStore = () => useContext(Ctx)

// ---- data helpers (rent = value × yield; commercial passes yield=1 so rent is direct) ----
export const baseFor = (a, type) =>
  (!a ? null : (type !== 'all' && a.bytype && a.bytype[type]) ? a.bytype[type]
    : { n: a.n, ppsf: a.ppsf, vlow: a.vlow, vavg: a.vavg, vhigh: a.vhigh })

export function statsFor(a, type, yld) {
  const b = baseFor(a, type)
  if (!b) return null
  return { low: b.vlow * yld, avg: b.vavg * yld, high: b.vhigh * yld, ppsf: b.ppsf, n: b.n, trend: a.trend }
}

export const areaAvgRent = (a, type, yld) => {
  const b = baseFor(a, type)
  return b && b.vavg != null ? b.vavg * yld : 0
}

// true if the area has usable figures — its own listings, or its parent group's
// (portals often list only the parent name, without the sub-area number)
export const areaHasData = (a) => !!(a && (a.n || (a.saleStats && a.saleStats.n)))
