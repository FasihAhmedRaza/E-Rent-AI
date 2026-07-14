// Shared Gemini call used by BOTH the deployed Vercel function (api/ask.js)
// and the local Vite dev bridge (vite.config.js). The leading underscore tells
// Vercel this is a helper module, not an API route.
//
// Supports multi-turn memory (history) + a system persona, and DISABLES gemini-2.5
// "thinking" (thinkingBudget:0) so the whole token budget goes to the actual answer
// (otherwise 2.5-flash spends most of maxOutputTokens thinking → tiny replies).
export async function geminiAnswer({ question, context, lang, history, key, model }) {
  const replyLang = lang === 'ar' ? 'Arabic' : 'English'
  const system = [
    'You are Intelligent Valuation AI, the assistant for an Ajman (UAE) real estate intelligence platform used by the Land Management Department.',
    'Answer in a warm, professional, conversational tone — like a knowledgeable market analyst. Aim for roughly 110–180 words (2–3 short paragraphs): enough to genuinely explain and add insight. Never reply with a single terse line.',
    'Ground EVERY number and claim ONLY in the DATA below. Refer to specific area names and AED figures. If something is not in the DATA, say so briefly instead of inventing it.',
    'Use the conversation so far for context — the user may refer to earlier questions, areas, or "it".',
    `Reply in ${replyLang}.`,
    '',
    'DATA (per area — name | avg annual rent AED | AED/sqft | count | 6-month trend):',
    context || '(no data provided)',
  ].join('\n')

  const contents = []
  for (const h of (Array.isArray(history) ? history : [])) {
    const text = (h && h.text ? String(h.text) : '').trim()
    if (text) contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text }] })
  }
  contents.push({ role: 'user', parts: [{ text: question }] })

  const mdl = model || 'gemini-2.0-flash' // higher free-tier limit than 2.5-flash
  const gen = { temperature: 0.5, maxOutputTokens: 1024 }
  if (/gemini-(2\.5|3)/.test(mdl)) gen.thinkingConfig = { thinkingBudget: 0 } // only 2.5/3 support thinking
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: gen,
    }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error?.message || 'Gemini request failed')
  const answer = ((j?.candidates?.[0]?.content?.parts) || []).map((p) => p.text || '').join('').trim()
  if (!answer) throw new Error('Empty AI response')
  return answer
}
