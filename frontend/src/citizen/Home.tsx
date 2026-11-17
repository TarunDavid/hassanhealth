import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import { api, type Ambulance, type Nearest, type Sos } from '../api'
import { getPosition, km, etaMinutes, type Pos, HASSAN } from '../geo'
import { useLang } from '../i18n'
import { pin } from '../mapIcons'
import { speak } from '../voice'
import { track, getSessionId } from '../track'
import { SpeakerButton } from './Shell'
import {
  MedicalCrossIcon,
  PawIcon,
  UserIcon,
  TargetIcon,
  PhoneCallIcon,
  NavigationPinIcon,
  ShareIcon,
  PlusIcon,
  CheckIcon,
} from '../icons'

const HOLD_MS = 1000

function FitAll({ points }: { points: [number, number][] }) {
  const map = useMap()
  const key = points.map((p) => p.join(',')).join('|')
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [30, 30], maxZoom: 14, animate: false })
    }
  }, [points, key, map])
  return null
}

type Phase = 'idle' | 'sending' | 'done' | 'error'

export default function Home() {
  const { lang, t } = useLang()
  const [panel, setPanel] = useState<0 | 1>(0) // 0: Human, 1: Animal
  const [phase, setPhase] = useState<Phase>('idle')
  const [sos, setSos] = useState<Sos | null>(null)
  const [amb, setAmb] = useState<Ambulance | null>(null)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)

  // Real location & nearest facility state
  const [pos, setPos] = useState<Pos>(HASSAN)
  const [nearestFac, setNearestFac] = useState<Nearest | null>(null)
  const [loadingLoc, setLoadingLoc] = useState(false)

  // Hold gesture state & refs
  const [holdProgress, setHoldProgress] = useState(0)
  const [showHoldHint, setShowHoldHint] = useState(false)
  const holdStartRef = useRef<number | null>(null)
  const holdRafRef = useRef<number | null>(null)
  const hasTriggeredRef = useRef(false)
  const isHoldingKeyRef = useRef(false)
  const hintTimeoutRef = useRef<number | null>(null)

  const isAnimal = panel === 1
  const prompt = isAnimal ? t('sos_animal') : t('sos_human')
  const clip = isAnimal ? 'sos_animal' : 'sos_human'

  // Fetch location and nearest facility
  const refreshLocation = useCallback(async () => {
    setLoadingLoc(true)
    const p = await getPosition()
    setPos(p)
    try {
      const n = await api.nearest(p.lat, p.lng, isAnimal ? 'animal' : 'human')
      setNearestFac(n)
    } catch {
      setNearestFac(null)
    } finally {
      setLoadingLoc(false)
    }
  }, [isAnimal])

  useEffect(() => {
    void refreshLocation()
  }, [refreshLocation])

  useEffect(() => {
    if (phase === 'idle') {
      void speak(prompt, lang, clip)
    }
  }, [panel, lang, phase, prompt, clip])

  // Polling dispatched ambulance updates
  useEffect(() => {
    if (phase !== 'done' || !sos?.ambulance) return
    const id = setInterval(async () => {
      const all = await api.ambulances().catch(() => [])
      const mine = all.find((a) => a.id === sos.ambulance!.id)
      if (mine) setAmb(mine)
    }, 3000)
    return () => clearInterval(id)
  }, [phase, sos])

  const triggerSos = useCallback(async (pressedIso?: string) => {
    if (phase === 'sending') return
    const pressedAtStr = pressedIso || new Date().toISOString()
    setPhase('sending')
    void speak(t('sending'), lang, 'sending')
    const finalReason = selectedReason || 'general'
    try {
      const livePos = await getPosition()
      const triageNote = selectedReason ? `[Reason: ${finalReason}]` : ''
      const res = await api.sendSos({
        lat: livePos.lat,
        lng: livePos.lng,
        kind: isAnimal ? 'animal' : 'human',
        reason: finalReason,
        pressed_at: pressedAtStr,
        session_id: getSessionId(),
        language: lang,
        note: triageNote,
      })
      setSos(res)
      setAmb(res.ambulance)
      setPhase('done')
      track('sos_sent', { kind: isAnimal ? 'animal' : 'human', detail: finalReason, lat: livePos.lat, lng: livePos.lng })
      void speak(
        res.ambulance ? t('dispatched') : t('logged'),
        lang,
        res.ambulance ? 'dispatched' : 'logged',
      )
    } catch {
      setPhase('error')
      track('sos_failed', { kind: isAnimal ? 'animal' : 'human', detail: 'network_or_api_error' })
      track('offline_fallback_shown')
      void speak(t('error'), lang, 'error')
    }
  }, [phase, isAnimal, lang, selectedReason, t])

  const cancelHold = useCallback(
    (reason: 'tap' | 'abort') => {
      if (holdRafRef.current) {
        cancelAnimationFrame(holdRafRef.current)
        holdRafRef.current = null
      }
      setHoldProgress(0)

      if (reason === 'tap' && !hasTriggeredRef.current && holdStartRef.current !== null) {
        const elapsed = performance.now() - holdStartRef.current
        if (elapsed < HOLD_MS) {
          setShowHoldHint(true)
          track('sos_hold_cancelled', { kind: isAnimal ? 'animal' : 'human', detail: `${Math.round(elapsed)}ms` })
          void speak(t('hold_hint'), lang, 'hold_hint')
          if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current)
          hintTimeoutRef.current = window.setTimeout(() => setShowHoldHint(false), 2000)
        }
      }
      holdStartRef.current = null
    },
    [isAnimal, lang, t],
  )

  const startHold = useCallback(() => {
    if (phase === 'sending' || hasTriggeredRef.current) return
    hasTriggeredRef.current = false
    setShowHoldHint(false)
    track('sos_hold_started', { kind: isAnimal ? 'animal' : 'human', lat: pos.lat, lng: pos.lng })
    const startTime = performance.now()
    holdStartRef.current = startTime

    const updateFrame = () => {
      const now = performance.now()
      const elapsed = now - startTime
      const progress = Math.min(100, (elapsed / HOLD_MS) * 100)
      setHoldProgress(progress)

      if (elapsed >= HOLD_MS) {
        if (!hasTriggeredRef.current) {
          hasTriggeredRef.current = true
          navigator.vibrate?.(60)
          setHoldProgress(100)
          const pressedIso = new Date().toISOString()
          void triggerSos(pressedIso)
        }
      } else {
        holdRafRef.current = requestAnimationFrame(updateFrame)
      }
    }

    holdRafRef.current = requestAnimationFrame(updateFrame)
  }, [phase, isAnimal, pos, triggerSos])

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    startHold()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore if not captured
    }
    cancelHold('tap')
  }

  const handlePointerCancel = () => {
    cancelHold('abort')
  }

  const handlePointerLeave = () => {
    cancelHold('abort')
  }

  // Keyboard accessibility: hold Enter or Space for 1000ms
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.repeat) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      isHoldingKeyRef.current = true
      startHold()
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      isHoldingKeyRef.current = false
      cancelHold('tap')
    }
  }

  if (phase === 'done' && sos) {
    return (
      <Result
        sos={sos}
        amb={amb}
        onBack={() => {
          setPhase('idle')
          setSos(null)
          hasTriggeredRef.current = false
        }}
      />
    )
  }

  // Human Triage Options
  const humanTriageOptions = [
    { id: 'snakebite', icon: '🐍', title: t('triage_snake') },
    { id: 'accident', icon: '🚨', title: t('triage_trauma') },
    { id: 'maternal', icon: '🤰', title: t('triage_maternal') },
  ]

  // Animal Triage Options
  const animalTriageOptions = [
    { id: 'animal_sick', icon: '🐮', title: t('triage_animal_sick'), desc: t('triage_cattle_desc') },
    { id: 'animal_injury', icon: '🩹', title: t('triage_animal_injury'), desc: t('triage_dog_desc') },
    { id: 'other', icon: '🐑', title: t('triage_other'), desc: t('triage_sheep_desc') },
  ]

  const handleSwitchMode = (mode: 0 | 1) => {
    setPanel(mode)
    setSelectedReason(null)
    if (mode === 1) {
      track('animal_mode_on')
    } else {
      track('human_mode_on')
    }
  }

  // SVG progress circle constants (radius = 112 for 240px button)
  const radius = 112
  const circumference = 2 * Math.PI * radius
  const strokeOffset = circumference - (holdProgress / 100) * circumference

  return (
    <div className={`flex min-h-full flex-col justify-between px-4 py-3.5 ${isAnimal ? 'bg-amber-50/40' : 'bg-slate-50'}`}>
      <div className="space-y-4">
        {/* Top Switcher Segmented Control */}
        <div className="flex items-center justify-between">
          <div className="flex rounded-full bg-slate-200/80 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => handleSwitchMode(0)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold transition-all ${
                !isAnimal ? 'bg-red-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserIcon size={14} />
              <span>{t('human')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode(1)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold transition-all ${
                isAnimal ? 'bg-amber-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PawIcon size={14} />
              <span>{t('animal')}</span>
            </button>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              isAnimal
                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isAnimal ? 'bg-amber-600' : 'bg-emerald-600'}`} />
            <span>{isAnimal ? '1962' : '108'}</span>
          </div>
        </div>

        {isAnimal && (
          <div className="flex items-center justify-between px-1 text-xs font-bold text-amber-900">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-600" />
              {t('pashu_helpline')}
            </span>
            <span className="text-amber-800/80">{t('district_unit')}</span>
          </div>
        )}

        {/* Central SOS Button with Circular Progress Ring */}
        <div className="relative my-4 flex flex-col items-center justify-center py-4">
          {/* Subtle Ambient Rings */}
          <div
            className={`absolute h-72 w-72 rounded-full opacity-40 transition-opacity ${
              holdProgress > 0 ? 'opacity-80 scale-105' : 'opacity-40'
            } ${isAnimal ? 'bg-amber-400/20' : 'bg-red-500/20'}`}
          />
          <div
            className={`absolute h-60 w-60 rounded-full opacity-30 ${
              isAnimal ? 'bg-amber-300/30' : 'bg-red-400/30'
            }`}
          />

          {/* SVG Progress Ring */}
          <svg
            className="absolute z-20 pointer-events-none -rotate-90"
            width="248"
            height="248"
            viewBox="0 0 248 248"
          >
            <circle
              cx="124"
              cy="124"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className={isAnimal ? 'text-amber-400/20' : 'text-red-300/20'}
            />
            <circle
              cx="124"
              cy="124"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className={isAnimal ? 'text-amber-200' : 'text-white'}
              style={{ transition: holdProgress === 0 ? 'stroke-dashoffset 0.15s ease-out' : 'none' }}
            />
          </svg>

          {/* Main Hold-to-Dispatch Button */}
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onContextMenu={(e) => e.preventDefault()}
            disabled={phase === 'sending'}
            aria-label={isAnimal ? t('sos_animal') : t('sos_human')}
            style={{ touchAction: 'none' }}
            className={`relative z-10 flex h-60 w-60 select-none flex-col items-center justify-center rounded-full text-white shadow-2xl transition-transform active:scale-98 disabled:opacity-75 ${
              isAnimal
                ? 'bg-gradient-to-b from-amber-600 via-amber-700 to-amber-900 shadow-amber-900/40'
                : 'bg-gradient-to-b from-red-500 via-red-600 to-red-800 shadow-red-900/40'
            }`}
          >
            {/* Icon */}
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/80 bg-white/15 text-white backdrop-blur-xs">
              {isAnimal ? <PawIcon size={30} /> : <MedicalCrossIcon size={28} />}
            </div>

            {/* Primary Action Label */}
            <span className="text-xl font-black uppercase tracking-wider leading-none text-center px-4 drop-shadow-sm">
              {isAnimal ? t('sos_btn_animal') : t('sos_btn_human')}
            </span>

            {/* Hold Hint Badge */}
            <div className="mt-3 rounded-full bg-black/30 px-3.5 py-1 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur-xs border border-white/25">
              {holdProgress > 0 ? `${Math.round(holdProgress)}%` : t('hold_btn_label')}
            </div>
          </button>

          {/* Short tap hint notice */}
          {showHoldHint && (
            <div className="mt-3 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-black text-white shadow-lg animate-bounce">
              ⚠️ {t('hold_hint')}
            </div>
          )}

          {phase === 'sending' && (
            <p className="mt-3 font-bold text-red-600 animate-pulse text-sm">
              {t('sending')}
            </p>
          )}

          {phase === 'error' && (
            <div className="mt-3 rounded-xl bg-red-100 p-2.5 text-center text-xs font-bold text-red-700 border border-red-200">
              {t('error')}{' '}
              <a
                href="tel:108"
                onClick={() => track('call_108', { detail: 'offline_fallback' })}
                className="underline font-black ml-1"
              >
                {t('call108')}
              </a>
            </div>
          )}
        </div>

        {/* Switch Banner */}
        <div
          onClick={() => handleSwitchMode(isAnimal ? 0 : 1)}
          className={`cursor-pointer rounded-2xl border p-3.5 transition-all shadow-xs active:scale-98 ${
            isAnimal
              ? 'border-red-200 bg-red-50/70 hover:bg-red-50'
              : 'border-amber-200 bg-amber-50/70 hover:bg-amber-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-xs ${
                  isAnimal ? 'bg-red-600' : 'bg-amber-700'
                }`}
              >
                {isAnimal ? <UserIcon size={20} /> : <PawIcon size={20} />}
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900">
                  {isAnimal ? t('switch_to_human') : t('switch_to_animal')}
                </h4>
                <p className="text-[11px] font-medium text-slate-500">
                  {isAnimal ? t('switch_to_human_sub') : t('switch_to_animal_sub')}
                </p>
              </div>
            </div>
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-black shadow-xs ${
                isAnimal ? 'bg-red-600 text-white' : 'bg-amber-800 text-white'
              }`}
            >
              {t('switch_btn')}
            </span>
          </div>
        </div>

        {/* Triage Section */}
        {!isAnimal ? (
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-extrabold uppercase text-slate-800">
                {t('triage_human_title')}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-600">
                {t('triage_human_badge')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {humanTriageOptions.map((opt) => {
                const isSelected = selectedReason === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedReason(isSelected ? null : opt.id)}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-3 transition-all active:scale-95 ${
                      isSelected
                        ? 'border-red-600 bg-red-50 shadow-xs ring-2 ring-red-600 font-black'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <span className="mt-1 text-center text-xs font-extrabold text-slate-900 leading-tight">
                      {opt.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between pb-2">
              <div>
                <h3 className="text-xs font-black uppercase text-amber-950">
                  {t('triage_animal_title')}
                </h3>
                <p className="text-[10px] text-amber-800 font-medium">
                  {t('triage_animal_sub')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {animalTriageOptions.map(({ id, icon, title, desc }) => {
                const isSelected = selectedReason === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedReason(isSelected ? null : id)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-3 transition-all active:scale-98 ${
                      isSelected
                        ? 'border-amber-700 bg-amber-100/70 shadow-xs ring-2 ring-amber-700 font-black'
                        : 'border-amber-200/70 bg-white hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{icon}</span>
                      <div className="text-left">
                        <span className="text-xs font-extrabold text-slate-900">
                          {title}
                        </span>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {desc}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-400">
                      {isSelected ? '✓' : '+'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Selected Reason Feedback */}
        {selectedReason && (
          <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-center text-xs font-bold text-slate-800 border border-slate-200">
            {t('selected_reason')}{' '}
            <span className="font-black text-red-700">
              {selectedReason === 'snakebite' ? t('triage_snake') :
               selectedReason === 'accident' ? t('triage_trauma') :
               selectedReason === 'maternal' ? t('triage_maternal') :
               selectedReason === 'animal_sick' ? t('triage_animal_sick') :
               selectedReason === 'animal_injury' ? t('triage_animal_injury') :
               t('triage_other')}
            </span>
          </div>
        )}

        {/* Real Location Card (Idle State) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600">
              <TargetIcon size={14} className={isAnimal ? 'text-amber-700' : 'text-red-600'} />
              {t('location_title')}
            </span>

            {/* Real precision badge - ONLY show when GPS is not approx */}
            {!pos.approx && pos.accuracy !== undefined ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>GPS ±{pos.accuracy}m</span>
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div>
              {pos.approx ? (
                <p className="text-xs font-extrabold text-amber-800">
                  ⚠️ {t('approx_location_gps')}
                </p>
              ) : (
                <h4 className="text-sm font-extrabold text-slate-900">
                  {nearestFac?.taluk ? `${nearestFac.taluk} ${lang === 'kn' ? 'ತಾಲೂಕು' : 'Taluk'}` : 'Hassan'}
                </h4>
              )}
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
              </p>
            </div>

            {/* Refresh Location Button (actually refreshes state) */}
            <button
              type="button"
              onClick={() => void refreshLocation()}
              disabled={loadingLoc}
              title={t('refresh_location')}
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 active:scale-95 ${
                loadingLoc ? 'animate-spin text-red-600' : ''
              }`}
            >
              <TargetIcon size={18} />
            </button>
          </div>

          {/* Real Nearest Facility Info Row */}
          {nearestFac && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-slate-700 truncate pr-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${isAnimal ? 'bg-amber-600' : 'bg-red-600'}`} />
                <span className="truncate">
                  {isAnimal ? t('nearest_vet_hospital') : t('nearest_facility')}:{' '}
                  {lang === 'kn' && nearestFac.name_kn ? nearestFac.name_kn : nearestFac.name} (
                  {nearestFac.distance_km} {t('km')})
                </span>
              </span>
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800 shrink-0">
                ~{nearestFac.distance_km ? etaMinutes(nearestFac.distance_km) : 10} {t('min')}
              </span>
            </div>
          )}

          {isAnimal && (
            <div className="mt-3 flex gap-2">
              <a
                href="tel:1962"
                onClick={() => track('call_1962', { kind: 'animal' })}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-center text-xs font-extrabold text-slate-900 shadow-xs hover:bg-amber-400 active:scale-98"
              >
                <PhoneCallIcon size={16} />
                <span>{t('call_1962')}</span>
              </a>
              <SpeakerButton
                text={t('call_1962')}
                clip="sos_animal"
                className="shrink-0"
              />
            </div>
          )}
        </div>

        {/* Anonymous usage logging privacy notice */}
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-center text-xs font-medium text-slate-600 shadow-2xs">
          <span className="font-extrabold text-slate-900">🔒 {lang === 'kn' ? 'ಗೌಪ್ಯತೆ ರಕ್ಷಣೆ:' : 'Privacy Protection:'}</span>{' '}
          {t('anonymous_notice')}
        </div>
      </div>
    </div>
  )
}

/** Active Dispatch Tracking Screen */
function Result({
  sos,
  amb,
  onBack,
}: {
  sos: Sos
  amb: Ambulance | null
  onBack: () => void
}) {
  const { lang, t } = useLang()
  const [addedNote, setAddedNote] = useState(sos.note || '')
  const [showAddModal, setShowAddModal] = useState(false)
  const [landmarkInput, setLandmarkInput] = useState('')

  const f = sos.facility
  const user = { lat: sos.lat, lng: sos.lng }
  const dist = amb ? km(amb, user) : (f?.distance_km ?? 5.6)
  const eta = etaMinutes(dist)

  // Real timeline timestamps derived from created_at
  const createdDate = new Date(sos.created_at)
  const sentTimeStr = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const arrivedDate = new Date(createdDate.getTime() + eta * 60000)
  const arrivedTimeStr = arrivedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const handleShare = () => {
    const text = `Hassan Emergency Tracking #${sos.id}: Ambulance ${amb?.code ?? ''} dispatched. ${window.location.origin}/`
    if (navigator.share) {
      void navigator.share({ title: `Hassan Emergency #${sos.id}`, text, url: window.location.origin })
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
      window.open(waUrl, '_blank')
    }
  }

  const handleSaveLandmark = async () => {
    if (!landmarkInput.trim()) return
    const combined = addedNote ? `${addedNote} · ${landmarkInput.trim()}` : landmarkInput.trim()
    try {
      await api.updateSosNote(sos.id, combined)
      setAddedNote(combined)
      setShowAddModal(false)
      setLandmarkInput('')
    } catch {
      alert('Could not update note. Check network connection.')
    }
  }

  const { user: authUser } = useAuth()
  const [live, setLive] = useState<Sos>(sos)
  useEffect(() => {
    let on = true
    const poll = () => api.sosDetail(sos.id).then((x) => on && setLive(x)).catch(() => {})
    void poll()
    const i = setInterval(() => void poll(), 6000)
    // A signed-in patient shares live location every 10 s so the responding doctor can follow
    const loc = authUser?.role === 'patient' && navigator.geolocation
      ? setInterval(() => navigator.geolocation.getCurrentPosition((p) => { void api.sosLocation(sos.id, p.coords.latitude, p.coords.longitude).catch(() => {}) }, () => {}, { maximumAge: 5000 }), 10000)
      : undefined
    return () => { on = false; clearInterval(i); if (loc) clearInterval(loc) }
  }, [sos.id, authUser?.role])

  const handleCancel = async () => {
    if (confirm(t('cancel_sos') + '?')) {
      await api.sosStatus(sos.id, 'resolved').catch(() => {})
      onBack()
    }
  }

  return (
    <div className="flex min-h-full flex-col gap-3.5 bg-slate-50 p-4">
      {/* Top Tracking Header Card */}
      <div className="flex items-center justify-between rounded-2xl bg-emerald-700 p-4 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-xs">
            <NavigationPinIcon size={22} />
          </div>
          <div>
            <h2 className="text-base font-black leading-tight tracking-tight">
              {t('help_on_way')}
            </h2>
            <p className="text-xs font-medium text-emerald-100 mt-0.5">
              {t('help_on_way_sub')}
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Reason & Press Time Card */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xl border border-red-200">
            {sos.reason === 'snakebite' ? '🐍' :
             sos.reason === 'accident' ? '🚨' :
             sos.reason === 'maternal' ? '🤰' :
             sos.reason === 'animal_sick' ? '🐮' :
             sos.reason === 'animal_injury' ? '🩹' :
             sos.kind === 'animal' ? '🐾' : '🆘'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-900">
                {sos.reason === 'snakebite' ? t('triage_snake') :
                 sos.reason === 'accident' ? t('triage_trauma') :
                 sos.reason === 'maternal' ? t('triage_maternal') :
                 sos.reason === 'animal_sick' ? t('triage_animal_sick') :
                 sos.reason === 'animal_injury' ? t('triage_animal_injury') :
                 sos.reason === 'general' ? t('triage_general') :
                 t('triage_other')}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 capitalize border border-slate-200">
                {sos.kind === 'animal' ? t('animal') : t('human')}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              {t('step_sent')}: {sos.pressed_at ? new Date(sos.pressed_at).toLocaleTimeString() : sentTimeStr}
            </p>
          </div>
        </div>
      </div>

      {/* Doctor alert status */}
      {live.doctor_responding ? (
        <div data-testid="doctor-responding" className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 text-sm font-extrabold text-emerald-900">
          {t('a_dr_informed')} Dr {live.doctor_responding.name}
        </div>
      ) : authUser?.role === 'patient' && (live.doctors_alerted ?? 0) > 0 ? (
        <div data-testid="doctor-alerted" className="rounded-2xl border-2 border-sky-300 bg-sky-50 p-3 text-sm font-extrabold text-sky-900">{t('a_dr_alerted')}</div>
      ) : !authUser ? (
        <Link to="/login" className="block rounded-2xl border-2 border-slate-300 bg-white p-3 text-sm font-extrabold text-slate-800">{t('a_login_nudge')}</Link>
      ) : null}

      {/* Dispatch Progress Stepper */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-900">
            {t('dispatch_progress')}
          </span>
          <span className="text-[10px] font-bold text-emerald-600">
            {t('updated_now')}
          </span>
        </div>

        <div className="relative mt-4 flex items-center justify-between">
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0" />
          <div className="absolute top-4 left-6 right-1/2 h-0.5 bg-emerald-600 -z-0" />

          {/* Step 1 */}
          <div className="z-10 flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
              <CheckIcon size={16} />
            </div>
            <span className="mt-1.5 text-[11px] font-extrabold text-slate-800">
              {t('step_sent')}
            </span>
            <span className="text-[9px] text-slate-400">{sentTimeStr}</span>
          </div>

          {/* Step 2 */}
          <div className="z-10 flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-xs ring-4 ring-red-100 animate-pulse">
              <NavigationPinIcon size={14} />
            </div>
            <span className="mt-1.5 text-[11px] font-black text-red-600">
              {t('step_dispatched')}
            </span>
            <span className="text-[9px] font-bold text-red-600">
              #{sos.id}
            </span>
          </div>

          {/* Step 3 */}
          <div className="z-10 flex flex-col items-center opacity-60">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600">
              <TargetIcon size={16} />
            </div>
            <span className="mt-1.5 text-[11px] font-bold text-slate-700">
              {t('step_arrived')}
            </span>
            <span className="text-[9px] text-slate-400">~{arrivedTimeStr}</span>
          </div>
        </div>
      </div>

      {/* Ambulance Real Details Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">
                {amb?.code ?? 'Ambulance Assigned'}
              </h3>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-800">
                ID: #HSN-108-{sos.id}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {amb?.base ? `${amb.base} ➔ ${lang === 'kn' ? 'ನಿಮ್ಮ ಸ್ಥಳ' : 'Your location'}` : 'En route to your location'}
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-red-600 leading-none">
              {eta} <span className="text-sm">{t('min')}</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500">
              {dist.toFixed(1)} {t('km')}
            </span>
          </div>
        </div>

        {/* Call 108 Emergency Helpline Button */}
        <a
          href="tel:108"
          onClick={() => track('call_108', { kind: sos.kind })}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-center text-sm font-black text-white shadow-xs transition-transform hover:bg-emerald-800 active:scale-98"
        >
          <PhoneCallIcon size={18} />
          <span>{t('call_108_btn')}</span>
        </a>
      </div>

      {/* Live Route Navigation Map Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
        <div className="flex items-center justify-between pb-2">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900">
              {t('tracking_title')}
            </h4>
            <p className="text-[10px] font-medium text-slate-500">
              {amb?.base ? `${amb.base} ➔ ${lang === 'kn' ? 'ನಿಮ್ಮ ಸ್ಥಳ' : 'Your location'}` : 'GPS Telematics'}
            </p>
          </div>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 border border-red-200">
            ((•)) GPS
          </span>
        </div>

        <div className="relative h-48 overflow-hidden rounded-xl border border-slate-200">
          <MapContainer
            center={[sos.lat, sos.lng]}
            zoom={12}
            className="h-full w-full"
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution="© OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitAll
              points={[
                [sos.lat, sos.lng],
                ...(f ? ([[f.lat, f.lng]] as [number, number][]) : []),
                ...(amb ? ([[amb.lat, amb.lng]] as [number, number][]) : []),
              ]}
            />
            <Marker position={[sos.lat, sos.lng]} icon={pin('user', 34, 'Your Location')} />
            {f && <Marker position={[f.lat, f.lng]} icon={pin(f.type, 30, f.name)} />}
            {amb && <Marker position={[amb.lat, amb.lng]} icon={pin('amb', 34, amb.code)} />}
            {amb && (
              <Polyline
                positions={[
                  [amb.lat, amb.lng],
                  [sos.lat, sos.lng],
                ]}
                pathOptions={{ color: '#059669', weight: 4, dashArray: '6 8' }}
              />
            )}
          </MapContainer>
        </div>
      </div>

      {/* Designated Facility Card */}
      {f && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div>
            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-700 uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              {t('designated_hospital')}
            </span>
            <h4 className="text-sm font-black text-slate-900 mt-0.5">
              {lang === 'kn' && f.name_kn ? f.name_kn : f.name}
            </h4>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {f.taluk} · {f.distance_km} {t('km')}
            </p>
          </div>

          <a
            href={f.phone ? `tel:${f.phone}` : 'tel:108'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 transition-transform active:scale-90 border border-red-200 shadow-2xs"
            title="Call Facility"
          >
            <PhoneCallIcon size={18} />
          </a>
        </div>
      )}

      {/* Share & Landmark Action Buttons */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleShare}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-extrabold text-slate-800 shadow-xs hover:bg-slate-50 active:scale-98"
        >
          <ShareIcon size={16} />
          <span>{t('share_link')}</span>
        </button>

        {addedNote && (
          <div className="rounded-xl bg-blue-50 p-2.5 text-xs text-blue-900 border border-blue-200">
            <b>{t('landmark_added')}</b> {addedNote}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs font-extrabold text-slate-800 shadow-xs hover:bg-slate-50 active:scale-98"
        >
          <div className="text-left">
            <p>{t('add_landmark')}</p>
            <p className="text-[10px] font-normal text-slate-500">
              {t('add_landmark_sub')}
            </p>
          </div>
          <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-700">
            <PlusIcon size={12} /> Add
          </span>
        </button>
      </div>

      {/* Cancel Link */}
      <div className="text-center pt-1 pb-4">
        <button
          type="button"
          onClick={() => void handleCancel()}
          className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline"
        >
          {t('cancel_sos')}
        </button>
      </div>

      {/* Add Landmark Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-black text-slate-900">
              {t('add_landmark')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {t('add_landmark_sub')}
            </p>
            <textarea
              value={landmarkInput}
              onChange={(e) => setLandmarkInput(e.target.value)}
              placeholder="e.g. Near bus stand water tank, unconscious patient..."
              rows={3}
              maxLength={200}
              className="mt-3 w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium focus:border-red-500 focus:outline-none"
            />
            <p className="mt-1 text-[10px] font-bold text-amber-800">
              🔒 {lang === 'kn'
                ? 'ಗೌಪ್ಯತೆ ರಕ್ಷಣೆ: ಯಾವುದೇ ಹೆಸರು ಅಥವಾ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಬೇಡಿ. ಸ್ಥಳದ ಗುರುತು ಮಾತ್ರ ನಮೂದಿಸಿ (ಗರಿಷ್ಠ 200 ಅಕ್ಷರ).'
                : 'Privacy Notice: Do not enter personal names or phone numbers. Only landmarks/conditions (max 200 chars).'}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700"
              >
                {t('back')}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveLandmark()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-xs"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
