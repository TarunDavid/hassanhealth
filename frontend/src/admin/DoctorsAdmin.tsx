import { useCallback, useEffect, useState } from 'react'
import { api, type DoctorProfile } from '../api'

export default function DoctorsAdmin() {
  const [rows, setRows] = useState<DoctorProfile[]>([])
  const load = useCallback(() => { void api.adminDoctors().then(setRows).catch(() => {}) }, [])
  useEffect(load, [load])
  const decide = (id: number, a: 'approve' | 'reject') => void api.decideDoctor(id, a).then(load)
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-sky-50 p-3 text-sm font-bold text-sky-900">Doctor registrations. Approve only after checking the medical council number. Admins never see any patient health data.</p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3">Council / Reg no</th><th className="p-3">Specialty</th><th className="p-3">Facility</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-slate-100" data-testid={`doc-row-${d.id}`}>
                <td className="p-3 font-bold">{d.full_name}</td>
                <td className="p-3 font-mono text-xs">{d.phone}</td>
                <td className="p-3">{d.council} / {d.registration_no}</td>
                <td className="p-3">{d.specialty}</td>
                <td className="p-3">{d.facility}</td>
                <td className="p-3 font-bold">{d.approval_status}</td>
                <td className="space-x-2 p-3 whitespace-nowrap">
                  {d.approval_status !== 'approved' && <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => decide(d.id, 'approve')}>Approve</button>}
                  {d.approval_status !== 'rejected' && <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white" onClick={() => decide(d.id, 'reject')}>Reject</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
