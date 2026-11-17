import type { UsageEventPayload } from './api'

const SESSION_STORAGE_KEY = 'hh_session_id'
const OFFLINE_QUEUE_KEY = 'hh_offline_events'
const MAX_OFFLINE_EVENTS = 100

let memorySessionId: string | null = null

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getSessionId(): string {
  if (memorySessionId) return memorySessionId
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) {
      memorySessionId = existing
      return existing
    }
    const fresh = generateUuid()
    localStorage.setItem(SESSION_STORAGE_KEY, fresh)
    memorySessionId = fresh
    return fresh
  } catch {
    if (!memorySessionId) {
      memorySessionId = generateUuid()
    }
    return memorySessionId
  }
}

function getStoredOfflineEvents(): UsageEventPayload[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function setStoredOfflineEvents(events: UsageEventPayload[]): void {
  try {
    const trimmed = events.slice(-MAX_OFFLINE_EVENTS)
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(trimmed))
  } catch {
    // Ignore storage errors (quota exceeded / private mode)
  }
}

let inMemoryQueue: UsageEventPayload[] = []
let isFlushing = false
let flushTimer: ReturnType<typeof setTimeout> | null = null

export interface TrackExtra {
  kind?: 'human' | 'animal' | string
  detail?: string
  language?: string
  lat?: number | null
  lng?: number | null
}

export function track(event: string, extra?: TrackExtra): void {
  try {
    const sid = getSessionId()
    let lang = extra?.language
    if (!lang) {
      try {
        lang = localStorage.getItem('lang') || localStorage.getItem('hh_lang') || 'kn'
      } catch {
        lang = 'kn'
      }
    }

    let lat = extra?.lat
    let lng = extra?.lng
    if (typeof lat === 'number' && !Number.isNaN(lat)) {
      lat = Math.round(lat * 100) / 100
    } else {
      lat = null
    }
    if (typeof lng === 'number' && !Number.isNaN(lng)) {
      lng = Math.round(lng * 100) / 100
    } else {
      lng = null
    }

    const payload: UsageEventPayload = {
      session_id: sid,
      event,
      kind: extra?.kind || undefined,
      detail: extra?.detail ? extra.detail.slice(0, 60) : undefined,
      language: lang,
      lat,
      lng,
    }

    inMemoryQueue.push(payload)

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      // Offline: persist to localStorage
      const offline = getStoredOfflineEvents()
      offline.push(payload)
      setStoredOfflineEvents(offline)
      inMemoryQueue = []
      return
    }

    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null
        void flushQueue()
      }, 500)
    }
  } catch {
    // Logging must never crash or block UI
  }
}

async function flushQueue(isExiting = false): Promise<void> {
  if (isFlushing) return
  isFlushing = true

  try {
    // Gather offline stored items
    const offlineItems = getStoredOfflineEvents()
    const allItems = [...offlineItems, ...inMemoryQueue]
    inMemoryQueue = []

    if (allItems.length === 0) {
      isFlushing = false
      return
    }

    // Process in batches of up to 20
    while (allItems.length > 0) {
      const batch = allItems.splice(0, 20)

      if (isExiting && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' })
        const sent = navigator.sendBeacon('/api/events/', blob)
        if (sent) continue
      }

      try {
        const res = await fetch('/api/events/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
          keepalive: isExiting,
        })
        if (!res.ok && res.status >= 500) {
          // Server error, re-cache un-sent
          const remaining = [...batch, ...allItems]
          setStoredOfflineEvents(remaining)
          break
        }
      } catch {
        // Network error, re-cache un-sent
        const remaining = [...batch, ...allItems]
        setStoredOfflineEvents(remaining)
        break
      }
    }

    // Clear offline cache if all sent successfully
    if (allItems.length === 0) {
      setStoredOfflineEvents([])
    }
  } catch {
    // Silently ignore
  } finally {
    isFlushing = false
  }
}

// Flush when returning online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushQueue()
  })

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushQueue(true)
    }
  })
}
