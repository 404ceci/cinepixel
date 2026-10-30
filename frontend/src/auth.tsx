import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, configureAuth } from './api/client'
import type { Session, User } from './types/movie'

const STORAGE_KEY = 'cinepixel:session'

interface Auth {
  user: User | null
  /** True while a stored session is being checked against the API on page load. */
  checking: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<Auth | null>(null)

function readStored(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function store(session: Session | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode): the session lasts until the tab closes */
  }
}

// Module-level copies so the API client can read the token synchronously,
// already on the very first request (before any React effect has run).
let currentToken: string | null = readStored()?.token ?? null
let handleUnauthorized: () => void = () => {}
configureAuth({ getToken: () => currentToken, onUnauthorized: () => handleUnauthorized() })

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = useState<Session | null>(readStored)
  const [checking, setChecking] = useState(() => session !== null)

  const apply = useCallback(
    (next: Session | null) => {
      currentToken = next?.token ?? null
      store(next)
      setSession(next)
      // Cached data includes the previous user's scores, so it must not leak across sessions.
      qc.clear()
    },
    [qc],
  )

  const signOut = useCallback(() => apply(null), [apply])

  useEffect(() => {
    handleUnauthorized = signOut
  }, [signOut])

  // On load, confirm the stored token is still valid (it may have expired).
  useEffect(() => {
    if (!session) return
    api
      .me()
      .then((user) => setSession((s) => (s ? { ...s, user } : s)))
      .catch(() => {
        /* a 401 already signed the user out through onUnauthorized */
      })
      .finally(() => setChecking(false))
  }, []) // runs once, on page load

  const value = useMemo<Auth>(
    () => ({
      user: session?.user ?? null,
      checking,
      signIn: async (email, password) => apply(await api.login(email, password)),
      signUp: async (email, password) => apply(await api.register(email, password)),
      signOut,
    }),
    [session, checking, apply, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
