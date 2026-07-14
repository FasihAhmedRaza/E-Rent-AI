import { useState } from 'react'
import { useAuth } from '../lib/auth'
import PasswordField from '../components/PasswordField'
import Mark from '../components/Mark'

export default function ResetPassword() {
  const { updatePassword, clearRecovery } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (pw !== pw2) { setErr('Passwords do not match.'); return }
    setBusy(true)
    const { error } = await updatePassword(pw)
    setBusy(false)
    if (error) { setErr(error.message); return }
    clearRecovery() // session is active -> app loads
  }

  return (
    <div className="auth-wrap">
      <div className="auth-aurora" />
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <div className="s-logo"><Mark /></div>
          <div><h1>Intelligent Valuation AI</h1><p>Ajman Land Intelligence</p></div>
        </div>
        <h2 className="auth-h">Set a new password</h2>
        <p className="auth-sub">Choose a new password for your account.</p>
        <label className="auth-l">New password</label>
        <PasswordField value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="New password" />
        <label className="auth-l">Confirm password</label>
        <PasswordField value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" placeholder="Repeat new password" />
        {err && <div className="auth-err">{err}</div>}
        <button className="btn" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
          {busy ? '…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
