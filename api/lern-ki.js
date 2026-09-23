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
      error: "Keine Nachricht eingegeben."
    });
  }


  // Schutz gegen Spam
  const ip = req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();

  const oldRequests = (requests.get(ip) || [])
    .filter(time => now - time < 600000);

  if (oldRequests.length >= 20) {
    return res.status(429).json({
      error: "Bitte kurz warten."
    });
  }

  oldRequests.push(now);
  requests.set(ip, oldRequests);



  const systemPrompt = `
Du bist Lessing KI.

Du bist ein moderner KI-Assistent für Schülerinnen und Schüler.

Du kannst:
- normal chatten
- Fragen beantworten
- beim Lernen helfen
- Lernpläne erstellen
- Tests erstellen
- Themen erklären
- Aufgaben Schritt für Schritt erklären

Klasse:
${grade}

Modus:
${mode}

Regeln:
- Antworte freundlich und verständlich.
- Passe dich dem Alter an.
- Zeige keine internen Gedanken.
- Gib nur die fertige Antwort aus.
`;



  const contents = [
    {
      role: "user",
      parts: [
        {
          text: systemPrompt
        }
      ]
    }
  ];



  if (Array.isArray(history)) {

    history.slice(-10).forEach(item => {

      if (
        item &&
        typeof item.text === "string" &&
        (item.role === "user" || item.role === "model")
      ) {

        contents.push({
          role: item.role,
          parts: [
            {
              text: item.text.substring(0,3000)
            }
          ]
        });

      }

    });

  }



  contents.push({
    role:"user",
    parts:[
      {
        text:question
      }
    ]
  });



  try {


    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
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

      console.error("Gemini Fehler:", data);

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

        error:"Keine Antwort von Gemini erhalten."

      });

    }



    return res.status(200).json({

      answer

    });



  } catch(error){


    console.error(error);


    return res.status(500).json({

      error:"Verbindung zu Gemini fehlgeschlagen."

    });


  }

}
