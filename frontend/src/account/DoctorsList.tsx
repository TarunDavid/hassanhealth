import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type DirectoryDoctor } from '../api'
import { useAuth } from '../AuthContext'
import { useLang } from '../i18n'
import { PhoneCallIcon, StethoscopeIcon } from '../icons'
import { SpeakerButton } from '../citizen/Shell'
import { Banner, inputCls } from './ui'

/** Registered, approved doctors. A signed-in patient taps Call and their phone dials the doctor. */
export default function DoctorsList() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const [rows, setRows] = useState<DirectoryDoctor[] | null>(null)
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const isPatient = user?.role === 'patient'

  useEffect(() => {
    if (!isPatient) return
    const id = setTimeout(() => { void api.doctorDirectory(q).then(setRows).catch(() => setRows([])) }, q ? 250 : 0)
    return () => clearTimeout(id)
  }, [isPatient, q])

  const call = async (d: DirectoryDoctor) => {
    setMsg('')
    try {
      const r = await api.callDoctor(d.id)
      const a = document.createElement('a')
      a.href = `tel:${r.tel}`
      a.click()
    } catch {
      setMsg(t('a_call_failed'))
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3" data-testid="doctors-list">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-black text-slate-900"><StethoscopeIcon size={20} /> {t('a_doctors_list')}</h2>
        <SpeakerButton text={isPatient ? t('a_intro_doctors_list') : t('a_signin_to_call')} />
      </div>
      {!isPatient ? (
        <Link to="/login?next=/doctor" className="block rounded-2xl border-2 border-slate-300 bg-slate-50 p-3 text-center text-sm font-extrabold text-slate-800">{t('a_signin_to_call')}</Link>
      ) : (
        <>
          <input className={inputCls} placeholder={t('a_search_doctor')} value={q} onChange={(e) => setQ(e.target.value)} />
          {rows && rows.length === 0 && <p className="text-sm font-bold text-slate-500">{t('a_no_doctors')}</p>}
          {rows?.map((d) => (
            <div key={d.id} data-testid="doctor-row" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3">
              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-900">Dr {d.full_name}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{d.specialty} · {lang === 'kn' ? d.facility_name_kn : d.facility}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold ${d.on_duty ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                  {d.on_duty ? t('a_badge_on') : t('a_badge_off')}
                </span>
              </div>
              <button type="button" disabled={!d.on_duty} onClick={() => void call(d)} aria-label={`${t('a_call')} Dr ${d.full_name}`}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white shadow-md active:scale-95 disabled:bg-slate-300">
                <PhoneCallIcon size={18} /> {t('a_call')}
              </button>
            </div>
          ))}
          {msg && <Banner tone="err">{msg}</Banner>}
          <p className="text-[11px] font-semibold text-slate-500">{t('a_call_note')}</p>
        </>
      )}
    </div>
  )
}
