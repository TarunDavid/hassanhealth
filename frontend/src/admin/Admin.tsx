import { useCallback, useEffect, useState } from 'react'
import { api, type Dashboard } from '../api'
import { useAuth } from '../AuthContext'
import AdminLogin from './AdminLogin'
import Overview from './Overview'
import Facilities from './Facilities'
import Funding from './Funding'
import Community from './Community'
import Live from './Live'
import CampsAdmin from './CampsAdmin'
import Usage from './Usage'
import DoctorsAdmin from './DoctorsAdmin'
import { MedicalCrossIcon, UserIcon } from '../icons'

const TABS = ['Overview', 'Facilities', 'Funding', 'Community', 'Live', 'Camps', 'Doctors', 'Usage'] as const
type Tab = (typeof TABS)[number]
export default function Admin() {
  const { user, loading, logout } = useAuth()
  const ok = user?.role === 'admin'
  const [tab, setTab] = useState<Tab>('Overview')
  const [data, setData] = useState<Dashboard | null>(null)
  const [err, setErr] = useState('')
  const [liveSosCount, setLiveSosCount] = useState<number>(0)

  const load = useCallback(() => {
    api
      .dashboard()
      .then((d) => {
        setData(d)
        setErr('')
      })
      .catch((e: Error) => setErr(e.message))

    api
      .sosList()
      .then((s) => {
        const active = s.filter((x) => x.status !== 'resolved').length
        setLiveSosCount(active)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (ok) {
      load()
      const interval = setInterval(load, 8000)
      return () => clearInterval(interval)
    }
  }, [ok, load])

  if (loading) return <div className="p-8 text-sm font-semibold text-slate-500">Loading...</div>
  if (!ok) return <AdminLogin />

  return (
    <div className="flex min-h-full flex-col bg-slate-100/70 text-slate-900">
      {/* Top Navigation Bar (Dark Navy #0F172A) */}
      <header className="z-30 flex flex-wrap items-center justify-between border-b border-slate-800 bg-[#0b1120] px-6 py-3 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm shadow-red-500/30">
            <MedicalCrossIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight text-white leading-tight">
                Hassan District Health
              </h1>
              <span className="rounded bg-amber-500 px-1.5 py-0.2 text-[9px] font-black uppercase text-slate-950">
                SIMULATED DATA
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-400 leading-none mt-0.5">
              ಹಾಸನ ಜಿಲ್ಲಾ ಆರೋಗ್ಯ ಪ್ರಾಧಿಕಾರ
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap items-center gap-1.5">
          {TABS.map((x) => {
            const isActive = tab === x
            return (
              <button
                key={x}
                type="button"
                onClick={() => setTab(x)}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {x === 'Live' && (
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                    <span>✱</span>
                  </span>
                )}
                <span>{x}</span>
                {x === 'Live' && (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[9px] text-white">
                    {liveSosCount}
                  </span>
                )}
              </button>
            )
          })}

          <button
            type="button"
            onClick={load}
            title="Refresh Data"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            ↻
          </button>

          {/* Admin Identity Badge */}
          <div className="ml-3 flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 px-2.5 py-1">
            <div className="text-right">
              <p className="text-[10px] font-black leading-none text-slate-200">
                Admin ·· {user?.phone.slice(-4)}
              </p>
              <p className="text-[9px] font-medium leading-none text-slate-400 mt-0.5">
                Prototype - simulated data
              </p>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-xs">
              <UserIcon size={14} />
            </div>
            <button type="button" onClick={() => void logout()} className="rounded-lg px-2 py-1 text-[10px] font-extrabold text-slate-300 hover:bg-slate-700 hover:text-white">
              Log out
            </button>
          </div>
        </nav>
      </header>

      {/* Main Admin Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 p-5 space-y-4">
        {err && (
          <p className="rounded-xl bg-red-100 p-3 text-xs font-bold text-red-800 border border-red-200">
            Could not load data: {err}
          </p>
        )}
        {!data && !err && (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm font-bold text-slate-500 animate-pulse">
              Loading District Health Database…
            </p>
          </div>
        )}

        {data && tab === 'Overview' && <Overview d={data} />}
        {data && tab === 'Facilities' && <Facilities d={data} />}
        {data && tab === 'Funding' && <Funding d={data} />}
        {data && tab === 'Community' && <Community d={data} />}
        {tab === 'Live' && <Live facilities={data?.facilities ?? []} />}
        {data && tab === 'Camps' && <CampsAdmin d={data} />}
        {tab === 'Doctors' && <DoctorsAdmin />}
        {tab === 'Usage' && <Usage />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-3 text-xs font-semibold text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <span>
            Hassan District Health Authority | ಜಿಲ್ಲಾ ಆರೋಗ್ಯ ಮತ್ತು ಕುಟುಂಬ ಕಲ್ಯಾಣ ಇಲಾಖೆ, ಹಾಸನ
          </span>
          <span className="text-[11px] text-slate-400">
            Prototype - simulated data
          </span>
        </div>
      </footer>
    </div>
  )
}
