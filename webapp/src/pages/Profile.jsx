import { useState } from 'react'
import { useAuth } from '../lib/auth'
import PasswordField from '../components/PasswordField'

function fmtDate(s) {
  if (!s) return '—'
  try { return new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return s }
}

export default function Profile() {
  const { user, updatePassword, signOut } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const change = async (e) => {
    e.preventDefault(); setErr(''); setMsg('')
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return }
    if (pw !== pw2) { setErr('Passwords do not match.'); return }
    setBusy(true)
    const { error } = await updatePassword(pw)
    setBusy(false)
    if (error) { setErr(error.message); return }
    setPw(''); setPw2(''); setMsg('Password updated successfully.')
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="h-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 0 18px' }}>
        <div><div className="eyebrow" style={{ color: 'var(--gold2)' }}>Account</div>
          <h2 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: '1.5rem' }}>Profile</h2></div>
      </div>

      <div className="card" style={{ padding: 22, marginBottom: 18 }}>
        <div className="sec-h">Signed in as</div>
        <p className="sec-s">You are currently logged in to E‑Rent AI with this account.</p>
        <div className="mrow"><span className="l">Email</span><span className="v">{user?.email || '—'}</span></div>
        <div className="mrow"><span className="l">User ID</span><span className="v" style={{ fontFamily: 'monospace', fontSize: '.78rem' }}>{user?.id || '—'}</span></div>
        <div className="mrow"><span className="l">Last sign‑in</span><span className="v">{fmtDate(user?.last_sign_in_at)}</span></div>
        <div className="mrow"><span className="l">Account created</span><span className="v">{fmtDate(user?.created_at)}</span></div>
        <button className="btn ghost" onClick={signOut} style={{ marginTop: 16 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
          Sign out
        </button>
      </div>

      <form className="card" style={{ padding: 22 }} onSubmit={change}>
        <div className="sec-h">Change password</div>
        <p className="sec-s">Set a new password for your account.</p>
        <label className="auth-l">New password</label>
        <PasswordField value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="New password" />
        <label className="auth-l">Confirm new password</label>
        <PasswordField value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" placeholder="Repeat new password" />
        {err && <div className="auth-err">{err}</div>}
        {msg && <div className="auth-msg">{msg}</div>}
        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 14, justifyContent: 'center' }}>
          {busy ? '…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
