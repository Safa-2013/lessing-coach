export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  const key=process.env.GEMINI_API_KEY;
  if(!key) return res.status(500).json({error:"GEMINI_API_KEY fehlt in den Vercel Environment Variables."});
  try{
    const body=req.body||{};
    const message=String(body.message||"").trim();
    if(!message) return res.status(400).json({error:"Keine Nachricht."});
    const profile=body.profile||{};
    const history=Array.isArray(body.history)?body.history.slice(-20):[];
    const system=`Du bist Lessing KI, eine freundliche Lern-KI für Schülerinnen und Schüler. Erkläre verständlich, geduldig und altersgerecht. Hilf bei allen Schulfächern und auch bei normalen Fragen. Erstelle auf Wunsch Lernpläne, Übungsaufgaben und Zusammenfassungen. Verwende Deutsch, sofern der Nutzer nicht eine andere Sprache verwendet. Schülerdaten: Vorname=${profile.first||""}, Klasse=${profile.class||""}. Gib keine privaten Daten aus und behandle diese Angaben nur für den aktuellen Chat.`;
    const contents=[{role:"user",parts:[{text:system}]}];
    for(const item of history){
      if(!item||!Array.isArray(item.parts)||!item.parts[0]?.text) continue;
      contents.push({role:item.role==="model"?"model":"user",parts:[{text:String(item.parts[0].text)}]});
    }
    const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-goog-api-key":key},
      body:JSON.stringify({contents})
    });
    const data=await response.json();
    if(!response.ok) return res.status(response.status).json({error:data?.error?.message||"Gemini API Fehler"});
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"Keine Antwort erhalten.";
    return res.status(200).json({text});
  }catch(err){return res.status(500).json({error:err?.message||"Serverfehler"});}
}
