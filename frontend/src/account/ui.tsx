import type { ReactNode } from 'react'
import { ApiError } from '../api'
import { SpeakerButton } from '../citizen/Shell'
import { useLang } from '../i18n'

export const inputCls =
  'w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 py-3 text-base font-semibold text-slate-900 focus:border-red-600 focus:outline-none'
export const btnPrimary =
  'w-full rounded-2xl bg-red-600 py-4 text-base font-extrabold text-white shadow-md active:scale-[0.98] disabled:opacity-50'
export const btnGhost =
  'w-full rounded-2xl border-2 border-slate-300 bg-white py-3 text-sm font-extrabold text-slate-800 active:scale-[0.98] disabled:opacity-50'

/** Screen wrapper: title, a speaker button that reads the intro aloud, then the content. */
export function Page({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="space-y-4 p-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black text-slate-900">{title}</h1>
        <SpeakerButton text={intro} />
      </div>
      {children}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok' | 'err'; children: ReactNode }) {
  const c = {
    info: 'border-sky-300 bg-sky-50 text-sky-900',
    warn: 'border-amber-300 bg-amber-50 text-amber-900',
    ok: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    err: 'border-red-300 bg-red-50 text-red-900',
  }[tone]
  return <div className={`rounded-xl border-2 p-3 text-sm font-bold ${c}`}>{children}</div>
}

/** Turn an API failure into a short translated message. */
export function useErrText() {
  const { t } = useLang()
  return (e: unknown): string => {
    if (e instanceof ApiError) {
      if (e.code === 'locked') return t('a_err_locked')
      if (e.code === 'wait_30_seconds' || e.code === 'rate_limited') return t('a_err_wait')
      if (e.code === 'wrong_code' || e.code === 'code_expired') return t('a_err_code')
      if (e.code === 'invalid_phone') return t('a_err_phone')
      if (e.code === 'invalid_credentials') return t('a_err_creds')
      if (e.code === 'phone_taken') return t('a_err_taken')
      if (e.code === 'weak_password') return t('a_err_weak')
      if (e.status >= 500 || e.status === 404) return t('a_err_server')
    }
    // network failure, or the host returned a web page instead of the API
    if (!(e instanceof ApiError)) return t('a_err_server')
    return t('a_err_generic')
  }
}

export function Spinner() {
  const { t } = useLang()
  return <p className="p-6 text-center text-sm font-bold text-slate-500">{t('a_loading')}</p>
}
