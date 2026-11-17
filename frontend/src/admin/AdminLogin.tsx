import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { MedicalCrossIcon } from '../icons'

/** Real server-side login for authority staff (phone + password). Replaces the old browser-only passcode. */
export default function AdminLogin({ title = 'Civic Authority Portal' }: { title?: string }) {
  const { setSession } = useAuth()
  const [phone, setPhone] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const r = await api.adminLogin(phone.trim(), pw)
      setSession(r.access, r.refresh, r.user)
    } catch {
      setErr('Wrong phone number or password.')
    }
    setBusy(false)
  }

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-slate-950 p-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-100 bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md shadow-red-200">
            <MedicalCrossIcon size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black leading-tight text-slate-900">Hassan District Health</h1>
            <p className="text-xs font-semibold text-slate-500">{title}</p>
          </div>
        </div>
        <label className="block space-y-1 pt-2">
          <span className="text-xs font-bold text-slate-700">Phone number</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            inputMode="numeric"
            autoComplete="username"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-red-600 focus:outline-none"
            autoFocus
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-700">Password</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-red-600 focus:outline-none"
          />
        </label>
        {err && <p className="text-xs font-bold text-red-600">{err}</p>}
        <button disabled={busy || phone.length !== 10 || !pw} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-extrabold text-white shadow-md hover:bg-slate-800 disabled:opacity-50">
          {busy ? 'Signing in...' : 'Sign in to Portal'}
        </button>
      </form>
    </div>
  )
}
