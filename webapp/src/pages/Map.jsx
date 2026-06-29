import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import { useStore, statsFor, areaAvgRent } from '../lib/store'
import { T } from '../lib/i18n'
import { fmt, money } from '../lib/format'

// pine→gold ladder colour (matches the prototype's lerp + .legbar gradient)
function lerp(t) {
  t = Math.max(0, Math.min(1, t))
  const c = [[215, 232, 226], [46, 139, 129], [11, 74, 69]]
  const seg = t < 0.5 ? 0 : 1
  const lt = t < 0.5 ? t * 2 : (t - 0.5) * 2
  const a = c[seg], b = c[seg + 1]
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * lt)},${Math.round(a[1] + (b[1] - a[1]) * lt)},${Math.round(a[2] + (b[2] - a[2]) * lt)})`
}

const fmtK = (n) => (n >= 1000 ? Math.round(n / 1000) + 'K' : '' + Math.round(n || 0))

const TILES = {
  standard: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', opt: { maxZoom: 19, attribution: '&copy; OpenStreetMap' } },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opt: { maxZoom: 19, attribution: '&copy; Esri, Maxar, Earthstar Geographics' } },
}

export default function Map() {
  const { data, areas, lang, area, setArea, type, yld, isCommercial } = useStore()
  const t = T[lang]
  const navigate = useNavigate()
  const [mapMode, setMapMode] = useState('standard')

  const mapRef = useRef(null)        // Leaflet map instance
  const layerRef = useRef(null)      // markers layer group
  const baseRef = useRef(null)       // current base tile layer
  const baseModeRef = useRef(null)   // mode of current base layer
  const markersRef = useRef({})      // area_key -> circleMarker
  const elRef = useRef(null)         // map container div

  const nm = (x) => (lang === 'ar' ? x.ar : x.en)
  const unitWord = isCommercial ? t.unitsWord : t.mapPlots
  const arraLabel = isCommercial ? (lang === 'ar' ? 'متوسط سعر البيع' : 'Avg sale price') : t.arraSale
  const saleAvgOf = (x) => (isCommercial ? (x.saleStats && x.saleStats.avg) : x.vavg)

  // ---- ranked areas by average rent (land: sale value × yield; commercial: market rent) ----
  const ranked = useMemo(() => {
    return [...areas]
      .map((x) => ({ x, rent: areaAvgRent(x, type, yld) }))
      .filter((r) => r.rent > 0)
      .sort((r1, r2) => r2.rent - r1.rent)
  }, [areas, type, yld])

  const bounds = useMemo(() => {
    const rents = ranked.map((r) => r.rent)
    return { mn: rents.length ? Math.min(...rents) : 0, mx: rents.length ? Math.max(...rents) : 1 }
  }, [ranked])

  const colorFor = (rent) => lerp((rent - bounds.mn) / ((bounds.mx - bounds.mn) || 1))

  // ---- selected area derived info ----
  const sel = areas.length ? (areas.find((x) => x.key === area) || areas[0]) : null
  const selStats = sel ? statsFor(sel, type, yld) : null
  const selRent = sel ? areaAvgRent(sel, type, yld) : 0
  const rank = sel ? ranked.findIndex((r) => r.x.key === sel.key) + 1 : 0

  // ---- create the Leaflet map once ----
  useEffect(() => {
    if (mapMode === 'offline' || !elRef.current || mapRef.current) return
    const m = L.map(elRef.current, { scrollWheelZoom: true, zoomControl: true }).setView([25.402, 55.492], 11)
    layerRef.current = L.layerGroup().addTo(m)
    mapRef.current = m
    setBaseLayer(mapMode)
    setTimeout(() => { try { m.invalidateSize() } catch (e) { /* noop */ } }, 60)
  }, [mapMode])

  // ---- clean up on unmount ----
  useEffect(() => () => {
    if (mapRef.current) { try { mapRef.current.remove() } catch (e) { /* noop */ } }
    mapRef.current = null; layerRef.current = null; baseRef.current = null; baseModeRef.current = null; markersRef.current = {}
  }, [])

  function setBaseLayer(mode) {
    const m = mapRef.current
    if (!m || mode === 'offline') return
    const want = mode === 'satellite' ? 'satellite' : 'standard'
    if (baseModeRef.current === want && baseRef.current) return
    const cfg = TILES[want]
    if (baseRef.current) m.removeLayer(baseRef.current)
    baseRef.current = L.tileLayer(cfg.url, cfg.opt).addTo(m)
    baseRef.current.bringToBack()
    baseModeRef.current = want
  }

  // ---- (re)build markers when data / mode / selection / lang changes ----
  useEffect(() => {
    const m = mapRef.current
    if (mapMode === 'offline' || !m || !layerRef.current || !areas.length) return
    setBaseLayer(mapMode)
    layerRef.current.clearLayers()
    markersRef.current = {}
    ranked.forEach(({ x, rent }) => {
      if (!x.ll) return
      const isSel = x.key === sel?.key
      const col = colorFor(rent)
      const mk = L.circleMarker(x.ll, {
        radius: isSel ? 15 : 11,
        fillColor: col,
        fillOpacity: 0.92,
        color: isSel ? '#C2982F' : '#fff',
        weight: isSel ? 4 : 2,
      })
      mk.bindTooltip(nm(x) + ' · ' + fmtK(rent), { permanent: true, direction: 'top', className: 'price-tip', offset: [0, -4] })
      const st = statsFor(x, type, yld)
      const src = x.sources || {}
      const sa = saleAvgOf(x)
      const arraRow = sa ? `<div class="mp-arra"><span>${arraLabel}</span> <b class="num">${fmt(sa)} ${t.cur}</b></div>` : ''
      mk.bindPopup(
        `<div class="mp"><div class="mp-h">${nm(x)}</div>` +
        `<div class="mp-avg"><span class="num">${fmt(rent)}</span> ${t.cur} <span>${t.mapAvg}</span></div>` +
        arraRow +
        `<div class="mp-row"><span class="src bayut"><i></i>Bayut</span><b class="num">${fmt(src.bayut)} ${t.cur}/${t.sqft}</b></div>` +
        `<div class="mp-row"><span class="src dub"><i></i>Dubizzle</span><b class="num">${fmt(src.dubizzle)} ${t.cur}/${t.sqft}</b></div>` +
        `<div class="mp-row"><span class="src pf"><i></i>Property Finder</span><b class="num">${fmt(src.propertyfinder)} ${t.cur}/${t.sqft}</b></div>` +
        `<div class="mp-foot">${t.mapRange}: <span class="num">${fmt(st ? st.low : 0)}–${fmt(st ? st.high : 0)}</span> · <span class="num">${st ? st.n : 0}</span> ${unitWord}</div></div>`,
        { className: 'price-pop' }
      )
      mk.on('click', () => setArea(x.key))
      mk.addTo(layerRef.current)
      markersRef.current[x.key] = mk
      if (isSel) mk.bringToFront()
    })
    setTimeout(() => { try { m.invalidateSize() } catch (e) { /* noop */ } }, 60)
  }, [areas, mapMode, lang, type, yld, sel?.key, ranked])

  // ---- handle mode switch: ensure map exists, swap base layer, resize ----
  useEffect(() => {
    if (mapMode === 'offline') return
    const m = mapRef.current
    if (m) {
      setBaseLayer(mapMode)
      setTimeout(() => { try { m.invalidateSize() } catch (e) { /* noop */ } }, 120)
    }
  }, [mapMode])

  if (!data || !sel) return null

  const modes = [
    ['standard', t.mapModeStandard],
    ['satellite', t.mapModeSatellite],
    ['offline', t.mapModeOffline],
  ]
  const offline = mapMode === 'offline'
  const yr = lang === 'ar' ? 'سنة' : 'yr'
  const srcs = sel.sources || {}
  const selSale = saleAvgOf(sel)

  return (
    <section className="view" id="v-map" style={{ display: 'block' }}>
      <div className="map-wrap">
        <div className="card tilemap-card">
          <div className="sec-h">
            <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            <span>{t.mapTitle}</span>
            <div className="map-toggle">
              {modes.map(([k, label]) => (
                <button key={k} className={mapMode === k ? 'active' : ''} onClick={() => setMapMode(k)}>{label}</button>
              ))}
            </div>
          </div>
          <p className="sec-s">{isCommercial ? t.mapSubC : t.mapSub}</p>

          {/* OFFLINE: coloured district ladder */}
          <div className="water-strip" data-l={t.water} style={{ display: offline ? '' : 'none' }} />
          <div className="tiles" style={{ display: offline ? '' : 'none' }}>
            {ranked.map((r, i) => {
              const pct = Math.max(6, Math.round(r.rent / (bounds.mx || 1) * 100))
              const col = colorFor(r.rent)
              const ss = r.x.sources || {}
              const rsa = saleAvgOf(r.x)
              return (
                <div key={r.x.key} className={'lad-row' + (r.x.key === sel.key ? ' sel' : '')} onClick={() => setArea(r.x.key)}>
                  <div className="lad-rank">{i + 1}</div>
                  <div className="lad-main">
                    <div className="lad-head">
                      <span className="lad-name">{nm(r.x)}{r.x.coast ? <span className="tanchor"> ⚓</span> : null}</span>
                      <span className="lad-val"><span className="num">{fmt(r.rent)}</span> <span className="cur">{t.cur}/{yr}</span></span>
                    </div>
                    <div className="lad-bar"><div className="lad-fill" style={{ width: pct + '%', background: col }} /></div>
                    <div className="lad-sub">
                      {rsa ? <span className="lad-arra">{arraLabel}: <b className="num">{money(rsa)}</b></span> : <span className="lad-arra" />}
                      <span className="lad-src">
                        <span><i style={{ background: '#1F9E6E' }} />{fmtK(ss.bayut)}</span>
                        <span><i style={{ background: '#D43B33' }} />{fmtK(ss.dubizzle)}</span>
                        <span><i style={{ background: '#7B5FD0' }} />{fmtK(ss.propertyfinder)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* LIVE: Leaflet map */}
          <div id="leafmap" ref={elRef} style={{ display: offline ? 'none' : 'block' }} />

          <div className="legend">
            <span>{t.legLow}</span>
            <div className="legbar" />
            <span>{t.legHigh}</span>
            <span className="src bayut maplg"><i />Bayut</span>
            <span className="src dub maplg"><i />Dubizzle</span>
          </div>
          <p className="map-note">{offline ? t.mapNoteTiles : (isCommercial ? t.mapNoteC : t.mapNote)}</p>
        </div>

        {/* AREA INFO CARD */}
        <div className="card area-info" id="areaInfo">
          <div className="eyebrow">{t.areaOverview}</div>
          <h2 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: '1.4rem', margin: '4px 0 14px' }}>{t.areaPrefix}{nm(sel)}</h2>
          <div className="ai-stat">
            <span className="l">{t.miAvg}</span>
            <span className="v"><span className="num">{fmt(selRent)}</span> <span className="cur">{t.cur}/{yr}</span></span>
          </div>
          <div className="ai-stat">
            <span className="l">{t.mapRange}</span>
            <span className="v"><span className="num">{fmt(selStats ? selStats.low : 0)}</span>–<span className="num">{fmt(selStats ? selStats.high : 0)}</span> <span className="cur">{t.cur}</span></span>
          </div>
          {selSale ? (
            <div className="ai-stat">
              <span className="l">{arraLabel}</span>
              <span className="v"><span className="num">{money(selSale)}</span> <span className="cur">{t.cur}</span></span>
            </div>
          ) : null}
          <div className="ai-stat">
            <span className="l">{t.perSqftL}</span>
            <span className="v"><span className="num">{fmt(selStats ? selStats.ppsf : sel.ppsf)}</span> <span className="cur">{t.cur}/{t.sqft}</span></span>
          </div>
          <div className="ai-stat">
            <span className="l">{isCommercial ? t.miUnits : t.miListings}</span>
            <span className="v num">{fmt(selStats ? selStats.n : sel.n)}</span>
          </div>
          <div className="ai-stat">
            <span className="l"><span className="src bayut"><i />Bayut</span></span>
            <span className="v"><span className="num">{fmt(srcs.bayut)}</span> <span className="cur">{t.cur}/{t.sqft}</span></span>
          </div>
          <div className="ai-stat">
            <span className="l"><span className="src dub"><i />Dubizzle</span></span>
            <span className="v"><span className="num">{fmt(srcs.dubizzle)}</span> <span className="cur">{t.cur}/{t.sqft}</span></span>
          </div>
          <div className="ai-stat">
            <span className="l"><span className="src pf"><i />Property Finder</span></span>
            <span className="v"><span className="num">{fmt(srcs.propertyfinder)}</span> <span className="cur">{t.cur}/{t.sqft}</span></span>
          </div>
          <div className="ai-stat">
            <span className="l">{t.miRank}</span>
            <span className="v num">{rank} / {ranked.length}</span>
          </div>
          <div className="mini-rank">
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/listings')}>{t.showListings}</button>
          </div>
        </div>
      </div>
    </section>
  )
}
