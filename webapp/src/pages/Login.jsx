import { useState } from 'react'
import { useAuth } from '../lib/auth'
import PasswordField from '../components/PasswordField'

const Logo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#F1E5C2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5" /></svg>
)
const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8.4 12 2.4 2.4 4.8-5.2" /></svg>
)

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
        else setMsg('If that email has an account, a password reset link is on its way. Check your inbox.')
      } else {
        const fn = mode === 'signin' ? signIn : signUp
        const { data, error } = await fn(email.trim(), pw)
        if (error) setErr(error.message)
        else if (mode === 'signup' && !data.session) { setMsg('Account created. Check your email to confirm, then sign in.'); setMode('signin') }
      }
    } finally { setBusy(false) }
  }

  const title = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'
  const cta = busy ? '…' : (mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link')
  const sub = mode === 'forgot' ? 'Enter your email and we will send a reset link.'
    : mode === 'signup' ? 'Create your internal access account.'
    : 'Internal access for the Land Management Department.'

  return (
    <div className="auth-split">
      <aside className="auth-hero">
        <div className="auth-aurora" />
        <div className="ah-top">
          <div className="s-logo"><Logo /></div>
          <div><h1>E‑Rent AI</h1><p>Ajman Land Intelligence</p></div>
        </div>
        <div className="ah-mid">
          <h2>Know the real value of every plot and unit in Ajman.</h2>
          <p>Live rent and sale data from Bayut, Dubizzle and Property Finder, across all 47 Ajman districts, turned into one clear valuation.</p>
          <ul className="ah-feats">
            <li><Check /> Land and commercial units, for rent and for sale</li>
            <li><Check /> Market rates from three live sources</li>
            <li><Check /> Full coverage of every Ajman district</li>
          </ul>
        </div>
        <div className="ah-stats">
          <div><b>6,000+</b><span>live listings</span></div>
          <div><b>47</b><span>Ajman areas</span></div>
          <div><b>3</b><span>data sources</span></div>
        </div>
      </aside>

      <main className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="ap-brand"><div className="s-logo"><Logo /></div><div><h1>E‑Rent AI</h1><p>Ajman Land Intelligence</p></div></div>
          <h2 className="auth-h">{title}</h2>
          <p className="auth-sub">{sub}</p>

          <label className="auth-l">Email</label>
          <input className="inp" type="email" autoComplete="username" value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@ajman.gov.ae" required />

          {mode !== 'forgot' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 6px' }}>
                <label className="auth-l" style={{ margin: 0 }}>Password</label>
                {mode === 'signin' && <button type="button" className="auth-mini" onClick={() => go('forgot')}>Forgot password?</button>}
              </div>
              <PasswordField value={pw} onChange={(e) => setPw(e.target.value)}
                             autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
            </>
          )}

          {err && <div className="auth-err">{err}</div>}
          {msg && <div className="auth-msg">{msg}</div>}

          <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
            {cta}{!busy && mode === 'signin' && <span aria-hidden style={{ marginInlineStart: 4 }}>→</span>}
          </button>

          <div className="auth-switch">
            {mode === 'signin' && <>No account? <button type="button" onClick={() => go('signup')}>Create one</button></>}
            {mode === 'signup' && <>Have an account? <button type="button" onClick={() => go('signin')}>Sign in</button></>}
            {mode === 'forgot' && <>Remembered it? <button type="button" onClick={() => go('signin')}>Back to sign in</button></>}
          </div>

          <div className="auth-foot">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Protected internal environment. Data stays within the platform.
          </div>
        </form>
      </main>
    </div>
  )
}
