import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, type DoctorProfile, type FacilityLite, type PatientProfile } from '../api'
import { useAuth } from '../AuthContext'
import { useLang } from '../i18n'
import { Banner, Card, Field, Page, Spinner, btnGhost, btnPrimary, inputCls, useErrText } from './ui'

const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

function Consent() {
  const { t } = useLang()
  const { refreshMe } = useAuth()
  const [busy, setBusy] = useState(false)
  return (
    <Page title={t('a_consent_title')} intro={t('a_consent_body')}>
      <Card><p className="text-base font-semibold leading-relaxed text-slate-800">{t('a_consent_body')}</p></Card>
      <button className={btnPrimary} disabled={busy} onClick={() => { setBusy(true); void api.consent().then(refreshMe).finally(() => setBusy(false)) }}>
        {t('a_agree')}
      </button>
    </Page>
  )
}

function PatientForm({ initial, onSaved }: { initial: Partial<PatientProfile>; onSaved: () => void }) {
  const { t, lang } = useLang()
  const err = useErrText()
  const [taluks, setTaluks] = useState<string[]>([])
  const [f, setF] = useState<Partial<PatientProfile>>({ language: lang, share_with_contact: false, allow_emergency_access: true, ...initial })
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)
  useEffect(() => {
    void api.facilitiesSignup().then((l) => setTaluks([...new Set(l.map((x) => x.taluk))].sort())).catch(() => {})
  }, [])
  const set = (k: keyof PatientProfile, v: string | boolean) => { setF((p) => ({ ...p, [k]: v })); setOk(false) }
  const age = f.dob ? Math.floor((Date.now() - new Date(f.dob).getTime()) / 31557600000) : null
  const save = async () => {
    setMsg('')
    try {
      await api.patchMe(f)
      setOk(true)
      onSaved()
    } catch (e) {
      setMsg(err(e))
    }
  }
  return (
    <div className="space-y-3">
      <Field label={t('a_full_name')}><input className={inputCls} value={f.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} /></Field>
      <Field label={t('a_dob')}><input type="date" className={inputCls} value={f.dob ?? ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('dob', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('a_sex')}>
          <select className={inputCls} value={f.sex ?? ''} onChange={(e) => set('sex', e.target.value)}>
            <option value="" />
            <option value="male">{t('a_male')}</option>
            <option value="female">{t('a_female')}</option>
            <option value="other">{t('a_other')}</option>
          </select>
        </Field>
        <Field label={t('a_blood')}>
          <select className={inputCls} value={f.blood_group ?? ''} onChange={(e) => set('blood_group', e.target.value)}>
            {BLOOD.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('a_taluk')}>
        <select className={inputCls} value={f.taluk ?? ''} onChange={(e) => set('taluk', e.target.value)}>
          <option value="" />
          {taluks.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </Field>
      <Field label={t('a_language')}>
        <select className={inputCls} value={f.language ?? 'kn'} onChange={(e) => set('language', e.target.value)}>
          <option value="kn">ಕನ್ನಡ</option>
          <option value="en">English</option>
        </select>
      </Field>
      {age !== null && age < 18 && (
        <Field label={t('a_guardian')}><input className={inputCls} inputMode="numeric" value={f.guardian_phone ?? ''} onChange={(e) => set('guardian_phone', e.target.value.replace(/\D/g, '').slice(0, 10))} /></Field>
      )}
      <Field label={t('a_ec_name')}><input className={inputCls} value={f.emergency_contact_name ?? ''} onChange={(e) => set('emergency_contact_name', e.target.value)} /></Field>
      <Field label={t('a_ec_phone')}><input className={inputCls} inputMode="numeric" value={f.emergency_contact_phone ?? ''} onChange={(e) => set('emergency_contact_phone', e.target.value.replace(/\D/g, '').slice(0, 10))} /></Field>
      <label className="flex items-start gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 text-sm font-bold text-slate-800">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={!!f.share_with_contact} onChange={(e) => set('share_with_contact', e.target.checked)} />
        {t('a_share_contact')}
      </label>
      <label className="flex items-start gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 text-sm font-bold text-slate-800">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={f.allow_emergency_access !== false} onChange={(e) => set('allow_emergency_access', e.target.checked)} />
        {t('a_allow_emergency')}
      </label>
      {msg && <Banner tone="err">{msg}</Banner>}
      {ok && <Banner tone="ok">{t('a_saved')}</Banner>}
      <button className={btnPrimary} onClick={() => void save()} disabled={!f.full_name?.trim()}>{t('a_save')}</button>
    </div>
  )
}

function DoctorForm({ initial, onSaved }: { initial?: DoctorProfile; onSaved: () => void }) {
  const { t, lang } = useLang()
  const err = useErrText()
  const [facs, setFacs] = useState<FacilityLite[]>([])
  const [f, setF] = useState({ full_name: initial?.full_name ?? '', council: initial?.council ?? 'Karnataka Medical Council', registration_no: initial?.registration_no ?? '', specialty: initial?.specialty ?? 'general', facility_id: initial?.facility_id ?? 0, shift_note: initial?.shift_note ?? '' })
  const [msg, setMsg] = useState('')
  useEffect(() => { void api.facilitiesSignup().then(setFacs).catch(() => {}) }, [])
  const valid = f.full_name.trim() && f.council.trim() && f.registration_no.trim() && f.facility_id
  return (
    <div className="space-y-3">
      <Field label={t('a_full_name')}><input className={inputCls} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label={t('a_council')}><input className={inputCls} value={f.council} onChange={(e) => setF({ ...f, council: e.target.value })} /></Field>
      <Field label={t('a_regno')}><input className={inputCls} value={f.registration_no} onChange={(e) => setF({ ...f, registration_no: e.target.value })} /></Field>
      <Field label={t('a_specialty')}>
        <select className={inputCls} value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })}>
          {['general', 'obstetrics', 'paediatrics', 'surgery', 'veterinary'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label={t('a_facility')}>
        <select className={inputCls} value={f.facility_id} onChange={(e) => setF({ ...f, facility_id: Number(e.target.value) })}>
          <option value={0} />
          {facs.map((x) => <option key={x.id} value={x.id}>{lang === 'kn' ? x.name_kn : x.name}</option>)}
        </select>
      </Field>
      <Field label={t('a_shift')}><input className={inputCls} maxLength={100} value={f.shift_note} onChange={(e) => setF({ ...f, shift_note: e.target.value })} /></Field>
      {msg && <Banner tone="err">{msg}</Banner>}
      <button className={btnPrimary} disabled={!valid} onClick={() => { setMsg(''); api.doctorRegister(f).then(onSaved).catch((e) => setMsg(err(e))) }}>{t('a_submit')}</button>
    </div>
  )
}

export default function Profile() {
  const { t } = useLang()
  const { user, loading, logout, refreshMe } = useAuth()
  const [editing, setEditing] = useState(false)
  const [dutyBusy, setDutyBusy] = useState(false)

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.consent_required) return <Consent />

  const doctor = user.role === 'doctor' ? (user.profile as DoctorProfile | null) : null
  const patient = user.role === 'patient' ? (user.profile as PatientProfile | null) : null

  const danger = (
    <div className="space-y-3 pt-2">
      <button className={btnGhost} onClick={() => void logout()}>{t('a_logout')}</button>
      {user.role === 'patient' && (
        <button className="w-full rounded-2xl border-2 border-red-300 bg-red-50 py-3 text-sm font-extrabold text-red-700"
          onClick={() => { if (confirm(t('a_delete_confirm'))) void api.deleteMe().then(logout) }}>
          {t('a_delete_data')}
        </button>
      )}
    </div>
  )

  if (user.role === 'doctor') {
    if (!doctor) return <Page title={t('a_doc_register')} intro={t('a_intro_doc_register')}><DoctorForm onSaved={() => void refreshMe()} />{danger}</Page>
    if (editing || doctor.approval_status === 'rejected')
      return (
        <Page title={t('a_doc_register')} intro={t('a_intro_doc_register')}>
          {doctor.approval_status === 'rejected' && <Banner tone="err">{t('a_rejected')}</Banner>}
          <DoctorForm initial={doctor} onSaved={() => { setEditing(false); void refreshMe() }} />{danger}
        </Page>
      )
    return (
      <Page title={doctor.full_name} intro={doctor.approval_status === 'approved' ? t('a_intro_dr') : t('a_pending')}>
        <Card className="space-y-1 text-sm font-semibold text-slate-700">
          <p>{doctor.council} · {doctor.registration_no}</p>
          <p>{doctor.specialty} · {doctor.facility}</p>
          <p className="font-mono text-xs">{user.phone}</p>
        </Card>
        {doctor.approval_status === 'pending' && <Banner tone="warn">{t('a_pending')}</Banner>}
        {doctor.approval_status === 'approved' && (
          <>
            <Banner tone="ok">{t('a_approved')}</Banner>
            {(['on_duty', 'sms_enabled'] as const).map((k) => (
              <label key={k} className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 text-base font-extrabold text-slate-800">
                {t(k === 'on_duty' ? 'a_on_duty' : 'a_sms_on')}
                <input type="checkbox" className="h-6 w-6" disabled={dutyBusy} checked={doctor[k]} data-testid={`toggle-${k}`}
                  onChange={(e) => { setDutyBusy(true); void api.doctorDuty({ [k]: e.target.checked }).then(refreshMe).finally(() => setDutyBusy(false)) }} />
              </label>
            ))}
            <Link to="/dr" className={`${btnPrimary} block text-center`}>{t('a_dr_home')}</Link>
          </>
        )}
        <button className={btnGhost} onClick={() => setEditing(true)}>{t('a_save')} / {t('a_doc_register')}</button>
        {danger}
      </Page>
    )
  }

  // patient
  if (!patient || editing)
    return (
      <Page title={t('a_profile')} intro={t('a_intro_profile')}>
        <PatientForm initial={patient ?? {}} onSaved={() => { setEditing(false); void refreshMe() }} />
        {danger}
      </Page>
    )
  return (
    <Page title={patient.full_name} intro={t('a_intro_profile')}>
      <Card className="space-y-1 text-sm font-semibold text-slate-700">
        <p>{patient.age ?? '-'} · {patient.sex || '-'} · {patient.blood_group || '-'}</p>
        <p>{patient.taluk}</p>
        <p className="font-mono text-xs">{user.phone}</p>
        {patient.emergency_contact_name && <p>{patient.emergency_contact_name} · {patient.emergency_contact_phone}</p>}
      </Card>
      <Link to="/health" className={`${btnPrimary} block text-center`}>{t('a_myhealth')}</Link>
      <button className={btnGhost} onClick={() => setEditing(true)}>{t('a_save')} / {t('a_profile')}</button>
      {danger}
    </Page>
  )
}
