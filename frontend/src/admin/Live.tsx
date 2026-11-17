import { useCallback, useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { api, type Ambulance, type FacilityRow, type Sos } from '../api'
import { pin } from '../mapIcons'
import { Card } from './ui'

const STATUS: Record<string, string> = {
  new: 'bg-red-100 text-red-800 border-red-200',
  dispatched: 'bg-amber-100 text-amber-900 border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export default function Live({ facilities }: { facilities: FacilityRow[] }) {
  const [sos, setSos] = useState<Sos[]>([])
  const [ambs, setAmbs] = useState<Ambulance[]>([])
  const load = useCallback(() => {
    void api.sosList().then(setSos).catch(() => {})
    void api.ambulances().then(setAmbs).catch(() => {})
  }, [])
  useEffect(() => {
    load()
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [load])

  const active = sos.filter((s) => s.status !== 'resolved')
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card title="Ambulance Tracker & Live SOS Map" className="lg:col-span-3">
        <div className="h-[28rem] overflow-hidden rounded-2xl border border-slate-200">
          <MapContainer center={[12.98, 76.1]} zoom={9} className="h-full w-full">
            <TileLayer
              attribution="© OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {facilities
              .filter((f) => f.type === 'hub' || f.type === 'chc' || f.type === 'vet')
              .map((f) => (
                <Marker key={f.id} position={[f.lat, f.lng]} icon={pin(f.type, 24, f.name)}>
                  <Popup>{f.name}</Popup>
                </Marker>
              ))}
            {ambs.map((a) => (
              <Marker key={a.id} position={[a.lat, a.lng]} icon={pin('amb', 32, a.code)}>
                <Popup>
                  <b>{a.code}</b> {a.is_animal ? '(Animal)' : ''}
                  <br />
                  Status: {a.status}
                  <br />
                  Base: {a.base}
                </Popup>
              </Marker>
            ))}
            {active.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={pin('user', 32, `SOS #${s.id}`)}>
                <Popup>
                  SOS #{s.id} · {s.kind}
                  <br />
                  {s.status}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        <p className="mt-2.5 text-xs text-slate-500 font-medium">
          🚑 Green ambulances · Red pulsing dots active SOS · Auto-updates every 3s. Drivers share live GPS from the{' '}
          <a className="underline font-bold text-slate-700" href="/driver" target="_blank" rel="noreferrer">
            driver simulation portal
          </a>
          .
        </p>
      </Card>

      <div className="space-y-4 lg:col-span-2">
        <Card
          title={`Ambulances (${ambs.filter((a) => a.status === 'available').length}/${ambs.length} Available)`}
        >
          <ul className="max-h-52 space-y-1.5 overflow-y-auto text-xs pr-1">
            {ambs.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-2.5"
              >
                <div>
                  <span className="font-black text-slate-900">
                    {a.code} {a.is_animal && '🐾'}
                  </span>
                  <p className="text-[10px] text-slate-500">{a.base}</p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                    a.status === 'available'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Live SOS Incoming Requests">
          {sos.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">
              No active emergency requests yet. Press the SOS button in the citizen app.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {sos.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-slate-200 p-3 text-xs bg-white shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-slate-900">
                        #{s.id} {s.kind === 'animal' ? '🐾 Animal (1962)' : '🚑 Human (108)'}
                      </span>
                      {s.reason && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-800 uppercase tracking-wide">
                          {s.reason.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${STATUS[s.status]}`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-600">
                    {s.pressed_at ? `Pressed: ${new Date(s.pressed_at).toLocaleTimeString()}` : `Created: ${new Date(s.created_at).toLocaleTimeString()}`} · {s.facility?.name} ({s.facility?.distance_km} km) ·{' '}
                    <span className="font-bold text-slate-800">
                      {s.ambulance?.code ?? 'Searching nearest unit...'}
                    </span>
                  </p>
                  {s.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => void api.sosStatus(s.id, 'resolved').then(load)}
                      className="mt-1 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 active:scale-95 transition-all"
                    >
                      Mark Resolved
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
