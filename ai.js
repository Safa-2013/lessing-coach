// Vercel serverless endpoint. Rename this file to api/ai.js before deployment.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'KI ist noch nicht verbunden. GEMINI_API_KEY fehlt in den Vercel-Umgebungsvariablen.' });
  try {
    const { messages = [], profile = {}, subject = '' } = req.body || {};
    const system = `Du bist die Lern-KI von Lessing Schulen Coaching. Antworte auf Deutsch, freundlich, klar und altersgerecht. Hilf beim Lernen, löse Aufgaben nachvollziehbar, erstelle Lernpläne und erkläre Themen. Erfinde keine Fakten. Bei Unsicherheit sage es. Fach: ${subject || 'nicht angegeben'}. Schülerklasse: ${profile.klass || 'nicht angegeben'}.`;
    const contents = [
      { role: 'user', parts: [{ text: system }] },
      ...messages.slice(-20).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }))
    ];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { temperature: 0.35, maxOutputTokens: 1800 } })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'Gemini API Fehler');
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'Ich konnte gerade keine Antwort erzeugen.';
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unbekannter KI-Fehler' });
  }
}
