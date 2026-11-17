import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type Me } from './api'
import { tokens } from './auth'

interface AuthCtx {
  user: Me | null
  loading: boolean
  setSession: (access: string, refresh: string, user: Me) => void
  refreshMe: () => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  setSession: () => {},
  refreshMe: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    if (!tokens.access() && !tokens.refresh()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      setUser(await api.me())
    } catch {
      setUser(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  const setSession = useCallback((access: string, refresh: string, u: Me) => {
    tokens.set(access, refresh)
    setUser(u)
    setLoading(false)
  }, [])

  const logout = useCallback(async () => {
    const r = tokens.refresh()
    try {
      if (r) await api.logout(r)
    } catch {
      // ignore: we clear the device either way
    }
    tokens.clear()
    setUser(null)
    // Do not keep any authenticated or medical response in the offline cache after logout
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo(() => ({ user, loading, setSession, refreshMe, logout }), [user, loading, setSession, refreshMe, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
