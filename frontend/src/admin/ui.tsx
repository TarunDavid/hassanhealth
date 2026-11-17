import type { ReactNode } from 'react'

export const Card = ({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) => (
  <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs ${className}`}>
    {title && (
      <h2 className="mb-3.5 text-xs font-black uppercase tracking-wider text-slate-800">
        {title}
      </h2>
    )}
    {children}
  </section>
)

export const Kpi = ({
  label,
  value,
  sub,
  tone = 'slate',
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'slate' | 'red' | 'green' | 'amber'
}) => {
  const c = {
    slate: 'text-slate-900',
    red: 'text-red-600',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
  }[tone]

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-0.5 text-2xl font-black ${c}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-medium text-slate-500 truncate">{sub}</p>}
    </div>
  )
}

export const Bar = ({
  pct,
  warn = 60,
  bad = 40,
}: {
  pct: number
  warn?: number
  bad?: number
}) => (
  <div className="flex items-center gap-2">
    <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full transition-all ${
          pct < bad ? 'bg-red-500' : pct < warn ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
    <span className="w-9 text-xs font-bold tabular-nums text-slate-700">{pct}%</span>
  </div>
)

export const TYPE_LABEL: Record<string, string> = {
  hub: 'District Hub',
  chc: 'CHC',
  phc: 'PHC',
  clinic: 'Village Clinic',
  vet: 'Vet Hospital',
}

export const NEED_LABEL: Record<string, string> = {
  staff: 'Staff',
  equipment: 'Equipment',
  building_repair: 'Building / Repair',
  medicine: 'Medicine supply',
  connectivity: 'Connectivity',
}
