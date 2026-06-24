// Vercel serverless function — keeps the Gemini key SERVER-SIDE (never exposed to the browser).
// The app POSTs { question, context, lang } here; we call Gemini and return { answer }.
// Set GEMINI_API_KEY (and optionally GEMINI_MODEL) in Vercel → Project → Settings → Environment Variables.

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const key = process.env.GEMINI_API_KEY
  if (!key) { res.status(503).json({ error: 'AI not configured (GEMINI_API_KEY missing)' }); return }

  try {
    const { question, context, lang } = req.body || {}
    if (!question) { res.status(400).json({ error: 'No question' }); return }

    const replyLang = lang === 'ar' ? 'Arabic' : 'English'
    const prompt = [
      'You are the E-Rent AI assistant for the AJMAN (UAE) land market.',
      "Answer the user's question concisely and helpfully using ONLY the DATA below. Use AED and refer to specific area names and the real numbers given.",
      'Annual land rent = land sale value × yield (5–8%, default 6.5%). Prices come from Bayut, Dubizzle and Property Finder.',
      `If the data does not cover the question, say so briefly. Keep answers under 90 words. Reply in ${replyLang}.`,
      '',
      'DATA (per area — name | avg annual rent AED | AED/sqft | plots | 6-month trend):',
      context || '(no data provided)',
      '',
      `QUESTION: ${question}`,
    ].join('\n')

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 320 },
      }),
    })
    const j = await r.json()
    if (!r.ok) { res.status(502).json({ error: j?.error?.message || 'Gemini request failed' }); return }
    const answer = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!answer) { res.status(502).json({ error: 'Empty AI response' }); return }
    res.status(200).json({ answer })
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) })
  }
}
