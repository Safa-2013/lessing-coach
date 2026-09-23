const requests = new Map();

function cleanAnswer(text) {
  return String(text || "").trim() || "Hallo! Wie kann ich dir helfen?";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Nur POST erlaubt." });
  }

  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return res.status(503).json({ error: "GEMINI_API_KEY fehlt in Vercel." });
  }

  const { question = "", mode = "Normal chatten", grade = "unbekannt" } = req.body || {};

  if (!question.trim()) {
    return res.status(400).json({ error: "Keine Frage." });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text: `Du bist Lessing KI. Antworte kurz, freundlich und verständlich.
Klasse: ${grade}
Modus: ${mode}

Frage:
${question}`
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 400
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini Fehler"
      });
    }

    const answer = data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      ?.join("");

    return res.status(200).json({
      answer: cleanAnswer(answer)
    });

  } catch (e) {
    return res.status(500).json({
      error: "KI Fehler"
    });
  }
}
