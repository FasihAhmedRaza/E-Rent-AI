import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { geminiAnswer } from './api/_gemini.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (incl. non-VITE_ ones like GEMINI_API_KEY) from webapp/.env for use here.
  const env = loadEnv(mode, process.cwd(), '')

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
              if (!key) return send(503, { error: 'AI not configured (add GEMINI_API_KEY to webapp/.env)' })
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
        },
      },
    ],
  }
})
