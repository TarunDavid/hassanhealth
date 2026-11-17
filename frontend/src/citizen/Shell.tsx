import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useLang } from '../i18n'
import { speak } from '../voice'
import { track, getSessionId } from '../track'
import {
  MedicalCrossIcon,
  SpeakerIcon,
  ShieldCheckIcon,
  UserIcon,
  StarOfLifeIcon,
  MapPinIcon,
  StethoscopeIcon,
  CalendarIcon,
  PhoneCallIcon,
} from '../icons'

const TABS = [
  { to: '/', Icon: StarOfLifeIcon, key: 'tab_sos' as const, ev: null },
  { to: '/map', Icon: MapPinIcon, key: 'tab_map' as const, ev: 'map_opened' as const },
  { to: '/doctor', Icon: StethoscopeIcon, key: 'tab_doctor' as const, ev: 'doctor_opened' as const },
  { to: '/camps', Icon: CalendarIcon, key: 'tab_camps' as const, ev: 'camps_opened' as const },
]

export default function Shell() {
  const { lang, setLang, t } = useLang()
  const { user } = useAuth()
  const location = useLocation()
  const [showSettings, setShowSettings] = useState(false)

  // Ensure no legacy personal identifiers linger in localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('emergency_contact_name')
      localStorage.removeItem('emergency_contact_phone')
    } catch {
      // Ignore
    }
  }, [])

  // Determine current screen speech text
  const getScreenSpeech = () => {
    if (location.pathname === '/map') return { text: t('map_intro'), clip: 'map_intro' }
    if (location.pathname === '/doctor') return { text: t('doctor_intro'), clip: 'doctor_intro' }
    if (location.pathname === '/camps') return { text: t('camps_intro'), clip: 'camps_intro' }
    return { text: t('sos_human'), clip: 'sos_human' }
  }

  const handleSpeakerClick = () => {
    const { text, clip } = getScreenSpeech()
    void speak(text, lang, clip)
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-slate-50 text-slate-900 shadow-2xl relative overflow-hidden">
      {/* Top App Bar */}
      <header className="z-30 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur-md">
        <NavLink to="/" className="flex items-center gap-2.5 text-left group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-700 text-white shadow-sm shadow-red-200 transition-transform group-active:scale-95">
            <MedicalCrossIcon size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold leading-none tracking-tight text-slate-900">
              {t('brand_title')}
            </span>
            <span className="mt-0.5 text-[10px] font-semibold leading-none text-red-600/90">
              {t('brand_subtitle')}
            </span>
          </div>
        </NavLink>

        <div className="flex items-center gap-2">
          {/* Neutral Quick-Call chip (links to tel:108) */}
          <a
            href="tel:108"
            onClick={() => track('call_108', { detail: 'header_chip' })}
            title="Call 108 Emergency"
            className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-extrabold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <PhoneCallIcon size={12} className="text-red-600" />
            <span>{t('helpline_chip')}</span>
          </a>

          {/* Language Switcher Pill */}
          <div className="flex items-center rounded-full border border-slate-200/80 bg-slate-100/90 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLang('kn')}
              aria-label="Kannada"
              className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold transition-all ${
                lang === 'kn' ? 'bg-red-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ಕನ್ನಡ
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              aria-label="English"
              className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold transition-all ${
                lang === 'en' ? 'bg-red-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EN
            </button>
          </div>

          {/* Audio Speaker Button */}
          <button
            type="button"
            onClick={handleSpeakerClick}
            aria-label={t('speak')}
            title="Read screen aloud"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-xs transition-transform hover:bg-red-100 active:scale-90"
          >
            <SpeakerIcon size={18} />
          </button>

          {/* Account */}
          <Link
            to={user ? '/profile' : '/login'}
            aria-label={t('a_account')}
            title={t('a_account')}
            data-testid="account-link"
            className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-xs active:scale-90 ${user ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            <UserIcon size={18} />
          </Link>

          {/* Privacy & App Info Button */}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label={t('privacy_and_info')}
            title={t('privacy_and_info')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-xs transition-transform hover:bg-slate-800 active:scale-90"
          >
            <ShieldCheckIcon size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <Outlet />
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="z-30 grid grid-cols-4 border-t border-slate-100 bg-white/95 px-2 py-1 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur-md">
        {TABS.map(({ to, Icon, key, ev }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => {
              void speak(t(key), lang)
              if (ev) track(ev)
            }}
            className={({ isActive }) =>
              `flex flex-col items-center py-1 transition-all ${
                isActive
                  ? 'font-extrabold text-red-700'
                  : 'font-semibold text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative flex items-center justify-center ${isActive ? 'scale-110 text-red-700' : ''}`}>
                  <Icon size={22} />
                  {isActive && (
                    <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-red-600" />
                  )}
                </div>
                <span className="mt-0.5 text-[11px] leading-tight tracking-tight">
                  {t(key)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* About / Settings Sheet */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs transition-all">
          <div className="rounded-t-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom max-h-[85vh] overflow-y-auto">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300" />

            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">{t('about_settings')}</h3>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900">
                {t('simulated_disclaimer')}
              </span>
            </div>

            {/* Language Preference */}
            <div className="mt-3.5 flex items-center justify-between rounded-2xl bg-slate-50 p-3">
              <span className="text-xs font-bold text-slate-700">{t('language')}</span>
              <div className="flex items-center rounded-full border border-slate-200 bg-white p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setLang('kn')}
                  className={`rounded-full px-3 py-1 text-xs font-extrabold transition-all ${
                    lang === 'kn' ? 'bg-red-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ಕನ್ನಡ
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`rounded-full px-3 py-1 text-xs font-extrabold transition-all ${
                    lang === 'en' ? 'bg-red-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            {/* Privacy & Data Protection Guarantee Card */}
            <div className="mt-4 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-emerald-900">
                <ShieldCheckIcon size={20} className="text-emerald-700 shrink-0" />
                <h4 className="text-xs font-black uppercase tracking-wide">
                  {lang === 'kn' ? 'ಗೌಪ್ಯತೆ ಮತ್ತು ಮಾಹಿತಿ ಸಂರಕ್ಷಣೆ' : 'Privacy & Data Protection'}
                </h4>
              </div>
              <ul className="space-y-2 text-[11px] text-emerald-950 font-medium">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold shrink-0">✓</span>
                  <span>
                    {lang === 'kn'
                      ? '100% ಅನಾಮಧೇಯ: ಯಾವುದೇ ಹೆಸರು, ದೂರವಾಣಿ ಸಂಖ್ಯೆ, ಆಧಾರ್ ಅಥವಾ ABHA ವಿವರಗಳನ್ನು ಸಂಗ್ರಹಿಸುವುದಿಲ್ಲ. ಲಾಗಿನ್ ಅಗತ್ಯವಿಲ್ಲ.'
                      : 'Zero PII: No names, phone numbers, Aadhaar, or ABHA collected. No citizen login required.'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold shrink-0">✓</span>
                  <span>
                    {lang === 'kn'
                      ? 'ಅನಾಮಧೇಯ ಅಧಿವೇಶನ: ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಉತ್ಪತ್ತಿಯಾದ ಯಾದೃಚ್ಛಿಕ ಐಡಿ ಮಾತ್ರ ಬಳಸಲಾಗುತ್ತದೆ. ನಿಮ್ಮ ಸಾಧನ ಅಥವಾ ಗುರುತಿಗೆ ಇದು ಲಿಂಕ್ ಆಗಿರುವುದಿಲ್ಲ.'
                      : 'Anonymous Session: Identified only by a randomized browser UUID not linked to your personal identity.'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold shrink-0">✓</span>
                  <span>
                    {lang === 'kn'
                      ? 'ಸುರಕ್ಷಿತ ಸ್ಥಳ: ಬಳಕೆಯ ಅಂಕಿಅಂಶಗಳಿಗೆ ಸ್ಥಳವನ್ನು ~1 ಕಿ.ಮೀ ಗೆ ಅಂದಾಜು ಮಾಡಲಾಗುತ್ತದೆ. ತುರ್ತು ಆಂಬ್ಯುಲೆನ್ಸ್ ರವಾನೆಗಾಗಿ ಮಾತ್ರ ನಿಖರ ಜಿಪಿಎಸ್ ಬಳಸಲಾಗುತ್ತದೆ.'
                      : 'Fuzzy Analytics: General usage logs round location to ~1 km. Exact GPS is used strictly for active emergency ambulance dispatch.'}
                  </span>
                </li>
              </ul>
              <div className="pt-2 text-[10px] font-mono text-emerald-800/80 border-t border-emerald-200/80 truncate">
                {lang === 'kn' ? 'ಅನಾಮಧೇಯ ಐಡಿ:' : 'Anonymous Session ID:'} {getSessionId()}
              </div>
            </div>

            {/* Simulated Data Disclaimer Note */}
            <div className="mt-3.5 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900 border border-amber-200">
              <p className="font-extrabold">{t('simulated_disclaimer')}</p>
              <p className="mt-0.5 text-[10px] text-amber-800">
                Hassan Rural Health prototype. Seeded data is simulated for academic research demonstration.
              </p>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="w-full rounded-xl bg-slate-100 py-2.5 text-center text-xs font-extrabold text-slate-700 hover:bg-slate-200 active:scale-98 transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function SpeakerButton({
  text,
  clip,
  className = '',
}: {
  text: string
  clip?: string
  className?: string
}) {
  const { lang, t } = useLang()
  return (
    <button
      type="button"
      onClick={() => void speak(text, lang, clip)}
      aria-label={t('speak')}
      title="Read aloud"
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-xs transition-transform hover:bg-red-100 active:scale-90 ${className}`}
    >
      <SpeakerIcon size={20} />
    </button>
  )
}
