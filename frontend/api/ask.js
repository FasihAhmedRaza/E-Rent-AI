// Vercel serverless function — keeps the Gemini key SERVER-SIDE (never exposed to the browser).
// The app POSTs { question, context, lang } here; we call Gemini and return { answer }.
// Set GEMINI_API_KEY (and optionally GEMINI_MODEL) in Vercel → Project → Settings → Environment Variables.
// Signed-in users only, so strangers can't spend the Gemini quota.
import { geminiAnswer } from './_gemini.js'
import { adminClient, requestUser, NOT_CONFIGURED } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  if (!adminClient()) { res.status(503).json({ error: NOT_CONFIGURED }); return }
  if (!(await requestUser(req))) { res.status(401).json({ error: 'Sign in required' }); return }

  const key = process.env.GEMINI_API_KEY
  if (!key) { res.status(503).json({ error: 'AI not configured (GEMINI_API_KEY missing)' }); return }

  try {
    const { question, context, lang, history } = req.body || {}
    if (!question) { res.status(400).json({ error: 'No question' }); return }
    const answer = await geminiAnswer({ question, context, lang, history, key, model: process.env.GEMINI_MODEL })
    res.status(200).json({ answer })
  } catch (e) {
    res.status(502).json({ error: String(e && e.message ? e.message : e) })
  }
}
