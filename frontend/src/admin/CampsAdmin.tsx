import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, Tooltip, TileLayer, useMapEvents } from 'react-leaflet'
import { api, type Camp, type Dashboard } from '../api'
import { km } from '../geo'
import { pin } from '../mapIcons'
import {
  CalendarIcon,
  DownloadIcon,
  RouteOptimizeIcon,
  PlusIcon,
  MapPinIcon,
  AmbulanceCarIcon,
  ShieldCheckIcon,
} from '../icons'

function Picker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

export default function CampsAdmin({ d }: { d: Dashboard }) {
  const formRef = useRef<HTMLDivElement>(null)
  const taluks = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>()
    d.facilities.forEach((f) => {
      if (!m.has(f.taluk)) m.set(f.taluk, { lat: f.lat, lng: f.lng })
    })
    return m
  }, [d])

  const [camps, setCamps] = useState<Camp[]>([])
  const [f, setF] = useState(() => ({
    title: 'Rural Health & ANC Outreach Camp',
    village: 'Community Grounds',
    taluk: d.taluks[0]?.taluk || 'Sakleshpura',
    date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    focus: 'Maternal care, ANC checkup, pediatric checkup, general screening',
    is_animal: false,
  }))
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [msg, setMsg] = useState('')
  const [selectedPrioritized, setSelectedPrioritized] = useState<string>(d.taluks[0]?.taluk || '')
  const [mapCategory, setMapCategory] = useState<'all' | 'human' | 'vet'>('all')

  // Route optimization result state
  const [optimizedRoute, setOptimizedRoute] = useState<{
    ordered: { camp: Camp; distFromPrev: number }[]
    totalKm: number
  } | null>(null)

  // Manage camp state
  const [editingCamp, setEditingCamp] = useState<Camp | null>(null)
  const [editForm, setEditForm] = useState<Partial<Camp>>({})

  const load = () => {
    void api.camps().then(setCamps)
  }
  useEffect(load, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const where = loc ?? taluks.get(f.taluk) ?? { lat: 13.0033, lng: 76.1004 }
    try {
      await api.addCamp({
        title: f.title,
        village: f.village,
        taluk: f.taluk,
        date: f.date,
        focus: f.focus,
        is_animal: f.is_animal,
        lat: where.lat,
        lng: where.lng,
      })
      setMsg('Camp scheduled ✔')
      setLoc(null)
      load()
    } catch {
      setMsg('Could not save — check all fields')
    }
  }

  // Real nearest-neighbour route order algorithm from district hub
  const handleAutoOptimize = () => {
    if (camps.length === 0) {
      alert('No camps available to optimize.')
      return
    }
    const hub = { lat: 13.0033, lng: 76.1004 }
    const unvisited = [...camps]
    const ordered: { camp: Camp; distFromPrev: number }[] = []
    let curr = hub
    let total = 0

    while (unvisited.length > 0) {
      let bestIdx = 0
      let bestDist = Infinity
      for (let i = 0; i < unvisited.length; i++) {
        const dist = km(curr, unvisited[i])
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      }
      const [picked] = unvisited.splice(bestIdx, 1)
      ordered.push({ camp: picked, distFromPrev: bestDist })
      total += bestDist
      curr = { lat: picked.lat, lng: picked.lng }
    }

    setOptimizedRoute({ ordered, totalKm: total })
  }

  const handleSelectPrioritized = (sug: { taluk: string; need_score: number; reason: string }) => {
    setSelectedPrioritized(sug.taluk)
    setF({
      ...f,
      taluk: sug.taluk,
      title: `${sug.taluk} Rural Outreach Camp`,
      village: `${sug.taluk} Community Health Ground`,
      focus: 'General health, ANC checkup, NCD screening',
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleOpenManage = (c: Camp) => {
    setEditingCamp(c)
    setEditForm({ ...c })
  }

  const handleSaveEdit = async () => {
    if (!editingCamp) return
    try {
      await api.updateCamp(editingCamp.id, editForm)
      setEditingCamp(null)
      load()
    } catch {
      alert('Failed to update camp.')
    }
  }

  const handleDeleteCamp = async () => {
    if (!editingCamp) return
    if (confirm(`Delete camp "${editingCamp.title}"?`)) {
      try {
        await api.deleteCamp(editingCamp.id)
        setEditingCamp(null)
        load()
      } catch {
        alert('Failed to delete camp.')
      }
    }
  }

  // Filtered camps on map
  const mapCamps = useMemo(() => {
    return camps.filter((c) => {
      if (mapCategory === 'human') return !c.is_animal
      if (mapCategory === 'vet') return c.is_animal
      return true
    })
  }, [camps, mapCategory])

  // Real KPI calculations from real data
  const criticalTaluks = useMemo(() => d.taluks.filter((t) => t.need_score >= 45), [d])
  const coveredCount = useMemo(
    () => criticalTaluks.filter((t) => camps.some((c) => c.taluk === t.taluk)).length,
    [criticalTaluks, camps],
  )
  const coveragePct = criticalTaluks.length
    ? Math.round((coveredCount / criticalTaluks.length) * 100)
    : 100

  return (
    <div className="space-y-4">
      {/* Top Banner Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-900 leading-tight">
              Mobile Health Camp Operations & MMU Deployments
            </h2>
            <span className="rounded bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase text-slate-950">
              SIMULATED DATA
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            District deployment schedules, route optimization, and need-prioritized outreach.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Print Roster Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <DownloadIcon size={14} />
            <span>Print roster</span>
          </button>

          {/* Auto-optimize routes button */}
          <button
            type="button"
            onClick={handleAutoOptimize}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <RouteOptimizeIcon size={14} />
            <span>Auto-Optimize MMU Routes</span>
          </button>

          <button
            type="button"
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-red-700 active:scale-95 transition-all"
          >
            <PlusIcon size={14} />
            <span>Schedule New Camp</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Stat Cards Row (Derived from real data) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* KPI 1: Active Schedules */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              ACTIVE SCHEDULES
            </span>
            <CalendarIcon size={16} />
          </div>
          <div className="mt-1 text-3xl font-black text-slate-900">
            {camps.length.toString().padStart(2, '0')}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>
              {camps.filter((c) => !c.is_animal).length} Human · {camps.filter((c) => c.is_animal).length} Animal
            </span>
          </p>
        </div>

        {/* KPI 2: High-Deprivation Coverage */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              HIGH-DEPRIVATION COVERAGE
            </span>
            <ShieldCheckIcon size={16} className="text-red-600" />
          </div>
          <div className="mt-1 text-3xl font-black text-red-600">{coveragePct}%</div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {coveredCount} of {criticalTaluks.length} Critical Taluks Targeted
          </p>
        </div>

        {/* KPI 3: Fleet Status */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              AMBULANCE FLEET STATUS
            </span>
            <AmbulanceCarIcon size={16} className="text-emerald-700" />
          </div>
          <div className="mt-1 text-3xl font-black text-emerald-700">
            {d.summary.ambulances_available}/{d.summary.ambulances_total}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {d.summary.ambulances_available} Available Units on Duty
          </p>
        </div>

        {/* KPI 4: Top Priority Taluk */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              TOP PRIORITY TALUK
            </span>
            <span className="text-base">🎯</span>
          </div>
          <div className="mt-1 text-2xl font-black text-slate-900 truncate">
            {d.taluks[0]?.taluk ?? 'None'}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Need Index Score: {d.taluks[0]?.need_score ?? 0}
          </p>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column (5 of 12) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Prioritized Locations Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                PRIORITIZED LOCATIONS
              </h3>
              <span className="rounded bg-orange-100 px-2 py-0.5 text-[9px] font-black text-orange-900">
                Need-Ranked Index
              </span>
            </div>

            <h4 className="mt-1 text-sm font-black text-slate-900">
              Suggested Locations for Next Mobile Camp
            </h4>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 leading-snug">
              Ranked by transit deficit, public transport distance from nearest facility, and staffing fill rate.
            </p>

            <div className="mt-3 space-y-2">
              {d.camp_suggestions.map((item, idx) => {
                const isSelected = selectedPrioritized === item.taluk
                return (
                  <div
                    key={item.taluk}
                    className={`rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-red-600 bg-red-50/30 ring-1 ring-red-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-900">
                          {item.taluk}
                        </span>
                        {idx === 0 && (
                          <span className="rounded bg-red-100 px-1.5 py-0.2 text-[9px] font-black text-red-800">
                            PRIORITY #1
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectPrioritized(item)}
                        className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${
                          isSelected
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Use'}
                      </button>
                    </div>

                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {item.reason}
                    </p>

                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Need score: {item.need_score}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Schedule Form Card */}
          <div ref={formRef} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-red-600" />
              <h3 className="text-sm font-black text-slate-900">
                Schedule a Mobile Health Camp
              </h3>
            </div>
            <p className="text-[11px] font-medium text-slate-500">
              Configure date, target village and clinical focus
            </p>

            <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-2.5">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-600">
                  Camp Title
                </label>
                <input
                  value={f.title}
                  onChange={(e) => setF({ ...f, title: e.target.value })}
                  placeholder="e.g. Maternal & Child Health Camp"
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-red-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-600">
                  Target Village & Venue
                </label>
                <div className="relative mt-1">
                  <MapPinIcon size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    value={f.village}
                    onChange={(e) => setF({ ...f, village: e.target.value })}
                    placeholder="e.g. Community Center Grounds"
                    required
                    className="w-full rounded-xl border border-slate-300 py-2 pl-8 pr-3 text-xs font-semibold text-slate-900 focus:border-red-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600">
                    Taluk
                  </label>
                  <select
                    value={f.taluk}
                    onChange={(e) => {
                      setF({ ...f, taluk: e.target.value })
                      setLoc(null)
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs font-semibold text-slate-900 focus:border-red-600 focus:outline-none bg-white"
                  >
                    {[...taluks.keys()].sort().map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={f.date}
                    onChange={(e) => setF({ ...f, date: e.target.value })}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-red-600 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-600">
                  Clinical Focus Areas (comma-separated)
                </label>
                <input
                  value={f.focus}
                  onChange={(e) => setF({ ...f, focus: e.target.value })}
                  placeholder="e.g. Maternal care, ANC checkup, Hb testing"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-red-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="animalCheck"
                  checked={f.is_animal}
                  onChange={(e) => setF({ ...f, is_animal: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-amber-700 focus:ring-amber-700"
                />
                <label htmlFor="animalCheck" className="text-xs font-bold text-slate-700">
                  Livestock / Pashu Sanjeevini Camp
                </label>
              </div>

              <button
                type="submit"
                className="mt-2 w-full rounded-xl bg-red-600 py-2.5 text-xs font-black text-white shadow-xs hover:bg-red-700 active:scale-98 transition-all"
              >
                Schedule Camp
              </button>

              {msg && (
                <p className="mt-1 text-center text-xs font-bold text-emerald-700 bg-emerald-50 py-1.5 rounded-lg border border-emerald-200">
                  {msg}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Right Column (7 of 12) */}
        <div className="space-y-4 lg:col-span-7">
          {/* GIS Map Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  DEPLOYMENT GIS & GEOGRAPHICAL COVERAGE
                </h3>
                <p className="text-[11px] font-medium text-slate-500">
                  Hover or click markers for details · click map to set exact coordinates
                </p>
              </div>

              {/* Map Filter Controls */}
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMapCategory('all')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition-all ${
                    mapCategory === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({camps.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMapCategory('human')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition-all ${
                    mapCategory === 'human'
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Human ({camps.filter((c) => !c.is_animal).length})
                </button>
                <button
                  type="button"
                  onClick={() => setMapCategory('vet')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition-all ${
                    mapCategory === 'vet'
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Vet ({camps.filter((c) => c.is_animal).length})
                </button>
              </div>
            </div>

            <div className="relative h-72 overflow-hidden rounded-xl border border-slate-200">
              <MapContainer center={[13.0, 76.1]} zoom={10} className="h-full w-full">
                <TileLayer
                  attribution="© OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Picker onPick={(lat, lng) => setLoc({ lat, lng })} />

                {mapCamps.map((c) => (
                  <Marker
                    key={c.id}
                    position={[c.lat, c.lng]}
                    icon={pin(c.is_animal ? 'vet' : 'clinic', 28)}
                  >
                    <Tooltip direction="top" offset={[0, -10]}>
                      <span className="font-bold text-xs">{c.title}</span> ({c.village})
                    </Tooltip>
                    <Popup>
                      <div className="p-1">
                        <h4 className="font-bold text-xs">{c.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {c.village}, {c.taluk} • {c.date}
                        </p>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                          Focus: {c.focus}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {loc && <Marker position={[loc.lat, loc.lng]} icon={pin('user', 28, 'Selected')} />}
              </MapContainer>
            </div>
          </div>

          {/* Upcoming Camps Roster Card (with id for printing) */}
          <div id="roster-print-section" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  UPCOMING CAMPS ROSTER
                </h3>
                <p className="text-[11px] font-medium text-slate-500">
                  Chronological schedule of confirmed rural outreach deployments
                </p>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black text-blue-900">
                {camps.length} Deployments Active
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {camps.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">No camps scheduled.</p>
              ) : (
                camps.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-lg leading-none mt-0.5">{item.is_animal ? '🐮' : '🩺'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-900">
                            {item.title}
                          </h4>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-black ${
                              item.is_animal ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'
                            }`}
                          >
                            {item.is_animal ? 'Animal' : 'Human'}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                          {item.date} · {item.village}, {item.taluk}
                        </p>
                        {item.focus && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {item.focus}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                      <a
                        href={`https://maps.google.com/?q=${item.lat},${item.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Route Sheet
                      </a>
                      <button
                        type="button"
                        onClick={() => handleOpenManage(item)}
                        className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Route Optimization Modal */}
      {optimizedRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Optimized MMU Route (Nearest-Neighbour)
                </h3>
                <p className="text-xs text-slate-500">
                  Computed from Hassan Hub (HIMS) across all scheduled camps
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                Total: {optimizedRoute.totalKm.toFixed(1)} km
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 pb-1 border-b border-slate-100">
                <span className="h-2 w-2 rounded-full bg-red-600" />
                <span>Start: Hassan District Hub (13.0033, 76.1004)</span>
              </div>

              {optimizedRoute.ordered.map(({ camp, distFromPrev }, idx) => (
                <div key={camp.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs">
                  <div>
                    <span className="font-extrabold text-slate-900">
                      Stop {idx + 1}: {camp.title}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {camp.village}, {camp.taluk} ({camp.date})
                    </p>
                  </div>
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-900 shrink-0">
                    +{distFromPrev.toFixed(1)} km
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setOptimizedRoute(null)}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Camp Modal */}
      {editingCamp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-black text-slate-900">
              Manage Camp: {editingCamp.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Edit deployment details or cancel the scheduled camp.
            </p>

            <div className="mt-3 space-y-2.5">
              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-600">Title</label>
                <input
                  type="text"
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold focus:border-red-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-600">Village & Venue</label>
                <input
                  type="text"
                  value={editForm.village || ''}
                  onChange={(e) => setEditForm({ ...editForm, village: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold focus:border-red-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600">Taluk</label>
                  <select
                    value={editForm.taluk || ''}
                    onChange={(e) => setEditForm({ ...editForm, taluk: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs font-semibold focus:border-red-600 focus:outline-none bg-white"
                  >
                    {[...taluks.keys()].sort().map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-600">Date</label>
                  <input
                    type="date"
                    value={editForm.date || ''}
                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-2 py-1.5 text-xs font-semibold focus:border-red-600 focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase text-slate-600">Focus Areas</label>
                <input
                  type="text"
                  value={editForm.focus || ''}
                  onChange={(e) => setEditForm({ ...editForm, focus: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold focus:border-red-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => void handleDeleteCamp()}
                className="rounded-xl bg-red-100 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-200"
              >
                Delete Camp
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCamp(null)}
                  className="rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
