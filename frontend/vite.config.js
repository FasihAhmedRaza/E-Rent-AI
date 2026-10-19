import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { geminiAnswer } from './api/_gemini.js'
import adminUsers from './api/admin-users.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (incl. non-VITE_ ones like GEMINI_API_KEY) from frontend/.env for use here.
  const env = loadEnv(mode, process.cwd(), '')
  // The serverless handlers read process.env; under `npm run dev` they get their keys from frontend/.env.
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_URL']) if (env[k] && !process.env[k]) process.env[k] = env[k]

  return {
    plugins: [
      react(),
      {
        // Local bridge so /api/ask works under `npm run dev` too.
        // (Vite's dev server does NOT run Vercel serverless functions; this mimics it.)
        name: 'dev-api-ask',
        configureServer(server) {
          server.middlewares.use('/api/ask', (req, res, next) => {
            if (req.method !== 'POST') return next()
            let body = ''
            req.on('data', (c) => (body += c))
            req.on('end', async () => {
              const send = (code, obj) => {
                res.statusCode = code
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(obj))
              }
              const key = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY
              if (!key) return send(503, { error: 'AI not configured (add GEMINI_API_KEY to frontend/.env)' })
              try {
                const { question, context, lang } = JSON.parse(body || '{}')
                if (!question) return send(400, { error: 'No question' })
                const answer = await geminiAnswer({ question, context, lang, key, model: env.GEMINI_MODEL })
                send(200, { answer })
              } catch (e) {
                send(502, { error: String(e && e.message ? e.message : e) })
              }
            })
          })
          // Same for the admin Team page: runs the real api/admin-users.js handler
          // (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in frontend/.env).
          server.middlewares.use('/api/admin-users', async (req, res) => {
            let body = ''
            for await (const c of req) body += c
            try { req.body = body ? JSON.parse(body) : {} } catch { req.body = {} }
            res.status = (code) => { res.statusCode = code; return res }
            res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) }
            try { await adminUsers(req, res) } catch (e) { res.status(502).json({ error: String(e && e.message ? e.message : e) }) }
          })
        },
      },
    ],
  }
})
