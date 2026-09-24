export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({text:'Method not allowed'});
  try{
    const {message=''}=req.body||{};
    if(!process.env.GEMINI_API_KEY) return res.status(200).json({text:'Ich bin bereit. Verbinde in Vercel unter Environment Variables den GEMINI_API_KEY, damit echte KI-Antworten aktiviert werden.'});
    const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:'Du bist Lessing KI, ein freundlicher Lernassistent für Schülerinnen und Schüler. Erkläre verständlich, korrekt und altersgerecht. Du kannst auch normal chatten. Keine Pflicht zur Fachauswahl.'}]},contents:[{role:'user',parts:[{text:message}]}]})});
    const data=await r.json(); if(!r.ok) return res.status(500).json({text:data?.error?.message||'KI-Fehler'});
    return res.status(200).json({text:data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'Keine Antwort erhalten.'});
  }catch(e){return res.status(500).json({text:'KI-Fehler: '+e.message})}
}
