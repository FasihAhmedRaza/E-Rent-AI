// Shared Gemini call used by BOTH the deployed Vercel function (api/ask.js)
// and the local Vite dev bridge (vite.config.js). The leading underscore tells
// Vercel this is a helper module, not an API route.
export async function geminiAnswer({ question, context, lang, key, model }) {
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

  const mdl = model || 'gemini-2.5-flash'
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 320 },
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error?.message || 'Gemini request failed')
  const answer = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!answer) throw new Error('Empty AI response')
  return answer
}
