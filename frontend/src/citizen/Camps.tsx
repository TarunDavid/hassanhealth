import { useEffect, useMemo, useState } from 'react'
import { api, type Camp } from '../api'
import { usePosition, km } from '../geo'
import { useLang } from '../i18n'
import { speak } from '../voice'
import { SpeakerButton } from './Shell'
import { track } from '../track'
import {
  BellIcon,
  DirectionsIcon,
  PhoneCallIcon,
} from '../icons'

export default function Camps() {
  const { lang, t } = useLang()
  const pos = usePosition()
  const [camps, setCamps] = useState<Camp[]>([])
  const [category, setCategory] = useState<'all' | 'human' | 'animal'>('all')
  const [selectedTaluk, setSelectedTaluk] = useState<string>('all')

  // Reminders persisted in localStorage
  const [remindedIds, setRemindedIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem('camp_reminders')
      return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>()
    } catch {
      return new Set<number>()
    }
  })

  useEffect(() => {
    void api.camps().then(setCamps).catch(() => setCamps([]))
  }, [])

  useEffect(() => {
    track('camps_opened')
    void speak(t('camps_intro'), lang, 'camps_intro')
  }, [lang, t])

  const taluks = useMemo(() => {
    return ['all', ...new Set(camps.map((c) => c.taluk))].sort()
  }, [camps])

  // Filter and sort by date
  const filtered = useMemo(() => {
    return camps
      .filter((c) => {
        if (category === 'human' && c.is_animal) return false
        if (category === 'animal' && !c.is_animal) return false
        if (selectedTaluk !== 'all' && c.taluk !== selectedTaluk) return false
        return true
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [camps, category, selectedTaluk])

  const handleRemindMe = (id: number) => {
    setRemindedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        track('camp_reminder', { detail: `camp_${id}` })
      }
      try {
        localStorage.setItem('camp_reminders', JSON.stringify([...next]))
      } catch {
        // Ignore
      }
      return next
    })
  }

  return (
    <div className="flex min-h-full flex-col gap-3.5 bg-slate-50 p-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-800 border border-slate-200 shadow-2xs">
        <span className="flex items-center gap-1.5 truncate">
          <span>{t('brand_subtitle')}</span>
        </span>
        <span className="shrink-0 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-extrabold text-white">
          {t('camps_free')}
        </span>
      </div>

      {/* Screen Heading */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 leading-tight">
              {t('camps_heading')}
            </h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {t('camps_subheading')}
            </p>
          </div>
          <SpeakerButton text={t('camps_intro')} clip="camps_intro" />
        </div>

        {/* Filter Controls */}
        <div className="mt-3.5 space-y-2">
          {/* Category Filter */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition-all ${
                category === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {t('all_types')}
            </button>
            <button
              type="button"
              onClick={() => setCategory('human')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition-all ${
                category === 'human' ? 'bg-red-700 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              {t('human')}
            </button>
            <button
              type="button"
              onClick={() => setCategory('animal')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-extrabold transition-all ${
                category === 'animal' ? 'bg-amber-800 text-white shadow-xs' : 'text-slate-600'
              }`}
            >
              {t('animal')}
            </button>
          </div>

          {/* Taluk Filter Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 shrink-0">
              {lang === 'kn' ? 'ತಾಲೂಕು:' : 'Taluk:'}
            </label>
            <select
              value={selectedTaluk}
              onChange={(e) => setSelectedTaluk(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-red-600"
            >
              {taluks.map((tk) => (
                <option key={tk} value={tk}>
                  {tk === 'all' ? t('all_taluks') : tk}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Camps List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs font-bold text-slate-500">
          {lang === 'kn' ? 'ಯಾವುದೇ ಶಿಬಿರಗಳು ನಿಗದಿಯಾಗಿಲ್ಲ' : 'No camps scheduled for this selection.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const isReminded = remindedIds.has(c.id)
            const campDist = km(pos, { lat: c.lat, lng: c.lng })
            const services = c.focus ? c.focus.split(',').map((s) => s.trim()).filter(Boolean) : []
            const d = new Date(c.date)
            const dayNum = d.getDate()
            const monthStr = d.toLocaleDateString(lang === 'kn' ? 'kn-IN' : 'en-US', { month: 'short' })

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3 transition-shadow hover:shadow-sm"
              >
                {/* Header Row: Date badge, Title, Taluk */}
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-black text-white shadow-2xs ${
                      c.is_animal ? 'bg-amber-800' : 'bg-red-700'
                    }`}
                  >
                    <span className="text-sm leading-none">{dayNum}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{monthStr}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-sm font-black text-slate-900 leading-tight truncate">
                        {c.title}
                      </h3>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-black shrink-0 ${
                          c.is_animal
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-red-100 text-red-900'
                        }`}
                      >
                        {c.is_animal ? t('animal') : t('human')}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-600 mt-0.5">
                      {c.village}, {c.taluk}
                    </p>

                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                      ↗ {campDist.toFixed(1)} {t('km')}
                    </p>
                  </div>
                </div>

                {/* Service Chips (derived from splitting focus on commas) */}
                {services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {services.map((tag, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleRemindMe(c.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition-all active:scale-98 ${
                      isReminded
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200'
                    }`}
                  >
                    <BellIcon size={14} />
                    <span>{isReminded ? '✔ ' + t('remind_me') : t('remind_me')}</span>
                  </button>

                  <a
                    href={`https://maps.google.com/?q=${c.lat},${c.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2.5 text-xs font-extrabold text-white shadow-2xs hover:bg-slate-800 transition-all active:scale-98"
                  >
                    <DirectionsIcon size={14} />
                    <span>{t('route')}</span>
                  </a>
                </div>

                {/* Reminder saved note */}
                {isReminded && (
                  <p className="text-[10px] font-semibold text-emerald-800 text-center">
                    {t('reminder_saved')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Doorstep Mobile Clinic Van (Disabled / Coming Soon) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🚐</span>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900">
                {t('doorstep_clinic')}
              </h4>
              <p className="text-[10px] text-slate-500">
                {t('cannot_travel_desc')}
              </p>
            </div>
          </div>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 border border-slate-200">
            {t('coming_soon')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <a
            href="tel:104"
            onClick={() => track('call_108', { detail: '104_helpline' })}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2 text-center text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-100"
          >
            <PhoneCallIcon size={13} className="text-red-600" />
            <span>104</span>
          </a>

          <a
            href="tel:1962"
            onClick={() => track('call_1962', { kind: 'animal' })}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 py-2 text-center text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-100"
          >
            <PhoneCallIcon size={13} className="text-amber-700" />
            <span>1962</span>
          </a>
        </div>
      </div>

      {/* WhatsApp Camp Alerts (Disabled / Coming Soon) */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs opacity-75">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-bold text-base">
            💬
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900">
              {t('whatsapp_camp_alerts')}
            </h4>
            <p className="text-[10px] font-medium text-slate-500">
              {t('coming_soon')}
            </p>
          </div>
        </div>

        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
          {t('coming_soon')}
        </span>
      </div>
    </div>
  )
}
