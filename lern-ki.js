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
    return res.status(503).json({
      error: "GEMINI_API_KEY fehlt in Vercel."
    });
  }

  const { question = "", history = [] } = req.body || {};

  if (!question.trim()) {
    return res.status(400).json({ error: "Keine Frage." });
  }

  const payload = {
    system_instruction: {
      parts: [{
        text: "Du bist Lessing KI, ein freundlicher Lernassistent für Schüler. Antworte kurz, verständlich und hilfreich auf Deutsch."
      }]
    },
    contents: [
      ...Array.isArray(history) ? history.slice(-10) : [],
      {
        role: "user",
        parts: [{ text: question.trim() }]
      }
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1200
    }
  };

  const models = [
    "gemini-3.6-flash",
    "gemini-2.5-flash-lite"
  ];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (response.ok) {
        const answer =
          data.candidates?.[0]?.content?.parts
            ?.map(p => p.text || "")
            .join("");

        return res.status(200).json({
          answer: cleanAnswer(answer)
        });
      }

      console.error("Gemini Fehler", model, data);
    } catch (e) {
      console.error("Verbindung Fehler", e);
    }
  }

  return res.status(503).json({
    error: "KI ist gerade ausgelastet. Bitte erneut versuchen."
  });
}
