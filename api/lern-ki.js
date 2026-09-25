export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { question, mode = 'Normal chatten', grade = 'nicht angegeben', history = [], attachment = null } = req.body || {};
    if (!question || typeof question !== 'string') return res.status(400).json({ error: 'Frage fehlt.' });
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY ist in Vercel noch nicht hinterlegt.' });
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const system = `Du bist Lessing KI, eine sehr gute deutschsprachige Lern- und Alltags-KI für Schülerinnen und Schüler.\n\nRegeln:\n- Antworte auf Deutsch, außer der Nutzer bittet um eine andere Sprache.\n- Du kannst normal chatten und bist nicht auf Schulthemen beschränkt.\n- Beim Lernen: erkläre verständlich, altersgerecht und Schritt für Schritt. Gib nicht einfach nur die Lösung, wenn gemeinsames Lernen sinnvoller ist.\n- Bei Mathematik zeige Rechenwege. Bei Sprachen gib Beispiele und korrigiere freundlich.\n- Bei 'Lernplan erstellen' erstelle einen realistischen Plan mit Zeiten, Pausen, Wiederholung und kleinen Selbsttests.\n- Bei 'Quiz erstellen' stelle zuerst Fragen und verrate die Lösungen nicht sofort.\n- Berücksichtige Klasse/Niveau: ${grade}.\n- Aktueller Modus: ${mode}.\n- Wenn eine Aufgabe als Bild/PDF angehängt wurde, analysiere den Anhang und beziehe dich konkret darauf.\n- Erfinde keine Inhalte aus einem Anhang, die nicht erkennbar sind.\n- Bei gefährlichen, medizinischen oder rechtlichen Fragen keine falsche Sicherheit vermitteln; bei akuter Gefahr auf geeignete Hilfe verweisen.\n- Keine langen Einleitungen; direkt hilfreich antworten.`;

    const contents = [];
    for (const m of Array.isArray(history) ? history.slice(-12) : []) {
      if (!m || !m.text) continue;
      contents.push({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: String(m.text).slice(0, 12000) }] });
    }
    const parts = [{ text: question.slice(0, 20000) }];
    if (attachment?.data && attachment?.mimeType) {
      parts.push({ inline_data: { mime_type: attachment.mimeType, data: attachment.data } });
    }
    contents.push({ role: 'user', parts });

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.55, maxOutputTokens: 3000 }
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'Gemini API Fehler.' });
    const answer = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    if (!answer) return res.status(502).json({ error: 'Die KI hat keine Antwort geliefert.' });
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Serverfehler.' });
  }
}
