// Size matched comparables.
//
// Why this file exists: an area's headline pooled a 500 sqft shop with a 60,000 sqft
// labour camp, so the range read "lowest 1,200 / highest 11,000,000" and told the user
// nothing about their own unit. Type a size in the filter bar and every figure on the
// filtered pages is rebuilt from listings of a SIMILAR SIZE only.
//
// The aggregation matches backend/make_snapshot.py (low = min, avg = median, high = max)
// so the numbers stay consistent with the snapshot when no size is entered.

export const TOLS = [0.15, 0.3, 0.5, 0.75]     // band = size ± TOL (widest is ±75%)
export const PICKABLE_TOLS = 3                 // the first three are offered in the UI
const MIN_COMPARABLES = 6                      // widen the band until at least this many
const OUTLIER_FACTOR = 4                       // drop listings 4x off the median AED/sqft
const SOURCES = ['bayut', 'dubizzle', 'propertyfinder']

const med = (list) => {
  if (!list.length) return null
  const s = [...list].sort((a, b) => a - b)
  const m = s.length >> 1
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2)
}

// same aggregation as make_snapshot.vstats
const vstats = (items) => {
  const vals = items.map((x) => x.value).filter(Boolean).sort((a, b) => a - b)
  if (!vals.length) return null
  return {
    n: vals.length,
    ppsf: med(items.map((x) => x.ppsf).filter(Boolean)),
    low: vals[0], avg: med(vals), high: vals[vals.length - 1],
  }
}

const srcMedians = (items) => Object.fromEntries(
  SOURCES.map((s) => [s, med(items.filter((x) => x.src === s).map((x) => x.ppsf).filter(Boolean))])
)

// A 1,200 sqft warehouse at 6.5M a year is a sale price the portal filed as rent.
// Once the sizes are comparable the price per sqft should be too, so anything wildly
// off the median of the band is a data error, not a comparable.
const trimOutliers = (items) => {
  if (items.length < 5) return items
  const m = med(items.map((x) => x.ppsf).filter(Boolean))
  if (!m) return items
  return items.filter((x) => !x.ppsf || (x.ppsf >= m / OUTLIER_FACTOR && x.ppsf <= m * OUTLIER_FACTOR))
}

export const parentBase = (en) => (en || '').replace(/\s*\d+$/, '').trim()

// Listings behind each area: its own, or its parent group's when the portals only ever
// wrote the parent name (same fallback as make_snapshot.py, so an area that shows
// parent figures today keeps showing them once a size is entered).
function poolsByArea(areas, listings, isCommercial) {
  const usable = listings.filter((l) => l.area && l.value > 0 && l.ppsf > 0 && l.size > 0
    && (isCommercial || l.lt === 'sale'))
  const own = new Map()
  for (const l of usable) {
    const arr = own.get(l.area)
    if (arr) arr.push(l); else own.set(l.area, [l])
  }
  const nameOf = new Map(areas.map((a) => [a.key, a.en]))
  const groups = new Map()
  for (const [key, ls] of own) {
    const p = parentBase(nameOf.get(key) || key)
    const arr = groups.get(p)
    if (arr) arr.push(...ls); else groups.set(p, [...ls])
  }
  const pools = new Map()
  for (const a of areas) {
    const ls = own.get(a.key)
    pools.set(a.key, ls && ls.length ? ls : (groups.get(parentBase(a.en)) || []))
  }
  return pools
}

const inBand = (items, size, tol) =>
  items.filter((x) => x.size >= size * (1 - tol) && x.size <= size * (1 + tol))

// the set the headline figure is built from: land uses sale listings (rent is derived),
// commercial uses real market rent
const headlinePool = (pool, type, isCommercial) =>
  pool.filter((x) => (!isCommercial || x.lt === 'rent') && (type === 'all' || x.type === type))

/**
 * Rebuild every area from listings close in size to `size`.
 * Returns { areas, listings, band } where `band` is the size window actually used.
 */
export function buildComparables({ areas, listings, isCommercial, area, type, size, tolIdx }) {
  const pools = poolsByArea(areas, listings, isCommercial)

  // The band is chosen ONCE, from the selected area and type, then applied to every
  // area so the by area comparison stays like for like.
  const head = headlinePool(pools.get(area) || [], type, isCommercial)
  let i = Math.min(Math.max(tolIdx | 0, 0), TOLS.length - 1)
  const start = i
  if (head.length) {
    while (i < TOLS.length - 1 && inBand(head, size, TOLS[i]).length < MIN_COMPARABLES) i++
  }
  const tol = TOLS[i]
  const band = {
    lo: Math.max(1, Math.round(size * (1 - tol))),
    hi: Math.round(size * (1 + tol)),
    tol, size, widened: i > start,
  }

  const kept = new Set()
  const keep = (items) => { for (const x of items) kept.add(x.id); return items }

  const out = areas.map((a) => {
    const pool = inBand(pools.get(a.key) || [], size, tol)
    if (isCommercial) {
      const rent = keep(trimOutliers(pool.filter((x) => x.lt === 'rent')))
      const sale = keep(trimOutliers(pool.filter((x) => x.lt === 'sale')))
      const bytype = {}
      for (const st of new Set([...rent, ...sale].map((x) => x.subtype))) {
        const rb = vstats(rent.filter((x) => x.subtype === st))
        const sb = vstats(sale.filter((x) => x.subtype === st))
        if (rb || sb) bytype[st] = { rent: rb, sale: sb }
      }
      return { ...a, rent: vstats(rent), sale: vstats(sale), bytype, sources: srcMedians(rent) }
    }
    const items = keep(trimOutliers(pool))
    const bytype = {}
    for (const ty of new Set(items.map((x) => x.type))) {
      const v = vstats(items.filter((x) => x.type === ty))
      if (v) bytype[ty] = { n: v.n, ppsf: v.ppsf, vlow: v.low, vavg: v.avg, vhigh: v.high }
    }
    const v = vstats(items)
    return {
      ...a, n: v ? v.n : 0, ppsf: v ? v.ppsf : null,
      vlow: v ? v.low : null, vavg: v ? v.avg : null, vhigh: v ? v.high : null,
      bytype, sources: srcMedians(items),
    }
  })

  return { areas: out, listings: listings.filter((l) => kept.has(l.id)), band }
}
