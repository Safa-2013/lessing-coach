const requests = new Map();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Nur POST erlaubt." });
  }

  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return res.status(503).json({ error: "GEMINI_API_KEY fehlt in Vercel." });
  }

  const body = req.body || {};
  const question = String(body.question || "").trim();

  if (!question) {
    return res.status(400).json({ error: "Keine Nachricht." });
  }

  const system = `
Du bist Lessing KI.
Du bist ein schneller freundlicher Lernassistent für Schüler.
Antworte kurz, verständlich und natürlich.
Bei Lernen erkläre Schritt für Schritt.
Bei normalen Gesprächen antworte wie ein normaler Chat.
Keine internen Gedanken ausgeben.
`;

  const models = [
    "gemini-3.6-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash-lite"
  ];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: system }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: question }]
              }
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 800
            }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timer);

      const data = await response.json();

      if (response.ok) {
        const answer =
          data?.candidates?.[0]?.content?.parts
            ?.map(p => p.text || "")
            .join("")
            .trim();

        return res.status(200).json({
          answer: answer || "Keine Antwort erhalten."
        });
      }

    } catch (e) {}
  }

  return res.status(503).json({
    error: "KI ist gerade ausgelastet. Bitte erneut versuchen."
  });
}
