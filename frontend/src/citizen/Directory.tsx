import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { api, type Facility } from '../api'
import { usePosition, etaMinutes } from '../geo'
import { useLang, type Key } from '../i18n'
import { pin } from '../mapIcons'
import { speak } from '../voice'
import { track } from '../track'
import {
  SearchIcon,
  MicIcon,
  DirectionsIcon,
  TargetIcon,
  MedicalCrossIcon,
  PawIcon,
} from '../icons'

function MapControls({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap()
  return (
    <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => map.zoomIn()}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-slate-800 shadow-md backdrop-blur-xs font-black text-base hover:bg-slate-100"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-slate-800 shadow-md backdrop-blur-xs font-black text-base hover:bg-slate-100"
      >
        -
      </button>
      <button
        type="button"
        onClick={() => map.setView([center.lat, center.lng], 12)}
        title="Recenter"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-slate-800 shadow-md backdrop-blur-xs hover:bg-slate-100"
      >
        <TargetIcon size={16} />
      </button>
    </div>
  )
}

function Recentre({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 11, { animate: false })
  }, [lat, lng, map])
  return null
}

export default function Directory() {
  const { lang, t } = useLang()
  const pos = usePosition()
  const [list, setList] = useState<Facility[]>([])
  const [filter, setFilter] = useState<'all' | 'hospital' | 'vet'>('all')
  const [search, setSearch] = useState('')
  const [listening, setListening] = useState(false)

  useEffect(() => {
    void api.facilities(pos.lat, pos.lng).then(setList).catch(() => setList([]))
  }, [pos])

  useEffect(() => {
    track('map_opened')
    void speak(t('map_intro'), lang, 'map_intro')
  }, [lang, t])

  const handleVoiceSearch = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert(lang === 'kn' ? 'ಧ್ವನಿ ಹುಡುಕಾಟ ಲಭ್ಯವಿಲ್ಲ' : 'Voice search is not supported in this browser.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = lang === 'kn' ? 'kn-IN' : 'en-IN'
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      setSearch(text)
    }
    recognition.start()
  }

  const filtered = useMemo(() => {
    return list.filter((f) => {
      // Type filter
      if (filter === 'vet' && f.type !== 'vet') return false
      if (filter === 'hospital' && (f.type === 'vet' || f.type === 'clinic')) return false

      // Search filter
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        f.name.toLowerCase().includes(q) ||
        (f.name_kn && f.name_kn.toLowerCase().includes(q)) ||
        f.taluk.toLowerCase().includes(q) ||
        f.type.toLowerCase().includes(q)
      )
    })
  }, [list, filter, search])

  // Real badges derived from actual facility properties
  const getBadges = (f: Facility) => {
    const badges: { text: string; bg: string; color: string }[] = []
    if (f.has_emergency) {
      badges.push({
        text: lang === 'kn' ? '24/7 ತುರ್ತು ಸೇವೆ' : '24/7 Emergency',
        bg: 'bg-red-50',
        color: 'text-red-700',
      })
    }
    if (f.has_telemedicine) {
      badges.push({
        text: lang === 'kn' ? 'ಟೆಲಿಮೆಡಿಸಿನ್ ಲಭ್ಯ' : 'Telemedicine Active',
        bg: 'bg-blue-50',
        color: 'text-blue-700',
      })
    }
    if (!f.has_internet) {
      badges.push({
        text: lang === 'kn' ? 'ಇಂಟರ್ನೆಟ್ ಇಲ್ಲ' : 'No Internet',
        bg: 'bg-amber-50',
        color: 'text-amber-800',
      })
    }
    if (f.specialist_services) {
      badges.push({
        text: f.specialist_services,
        bg: 'bg-slate-100',
        color: 'text-slate-700',
      })
    }
    return badges
  }

  const getCardStyle = (f: Facility) => {
    const typeKey = `type_${f.type}` as Key
    switch (f.type) {
      case 'hub':
        return {
          icon: <MedicalCrossIcon size={18} />,
          iconBg: 'bg-red-600 text-white',
          typeLabel: t(typeKey),
          btnBg: 'bg-emerald-700 hover:bg-emerald-800 text-white',
        }
      case 'clinic':
        return {
          icon: <span className="font-extrabold text-base">C</span>,
          iconBg: 'bg-purple-100 text-purple-700',
          typeLabel: t(typeKey),
          btnBg: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200',
        }
      case 'vet':
        return {
          icon: <PawIcon size={18} />,
          iconBg: 'bg-amber-600 text-white',
          typeLabel: t(typeKey),
          btnBg: 'bg-amber-700 hover:bg-amber-800 text-white',
        }
      default:
        return {
          icon: <MedicalCrossIcon size={18} />,
          iconBg: 'bg-emerald-600 text-white',
          typeLabel: t(typeKey),
          btnBg: 'bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200',
        }
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      {/* Top Category Filter Row */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-100 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold transition-all shrink-0 ${
            filter === 'all'
              ? 'bg-red-700 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>{t('all_types')}</span>
          <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">
            {list.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('hospital')}
          className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold transition-all shrink-0 ${
            filter === 'hospital'
              ? 'bg-red-700 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <MedicalCrossIcon size={12} />
          <span>{t('hospitals_only')}</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('vet')}
          className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold transition-all shrink-0 ${
            filter === 'vet'
              ? 'bg-amber-800 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <PawIcon size={12} />
          <span>{t('vets_only')}</span>
        </button>
      </div>

      {/* Interactive Map Area */}
      <div className="relative h-64 w-full bg-slate-200 border-b border-slate-200">
        <MapContainer
          center={[pos.lat, pos.lng]}
          zoom={11}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution="© OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recentre lat={pos.lat} lng={pos.lng} />
          <MapControls center={pos} />

          {/* User Location Marker */}
          <Marker
            position={[pos.lat, pos.lng]}
            icon={pin('user', 32, lang === 'kn' ? 'ನಿಮ್ಮ ಸ್ಥಳ' : 'Your location')}
          />

          {/* Facility Pins */}
          {filtered.map((f) => (
            <Marker
              key={f.id}
              position={[f.lat, f.lng]}
              icon={pin(f.type, 30, lang === 'kn' && f.name_kn ? f.name_kn : f.name)}
              eventHandlers={{
                click: () => {
                  track('facility_selected', { detail: f.name.slice(0, 50), kind: f.type === 'vet' ? 'animal' : 'human', lat: f.lat, lng: f.lng })
                },
              }}
            >
              <Popup>
                <div className="p-1">
                  <h4 className="font-bold text-xs">
                    {lang === 'kn' && f.name_kn ? f.name_kn : f.name}
                  </h4>
                  <p className="text-[10px] text-slate-500">{f.taluk}</p>
                  <p className="text-[10px] font-bold text-emerald-700 mt-1">
                    {f.distance_km} {t('km')} · ~{f.distance_km ? etaMinutes(f.distance_km) : 10} {t('min')}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Directory Content List Container */}
      <div className="flex-1 bg-white p-4 space-y-3.5 rounded-t-3xl shadow-lg -mt-3 relative z-10">
        <div className="mx-auto h-1 w-12 rounded-full bg-slate-300" />

        {/* Search Input Bar */}
        <div className="relative flex items-center">
          <SearchIcon size={18} className="absolute left-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-10 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-red-500 focus:bg-white focus:outline-none shadow-2xs"
          />
          <button
            type="button"
            onClick={handleVoiceSearch}
            title="Voice Search"
            className={`absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-red-600 ${
              listening ? 'text-red-600 animate-pulse' : ''
            }`}
          >
            <MicIcon size={16} />
          </button>
        </div>

        {/* Nearby Facilities Title Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-600 text-xs font-bold">✓</span>
            <h3 className="text-xs font-extrabold text-slate-900">
              {t('nearby_facilities')}
            </h3>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-700 border border-indigo-100">
            {filtered.length} {t('found')}
          </span>
        </div>

        {/* Facility Cards List */}
        <div className="space-y-3">
          {filtered.slice(0, 15).map((f) => {
            const style = getCardStyle(f)
            const badges = getBadges(f)
            const eta = f.distance_km ? etaMinutes(f.distance_km) : 10

            return (
              <div
                key={f.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-shadow hover:shadow-sm space-y-2.5"
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-2xs ${style.iconBg}`}
                    >
                      {style.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-black text-slate-900 leading-tight">
                          {lang === 'kn' && f.name_kn ? f.name_kn : f.name}
                        </h4>
                        <span className="rounded bg-orange-100 px-1.5 py-0.2 text-[9px] font-black text-orange-900">
                          {style.typeLabel}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        {f.taluk}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                        ↗ {f.distance_km ?? '0'} {t('km')} · ~{eta} {t('min')} {t('drive')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Badges row */}
                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {badges.map((b, idx) => (
                      <span
                        key={idx}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${b.bg} ${b.color} border border-slate-100`}
                      >
                        {b.text}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Buttons row */}
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={f.phone ? `tel:${f.phone}` : 'tel:108'}
                    onClick={() => {
                      if (!f.phone || f.phone === '108') {
                        track('call_108', { detail: f.name.slice(0, 50) })
                      } else {
                        track('facility_selected', { detail: `call_${f.name}`.slice(0, 50), kind: f.type === 'vet' ? 'animal' : 'human' })
                      }
                    }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-center text-xs font-extrabold shadow-2xs transition-transform active:scale-98 ${style.btnBg}`}
                  >
                    <span>{t('call')}</span>
                  </a>

                  <a
                    href={`https://maps.google.com/?q=${f.lat},${f.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track('facility_selected', { detail: `route_${f.name}`.slice(0, 50), kind: f.type === 'vet' ? 'animal' : 'human' })}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-colors border border-slate-200"
                    title={t('get_route')}
                  >
                    <DirectionsIcon size={16} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
