// Shared by the serverless functions: checks WHO is calling, server-side.
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel → Project → Settings → Environment Variables.
// The service-role key bypasses all security rules — it must never get a VITE_ prefix (that ships it to the browser).
import { createClient } from '@supabase/supabase-js'

let client
export function adminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

// The signed-in user behind this request (from the "Authorization: Bearer <token>" header), or null.
export async function requestUser(req) {
  const sb = adminClient()
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!sb || !token) return null
  const { data, error } = await sb.auth.getUser(token)
  return error ? null : data.user
}

// Admins are marked in app_metadata (only the server / SQL editor can write it, so users can't promote themselves).
export const isAdmin = (user) => user?.app_metadata?.role === 'admin'

export const NOT_CONFIGURED = 'Server auth not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)'
