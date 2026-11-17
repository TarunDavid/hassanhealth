import { authFetch } from './auth'

export interface Facility {
  id: number; name: string; name_kn: string; type: 'hub' | 'chc' | 'phc' | 'clinic' | 'vet'
  taluk: string; lat: number; lng: number; phone: string; has_telemedicine: boolean
  telemedicine_link: string; has_internet: boolean; has_emergency: boolean
  specialist_services: string; parent_id: number | null; distance_km?: number
}
export interface ChainItem { id: number; name: string; name_kn: string; type: string; phone: string; has_telemedicine: boolean }
export interface Nearest extends Facility { chain: ChainItem[]; telemedicine: ChainItem | null }
export interface Ambulance { id: number; code: string; status: string; lat: number; lng: number; is_animal: boolean; base: string; updated_at: string }
export interface Sos {
  id: number; kind: 'human' | 'animal'; reason: string; lat: number; lng: number; note: string; status: string; language: string
  pressed_at: string | null; session_id: string; created_at: string; facility: Facility | null; ambulance: Ambulance | null
  doctors_alerted?: number; doctor_responding?: { name: string; at: string } | null
}
export interface PatientProfile {
  full_name: string; dob: string | null; age: number | null; sex: string; blood_group: string; taluk: string; language: string
  guardian_phone: string; emergency_contact_name: string; emergency_contact_phone: string
  share_with_contact: boolean; allow_emergency_access: boolean
}
export interface DoctorProfile {
  id: number; full_name: string; council: string; registration_no: string; specialty: string; facility_id: number
  facility: string; facility_name_kn: string; on_duty: boolean; sms_enabled: boolean; shift_note: string
  approval_status: 'pending' | 'approved' | 'rejected'; phone?: string
}
export interface Me {
  id: number; phone: string; role: 'patient' | 'doctor' | 'admin'; profile: PatientProfile | DoctorProfile | null
  consent_required: boolean
}
export interface AuthResult { access: string; refresh: string; user: Me; is_new?: boolean }
export interface DirectoryDoctor { id: number; full_name: string; specialty: string; facility: string; facility_name_kn: string; on_duty: boolean; shift_note: string }
export interface Conditions { chronic: string[]; allergies: string; medicines: string; surgeries: string; pregnancy: string; notes: string }
export interface RecordMeta { id: number; title: string; record_type: string; record_date: string | null; source_name: string; size_bytes: number; mime_type: string; uploaded_at: string }
export interface Grant { id: number; doctor: string; specialty: string; facility: string; expires_at: string | null }
export interface LogRow { id: number; who: string; action: string; reason: string; detail: string; at: string }
export interface PatientRow { id: number; name: string; access: 'granted' | 'emergency' }
export interface InboxRow { id: number; template: string; body: string; status: string; at: string }
export interface PatientMedical { patient: { id: number; name: string; age: number | null; sex: string; blood_group: string; phone: string }; access: string; conditions: Conditions }
export interface TrackData {
  status: string; kind: string; reason: string; reason_label: string
  patient: { name: string; age: number | null; sex: string; phone: string }
  lat: number; lng: number; facility: string | null; pressed_at: string
  trail: { lat: number; lng: number; at: string }[]; my_status: string; responder: string | null
}
export interface FacilityLite { id: number; name: string; name_kn: string; type: string; taluk: string }
export interface Camp { id: number; title: string; village: string; taluk: string; lat: number; lng: number; date: string; focus: string; is_animal: boolean }
export interface FacilityRow extends Facility {
  building_condition: number; medicine_stock_pct: number; staff_pct: number; staff_sanctioned: number; staff_filled: number
  equipment_pct: number; equipment_required: number; equipment_working: number; needs: string[]; urgency: number
}
export interface TalukRow {
  taluk: string; staff_fill_pct: number; facilities: number; no_internet: number; visits: number
  transport_pct: number | null; financial_pct: number | null; distance_pct: number | null; need_score: number
}
export interface Dashboard {
  summary: {
    facilities: number; by_type: Record<string, number>; telemedicine: number; no_internet: number; emergency_capable: number
    avg_staff_fill_pct: number; needs_attention: number; ambulances_total: number; ambulances_available: number
  }
  facilities: FacilityRow[]; funding: FacilityRow[]; taluks: TalukRow[]
  visits_monthly: { month: string; visits: number }[]; illness: { illness: string; visits: number }[]
  camp_suggestions: { taluk: string; need_score: number; reason: string }[]
}

export interface UsageEventPayload {
  session_id?: string
  event: string
  kind?: string
  detail?: string
  language?: string
  lat?: number | null
  lng?: number | null
}

export interface UsageData {
  summary: {
    events_today: number
    unique_sessions_today: number
    sos_today: number
    animal_sos_today: number
    total_events_in_range: number
    total_sos_in_range: number
  }
  total_events_per_day: { date: string; count: number }[]
  unique_sessions_per_day: { date: string; count: number }[]
  event_counts: { event: string; label: string; count: number }[]
  sos_by_reason: { reason: string; label: string; count: number }[]
  sos_by_kind: { human: number; animal: number }
  sos_by_hour: { hour: number; count: number }[]
  recent_sos: Sos[]
  date_range: { from: string; to: string }
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, raw: string) {
    super(`${status} ${raw}`)
    this.status = status
    this.code = code
  }
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await authFetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  if (!r.ok) {
    const raw = await r.text()
    let code = ''
    try {
      code = (JSON.parse(raw) as { error?: string }).error ?? ''
    } catch {
      // not json
    }
    throw new ApiError(r.status, code, raw)
  }
  if (r.status === 204) return undefined as unknown as T
  return r.json() as Promise<T>
}

// A citizen who sends an SOS receives a secret token for that SOS. It is kept in memory and in sessionStorage
// so the same person can cancel it, add a note or send live location. It is never shown in any URL.
const sosTokens = new Map<number, string>()
function sosHeaders(id: number): Record<string, string> {
  let t = sosTokens.get(id)
  if (!t) {
    try {
      t = sessionStorage.getItem(`hh_sos_${id}`) ?? undefined
    } catch {
      t = undefined
    }
  }
  return t ? { 'X-SOS-Token': t } : {}
}
const q = (lat: number, lng: number) => `lat=${lat}&lng=${lng}`
export const api = {
  nearest: (lat: number, lng: number, kind = 'human') => req<Nearest>(`/api/nearest/?${q(lat, lng)}&kind=${kind}`),
  facilities: (lat?: number, lng?: number) => req<Facility[]>(`/api/facilities/${lat !== undefined ? `?${q(lat, lng!)}` : ''}`),
  sendSos: (b: {
    lat: number
    lng: number
    kind: string
    language: string
    note?: string
    reason?: string
    pressed_at?: string
    session_id?: string
  }) =>
    req<Sos & { owner_token?: string }>('/api/sos/', { method: 'POST', body: JSON.stringify(b) }).then((s) => {
      if (s.owner_token) {
        sosTokens.set(s.id, s.owner_token)
        try {
          sessionStorage.setItem(`hh_sos_${s.id}`, s.owner_token)
        } catch {
          // ignore
        }
      }
      return s
    }),
  sosDetail: (id: number) => req<Sos>(`/api/sos/${id}/`, { headers: sosHeaders(id) }),
  sosLocation: (id: number, lat: number, lng: number) =>
    req<void>(`/api/sos/${id}/location/`, { method: 'POST', headers: sosHeaders(id), body: JSON.stringify({ lat, lng }) }),
  sosList: () => req<Sos[]>('/api/sos/'),
  sosStatus: (id: number, status: string) => req<Sos>(`/api/sos/${id}/`, { method: 'PATCH', headers: sosHeaders(id), body: JSON.stringify({ status }) }),
  updateSosNote: (id: number, note: string) => req<Sos>(`/api/sos/${id}/`, { method: 'PATCH', headers: sosHeaders(id), body: JSON.stringify({ note }) }),
  ambulances: () => req<Ambulance[]>('/api/ambulances/'),
  moveAmbulance: (id: number, lat: number, lng: number, status?: string) =>
    req<Ambulance>(`/api/ambulances/${id}/location/`, { method: 'POST', body: JSON.stringify({ lat, lng, status }) }),
  camps: () => req<Camp[]>('/api/camps/'),
  addCamp: (c: Omit<Camp, 'id'>) => req<Camp>('/api/camps/', { method: 'POST', body: JSON.stringify(c) }),
  updateCamp: (id: number, c: Partial<Omit<Camp, 'id'>>) => req<Camp>(`/api/camps/${id}/`, { method: 'PATCH', body: JSON.stringify(c) }),
  deleteCamp: (id: number) => req<void>(`/api/camps/${id}/`, { method: 'DELETE' }),
  dashboard: () => req<Dashboard>('/api/dashboard/'),
  sendEvents: (events: UsageEventPayload | UsageEventPayload[]) =>
    req<void>('/api/events/', { method: 'POST', body: JSON.stringify(events) }),
  usage: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return req<UsageData>(`/api/usage/${qs ? `?${qs}` : ''}`)
  },
  // --- auth ---
  me: () => req<Me>('/api/me/'),
  adminLogin: (phone: string, password: string) =>
    req<AuthResult>('/api/auth/admin-login/', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  logout: (refresh: string) => req<void>('/api/auth/logout/', { method: 'POST', body: JSON.stringify({ refresh }) }),
  register: (phone: string, password: string, role: string) =>
    req<AuthResult>('/api/auth/register/', { method: 'POST', body: JSON.stringify({ phone, password, role }) }),
  login: (phone: string, password: string) =>
    req<AuthResult>('/api/auth/login/', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  doctorDirectory: (q = '') => req<DirectoryDoctor[]>(`/api/doctors/directory/${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  callDoctor: (id: number) => req<{ tel: string; name: string }>(`/api/doctors/${id}/call/`, { method: 'POST' }),
  patchMe: (b: Partial<PatientProfile>) => req<Me>('/api/me/', { method: 'PATCH', body: JSON.stringify(b) }),
  deleteMe: () => req<void>('/api/me/', { method: 'DELETE' }),
  consent: () => req<Me>('/api/me/consent/', { method: 'POST', body: JSON.stringify({ agree: true }) }),
  facilitiesSignup: () => req<FacilityLite[]>('/api/facilities-signup/'),
  doctorRegister: (b: { full_name: string; council: string; registration_no: string; specialty: string; facility_id: number; shift_note?: string }) =>
    req<Me>('/api/doctors/register/', { method: 'POST', body: JSON.stringify(b) }),
  doctorDuty: (b: { on_duty?: boolean; sms_enabled?: boolean }) =>
    req<DoctorProfile>('/api/doctors/me/duty/', { method: 'PATCH', body: JSON.stringify(b) }),
  adminDoctors: (status?: string) => req<DoctorProfile[]>(`/api/admin/doctors/${status ? `?status=${status}` : ''}`),
  decideDoctor: (id: number, action: 'approve' | 'reject') => req<DoctorProfile>(`/api/admin/doctors/${id}/${action}/`, { method: 'POST' }),
  inbox: () => req<InboxRow[]>('/api/doctors/inbox/'),
  track: (token: string) => req<TrackData>(`/api/track/${token}/`),
  respond: (token: string, action: 'accept' | 'decline') =>
    req<{ my_status: string }>(`/api/respond/${token}/`, { method: 'POST', body: JSON.stringify({ action }) }),
  // --- private medical data ---
  conditions: () => req<Conditions>('/api/me/medical/'),
  saveConditions: (c: Conditions) => req<Conditions>('/api/me/medical/', { method: 'PUT', body: JSON.stringify(c) }),
  records: () => req<RecordMeta[]>('/api/me/records/'),
  deleteRecord: (id: number) => req<void>(`/api/me/records/${id}/`, { method: 'DELETE' }),
  grants: () => req<Grant[]>('/api/me/access/'),
  addGrant: (doctor_phone: string, duration: 'forever' | '30d') =>
    req<Grant[]>('/api/me/access/', { method: 'POST', body: JSON.stringify({ doctor_phone, duration }) }),
  revokeGrant: (id: number) => req<void>(`/api/me/access/${id}/`, { method: 'DELETE' }),
  accessLog: () => req<LogRow[]>('/api/me/access-log/'),
  doctorPatients: () => req<PatientRow[]>('/api/doctor/patients/'),
  patientMedical: (id: number) => req<PatientMedical>(`/api/doctor/patients/${id}/medical/`),
  patientRecords: (id: number) => req<RecordMeta[]>(`/api/doctor/patients/${id}/records/`),
}

/** Upload a record (multipart). Returns the new record, or throws ApiError. */
export async function uploadRecord(file: File, meta: { title: string; record_type: string }): Promise<RecordMeta> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('title', meta.title)
  fd.append('record_type', meta.record_type)
  const r = await authFetch('/api/me/records/', { method: 'POST', body: fd })
  if (!r.ok) throw new ApiError(r.status, ((await r.json().catch(() => ({}))) as { error?: string }).error ?? '', '')
  return r.json() as Promise<RecordMeta>
}

/** Download a private file through the authenticated endpoint and hand it to the browser. Nothing is cached. */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const r = await authFetch(url)
  if (!r.ok) throw new ApiError(r.status, '', '')
  const blob = await r.blob()
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = u
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(u), 1000)
}
