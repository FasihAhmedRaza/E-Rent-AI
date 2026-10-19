import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { authHeaders } from '../lib/supabase'
import PasswordField from '../components/PasswordField'

// Admin-only: add employees (invite email, or a password the admin shares themselves) and remove them.
// Talks to /api/admin-users, which re-checks that the caller is an admin server-side.

function fmtDate(s) {
  if (!s) return '—'
  try { return new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return s }
}

async function api(method, body) {
  const r = await fetch('/api/admin-users', {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`)
  return j
}

// e.g. "k7Qm-xR2p-9wNa" — no look-alike characters (0/O, 1/l/I), so it's easy to read out or send on WhatsApp.
function genPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const s = Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => abc[n % abc.length]).join('')
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}

const small = { padding: '6px 12px', fontSize: '.78rem' }

export default function Team() {
  const { user, isAdmin } = useAuth()
  const [users, setUsers] = useState(null)
  const [listErr, setListErr] = useState('')
  const [mode, setMode] = useState('invite') // invite | password
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [created, setCreated] = useState(null) // { email, password } for the admin to hand over
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api('GET')
    .then((j) => { setUsers(j.users); setListErr('') })
    .catch((e) => setListErr(e.message)), [])
  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  if (!isAdmin) return <Navigate to="/" replace />

  const pick = (m) => { setMode(m); setErr(''); setMsg(''); setCreated(null); setPw(m === 'password' ? genPassword() : '') }

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setMsg(''); setCreated(null); setCopied(false)
    const addr = email.trim()
    setBusy(true)
    try {
      if (mode === 'invite') {
        await api('POST', { action: 'invite', email: addr })
        setMsg(`Invite sent to ${addr}. They'll get an email with a link to set their own password.`)
      } else {
        await api('POST', { action: 'create', email: addr, password: pw })
        setCreated({ email: addr, password: pw })
        setPw(genPassword())
      }
      setEmail('')
      load()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  const resend = async (u) => {
    setErr(''); setMsg(''); setCreated(null)
    try { await api('POST', { action: 'invite', email: u.email }); setMsg(`Invite re-sent to ${u.email}.`) } catch (e) { setErr(e.message) }
  }

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.email}? They won't be able to sign in any more.`)) return
    setErr(''); setMsg(''); setCreated(null)
    try { await api('POST', { action: 'remove', id: u.id }); setMsg(`${u.email} was removed.`); load() } catch (e) { setErr(e.message) }
  }

  const loginText = created && `Your Intelligent Valuation AI login\nWebsite: ${window.location.origin}\nEmail: ${created.email}\nPassword: ${created.password}\nYou can change your password from your Profile after signing in.`
  const copy = () => navigator.clipboard.writeText(loginText).then(() => setCopied(true), () => {})

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="h-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 0 18px' }}>
        <div><div className="eyebrow" style={{ color: 'var(--gold2)' }}>Admin</div>
          <h2 style={{ fontFamily: 'Tajawal', fontWeight: 800, fontSize: '1.5rem' }}>Team</h2></div>
      </div>

      <form className="card" style={{ padding: 22, marginBottom: 18 }} onSubmit={submit}>
        <div className="sec-h">Add an employee</div>
        <p className="sec-s">Only people you add here can sign in.</p>
        <div className="pills" style={{ margin: '12px 0 4px' }}>
          <button type="button" className={'pill-f' + (mode === 'invite' ? ' active' : '')} onClick={() => pick('invite')}>Send invite email</button>
          <button type="button" className={'pill-f' + (mode === 'password' ? ' active' : '')} onClick={() => pick('password')}>Set password myself</button>
        </div>
        <p className="sec-s" style={{ marginTop: 8 }}>{mode === 'invite'
          ? 'They get an email with a link and choose their own password.'
          : 'No email is sent. You share the login details with them yourself (WhatsApp or anything you like).'}</p>

        <label className="auth-l">Employee email</label>
        <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@ajman.gov.ae" required />

        {mode === 'password' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 6px' }}>
              <label className="auth-l" style={{ margin: 0 }}>Password</label>
              <button type="button" className="auth-mini" onClick={() => setPw(genPassword())}>Generate new</button>
            </div>
            <PasswordField value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" />
          </>
        )}

        {err && <div className="auth-err">{err}</div>}
        {msg && <div className="auth-msg">{msg}</div>}
        {created && (
          <div className="auth-msg">
            Account created. Send these login details to the employee:
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '.8rem', margin: '8px 0', userSelect: 'all' }}>{loginText}</pre>
            <button type="button" className="btn ghost" style={small} onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
        )}

        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 14, justifyContent: 'center' }}>
          {busy ? '…' : mode === 'invite' ? 'Send invite' : 'Create account'}
        </button>
      </form>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 6px' }}>
          <div className="sec-h">People with access</div>
          <p className="sec-s">“Invite pending” means they haven't opened their invite email yet.</p>
        </div>
        {listErr ? <div className="auth-err" style={{ margin: '0 22px 22px' }}>{listErr}</div>
          : !users ? <div className="empty">Loading…</div>
          : (
            <div className="tbl-wrap">
              <table className="team-tbl">
                <thead><tr><th>Email</th><th>Status</th><th>Last sign‑in</th><th /></tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="pname">{u.email}{u.id === user?.id && <span className="ps">You</span>}</td>
                      <td>{u.admin ? <span className="ubadge admin">Admin</span>
                        : u.pending ? <span className="ubadge wait">Invite pending</span>
                        : <span className="ubadge ok">Active</span>}</td>
                      <td>{fmtDate(u.lastSignIn)}</td>
                      <td style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                        {u.pending && <button className="btn ghost" style={small} onClick={() => resend(u)}>Resend invite</button>}
                        {u.id !== user?.id && <button className="btn ghost" style={{ ...small, marginInlineStart: 8, color: '#A92A24' }} onClick={() => remove(u)}>Remove</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}
