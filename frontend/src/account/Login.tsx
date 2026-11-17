import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { useLang } from '../i18n'
import { StethoscopeIcon, UserIcon } from '../icons'
import { Banner, Field, Page, btnPrimary, inputCls, useErrText } from './ui'

type Role = 'patient' | 'doctor'

/** Create an account (patient or doctor) or sign in. Phone number + password, no codes. */
export default function Login() {
  const { t } = useLang()
  const { user, setSession } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const err = useErrText()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [role, setRole] = useState<Role>('patient')
  const [phone, setPhone] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  if (user && user.role !== 'admin') return <Navigate to={next && next.startsWith('/') ? next : '/profile'} replace />

  const submit = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) return setMsg(t('a_err_phone'))
    if (mode === 'register' && pw.length < 6) return setMsg(t('a_err_weak'))
    setBusy(true)
    setMsg('')
    try {
      const r = mode === 'register' ? await api.register(phone, pw, role) : await api.login(phone, pw)
      setSession(r.access, r.refresh, r.user)
      nav(next && next.startsWith('/') ? next : '/profile', { replace: true })
    } catch (e) {
      setMsg(err(e))
    }
    setBusy(false)
  }

  const tab = (m: 'register' | 'login', label: string) => (
    <button type="button" data-testid={`tab-${m}`} onClick={() => { setMode(m); setMsg('') }}
      className={`flex-1 rounded-xl py-2.5 text-sm font-extrabold ${mode === m ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300'}`}>
      {label}
    </button>
  )

  return (
    <Page title={t('a_login_title')} intro={mode === 'register' ? t('a_choose_role') : t('a_intro_login')}>
      <Banner tone="info">{t('a_guest_note')}</Banner>
      <div className="flex gap-2">{tab('register', t('a_create_account'))}{tab('login', t('a_signin_tab'))}</div>

      {mode === 'register' && (
        <div className="space-y-2">
          <p className="text-base font-extrabold text-slate-800">{t('a_choose_role')}</p>
          <div className="grid grid-cols-2 gap-3">
            {(['patient', 'doctor'] as Role[]).map((r) => (
              <button key={r} type="button" data-testid={`role-${r}`} onClick={() => setRole(r)}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 shadow-sm active:scale-[0.98] ${role === r ? 'border-red-600 bg-red-50' : 'border-slate-300 bg-white'}`}>
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${r === 'patient' ? 'bg-red-600' : 'bg-slate-900'}`}>
                  {r === 'patient' ? <UserIcon size={26} /> : <StethoscopeIcon size={26} />}
                </span>
                <span className="text-sm font-black text-slate-900">{t(r === 'patient' ? 'a_role_patient' : 'a_role_doctor')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Field label={t('a_phone')}>
        <input className={inputCls} inputMode="numeric" autoComplete="tel" value={phone} data-testid="phone"
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
      </Field>
      <Field label={mode === 'register' ? t('a_password') : t('a_password_only')}>
        <div className="flex gap-2">
          <input className={inputCls} type={show ? 'text' : 'password'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={pw} data-testid="password" onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} />
          <button type="button" onClick={() => setShow(!show)} className="shrink-0 rounded-xl border-2 border-slate-300 bg-white px-3 text-xs font-extrabold text-slate-700">{t('a_show_pw')}</button>
        </div>
      </Field>
      {msg && <Banner tone="err">{msg}</Banner>}
      <button className={btnPrimary} disabled={busy} data-testid="submit" onClick={() => void submit()}>
        {mode === 'register' ? t('a_create_account') : t('a_signin_tab')}
      </button>
      <p className="text-center text-xs font-semibold text-slate-500">{t('a_shared_phone')}</p>
    </Page>
  )
}
