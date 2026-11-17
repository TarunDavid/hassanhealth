import { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api, type UsageData } from '../api'
import { Card, Kpi } from './ui'

const REASON_COLORS: Record<string, string> = {
  snakebite: '#dc2626',
  accident: '#ea580c',
  maternal: '#db2777',
  animal_sick: '#d97706',
  animal_injury: '#b45309',
  general: '#2563eb',
  other: '#64748b',
}

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-red-100 text-red-800 border-red-200',
  dispatched: 'bg-amber-100 text-amber-900 border-amber-200',
  resolved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export default function Usage() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(30)
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - (rangeDays - 1))
    const fromStr = from.toISOString().split('T')[0]
    const toStr = to.toISOString().split('T')[0]

    api
      .usage(fromStr, toStr)
      .then((d) => {
        setData(d)
        setErr('')
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [rangeDays])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm font-bold text-slate-500 animate-pulse">Loading Analytics & Usage Data…</p>
      </div>
    )
  }

  if (err && !data) {
    return (
      <p className="rounded-xl bg-red-100 p-3 text-xs font-bold text-red-800 border border-red-200">
        Could not load usage data: {err}
      </p>
    )
  }

  if (!data) return null

  const s = data.summary

  // Combine daily events & unique sessions for LineChart
  const dailyChartData = data.total_events_per_day.map((d, idx) => {
    const sessionMatch = data.unique_sessions_per_day[idx]
    return {
      date: d.date.slice(5),
      events: d.count,
      sessions: sessionMatch ? sessionMatch.count : 0,
    }
  })

  return (
    <div className="space-y-4">
      {/* Date Range Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
        <div>
          <h2 className="text-sm font-black text-slate-900 leading-tight">
            Emergency Dispatch & Citizen Usage Analytics
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Anonymous interaction logs & SOS reasons ({data.date_range.from} to {data.date_range.to})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setRangeDays(7)}
              className={`rounded-lg px-3 py-1 font-extrabold transition-all ${
                rangeDays === 7 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setRangeDays(30)}
              className={`rounded-lg px-3 py-1 font-extrabold transition-all ${
                rangeDays === 30 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          <button
            type="button"
            onClick={load}
            title="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-colors border border-slate-200"
          >
            ↻
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Total Interactions"
          value={s.total_events_in_range}
          sub={`${s.events_today} events today`}
          tone="slate"
        />
        <Kpi
          label="Daily Active Sessions"
          value={s.unique_sessions_today}
          sub="Unique anonymous sessions today"
          tone="green"
        />
        <Kpi
          label="Total SOS Dispatches"
          value={s.total_sos_in_range}
          sub={`${s.sos_today} dispatched today`}
          tone="red"
        />
        <Kpi
          label="Livestock Emergency"
          value={data.sos_by_kind.animal}
          sub={`${s.animal_sos_today} animal cases today (1962)`}
          tone="amber"
        />
      </div>

      {/* Primary Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Daily Events & Sessions Line Chart */}
        <Card title={`Daily Interactions & Sessions (${rangeDays} Days)`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="events"
                  name="Total Events"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name="Unique Sessions"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-center gap-6 text-[11px] font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-600" /> Total Events
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600" /> Unique Sessions
            </span>
          </div>
        </Card>

        {/* SOS By Reason Bar Chart */}
        <Card title="Emergency SOS Count by Reason">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sos_by_reason}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={35}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="count" name="SOS Count" radius={[6, 6, 0, 0]}>
                  {data.sos_by_reason.map((entry) => (
                    <Cell key={entry.reason} fill={REASON_COLORS[entry.reason] || '#2563eb'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Secondary Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* SOS By Hour of Day */}
        <Card title="SOS Dispatches by Hour of Day (00:00 - 23:00)">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sos_by_hour}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(h: number) => `${h}:00`}
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(h: unknown) => `${h}:00 - ${Number(h) + 1}:00`}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="count" name="SOS Count" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-center text-[10px] font-medium text-slate-500">
            Daytime hours (07:00 - 21:00) represent majority of dispatches
          </p>
        </Card>

        {/* Feature Usage Breakdown */}
        <Card title="Feature & Action Event Breakdown">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.event_counts.filter((e) => e.count > 0).slice(0, 10)}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                />
                <Bar dataKey="count" name="Occurrences" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 50 Recent SOS Requests Table */}
      <Card title="50 Most Recent Emergency SOS Requests">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase text-slate-600">
              <tr>
                <th className="py-2.5 px-3">#ID</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Reason</th>
                <th className="py-2.5 px-3">Assigned Facility</th>
                <th className="py-2.5 px-3">Ambulance</th>
                <th className="py-2.5 px-3">Button Pressed At</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {data.recent_sos.map((sos) => {
                const pressedDt = sos.pressed_at ? new Date(sos.pressed_at) : new Date(sos.created_at)
                return (
                  <tr key={sos.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-3 font-bold text-slate-900">#{sos.id}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          sos.kind === 'animal'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {sos.kind === 'animal' ? '🐾 Animal' : '🚑 Human'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-800 uppercase">
                        {sos.reason ? sos.reason.replace('_', ' ') : 'General'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {sos.facility ? `${sos.facility.name} (${sos.facility.taluk})` : '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-bold">
                      {sos.ambulance?.code ?? '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                      {pressedDt.toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${
                          STATUS_BADGE[sos.status] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {sos.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
