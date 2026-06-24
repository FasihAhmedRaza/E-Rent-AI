// Calls our serverless function (/api/ask) which holds the Gemini key server-side.
// Throws if the AI isn't available (no key / offline) so the caller can fall back.
export async function askGemini({ question, context, lang }) {
  const r = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context, lang }),
  })
  if (!r.ok) throw new Error('ai-unavailable')
  const j = await r.json()
  if (!j.answer) throw new Error('ai-empty')
  return j.answer
}
