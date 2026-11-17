import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Dashboard } from '../api'
import { Card } from './ui'

export default function Community({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-4">
      <Card title="Barriers faced by households (% affected) by taluk">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={d.taluks}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="taluk" fontSize={11} stroke="#64748b" />
              <YAxis domain={[0, 100]} fontSize={11} stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Bar dataKey="transport_pct" name="No transport" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="financial_pct" name="Cost burden" fill="#dc2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="distance_pct" name="Hospital >10 km" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Taluk Need Ranking">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
              <tr>
                <th className="py-2.5">Taluk</th>
                <th>Need score</th>
                <th>Staff filled</th>
                <th>Offline facilities</th>
                <th>Visits (6 mo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.taluks.map((t) => (
                <tr key={t.taluk} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 font-black text-slate-900">{t.taluk}</td>
                  <td>
                    <span
                      className={`rounded-lg px-2 py-0.5 font-black ${
                        t.need_score > 50
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.need_score}
                    </span>
                  </td>
                  <td className="font-semibold text-slate-700">{t.staff_fill_pct}%</td>
                  <td className="font-semibold text-slate-700">
                    {t.no_internet}/{t.facilities}
                  </td>
                  <td className="font-semibold text-slate-700">
                    {t.visits.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
