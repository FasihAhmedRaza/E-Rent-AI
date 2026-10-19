import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, arrivedFromInvite } from './supabase'

const Ctx = createContext(null)

// No public sign-up: accounts are created by an admin on the Team page (invite email or admin-set password).
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [invited, setInvited] = useState(arrivedFromInvite)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = {
    session,
    loading,
    recovery,
    invited,
    user: session?.user || null,
    isAdmin: session?.user?.app_metadata?.role === 'admin',
    clearRecovery: () => { setRecovery(false); setInvited(false) },
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut({ scope: 'local' }), // local = instant (no server round-trip)
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: import.meta.env.VITE_RESET_REDIRECT_URL || window.location.origin }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
