import { createClient } from '@supabase/supabase-js'

// Publishable (anon) key — safe to ship in the browser bundle (RLS-protected).
// Env vars win; the fallback keeps the deployed app working even if the host's
// build-time env vars aren't set.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://fnlkogqcqmoxlihqmfzb.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dr9Gs99Es23NMmmTmadV_w_vK-lJ5Eg'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
})
