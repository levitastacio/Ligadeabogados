import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { GOALS } from '../lib/utils'

const AuthContext = createContext(null)

function applyAccent(goal) {
  const color = GOALS[goal]?.color || '#0A84FF'
  const root = document.documentElement
  root.style.setProperty('--accent', color)
  root.style.setProperty('--accent-soft', `${color}24`)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', color)
}

function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme)
  else root.removeAttribute('data-theme')
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(undefined)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data || null)
    if (data) applyAccent(data.goal)
  }, [])

  useEffect(() => {
    // Solo se toca el tema si el usuario eligio uno; si no, se respeta
    // la preferencia del sistema (o la del visor que muestre la app).
    const storedTheme = localStorage.getItem('gs-theme')
    if (storedTheme) applyTheme(storedTheme)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      loadProfile(data.session?.user?.id)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null)
      loadProfile(s?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const refreshProfile = useCallback(() => loadProfile(session?.user?.id), [loadProfile, session])

  const setTheme = useCallback((theme) => {
    if (theme) localStorage.setItem('gs-theme', theme)
    else localStorage.removeItem('gs-theme')
    applyTheme(theme)
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    refreshProfile,
    setTheme,
    accent: GOALS[profile?.goal]?.color || '#0A84FF',
    loading: session === undefined || (session && profile === undefined),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
