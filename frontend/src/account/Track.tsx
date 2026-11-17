import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError, type TrackData } from '../api'
import { useAuth } from '../AuthContext'
import { useLang } from '../i18n'
import { Banner, Card, Page, Spinner, btnGhost, btnPrimary } from './ui'

/** Opened from the SMS link (/s/:token or /r/:token). Needs no login to view; responding needs a doctor login. */
export default function Track() {
  const { token = '' } = useParams()
  const { t } = useLang()
  const { user } = useAuth()
  const [d, setD] = useState<TrackData | null>(null)
  const [gone, setGone] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let live = true
    const tick = () => api.track(token).then((x) => live && setD(x)).catch((e) => { if (e instanceof ApiError && (e.status === 410 || e.status === 404)) setGone(true) })
    void tick()
    const i = setInterval(() => void tick(), 8000)
    return () => { live = false; clearInterval(i) }
  }, [token])

  if (gone) return <Page title={t('a_track_title')} intro={t('a_expired')}><Banner tone="warn">{t('a_expired')}</Banner></Page>
  if (!d) return <Spinner />
  const maps = `https://www.google.com/maps?q=${d.lat},${d.lng}`
  const isDoctor = user?.role === 'doctor'
  const respond = (a: 'accept' | 'decline') => api.respond(token, a).then(() => api.track(token)).then(setD).catch(() => setMsg(t('a_err_generic')))
  return (
    <Page title={t('a_track_title')} intro={t('a_intro_track')}>
      <Card className="space-y-1 text-sm font-semibold">
        <p className="text-lg font-black">{d.patient.name}</p>
        <p>{d.patient.age ?? '-'} · {d.patient.sex || '-'} · {d.patient.phone}</p>
        <p>{d.reason_label}</p>
        <p className="text-xs text-slate-500">{d.pressed_at.slice(0, 16).replace('T', ' ')}</p>
      </Card>
      <a href={maps} target="_blank" rel="noreferrer" className={`${btnPrimary} block text-center`}>{t('a_open_maps')}</a>
      {d.responder && d.my_status !== 'acked' && <Banner tone="warn">{t('a_taken_by')} {d.responder}</Banner>}
      {d.my_status === 'acked' && <Banner tone="ok">{t('a_responding')}</Banner>}
      {msg && <Banner tone="err">{msg}</Banner>}
      {!isDoctor && <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className={`${btnGhost} block text-center`}>{t('a_login_to_respond')}</Link>}
      {isDoctor && d.my_status !== 'acked' && (
        <div className="grid grid-cols-2 gap-3">
          <button className={btnPrimary} onClick={() => void respond('accept')}>{t('a_respond_accept')}</button>
          <button className={btnGhost} onClick={() => void respond('decline')}>{t('a_respond_decline')}</button>
        </div>
      )}
    </Page>
  )
}
