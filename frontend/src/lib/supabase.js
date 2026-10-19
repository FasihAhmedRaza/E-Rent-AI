import { createClient } from '@supabase/supabase-js'

// Publishable (anon) key — safe to ship in the browser bundle (RLS-protected).
// Env vars win; the fallback keeps the deployed app working even if the host's
// build-time env vars aren't set.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://fnlkogqcqmoxlihqmfzb.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dr9Gs99Es23NMmmTmadV_w_vK-lJ5Eg'

// Read the email-link result BEFORE createClient: supabase-js strips it from the URL once parsed.
// An accepted invite lands with "#...&type=invite"; an expired / already-used link with "error_description".
const linkParams = new URLSearchParams(window.location.hash.slice(1) + '&' + window.location.search.slice(1))
export const arrivedFromInvite = linkParams.get('type') === 'invite'
export const authLinkError = linkParams.get('error_description')

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})

// For calls to our own /api functions, so the server can check who is signed in.
export async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
}
