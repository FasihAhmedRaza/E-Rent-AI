import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const [data, setData] = useState(null)
  const [lang, setLang] = useState('en')
  const [area, setArea] = useState(null)
  const [type, setType] = useState('all')
  const [search, setSearch] = useState('')
  const yld = 0.065 // mid-point of the 5–8% yield band

  useEffect(() => {
    fetch('/landData.json').then((r) => r.json()).then((d) => {
      setData(d)
      setArea(d.areas[0]?.key)
    }).catch(() => setData({ error: true }))
  }, [])

  return (
    <Ctx.Provider value={{ data, lang, setLang, area, setArea, type, setType, search, setSearch, yld }}>
      {children}
    </Ctx.Provider>
  )
}

export const useStore = () => useContext(Ctx)

// ---- data helpers (mirror the prototype's stat() / areaAvg(), rent = value × yield) ----
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
  return b ? b.vavg * yld : 0
}
