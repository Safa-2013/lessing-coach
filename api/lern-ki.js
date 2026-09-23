const requests = new Map();

function cleanAnswer(text) {
  if (!text) return "Hallo! Wie kann ich dir helfen?";
  return String(text).trim();
}

function getModels() {
  return [
    "gemini-2.5-flash-lite",
    "gemini-3.6-flash"
  ];
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Nur POST erlaubt."
    });
  }


  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
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
      error: "Keine Frage."
    });
  }


  const system = `
Du bist Lessing KI.

Du bist ein schneller, freundlicher Lernassistent für Schüler.

Regeln:
- Antworte auf Deutsch.
- Erkläre einfach.
- Hilf bei Hausaufgaben Schritt für Schritt.
- Erstelle Lernpläne wenn gefragt.
- Erstelle Quiz wenn gefragt.
- Bei normalen Fragen antworte wie ein normaler Chat.
- Keine internen Gedanken zeigen.
- Keine langen Einleitungen.

Klasse:
${grade}

Modus:
${mode}
`;


  const contents = [];


  if (Array.isArray(history)) {
    history.slice(-6).forEach(msg => {

      if (
        msg.role === "user" ||
        msg.role === "model"
      ) {
        contents.push({
          role: msg.role,
          parts:[
            {
              text:String(msg.text).slice(0,1500)
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



  let lastError;


  for (const model of getModels()) {

    try {

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method:"POST",

          headers:{
            "Content-Type":"application/json",
            "x-goog-api-key":apiKey
          },

          body:JSON.stringify({

            system_instruction:{
              parts:[
                {
                  text:system
                }
              ]
            },


            contents,


            generationConfig:{
              temperature:0.3,
              maxOutputTokens:700
            }

          })
        }
      );


      const data = await response.json();


      if(response.ok){

        const answer =
          data?.candidates?.[0]
          ?.content?.parts
          ?.map(p=>p.text)
          .join("");


        return res.status(200).json({
          answer:cleanAnswer(answer)
        });

      }


      lastError=data?.error?.message;


    } catch(error){

      lastError=error.message;

    }

  }



  console.error(
    "Gemini Fehler:",
    lastError
  );


  return res.status(503).json({
    error:
    "Die KI ist gerade ausgelastet. Bitte erneut versuchen."
  });

}
