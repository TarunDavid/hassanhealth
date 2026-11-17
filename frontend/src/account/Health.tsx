import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, downloadFile, uploadRecord, type Conditions, type Grant, type LogRow, type RecordMeta } from '../api'
import { useAuth } from '../AuthContext'
import { useLang } from '../i18n'
import { Banner, Card, Field, Page, Spinner, btnGhost, btnPrimary, inputCls, useErrText } from './ui'

const EMPTY: Conditions = { chronic: [], allergies: '', medicines: '', surgeries: '', pregnancy: '', notes: '' }
const TYPES = ['report', 'prescription', 'scan', 'discharge', 'vaccination', 'other'] as const

export default function Health() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const err = useErrText()
  const [cond, setCond] = useState<Conditions>(EMPTY)
  const [recs, setRecs] = useState<RecordMeta[]>([])
  const [grants, setGrants] = useState<Grant[]>([])
  const [log, setLog] = useState<LogRow[]>([])
  const [msg, setMsg] = useState('')
  const [saved, setSaved] = useState(false)
  const [title, setTitle] = useState('')
  const [rtype, setRtype] = useState<string>('report')
  const [file, setFile] = useState<File | null>(null)
  const [dphone, setDphone] = useState('')
  const [dur, setDur] = useState<'forever' | '30d'>('forever')
  const [upErr, setUpErr] = useState('')
  const [grErr, setGrErr] = useState('')

  const load = useCallback(() => {
    void api.conditions().then(setCond).catch(() => {})
    void api.records().then(setRecs).catch(() => {})
    void api.grants().then(setGrants).catch(() => {})
    void api.accessLog().then(setLog).catch(() => {})
  }, [])
  useEffect(() => { if (user?.role === 'patient') load() }, [user, load])

  if (loading) return <Spinner />
  if (!user || user.role !== 'patient') return <Navigate to="/login" replace />

  const lines = (s: string) => s.split('\n')
  return (
    <Page title={t('a_myhealth')} intro={t('a_intro_myhealth')}>
      <Banner tone="info">{t('a_private_banner')}</Banner>

      <section className="space-y-3">
        <h2 className="text-lg font-black">{t('a_conditions')}</h2>
        <Field label={t('a_chronic')}>
          <textarea className={inputCls} rows={3} value={cond.chronic.join('\n')} onChange={(e) => { setCond({ ...cond, chronic: lines(e.target.value) }); setSaved(false) }} />
        </Field>
        {(['allergies', 'medicines', 'surgeries', 'pregnancy', 'notes'] as const).map((k) => (
          <Field key={k} label={t(`a_${k}` as 'a_allergies')}>
            <input className={inputCls} value={cond[k]} onChange={(e) => { setCond({ ...cond, [k]: e.target.value }); setSaved(false) }} />
          </Field>
        ))}
        {msg && <Banner tone="err">{msg}</Banner>}
        {saved && <Banner tone="ok">{t('a_saved')}</Banner>}
        <button className={btnPrimary} onClick={() => { setMsg(''); api.saveConditions({ ...cond, chronic: cond.chronic.map((x) => x.trim()).filter(Boolean) }).then((c) => { setCond(c); setSaved(true) }).catch((e) => setMsg(err(e))) }}>{t('a_save')}</button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black">{t('a_records')}</h2>
        {recs.length === 0 && <p className="text-sm font-bold text-slate-500">{t('a_no_records')}</p>}
        {recs.map((r) => (
          <Card key={r.id} className="space-y-2">
            <p className="font-extrabold">{r.title}</p>
            <p className="text-xs font-semibold text-slate-500">{t(`a_rt_${r.record_type}` as 'a_rt_other')} · {(r.size_bytes / 1024).toFixed(0)} KB · {r.uploaded_at.slice(0, 10)}</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={btnGhost} onClick={() => void downloadFile(`/api/me/records/${r.id}/download/`, r.source_name || `${r.title}`)}>{t('a_download')}</button>
              <button className={btnGhost} onClick={() => void api.deleteRecord(r.id).then(load)}>{t('a_delete')}</button>
            </div>
          </Card>
        ))}
        <Card className="space-y-3">
          <p className="font-extrabold">{t('a_add_record')}</p>
          <Field label={t('a_title')}><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label={t('a_type')}>
            <select className={inputCls} value={rtype} onChange={(e) => setRtype(e.target.value)}>
              {TYPES.map((x) => <option key={x} value={x}>{t(`a_rt_${x}` as 'a_rt_other')}</option>)}
            </select>
          </Field>
          <Field label={t('a_pick_file')}>
            <input type="file" accept="application/pdf,image/jpeg,image/png" data-testid="record-file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          {upErr && <Banner tone="err">{upErr}</Banner>}
          <button className={btnPrimary} disabled={!file || !title.trim()} onClick={() => {
            setUpErr('')
            void uploadRecord(file!, { title: title.trim(), record_type: rtype }).then(() => { setTitle(''); setFile(null); load() }).catch(() => setUpErr(t('a_err_upload')))
          }}>{t('a_upload')}</button>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black">{t('a_doctors_access')}</h2>
        {grants.length === 0 && <p className="text-sm font-bold text-slate-500">{t('a_no_access')}</p>}
        {grants.map((g) => (
          <Card key={g.id} className="flex items-center justify-between gap-2">
            <div><p className="font-extrabold">{g.doctor}</p><p className="text-xs font-semibold text-slate-500">{g.facility}</p></div>
            <button className="rounded-xl border-2 border-red-300 px-3 py-2 text-xs font-extrabold text-red-700" onClick={() => void api.revokeGrant(g.id).then(load)}>{t('a_revoke')}</button>
          </Card>
        ))}
        <Card className="space-y-3">
          <Field label={t('a_doctor_phone')}><input className={inputCls} inputMode="numeric" value={dphone} onChange={(e) => setDphone(e.target.value.replace(/\D/g, '').slice(0, 10))} /></Field>
          <select className={inputCls} value={dur} onChange={(e) => setDur(e.target.value as 'forever' | '30d')}>
            <option value="forever">{t('a_dur_forever')}</option>
            <option value="30d">{t('a_dur_30')}</option>
          </select>
          {grErr && <Banner tone="err">{grErr}</Banner>}
          <button className={btnPrimary} disabled={dphone.length !== 10} onClick={() => { setGrErr(''); api.addGrant(dphone, dur).then(() => { setDphone(''); load() }).catch(() => setGrErr(t('a_err_doctor'))) }}>{t('a_grant')}</button>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-black">{t('a_access_log')}</h2>
        {log.length === 0 && <p className="text-sm font-bold text-slate-500">{t('a_no_log')}</p>}
        {log.slice(0, 30).map((l) => (
          <p key={l.id} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {l.at.slice(0, 16).replace('T', ' ')} · {l.who === 'You' ? t('a_you') : l.who} · {l.action}{l.reason === 'emergency' ? ` · ${t('a_emergency_access')}` : ''}
          </p>
        ))}
      </section>
    </Page>
  )
}
