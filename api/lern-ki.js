const requests = new Map();

function cleanAnswer(raw) {
  const text = String(raw || "").trim();
  return text || "Hallo! Wie kann ich dir helfen?";
}

async function getModels() {
  return [
    "gemini-2.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-2.0-flash-lite"
  ];
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Nur POST erlaubt."
    });
  }

  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return res.status(503).json({
      error: "GEMINI_API_KEY fehlt in Vercel."
    });
  }


  const {
    question = "",
    mode = "Normal chatten",
    grade = "unbekannt",
    history = []
  } = req.body || {};


  if (!question.trim()) {
    return res.status(400).json({
      error: "Keine Frage eingegeben."
    });
  }


  const system = `
Du bist Lessing KI.

Du bist ein freundlicher KI-Assistent für Schülerinnen und Schüler.

Du kannst:
- normal chatten
- Fragen beantworten
- beim Lernen helfen
- Lernpläne erstellen
- Quiz erstellen
- Hausaufgaben erklären

Antworte auf Deutsch.
Passe dich der Klasse ${grade} an.

Modus:
${mode}

Wichtig:
Gib nur die fertige Antwort aus.
Keine internen Gedanken oder Analysen.
`;


  const payload = {
    system_instruction: {
      parts: [
        {
          text: system
        }
      ]
    },

    contents: [
      ...(Array.isArray(history)
        ? history.slice(-10).map(m => ({
            role: m.role,
            parts: [
              {
                text: String(m.text || "")
              }
            ]
          }))
        : []),

      {
        role: "user",
        parts: [
          {
            text: question
          }
        ]
      }
    ],

    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1500
    }
  };


  const models = await getModels();

  let lastError = null;


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
          data?.candidates?.[0]?.content?.parts
          ?.map(p => p.text)
          .join("");


        return res.status(200).json({
          answer: cleanAnswer(answer)
        });

      }


      lastError = data?.error?.message || "Gemini Fehler";


      console.log(
        "Modell fehlgeschlagen:",
        model,
        lastError
      );


    } catch(error){

      lastError = error.message;

    }

  }


  return res.status(503).json({
    error:
    "Google Gemini ist momentan nicht verfügbar. Bitte später erneut versuchen.",
    details:lastError
  });

}
