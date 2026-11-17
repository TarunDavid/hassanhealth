import { useMemo, useState } from 'react'
import type { Dashboard, FacilityRow } from '../api'
import {
  DownloadIcon,
  PlusIcon,
  SearchIcon,
  AlertTriangleIcon,
  BriefcaseIcon,
  SignalBarsIcon,
  PillIcon,
  ExchangeIcon,
  RadioTowerIcon,
  PawIcon,
} from '../icons'

export default function Facilities({ d }: { d: Dashboard }) {
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedTaluk, setSelectedTaluk] = useState('all')
  const [sortOrder, setSortOrder] = useState<'urgent' | 'staff' | 'equipment' | 'medicine'>('urgent')
  const [activeChip, setActiveChip] = useState<'all' | 'staff' | 'biomed' | 'drugs' | 'tele' | 'emergency'>('all')
  const [page, setPage] = useState(1)
  const [selectedFacilityForAudit, setSelectedFacilityForAudit] = useState<FacilityRow | null>(null)
  const pageSize = 14

  const taluks = useMemo(() => [...new Set(d.facilities.map((f) => f.taluk))].sort(), [d])

  // Count metrics
  const totalFacilities = d.facilities.length
  const criticalCount = d.facilities.filter(
    (f) => f.staff_pct < 50 || f.equipment_pct === 0 || f.medicine_stock_pct < 40 || f.urgency > 40,
  ).length
  const totalStaffSanctioned = d.facilities.reduce((acc, f) => acc + f.staff_sanctioned, 0)
  const totalStaffFilled = d.facilities.reduce((acc, f) => acc + f.staff_filled, 0)
  const doctorVacancies = 18 // Representative district metric
  const teleOperational = d.facilities.filter((f) => f.has_telemedicine).length
  const netOffline = d.facilities.filter((f) => !f.has_internet).length

  // Filter logic
  const filteredRows = useMemo(() => {
    return d.facilities
      .filter((f) => {
        // Dropdown filters
        if (selectedType !== 'all' && f.type !== selectedType) return false
        if (selectedTaluk !== 'all' && f.taluk !== selectedTaluk) return false

        // Chip filters
        if (activeChip === 'staff' && f.staff_pct >= 50) return false
        if (activeChip === 'biomed' && f.equipment_pct > 0) return false
        if (activeChip === 'drugs' && f.medicine_stock_pct >= 50) return false
        if (activeChip === 'tele' && f.has_telemedicine) return false
        if (activeChip === 'emergency' && !f.has_emergency) return false

        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase()
          return (
            f.name.toLowerCase().includes(q) ||
            (f.name_kn && f.name_kn.toLowerCase().includes(q)) ||
            f.taluk.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        if (sortOrder === 'urgent') return b.urgency - a.urgency
        if (sortOrder === 'staff') return a.staff_pct - b.staff_pct
        if (sortOrder === 'equipment') return a.equipment_pct - b.equipment_pct
        if (sortOrder === 'medicine') return a.medicine_stock_pct - b.medicine_stock_pct
        return 0
      })
  }, [d.facilities, selectedType, selectedTaluk, activeChip, search, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize)

  // Facility badge helper
  const getFacilityBadge = (f: FacilityRow) => {
    if (f.type === 'hub') {
      return { text: 'DISTRICT APEX', bg: 'bg-red-950 text-white border-red-900' }
    }
    if (f.type === 'chc') {
      return { text: 'CHC TALUK', bg: 'bg-orange-100 text-orange-900 border-orange-200' }
    }
    if (f.type === 'phc') {
      return { text: 'PHC', bg: 'bg-emerald-100 text-emerald-900 border-emerald-200' }
    }
    if (f.type === 'clinic') {
      return { text: 'SUB-CENTRE', bg: 'bg-indigo-100 text-indigo-900 border-indigo-200' }
    }
    if (f.type === 'vet') {
      return {
        text: f.name.includes('Hospital') ? 'VET POLYCLINIC' : 'VET CLINIC',
        bg: 'bg-amber-100 text-amber-900 border-amber-200',
      }
    }
    return { text: 'CENTRE', bg: 'bg-slate-100 text-slate-700 border-slate-200' }
  }

  const getSubLocation = (f: FacilityRow) => {
    if (f.type === 'hub') return 'Hassan Institute of Medical Sciences • Tertiary Care & ICU'
    if (f.type === 'chc') return `Taluk Hospital • ${f.taluk} Sector Trauma Unit`
    if (f.type === 'phc') return `Primary Health Centre • 24x7 Delivery`
    if (f.type === 'clinic') return `Village Clinic • ${f.taluk} Rural Outreach`
    if (f.type === 'vet') return `Veterinary Hospital • Livestock & Dairy Zone`
    return f.taluk
  }

  const handleExportCSV = () => {
    const headers = 'ID,Name,Type,Taluk,Staff%,StaffFilled,StaffSanctioned,Equipment%,Working,Required,Medicine%,Building,Emergency,Telemedicine,Internet,Urgency\n'
    const csv = d.facilities
      .map(
        (f) =>
          `"${f.id}","${f.name}","${f.type}","${f.taluk}",${f.staff_pct},${f.staff_filled},${f.staff_sanctioned},${f.equipment_pct},${f.equipment_working},${f.equipment_required},${f.medicine_stock_pct},${f.building_condition},${f.has_emergency},${f.has_telemedicine},${f.has_internet},${f.urgency}`,
      )
      .join('\n')
    const blob = new Blob([headers + csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Hassan_Health_Facilities_Audit_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <div className="space-y-4">
      {/* Sub-Header Banner (Image 8) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-xs border border-slate-200/80">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            HASSAN DISTRICT MIS / Healthcare Facilities & Physical Infrastructure
          </p>
          <div className="flex items-center gap-2.5 mt-0.5">
            <h2 className="text-xl font-black text-slate-900 leading-tight">
              Facility & Resource Dashboard
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-700">
              {totalFacilities} Facilities Tracked
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            ಜಿಲ್ಲಾ ಆರೋಗ್ಯ ಕೇಂದ್ರ ಹಾಗೂ ಸಂಪನ್ಮೂಲ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ • Live telemetry across 8 Taluks for staff strength, biomedical equipment, essential drug formulary, and telemedicine reach.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98"
          >
            <DownloadIcon size={14} />
            <span>Export CSV / Audit</span>
          </button>

          <button
            type="button"
            onClick={() =>
              alert(
                'Drug Restock Requisition generated!\nEmergency supply order triggered for 5 facilities with sub-40% inventory.',
              )
            }
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-98"
          >
            <PillIcon size={14} className="text-red-600" />
            <span>Drug Restock Requisition</span>
          </button>

          <button
            type="button"
            onClick={() =>
              alert(
                'Register Facility / Asset Dialog:\nIn live mode, opens new facility onboarding & asset geo-tagging form.',
              )
            }
            className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-red-700 active:scale-98"
          >
            <PlusIcon size={14} />
            <span>Register Facility / Asset</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Stat Cards Row (Image 8) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* KPI 1 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              TOTAL NETWORK UNITS
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs">
              🏥
            </span>
          </div>
          <div className="mt-1 text-3xl font-black text-slate-900">{totalFacilities}</div>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            1 District Hub • 7 CHC • 16 PHC • 16 Sub-clinics • 6 Vet
          </p>
        </div>

        {/* KPI 2 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wide text-red-600 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              CRITICAL RESOURCE GAPS
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-100 text-red-700">
              <AlertTriangleIcon size={14} />
            </div>
          </div>
          <div className="mt-1 text-3xl font-black text-red-600">{criticalCount}</div>
          <p className="mt-1 text-[11px] font-bold text-red-600">
            Immediate intervention required: {criticalCount} High Risk
          </p>
        </div>

        {/* KPI 3 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              AGGREGATE STAFFING
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
              <BriefcaseIcon size={14} />
            </div>
          </div>
          <div className="mt-1 text-3xl font-black text-slate-900">
            {d.summary.avg_staff_fill_pct}%
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {totalStaffFilled} of {totalStaffSanctioned} Posts Active • {doctorVacancies} Doctor Vacancies
          </p>
        </div>

        {/* KPI 4 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wide">
              TELEMEDICINE & OFC SYNC
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-700 font-bold text-xs">
              🖥️
            </span>
          </div>
          <div className="mt-1 text-3xl font-black text-slate-900">
            <span className="text-emerald-700">{teleOperational}</span>/{totalFacilities}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold">
            <span className="text-emerald-700">
              {((teleOperational / totalFacilities) * 100).toFixed(1)}% Operational
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-red-600">{netOffline} Offline / Low Net</span>
          </p>
        </div>
      </div>

      {/* Search, Filter & Sub-Filter Bar (Image 8) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
        {/* Main Controls Row */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
          {/* Search Input */}
          <div className="relative lg:col-span-4">
            <SearchIcon size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search facility name, doctor, or PIN code..."
              className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:border-red-600 focus:outline-none"
            />
          </div>

          {/* Type Dropdown */}
          <div className="lg:col-span-3">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-red-600 focus:outline-none"
            >
              <option value="all">All Types ({totalFacilities} Facilities)</option>
              <option value="hub">District Hub (1)</option>
              <option value="chc">CHC Taluk Hospitals (7)</option>
              <option value="phc">Primary Health Centres (16)</option>
              <option value="clinic">Sub-Centres & Clinics (16)</option>
              <option value="vet">Veterinary Hospitals (6)</option>
            </select>
          </div>

          {/* Taluk Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={selectedTaluk}
              onChange={(e) => {
                setSelectedTaluk(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-red-600 focus:outline-none"
            >
              <option value="all">All Taluks (8)</option>
              {taluks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="lg:col-span-3">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-red-600 focus:outline-none"
            >
              <option value="urgent">Sort: Most Urgent / Highest Deficit</option>
              <option value="staff">Sort: Lowest Staffing</option>
              <option value="equipment">Sort: Lowest Equipment</option>
              <option value="medicine">Sort: Lowest Medicine</option>
            </select>
          </div>
        </div>

        {/* Sub-Filter Chips Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveChip('all')
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-xs font-extrabold transition-all ${
                activeChip === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({totalFacilities})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveChip('staff')
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                activeChip === 'staff'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Critical Staff (&lt;50%)
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveChip('biomed')
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                activeChip === 'biomed'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Biomedical Outage (0%)
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveChip('drugs')
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                activeChip === 'drugs'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Low Drugs (&lt;50%)
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveChip('tele')
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                activeChip === 'tele'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tele-Offline
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveChip('emergency')
                setPage(1)
              }}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                activeChip === 'emergency'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Emergency 24/7 (8)
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Showing {paginatedRows.length} of {filteredRows.length} facilities
          </div>
        </div>
      </div>

      {/* Facilities Master Table (Image 8) */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 pl-4 pr-3">FACILITY</th>
                <th className="py-3 px-3">TALUK</th>
                <th className="py-3 px-3">STAFFING</th>
                <th className="py-3 px-3">EQUIPMENT</th>
                <th className="py-3 px-3">MEDICINE</th>
                <th className="py-3 px-3">BUILDING</th>
                <th className="py-3 px-2 text-center">EMERGENCY</th>
                <th className="py-3 px-2 text-center">TELE</th>
                <th className="py-3 px-2 text-center">NET</th>
                <th className="py-3 pr-4 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {paginatedRows.map((f) => {
                const badge = getFacilityBadge(f)
                const subLoc = getSubLocation(f)
                const isCriticalDrug = f.medicine_stock_pct < 30

                return (
                  <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Facility Name & Badge */}
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 text-xs">{f.name}</span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-black uppercase border ${badge.bg}`}
                        >
                          {badge.text}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-slate-500 mt-0.5">{subLoc}</p>
                    </td>

                    {/* Taluk */}
                    <td className="py-3 px-3 font-bold text-slate-700">{f.taluk}</td>

                    {/* Staffing Progress & Ratio */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              f.staff_pct < 50
                                ? 'bg-amber-800'
                                : f.staff_pct < 75
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, f.staff_pct)}%` }}
                          />
                        </div>
                        <span className="w-8 text-[11px] font-bold tabular-nums text-slate-800">
                          {f.staff_pct}%
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {f.staff_filled}/{f.staff_sanctioned} Active
                      </p>
                    </td>

                    {/* Equipment Progress & Ratio */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              f.equipment_pct === 0
                                ? 'bg-red-600'
                                : f.equipment_pct < 60
                                  ? 'bg-amber-600'
                                  : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, f.equipment_pct)}%` }}
                          />
                        </div>
                        <span
                          className={`w-8 text-[11px] font-bold tabular-nums ${
                            f.equipment_pct === 0 ? 'text-red-600' : 'text-slate-800'
                          }`}
                        >
                          {f.equipment_pct}%
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {f.equipment_working}/{f.equipment_required} working
                      </p>
                    </td>

                    {/* Medicine Progress & Ratio */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              f.medicine_stock_pct < 35
                                ? 'bg-red-600'
                                : f.medicine_stock_pct < 55
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, f.medicine_stock_pct)}%` }}
                          />
                        </div>
                        <span className="w-8 text-[11px] font-bold tabular-nums text-slate-800">
                          {f.medicine_stock_pct}%
                        </span>
                      </div>
                      {isCriticalDrug ? (
                        <span className="mt-0.5 inline-block text-[9px] font-black text-red-600 uppercase tracking-tight">
                          CRITICAL STOCK
                        </span>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">Formulary stocked</p>
                      )}
                    </td>

                    {/* Building Rating */}
                    <td className="py-3 px-3 text-amber-500 text-xs">
                      {'★'.repeat(f.building_condition)}
                      <span className="text-slate-200">
                        {'★'.repeat(5 - f.building_condition)}
                      </span>
                    </td>

                    {/* Emergency Unit */}
                    <td className="py-3 px-2 text-center">
                      {f.has_emergency ? (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                          ✓
                        </span>
                      ) : f.type === 'vet' ? (
                        <span className="text-amber-700">
                          <PawIcon size={14} className="inline" />
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Telemedicine */}
                    <td className="py-3 px-2 text-center">
                      {f.has_telemedicine ? (
                        <span className="text-emerald-700 text-sm" title="Telemedicine Active">
                          🖥️
                        </span>
                      ) : (
                        <span className="text-slate-300">⊘</span>
                      )}
                    </td>

                    {/* Network Connectivity */}
                    <td className="py-3 px-2 text-center">
                      {f.has_internet ? (
                        <span className="text-emerald-700" title="High-speed Fiber / OFC Sync">
                          <SignalBarsIcon size={14} className="inline" />
                        </span>
                      ) : (
                        <span className="font-bold text-red-600 text-xs" title="Offline">
                          ✕
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 pr-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedFacilityForAudit(f)}
                        className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline"
                      >
                        Audit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls Footer (Image 8) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-bold">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-bold">
              {Math.min(page * pageSize, filteredRows.length)}
            </span>{' '}
            of <span className="font-bold">{filteredRows.length}</span> entries
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-40"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black transition-all ${
                  page === p
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 3 Bottom Interactive Action Cards (Image 8) */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card 1: Deficit Requisition Alert */}
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs">
              <PillIcon size={16} />
            </div>
            <h4 className="text-xs font-black text-slate-900">Deficit Requisition Alert</h4>
          </div>
          <p className="text-[11px] font-medium text-slate-600 leading-snug">
            Broadcast bulk SMS & NHM emergency stock indent for the 5 facilities under 40% essential medicine reserve.
          </p>
          <button
            type="button"
            onClick={() => alert('Restock directive issued to Karnataka State Drug Logistics Society!')}
            className="text-xs font-black text-red-600 hover:text-red-700 hover:underline pt-1 inline-block"
          >
            Issue Restock Directive ➔
          </button>
        </div>

        {/* Card 2: Doctor Deputation Roster */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <ExchangeIcon size={16} />
            </div>
            <h4 className="text-xs font-black text-slate-900">Doctor Deputation Roster</h4>
          </div>
          <p className="text-[11px] font-medium text-slate-600 leading-snug">
            Temporary reallocation of 4 General Duty Medical Officers from HIMS Hassan to Kattaya & Hanbal Sub-centres.
          </p>
          <button
            type="button"
            onClick={() => alert('Deputation matrix opened for administrative reassignment.')}
            className="text-xs font-black text-blue-700 hover:text-blue-800 hover:underline pt-1 inline-block"
          >
            Open Deputation Matrix ➔
          </button>
        </div>

        {/* Card 3: BSNL OFC Restoration Ticket */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-700 text-white shadow-xs">
              <RadioTowerIcon size={16} />
            </div>
            <h4 className="text-xs font-black text-slate-900">BSNL OFC Restoration Ticket</h4>
          </div>
          <p className="text-[11px] font-medium text-slate-600 leading-snug">
            19 Facilities logged network packet loss &gt; 40%. Direct escalate to Hassan District Telecom Engineer.
          </p>
          <button
            type="button"
            onClick={() => alert('Telecom SLA escalation ticket logged for 19 PHC nodes.')}
            className="text-xs font-black text-indigo-700 hover:text-indigo-800 hover:underline pt-1 inline-block"
          >
            Track Telecom SLA (19 PHCs) ➔
          </button>
        </div>
      </div>

      {/* Cloud Feed & District Approval Seal Footer Line (Image 8) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          National Health Mission (NHM) Karnataka State Cloud Feed / Last automated ping: 2 mins ago
        </span>
        <div className="flex items-center gap-2">
          <span>District Collectorate Approval Seal: #HSN-CIVIC-2026-Q1</span>
          <span>•</span>
          <button
            type="button"
            onClick={() => alert('System Logs: Zero crash events. 100% telemetry uptime.')}
            className="font-bold text-slate-700 hover:underline"
          >
            View System Logs
          </button>
        </div>
      </div>

      {/* Facility Audit Detail Modal */}
      {selectedFacilityForAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {selectedFacilityForAudit.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedFacilityForAudit.taluk} Taluk • {selectedFacilityForAudit.type.toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFacilityForAudit(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-extrabold uppercase text-slate-400">Staff Fill</p>
                <p className="text-lg font-black text-slate-900">{selectedFacilityForAudit.staff_pct}%</p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {selectedFacilityForAudit.staff_filled}/{selectedFacilityForAudit.staff_sanctioned} Active
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-extrabold uppercase text-slate-400">Equipment</p>
                <p className="text-lg font-black text-slate-900">{selectedFacilityForAudit.equipment_pct}%</p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {selectedFacilityForAudit.equipment_working}/{selectedFacilityForAudit.equipment_required} Working
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <p className="text-[10px] font-extrabold uppercase text-slate-400">Medicine</p>
                <p className="text-lg font-black text-slate-900">{selectedFacilityForAudit.medicine_stock_pct}%</p>
                <p className="text-[10px] text-slate-500 font-medium">Stocked</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Urgency Risk Index:</span>
                <span className="font-black text-red-600">{selectedFacilityForAudit.urgency} / 100</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Infrastructure Rating:</span>
                <span className="font-bold text-amber-500">{'★'.repeat(selectedFacilityForAudit.building_condition)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Telemedicine Link:</span>
                <span className="font-mono text-[11px] text-blue-700 truncate max-w-[240px]">
                  {selectedFacilityForAudit.telemedicine_link || 'Direct HIMS Node'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Identified Gaps:</span>
                <span className="font-bold text-slate-900">
                  {selectedFacilityForAudit.needs.join(', ') || 'Within compliance limits'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  alert(`Procurement requisition filed for ${selectedFacilityForAudit.name}`)
                  setSelectedFacilityForAudit(null)
                }}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-black text-white hover:bg-red-700 shadow-xs"
              >
                Trigger Immediate Restock
              </button>
              <button
                type="button"
                onClick={() => setSelectedFacilityForAudit(null)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
