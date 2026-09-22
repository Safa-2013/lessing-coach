const requests = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Nur POST erlaubt.' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter(time => now - time < 10 * 60 * 1000);
  if (recent.length >= 20) return res.status(429).json({ error: 'Bitte warte kurz und versuche es später erneut.' });
  recent.push(now);
  requests.set(ip, recent);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'Die Lern-KI ist noch nicht eingerichtet.' });

  const { question = '', mode = 'Frage beantworten', grade = 'unbekannt' } = req.body || {};
  if (!question.trim() || question.length > 5000) return res.status(400).json({ error: 'Ungültige Frage.' });

  const system = `Du bist Lessing Lern-KI, eine besonders geduldige, genaue und sichere Lernbegleitung für Schülerinnen und Schüler.
Erkenne das Schulfach automatisch. Antworte auf Deutsch und passe Sprache und Schwierigkeit an die Klasse ${grade} an.
Gewählter Lernmodus: ${mode}.
Erkläre verständlich mit Beispielen. Stelle bei unklaren Fragen höchstens eine kurze Rückfrage.
Bei Hausaufgaben hilfst du schrittweise, statt nur die Endlösung zu nennen.
Bei "Lernplan erstellen" lieferst du einen konkreten Plan mit Tagen, Dauer, Zielen, Übungen, Pausen und Wiederholung.
Bei "Quiz erstellen" gibst du Fragen zuerst ohne Lösungen; Lösungen erst, wenn danach gefragt wird.
Erfinde keine Fakten. Weise bei Unsicherheit darauf hin. Bitte niemals um private Daten.
Bei Gewalt, Missbrauch, Selbstverletzung oder akuter Gefahr rätst du sofort zu einer erwachsenen Vertrauensperson und im Notfall zu 112.`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: question.trim() }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens: 3000 }
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'Google Gemini konnte nicht antworten.' });
    const answer = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!answer) return res.status(502).json({ error: 'Keine Antwort erhalten.' });
    return res.status(200).json({ answer });
  } catch {
    return res.status(502).json({ error: 'Die Lern-KI ist gerade nicht erreichbar.' });
  }
}
