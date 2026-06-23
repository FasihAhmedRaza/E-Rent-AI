# E‑Rent Confirmation

A tiny **standalone** page (no build step) that handles Supabase auth links for E‑Rent AI:
- **Password reset** → user lands here, sets a new password.
- **Email confirmation** → shows a "confirmed" message.

Deploy this folder anywhere static (Netlify drop, Vercel, GitHub Pages, Cloudflare Pages). It's just `index.html`.

---

## Setup (one time)

### 1. Deploy this folder
Upload `e-rent-confirmation/` to a static host. You'll get a URL like
`https://erent-confirm.netlify.app`.

### 2. Edit `index.html` → `APP_URL`
Set `APP_URL` (top of the `<script>`) to your **deployed E‑Rent AI app** URL so the
"Open E‑Rent AI →" buttons work. (`SUPABASE_URL` + anon key are already filled in.)

### 3. Point the app's reset link here
In `webapp/.env` set:
```
VITE_RESET_REDIRECT_URL=https://erent-confirm.netlify.app
```
then rebuild/redeploy the app. (Locally it falls back to localhost if unset.)

### 4. Allow the redirect in Supabase
Supabase Dashboard → **Authentication → URL Configuration → Redirect URLs** → add:
```
https://erent-confirm.netlify.app
https://erent-confirm.netlify.app/**
https://<your-deployed-app-url>/**
```
Also set **Site URL** to your app URL.

### 5. Brand the emails
Supabase Dashboard → **Authentication → Email Templates**:
- **Reset Password** → paste `email-templates/reset-password.html`
- **Confirm signup** → paste `email-templates/confirm-signup.html`

### 6. (Recommended) Proper sender name + address
The default Supabase emails come from a generic address with low sending limits.
For a real **company sender** (e.g. `no-reply@your-domain.ae`, name "E‑Rent AI") and
reliable delivery, configure custom SMTP:
Dashboard → **Project Settings → Authentication → SMTP Settings** → enable custom SMTP
(e.g. Resend, SendGrid, Amazon SES, or your domain mailbox) and set the sender name/email.

---

## How it works
The reset email's link goes through Supabase's verify endpoint, which redirects here with a
recovery token in the URL. `supabase-js` (loaded from CDN) detects it, the page shows the
"Set a new password" form, and calls `supabase.auth.updateUser({ password })`.
