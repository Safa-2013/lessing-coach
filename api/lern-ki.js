const requests = new Map();

function cleanAnswer(text) {
  return String(text || "").trim() || "Hallo! Wie kann ich dir helfen?";
}

function getModels() {
  return [
    "gemini-2.5-flash-lite"
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
      error:"Keine Frage"
    });
  }


  const system = `
Du bist Lessing KI.

Du bist ein schneller, freundlicher Lernassistent für Schüler.

Regeln:
- Antworte auf Deutsch.
- Erkläre einfach.
- Bei Schule hilfst du Schritt für Schritt.
- Bei normalen Fragen chatte normal.
- Keine internen Gedanken zeigen.
- Keine langen Einleitungen.
- Komm direkt zur Antwort.

Klasse:
${grade}

Modus:
${mode}
`;


  const contents = [
    ...(
      Array.isArray(history)
      ? history.slice(-6).map(m => ({
          role:m.role,
          parts:[
            {
              text:String(m.text).slice(0,1000)
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


  for (const model of getModels()) {

    try {

      const controller = new AbortController();

      const timer = setTimeout(()=>{
        controller.abort();
      },8000);


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
              maxOutputTokens:600
            }

          }),

          signal:controller.signal
        }
      );


      clearTimeout(timer);


      const data = await response.json();


      if(response.ok){

        const answer =
        data?.candidates?.[0]?.content?.parts
        ?.map(p=>p.text)
        .join("");


        return res.status(200).json({
          answer:cleanAnswer(answer)
        });

      }


      console.log("Gemini Fehler:",data);


    } catch(error){

      console.log("Timeout:",error.message);

    }

  }


  return res.status(503).json({
    error:"Die KI ist gerade ausgelastet. Bitte erneut versuchen."
  });

}
