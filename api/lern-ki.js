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



  // Schutz gegen zu viele Anfragen
  const ip = req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();

  const userRequests = (requests.get(ip) || [])
    .filter(t => now - t < 600000);


  if (userRequests.length >= 20) {
    return res.status(429).json({
      error: "Bitte kurz warten."
    });
  }


  userRequests.push(now);
  requests.set(ip, userRequests);



  const system = `
Du bist Lessing KI.

Du bist ein schneller KI-Assistent für Schüler.

Du kannst:
- Fragen beantworten
- Lernen erklären
- Lernpläne erstellen
- Tests erstellen
- normal chatten

Klasse:
${grade}

Modus:
${mode}

Antworte kurz, klar und verständlich.
Keine internen Gedanken anzeigen.
`;



  const contents = [
    {
      role: "user",
      parts:[
        {
          text: system
        }
      ]
    }
  ];



  if(Array.isArray(history)){

    history.slice(-6).forEach(msg=>{

      if(msg?.text){

        contents.push({

          role: msg.role === "model"
            ? "model"
            : "user",

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
        text:question.trim()
      }
    ]

  });



  try{


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

            temperature:0.4,

            maxOutputTokens:800

          }

        })

      }

    );



    const data = await response.json();



    if(!response.ok){

      console.error(data);

      return res.status(response.status).json({

        error:
          data?.error?.message ||
          "Gemini Fehler"

      });

    }



    const answer =
      data?.candidates?.[0]
      ?.content
      ?.parts?.[0]
      ?.text;



    if(!answer){

      return res.status(500).json({

        error:"Keine Antwort erhalten."

      });

    }



    return res.status(200).json({

      answer

    });



  }catch(error){


    console.error(error);


    return res.status(500).json({

      error:"KI nicht erreichbar."

    });


  }

}
