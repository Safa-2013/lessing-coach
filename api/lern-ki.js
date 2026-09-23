const requests = new Map();

function cleanAnswer(text) {
  const answer = String(text || "").trim();
  return answer || "Hallo! Wie kann ich dir helfen?";
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
    grade = "unbekannt"
  } = req.body || {};


  if (!question.trim()) {
    return res.status(400).json({
      error: "Keine Frage."
    });
  }


  const system = `
Du bist Lessing KI.

Du bist ein schneller KI-Lernassistent für Schüler.

Antworte:
- kurz und verständlich
- auf Deutsch
- freundlich
- ohne lange Einleitung

Bei Schule:
- erkläre Schritt für Schritt
- gib Beispiele

Bei normalen Fragen:
- chatte normal.

Klasse: ${grade}
Modus: ${mode}

Zeige niemals interne Gedanken.
`;


  try {

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 6000);



    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key
        },


        body: JSON.stringify({

          system_instruction: {
            parts: [
              {
                text: system
              }
            ]
          },


          contents: [
            {
              role: "user",
              parts: [
                {
                  text: question.trim()
                }
              ]
            }
          ],


          generationConfig: {

            temperature: 0.2,

            maxOutputTokens: 350

          }

        }),


        signal: controller.signal

      }
    );


    clearTimeout(timeout);



    const data = await response.json();



    if (!response.ok) {

      console.log(data);

      return res.status(response.status).json({

        error:
        data?.error?.message ||
        "Gemini Fehler"

      });

    }



    const answer =
      data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text)
      ?.join("");



    return res.status(200).json({

      answer: cleanAnswer(answer)

    });



  } catch(error) {


    if(error.name === "AbortError") {

      return res.status(504).json({

        error:
        "KI antwortet zu langsam."

      });

    }


    console.log(error);


    return res.status(500).json({

      error:
      "KI Fehler."

    });

  }

}
