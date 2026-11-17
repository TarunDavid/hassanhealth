// Token storage and an fetch wrapper that attaches the access token and refreshes it once on 401.
// Tokens live in localStorage (wrapped in try/catch). They are cleared on logout.
const A = 'hh_access'
const R = 'hh_refresh'

function read(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function write(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    // storage unavailable (private mode)
  }
}

export const tokens = {
  access: () => read(A),
  refresh: () => read(R),
  set(access: string, refresh: string) {
    write(A, access)
    write(R, refresh)
  },
  clear() {
    write(A, null)
    write(R, null)
  },
}

let refreshing: Promise<boolean> | null = null

async function refreshTokens(): Promise<boolean> {
  const r = tokens.refresh()
  if (!r) return false
  try {
    const res = await fetch('/api/auth/refresh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: r }),
    })
    if (!res.ok) {
      tokens.clear()
      return false
    }
    const d = (await res.json()) as { access: string; refresh?: string }
    tokens.set(d.access, d.refresh ?? r)
    return true
  } catch {
    return false
  }
}

export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const go = () => {
    const h = new Headers(init.headers)
    const a = tokens.access()
    if (a) h.set('Authorization', `Bearer ${a}`)
    return fetch(url, { ...init, headers: h })
  }
  let res = await go()
  if (res.status === 401 && tokens.refresh()) {
    refreshing ??= refreshTokens().finally(() => {
      refreshing = null
    })
    if (await refreshing) res = await go()
  }
  return res
}
