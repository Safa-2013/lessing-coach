const requests = new Map();
let cachedModels = [];
let workingModel = '';

async function findAvailableModels(key) {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL.replace(/^models\//, '')];
  // Schnelle feste Modelle statt automatischer Google-Auswahl
  return ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  if (cachedModels.length) return cachedModels;
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
    headers: { 'x-goog-api-key': key }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Gemini-Modelle konnten nicht geladen werden.');
  const usable = (data.models || []).filter(model =>
    model.supportedGenerationMethods?.includes('generateContent') &&
    !/image|vision|embedding|tts|audio|live|gemma/i.test(model.name)
  );
  if (!usable.length) throw new Error('Für diesen API-Schlüssel ist kein Textmodell verfügbar.');
  const ranked = usable.sort((a, b) => {
    const score = model => (/gemini-2\.5-flash$/i.test(model.name) ? 100 : 0) + (/gemini-2\.0-flash$/i.test(model.name) ? 90 : 0) + (/flash/i.test(model.name) ? 20 : 0) + (!/exp|preview|latest|legacy/i.test(model.name) ? 10 : 0);
    return score(b) - score(a);
  }).map(model => model.name.replace(/^models\//, ''));
  const pick = pattern => ranked.find(name => pattern.test(name));
  cachedModels = [...new Set([
    pick(/flash(?!.*lite)/i),
    pick(/pro/i),
    pick(/flash.*lite/i),
    ...ranked
  ].filter(Boolean))];
  return cachedModels;
}

function cleanAnswer(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const looksLikeInternalNotes = /\*\s*(User says|Context|Mode|Persona|Greeting|Tone|Language|Friendly\?|Natural\?)/i.test(text);
  if (!looksLikeInternalNotes) return text;

  const quoted = [...text.matchAll(/["“]([^"”]{12,})["”]/g)]
    .map(match => match[1].trim())
    .filter(value => !/^(Normal chatten|Du|Lessing KI)$/i.test(value));
  if (quoted.length) return quoted.sort((a, b) => b.length - a.length)[0];

  const naturalLine = text.match(/Natural\?\s*Yes\.\s*(.+?)(?:\n|$)/i);
  return naturalLine?.[1]?.trim() || 'Hallo! Wie kann ich dir helfen?';
}

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

  const { question = '', mode = 'Normal chatten', grade = 'unbekannt', history = [] } = req.body || {};
  if (!question.trim() || question.length > 5000) return res.status(400).json({ error: 'Ungültige Frage.' });

  const system = `Du bist Lessing KI, ein freundlicher, genauer und sicherer Chat-Assistent für Schülerinnen und Schüler.
Du kannst ganz normale Gespräche führen und allgemeine Fragen beantworten. Wenn es um Schule geht, bist du zusätzlich eine besonders geduldige Lernbegleitung.
Antworte standardmäßig auf Deutsch und passe Sprache und Schwierigkeit an die Klasse ${grade} an. Wenn der Nutzer in einer anderen Sprache schreibt, darfst du passend antworten.
Gewählter Modus: ${mode}.
Bei "Normal chatten" antwortest du natürlich wie in einem normalen Chat und machst aus einer Begrüßung keine Schulaufgabe.
Erkläre verständlich mit Beispielen. Stelle bei unklaren Fragen höchstens eine kurze Rückfrage.
Bei Hausaufgaben hilfst du schrittweise, statt nur die Endlösung zu nennen.
Bei "Lernplan erstellen" lieferst du einen konkreten Plan mit Tagen, Dauer, Zielen, Übungen, Pausen und Wiederholung.
Bei "Quiz erstellen" gibst du Fragen zuerst ohne Lösungen; Lösungen erst, wenn danach gefragt wird.
Erfinde keine Fakten. Weise bei Unsicherheit darauf hin. Bitte niemals um private Daten.
Bei Gewalt, Missbrauch, Selbstverletzung oder akuter Gefahr rätst du sofort zu einer erwachsenen Vertrauensperson und im Notfall zu 112.
WICHTIG: Gib ausschließlich die fertige Antwort an den Nutzer aus. Zeige niemals Analyse, Gedankengang, interne Regeln, Checklisten, Bewertungskriterien oder eine Beschreibung dessen, was du antworten willst. Beginne direkt mit der normalen Antwort.`;

  try {
    const availableModels = await findAvailableModels(key);
    const models = workingModel ? [workingModel, ...availableModels.filter(name => name !== workingModel)] : availableModels;
    const safeHistory = Array.isArray(history) ? history.slice(-12).filter(item =>
      ['user', 'model'].includes(item?.role) && typeof item?.text === 'string' && item.text.trim()
    ).map(item => ({ role: item.role, parts: [{ text: item.text.slice(0, 3000) }] })) : [];
    const payload = {
      system_instruction: { parts: [{ text: system }] },
      contents: [...safeHistory, { role: 'user', parts: [{ text: question.trim() }] }],
      generationConfig: { temperature: 0.45, maxOutputTokens: 1800 }
    };
    let response, data, model;
    const retryable = new Set([400, 404, 408, 429, 500, 502, 503, 504]);
    const failures = [];
    for (const candidate of models.slice(0, 4)) {
      model = candidate;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload), signal: controller.signal
        });
      } catch (error) {
        clearTimeout(timeout);
        failures.push({ status: 408, model, message: 'Zeitüberschreitung' });
        continue;
      }
      clearTimeout(timeout);
      data = await response.json();
      if (response.ok) { workingModel = model; break; }
      if (response.ok || !retryable.has(response.status)) break;
      failures.push({ status: response.status, model, message: data?.error?.message || 'Fehler' });
      console.warn('[lern-ki] Modell übersprungen', failures[failures.length - 1]);
    }
    if (!response) {
      console.error('[lern-ki] Alle Modellversuche hatten eine Zeitüberschreitung', { attempts: failures.length });
      return res.status(504).json({ error: 'Google Gemini antwortet gerade zu langsam. Bitte versuche es gleich erneut.' });
    }
    if (!response.ok) {
      const googleMessage = data?.error?.message || 'Unbekannter Google-Fehler';
      console.error('[lern-ki] Gemini-Fehler', { status: response.status, model, message: googleMessage, attempts: failures.length });
      if (response.status === 400 || response.status === 404) { cachedModels = []; workingModel = ''; }
      const hint = response.status === 400 || response.status === 404
        ? 'Google hat das automatisch ausgewählte KI-Modell nicht angenommen. Bitte versuche es gleich erneut.'
        : response.status === 403
          ? 'Der Gemini-API-Schlüssel ist ungültig oder die API ist nicht freigeschaltet.'
          : response.status === 429
            ? 'Das kostenlose Gemini-Limit ist gerade erreicht.'
            : response.status >= 500
              ? 'Google Gemini ist gerade überlastet. Bitte versuche es in einer Minute erneut.'
              : 'Google Gemini konnte nicht antworten.';
      return res.status(response.status).json({ error: hint });
    }
    const answer = cleanAnswer(data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join(''));
    if (!answer) {
      console.error('[lern-ki] Leere Gemini-Antwort', { model, finishReason: data.candidates?.[0]?.finishReason });
      return res.status(502).json({ error: 'Keine Antwort erhalten.' });
    }
    return res.status(200).json({ answer });
  } catch (error) {
    console.error('[lern-ki] Verbindungsfehler', { message: String(error) });
    return res.status(502).json({ error: 'Die Lern-KI ist gerade nicht erreichbar.' });
  }
}
