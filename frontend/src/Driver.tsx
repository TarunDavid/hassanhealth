import { useEffect, useRef, useState } from 'react'
import { api, type Ambulance, type Sos } from './api'
import { AmbulanceCarIcon } from './icons'
import { useAuth } from './AuthContext'
import AdminLogin from './admin/AdminLogin'

/** Ambulance driver page: shares real GPS, or simulates a drive to the patient for demos. */
export default function Driver() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-sm font-semibold text-slate-500">Loading...</div>
  if (user?.role !== 'admin') return <AdminLogin title="Ambulance driver page (staff login)" />
  return <DriverInner />
}

function DriverInner() {
  const [ambs, setAmbs] = useState<Ambulance[]>([])
  const [id, setId] = useState<number | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [sharing, setSharing] = useState(false)
  const watch = useRef<number | null>(null)
  const timer = useRef<number | null>(null)
  const add = (m: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 8))

  useEffect(() => {
    void api.ambulances().then((a) => {
      setAmbs(a)
      setId(a[0]?.id ?? null)
    })
  }, [])

  useEffect(
    () => () => {
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
      if (timer.current) clearInterval(timer.current)
    },
    [],
  )

  const me = ambs.find((a) => a.id === id)

  function share() {
    if (!id || !navigator.geolocation) return add('GPS not available on this device')
    if (sharing && watch.current !== null) {
      navigator.geolocation.clearWatch(watch.current)
      setSharing(false)
      return add('Stopped sharing GPS')
    }
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        void api.moveAmbulance(id, p.coords.latitude, p.coords.longitude)
        add(`GPS ${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}`)
      },
      (e) => add(`GPS error: ${e.message}`),
      { enableHighAccuracy: true },
    )
    setSharing(true)
    add('Sharing live GPS')
  }

  async function simulate() {
    if (!id || !me) return
    const list: Sos[] = await api.sosList()
    const job = list.find((s) => s.ambulance?.id === id && s.status === 'dispatched')
    if (!job)
      return add(
        'No active SOS assigned to this ambulance. Press SOS in the citizen app first.',
      )
    if (timer.current) clearInterval(timer.current)
    const from = { lat: me.lat, lng: me.lng }
    let step = 0
    const N = 20
    add(`Driving to SOS #${job.id}…`)
    timer.current = window.setInterval(() => {
      step++
      const lat = from.lat + ((job.lat - from.lat) * step) / N
      const lng = from.lng + ((job.lng - from.lng) * step) / N
      void api.moveAmbulance(id, lat, lng)
      setAmbs((a) => a.map((x) => (x.id === id ? { ...x, lat, lng } : x)))
      if (step >= N) {
        clearInterval(timer.current!)
        timer.current = null
        add('Arrived at patient location ✔')
      }
    }, 1500)
  }

  async function home() {
    if (!me) return
    const all = await api.dashboard()
    const base = all.facilities.find((f) => f.name === me.base)
    if (base) {
      await api.moveAmbulance(me.id, base.lat, base.lng, 'available')
      add('Returned to base, marked available')
      setAmbs(await api.ambulances())
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-3.5 bg-slate-100 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-xs border border-slate-200">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
          <AmbulanceCarIcon size={24} />
        </div>
        <div>
          <h1 className="text-base font-black text-slate-900 leading-tight">
            Ambulance Driver Terminal
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            Hassan 108 & 1962 Live Telematics
          </p>
        </div>
      </div>

      {/* Ambulance select */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2">
        <label className="text-xs font-bold text-slate-700">Select Vehicle</label>
        <select
          value={id ?? ''}
          onChange={(e) => setId(Number(e.target.value))}
          className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-red-600"
        >
          {ambs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} • {a.base} • {a.status} {a.is_animal ? '(Animal 1962)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Control Actions */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={share}
          className={`w-full rounded-xl py-3 text-xs font-black shadow-xs transition-transform active:scale-98 ${
            sharing
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {sharing ? 'Stop Sharing GPS' : '📡 Share Live Device GPS'}
        </button>

        <button
          type="button"
          onClick={() => void simulate()}
          className="w-full rounded-xl bg-amber-400 py-3 text-xs font-black text-slate-950 shadow-xs hover:bg-amber-300 transition-transform active:scale-98"
        >
          ▶ Simulate Drive to Patient (Demo)
        </button>

        <button
          type="button"
          onClick={() => void home()}
          className="w-full rounded-xl border border-slate-300 bg-white py-3 text-xs font-black text-slate-800 shadow-xs hover:bg-slate-50 transition-transform active:scale-98"
        >
          🏥 Return to Base & Reset to Available
        </button>
      </div>

      {/* Terminal Log */}
      <div className="rounded-2xl border border-slate-800 bg-[#0b1120] p-4 text-xs font-mono text-emerald-400 shadow-md">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
          <span>Terminal Telematics Feed</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            Live
          </span>
        </div>
        <pre className="whitespace-pre-wrap leading-relaxed">
          {log.join('\n') || 'Ready. Awaiting dispatch assignment...'}
        </pre>
      </div>
    </div>
  )
}
