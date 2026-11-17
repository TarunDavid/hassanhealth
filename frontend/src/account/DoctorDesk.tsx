import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api, downloadFile, type DoctorProfile, type InboxRow, type PatientMedical, type PatientRow, type RecordMeta } from '../api'
import { useAuth } from '../AuthContext'
import { useLang } from '../i18n'
import { Banner, Card, Page, Spinner, btnGhost } from './ui'

function useDoctor() {
  const { user, loading } = useAuth()
  const ok = user?.role === 'doctor' && (user.profile as DoctorProfile | null)?.approval_status === 'approved'
  return { user, loading, ok }
}

export function DoctorDesk() {
  const { t } = useLang()
  const { loading, ok } = useDoctor()
  const [pts, setPts] = useState<PatientRow[]>([])
  const [inbox, setInbox] = useState<InboxRow[]>([])
  useEffect(() => {
    if (!ok) return
    void api.doctorPatients().then(setPts).catch(() => {})
    void api.inbox().then(setInbox).catch(() => {})
  }, [ok])
  if (loading) return <Spinner />
  if (!ok) return <Navigate to="/login" replace />
  return (
    <Page title={t('a_dr_home')} intro={t('a_intro_dr')}>
      <section className="space-y-2">
        <h2 className="text-lg font-black">{t('a_my_patients')}</h2>
        {pts.length === 0 && <p className="text-sm font-bold text-slate-500">{t('a_no_patients')}</p>}
        {pts.map((p) => (
          <Link key={p.id} to={`/dr/patient/${p.id}`} className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-4 font-extrabold">
            <span>{p.name}{p.access === 'emergency' && <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">{t('a_emergency_access')}</span>}</span>
            <span className="text-sm text-red-600">{t('a_open')}</span>
          </Link>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-black">{t('a_inbox')}</h2>
        {inbox.length === 0 && <p className="text-sm font-bold text-slate-500">{t('a_no_inbox')}</p>}
        {inbox.map((m) => <Card key={m.id}><p className="whitespace-pre-wrap text-xs font-semibold text-slate-700">{m.body}</p><p className="mt-1 text-[10px] text-slate-400">{m.at.slice(0, 16).replace('T', ' ')}</p></Card>)}
      </section>
    </Page>
  )
}

export function DoctorPatient() {
  const { t } = useLang()
  const { id } = useParams()
  const { loading, ok } = useDoctor()
  const [m, setM] = useState<PatientMedical | null>(null)
  const [recs, setRecs] = useState<RecordMeta[]>([])
  const [denied, setDenied] = useState(false)
  useEffect(() => {
    if (!ok || !id) return
    void api.patientMedical(Number(id)).then(setM).catch(() => setDenied(true))
    void api.patientRecords(Number(id)).then(setRecs).catch(() => {})
  }, [ok, id])
  if (loading) return <Spinner />
  if (!ok) return <Navigate to="/login" replace />
  if (denied) return <Page title={t('a_view_records')} intro={t('a_no_patients')}><Banner tone="warn">{t('a_no_patients')}</Banner></Page>
  if (!m) return <Spinner />
  const c = m.conditions
  return (
    <Page title={m.patient.name} intro={t('a_view_records')}>
      {m.access === 'emergency' && <Banner tone="warn">{t('a_emergency_access')}</Banner>}
      <Card className="space-y-1 text-sm font-semibold">
        <p>{m.patient.age ?? '-'} · {m.patient.sex || '-'} · {m.patient.blood_group || '-'}</p>
        <p>{t('a_chronic')}: {c.chronic.join(', ') || t('a_none')}</p>
        <p>{t('a_allergies')}: {c.allergies || t('a_none')}</p>
        <p>{t('a_medicines')}: {c.medicines || t('a_none')}</p>
        <p>{t('a_surgeries')}: {c.surgeries || t('a_none')}</p>
        {c.pregnancy && <p>{t('a_pregnancy')}: {c.pregnancy}</p>}
        {c.notes && <p>{t('a_notes')}: {c.notes}</p>}
      </Card>
      <h2 className="text-lg font-black">{t('a_records')}</h2>
      {recs.length === 0 && <p className="text-sm font-bold text-slate-500">{t('a_no_records')}</p>}
      {recs.map((r) => (
        <Card key={r.id} className="space-y-2">
          <p className="font-extrabold">{r.title}</p>
          <button className={btnGhost} onClick={() => void downloadFile(`/api/doctor/patients/${m.patient.id}/records/${r.id}/download/`, r.source_name || r.title)}>{t('a_download')}</button>
        </Card>
      ))}
    </Page>
  )
}
