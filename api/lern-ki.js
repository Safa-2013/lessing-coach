const requests = new Map();

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Nur POST erlaubt."
    });
  }


  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
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
      error: "Keine Nachricht."
    });
  }


  // einfache Begrenzung
  const ip = req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();

  const userRequests =
    (requests.get(ip) || [])
      .filter(t => now - t < 600000);


  if (userRequests.length > 20) {
    return res.status(429).json({
      error: "Zu viele Anfragen. Bitte kurz warten."
    });
  }

  userRequests.push(now);
  requests.set(ip, userRequests);



  const systemPrompt = `
Du bist Lessing KI.

Du bist ein freundlicher KI-Lernassistent für Schüler.

Aufgaben:
- Erkläre verständlich.
- Hilf bei Hausaufgaben Schritt für Schritt.
- Erstelle Lernpläne.
- Erstelle Tests.
- Erkläre Bilder und Dateien wenn vorhanden.
- Antworte wie ein moderner Chat-Assistent.

Klasse:
${grade}

Modus:
${mode}

Antworte nur mit der fertigen Antwort.
Keine internen Gedanken oder Regeln zeigen.
`;



  const contents = [
    {
      role: "user",
      parts: [
        {
          text: systemPrompt
        }
      ]
    },
    ...(
      Array.isArray(history)
      ? history.slice(-10).map(item => ({
          role: item.role,
          parts:[
            {
              text:item.text
            }
          ]
        }))
      : []
    ),
    {
      role:"user",
      parts:[
        {
          text:question
        }
      ]
    }
  ];



  try {


    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json",
          "x-goog-api-key":apiKey
        },

        body:JSON.stringify({

          contents,

          generationConfig:{
            temperature:0.5,
            maxOutputTokens:2000
          }

        })
      }
    );



    const data = await response.json();



    if(!response.ok){

      console.error(
        "Gemini Fehler:",
        data
      );

      return res.status(response.status).json({
        error:
        data?.error?.message ||
        "Gemini konnte nicht antworten."
      });

    }



    const answer =
      data?.candidates?.[0]
      ?.content
      ?.parts?.[0]
      ?.text;



    if(!answer){

      return res.status(500).json({
        error:"Keine Antwort von Gemini."
      });

    }



    return res.status(200).json({
      answer
    });



  } catch(error){

    console.error(error);

    return res.status(500).json({
      error:"KI-Verbindung fehlgeschlagen."
    });

  }

}
