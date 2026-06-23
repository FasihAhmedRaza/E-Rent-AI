import { useState } from 'react'
import { useAuth } from '../lib/auth'
import PasswordField from '../components/PasswordField'

export default function Login() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const go = (m) => { setMode(m); setErr(''); setMsg(''); setPw('') }

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true)
    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email.trim())
        if (error) setErr(error.message)
        else setMsg('If that email has an account, a password-reset link is on its way. Check your inbox.')
      } else {
        const fn = mode === 'signin' ? signIn : signUp
        const { data, error } = await fn(email.trim(), pw)
        if (error) setErr(error.message)
        else if (mode === 'signup' && !data.session) { setMsg('Account created. Check your email to confirm, then sign in.'); setMode('signin') }
        // success with session -> AuthProvider swaps to the app automatically
      }
    } finally { setBusy(false) }
  }

  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'
  const cta = busy ? '…' : (mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link')

  return (
    <div className="auth-wrap">
      <div className="auth-aurora" />
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <div className="s-logo"><svg viewBox="0 0 24 24" fill="none" stroke="#F1E5C2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5" /></svg></div>
          <div><h1>E‑Rent AI</h1><p>Ajman Land Intelligence</p></div>
        </div>
        <h2 className="auth-h">{title}</h2>
        <p className="auth-sub">{mode === 'forgot' ? 'Enter your email and we\'ll send a reset link.' : 'Internal access · Land Management Dept.'}</p>

        <label className="auth-l">Email</label>
        <input className="inp" type="email" autoComplete="username" value={email}
               onChange={(e) => setEmail(e.target.value)} placeholder="you@ajman.gov.ae" required />

        {mode !== 'forgot' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 6px' }}>
              <label className="auth-l" style={{ margin: 0 }}>Password</label>
              {mode === 'signin' && <button type="button" className="auth-mini" onClick={() => go('forgot')}>Forgot password?</button>}
            </div>
            <PasswordField value={pw} onChange={(e) => setPw(e.target.value)}
                           autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </>
        )}

        {err && <div className="auth-err">{err}</div>}
        {msg && <div className="auth-msg">{msg}</div>}

        <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>{cta}</button>

        <div className="auth-switch">
          {mode === 'signin' && <>No account? <button type="button" onClick={() => go('signup')}>Create one</button></>}
          {mode === 'signup' && <>Have an account? <button type="button" onClick={() => go('signin')}>Sign in</button></>}
          {mode === 'forgot' && <>Remembered it? <button type="button" onClick={() => go('signin')}>Back to sign in</button></>}
        </div>
      </form>
    </div>
  )
}
