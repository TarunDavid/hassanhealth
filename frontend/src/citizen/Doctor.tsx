import { useEffect, useState } from 'react'
import { api, type Nearest } from '../api'
import { usePosition } from '../geo'
import { useLang, type Key } from '../i18n'
import { speak } from '../voice'
import { SpeakerButton } from './Shell'
import { track } from '../track'
import DoctorsList from '../account/DoctorsList'
import {
  VideoCameraIcon,
  PhoneCallIcon,
  ChevronRightIcon,
  BuildingIcon,
  CheckIcon,
} from '../icons'

export default function Doctor() {
  const { lang, t } = useLang()
  const pos = usePosition()
  const [n, setN] = useState<Nearest | null>(null)
  const [chainOpen, setChainOpen] = useState(false)

  // Checklist state persisted in localStorage
  const [checks, setChecks] = useState<Record<number, boolean>>(() => {
    try {
      const saved = localStorage.getItem('telemedicine_checklist')
      return saved ? JSON.parse(saved) : { 0: true, 1: true, 2: false }
    } catch {
      return { 0: true, 1: true, 2: false }
    }
  })

  useEffect(() => {
    void api.nearest(pos.lat, pos.lng, 'human').then(setN).catch(() => setN(null))
  }, [pos])

  useEffect(() => {
    track('doctor_opened')
    void speak(t('doctor_intro'), lang, 'doctor_intro')
  }, [lang, t])

  const toggleCheck = (idx: number) => {
    setChecks((prev) => {
      const next = { ...prev, [idx]: !prev[idx] }
      try {
        localStorage.setItem('telemedicine_checklist', JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }

  const tele = n?.telemedicine
  const videoLink =
    n?.type === tele?.type && n?.telemedicine_link
      ? n.telemedicine_link
      : `https://meet.jit.si/Hassan-${tele?.name?.replace(/\W/g, '') || 'DistrictHub'}`

  const phoneLink = tele?.phone ? `tel:${tele.phone}` : 'tel:104'
  const isFacilityOffline = n ? !n.has_internet : false

  return (
    <div className="flex min-h-full flex-col gap-3.5 bg-slate-50 p-4">
      {/* Offline Facility Warning (if nearest facility has no internet) */}
      {isFacilityOffline && (
        <div className="rounded-2xl bg-amber-100 p-3 text-xs font-bold text-amber-900 border border-amber-300 flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span>{t('offline_facility_notice')}</span>
        </div>
      )}

      <DoctorsList />

      {/* Doctor on Duty Card */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-blue-200 border-2 border-white shadow-sm overflow-hidden text-2xl">
              👩‍⚕️
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                {t('doctor_on_duty')}
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {lang === 'kn' && tele?.name_kn ? tele.name_kn : tele?.name ?? 'District Hub'}
              </p>
            </div>
          </div>

          <SpeakerButton text={t('doctor_intro')} clip="doctor_intro" />
        </div>

        <p className="mt-3 text-xs font-medium text-slate-600 leading-relaxed">
          {t('doctor_desc')}
        </p>
      </div>

      {/* Action Cards (Video Call & Audio Call) */}
      <div className="space-y-2.5">
        {/* If facility is offline, voice call is shown first as primary */}
        {isFacilityOffline ? (
          <>
            {/* Primary Voice Call Card */}
            <a
              href={phoneLink}
              onClick={() => track('call_started', { detail: 'voice_telemedicine_primary' })}
              className="group flex items-center justify-between rounded-2xl border-2 border-emerald-500 bg-emerald-50/80 p-3.5 shadow-sm transition-all hover:bg-emerald-50 active:scale-98"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm shadow-emerald-200">
                  <PhoneCallIcon size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {t('start_voice_call')}
                  </h3>
                  <p className="text-xs font-bold text-emerald-700">
                    {t('voice_call_sub')}
                  </p>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-600 shadow-2xs">
                <ChevronRightIcon size={16} />
              </div>
            </a>

            {/* Video Call (secondary when offline) */}
            <a
              href={videoLink}
              target="_blank"
              rel="noreferrer"
              onClick={() => track('call_started', { detail: 'video_telemedicine_secondary' })}
              className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs opacity-75 hover:opacity-100 transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-600 text-white shadow-xs">
                  <VideoCameraIcon size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {t('start_video_call')}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    {t('demo_video_room')}
                  </p>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ChevronRightIcon size={16} />
              </div>
            </a>
          </>
        ) : (
          <>
            {/* Video Call (primary when online) */}
            <a
              href={videoLink}
              target="_blank"
              rel="noreferrer"
              onClick={() => track('call_started', { detail: 'video_telemedicine' })}
              className="group flex items-center justify-between rounded-2xl border border-red-100 bg-gradient-to-r from-red-50/90 via-white to-red-50/50 p-3.5 shadow-xs transition-all hover:border-red-200 hover:shadow-sm active:scale-98"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm shadow-red-200">
                  <VideoCameraIcon size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {t('start_video_call')}
                  </h3>
                  <p className="text-xs font-semibold text-red-700">
                    {t('demo_video_room')}
                  </p>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-2xs group-hover:text-red-600 transition-colors">
                <ChevronRightIcon size={16} />
              </div>
            </a>

            {/* Voice Call */}
            <a
              href={phoneLink}
              onClick={() => track('call_started', { detail: 'voice_telemedicine' })}
              className="group flex items-center justify-between rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/50 p-3.5 shadow-xs transition-all hover:border-emerald-200 hover:shadow-sm active:scale-98"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm shadow-emerald-200">
                  <PhoneCallIcon size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {t('start_voice_call')}
                  </h3>
                  <p className="text-xs font-semibold text-emerald-700">
                    {t('voice_call_sub')}
                  </p>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-2xs group-hover:text-emerald-600 transition-colors">
                <ChevronRightIcon size={16} />
              </div>
            </a>
          </>
        )}
      </div>

      {/* Connected Referral Hub Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <BuildingIcon size={16} className="text-amber-700" />
            <h3 className="text-xs font-extrabold text-slate-900">
              {t('connected_hub')}
            </h3>
          </div>
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900">
            {t('district_node')}
          </span>
        </div>

        {/* Hub Card */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 font-black text-xl shadow-2xs">
              🏥
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900">
                {lang === 'kn' && tele?.name_kn ? tele.name_kn : tele?.name ?? 'District Hub'}
              </h4>
              <p className="text-[11px] font-medium text-slate-500">
                {tele?.phone || '104'}
              </p>
            </div>
          </div>

          <a
            href={phoneLink}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xs transition-transform hover:bg-emerald-800 active:scale-95"
            title="Call District Hub"
          >
            <PhoneCallIcon size={18} />
          </a>
        </div>

        {/* Expandable Hub-and-Spoke Referral Chain */}
        {n && n.chain && n.chain.length > 0 && (
          <div className="pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setChainOpen((prev) => !prev)}
              className="w-full cursor-pointer text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center justify-between py-1"
            >
              <span>{t('referral_chain_title')}</span>
              <span className={`text-slate-400 font-mono transition-transform ${chainOpen ? 'rotate-90' : ''}`}>
                ▸
              </span>
            </button>

            {chainOpen && (
              <ol className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
                {n.chain.map((c, idx) => (
                  <li key={c.id} className="relative text-xs">
                    <span className="font-extrabold text-slate-800">
                      {idx + 1}. {lang === 'kn' && c.name_kn ? c.name_kn : c.name}
                    </span>
                    <span className="text-slate-500 text-[11px] ml-1.5">
                      ({t(`type_${c.type}` as Key)})
                    </span>
                    {c.phone && (
                      <span className="block text-[10px] text-slate-400">
                        📞 {c.phone}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      {/* Before Calling Checklist Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-red-600">☑</span>
            <h3 className="text-xs font-extrabold text-slate-900">
              {t('before_calling')}
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            {t('tap_to_check')}
          </span>
        </div>

        <div className="mt-2 space-y-2">
          {[
            { title: t('prep_1'), sub: t('prep_1_sub') },
            { title: t('prep_2'), sub: t('prep_2_sub') },
            { title: t('prep_3'), sub: t('prep_3_sub') },
          ].map((item, idx) => {
            const isChecked = !!checks[idx]
            return (
              <div
                key={idx}
                onClick={() => toggleCheck(idx)}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl p-2.5 transition-colors ${
                  isChecked ? 'bg-red-50/50' : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    isChecked
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isChecked && <CheckIcon size={12} />}
                </div>
                <div>
                  <p
                    className={`text-xs font-bold leading-tight ${
                      isChecked ? 'text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                    {item.sub}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
