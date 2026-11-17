import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import type { Dashboard } from '../api'
import { Card, Kpi, TYPE_LABEL } from './ui'

export default function Overview({ d }: { d: Dashboard }) {
  const s = d.summary
  return (
    <div className="space-y-4">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Kpi
          label="Facilities"
          value={s.facilities}
          sub={Object.entries(s.by_type)
            .map(([k, v]) => `${v} ${TYPE_LABEL[k]}`)
            .join(' · ')}
        />
        <Kpi
          label="Avg staff filled"
          value={`${s.avg_staff_fill_pct}%`}
          tone={s.avg_staff_fill_pct < 70 ? 'red' : 'green'}
        />
        <Kpi
          label="Need attention"
          value={s.needs_attention}
          tone="red"
          sub="facilities with gaps"
        />
        <Kpi
          label="Emergency-ready"
          value={s.emergency_capable}
          tone="green"
          sub="active trauma units"
        />
        <Kpi
          label="Telemedicine"
          value={s.telemedicine}
          sub="digital connectivity"
          tone="green"
        />
        <Kpi
          label="No internet"
          value={s.no_internet}
          tone="amber"
          sub="facilities offline"
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Patient visits per month (all facilities)">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={d.visits_monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" fontSize={11} stroke="#64748b" />
                <YAxis fontSize={11} stroke="#64748b" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#2563eb' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Prevalent illness (visits)">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.illness} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" fontSize={11} stroke="#64748b" />
                <YAxis
                  type="category"
                  dataKey="illness"
                  fontSize={11}
                  width={110}
                  stroke="#64748b"
                />
                <Tooltip />
                <Bar dataKey="visits" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title="Staffing level by taluk (% of sanctioned posts filled)"
          className="lg:col-span-2"
        >
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart
                data={[...d.taluks].sort((a, b) => a.staff_fill_pct - b.staff_fill_pct)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="taluk" fontSize={11} stroke="#64748b" />
                <YAxis domain={[0, 100]} fontSize={11} stroke="#64748b" />
                <Tooltip />
                <Bar dataKey="staff_fill_pct" radius={[4, 4, 0, 0]}>
                  {d.taluks.map((t) => (
                    <Cell
                      key={t.taluk}
                      fill={
                        t.staff_fill_pct < 60
                          ? '#dc2626'
                          : t.staff_fill_pct < 75
                            ? '#f59e0b'
                            : '#059669'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
