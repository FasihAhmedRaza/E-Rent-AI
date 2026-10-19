// Vercel serverless function behind the admin "Team" page. Only admins may call it.
//   GET                                        → list all accounts
//   POST { action: 'invite', email }           → email an invite link; the employee sets their own password
//   POST { action: 'create', email, password } → account with a password the admin shares themselves; no email
//   POST { action: 'remove', id }              → delete an account
import { adminClient, requestUser, isAdmin, NOT_CONFIGURED } from './_auth.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req, res) {
  const sb = adminClient()
  if (!sb) { res.status(503).json({ error: NOT_CONFIGURED }); return }
  const me = await requestUser(req)
  if (!me) { res.status(401).json({ error: 'Sign in required' }); return }
  if (!isAdmin(me)) { res.status(403).json({ error: 'Admins only' }); return }

  try {
    if (req.method === 'GET') {
      const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 })
      if (error) throw error
      const users = data.users.map((u) => ({
        id: u.id,
        email: u.email,
        admin: isAdmin(u),
        pending: !u.email_confirmed_at, // invited, but hasn't opened the invite link yet
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at,
      })).sort((a, b) => (b.admin - a.admin) || a.email.localeCompare(b.email))
      res.status(200).json({ users })
      return
    }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

    const { action, password, id } = req.body || {}
    const email = String(req.body?.email || '').trim().toLowerCase()
    if ((action === 'invite' || action === 'create') && !EMAIL.test(email)) {
      res.status(400).json({ error: 'Enter a valid email address.' }); return
    }

    if (action === 'invite') {
      // Inviting an address that was invited before (but never accepted) simply re-sends the email.
      const { error } = await sb.auth.admin.inviteUserByEmail(email, { redirectTo: process.env.APP_URL || req.headers.origin })
      if (error) throw error
    } else if (action === 'create') {
      if (!password || password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters.' }); return }
      const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) throw error
    } else if (action === 'remove') {
      if (!id) { res.status(400).json({ error: 'No account given' }); return }
      if (id === me.id) { res.status(400).json({ error: "You can't remove your own account." }); return }
      const { error } = await sb.auth.admin.deleteUser(id)
      if (error) throw error
    } else {
      res.status(400).json({ error: 'Unknown action' }); return
    }
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(e?.status >= 400 && e.status < 600 ? e.status : 500).json({ error: String(e && e.message ? e.message : e) })
  }
}
