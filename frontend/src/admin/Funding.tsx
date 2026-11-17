import type { Dashboard } from '../api'
import { Card, NEED_LABEL, TYPE_LABEL } from './ui'

const CHIP: Record<string, string> = {
  staff: 'bg-violet-100 text-violet-800 border-violet-200',
  equipment: 'bg-blue-100 text-blue-800 border-blue-200',
  building_repair: 'bg-orange-100 text-orange-900 border-orange-200',
  medicine: 'bg-pink-100 text-pink-800 border-pink-200',
  connectivity: 'bg-slate-200 text-slate-800 border-slate-300',
}

export default function Funding({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-4">
      <Card title="Recommended for immediate government funding (ranked by urgency)">
        <ol className="space-y-2">
          {d.funding.map((f, i) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:shadow-xs transition-shadow"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 font-black text-white shadow-xs">
                {i + 1}
              </span>
              <div className="min-w-[200px] flex-1">
                <p className="font-black text-slate-900 text-sm">{f.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {TYPE_LABEL[f.type]} · {f.taluk} · staff {f.staff_pct}% · equipment {f.equipment_pct}% · medicine {f.medicine_stock_pct}%
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {f.needs.map((n) => (
                  <span
                    key={n}
                    className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold ${CHIP[n]}`}
                  >
                    {NEED_LABEL[n]}
                  </span>
                ))}
              </div>
              <span className="w-24 text-right text-xs font-black tabular-nums text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                score {f.urgency}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="How the ranking works">
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-slate-600 font-medium leading-relaxed">
          <li>
            <b>Staff:</b> flagged when fewer than 65% of sanctioned posts are filled.
          </li>
          <li>
            <b>Equipment:</b> flagged when fewer than 80% of required equipment is working.
          </li>
          <li>
            <b>Building / repair:</b> flagged when condition rating is 2 or lower (out of 5).
          </li>
          <li>
            <b>Medicine supply:</b> flagged when stock is below 55%.
          </li>
          <li>
            <b>Connectivity:</b> flagged when the facility has no internet (blocks telemedicine).
          </li>
          <li>The urgency score is a weighted sum of how far each gap is below its threshold.</li>
        </ul>
      </Card>
    </div>
  )
}
