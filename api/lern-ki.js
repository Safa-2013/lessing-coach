export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({text:'Method not allowed'});
  try{
    const {message='',history=[],model='gemini-2.5-flash'}=req.body||{};
    if(!message.trim()) return res.status(400).json({text:'Bitte schreibe eine Frage.'});
    if(!process.env.GEMINI_API_KEY) return res.status(503).json({text:'Die Lern-KI ist noch nicht aktiviert. Hinterlege in Vercel die Umgebungsvariable GEMINI_API_KEY.'});
    const safeHistory=Array.isArray(history)?history.slice(-20).filter(x=>x&&typeof x.text==='string').map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.text.slice(0,6000)}]})):[];
    safeHistory.push({role:'user',parts:[{text:message.slice(0,6000)}]});
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${process.env.GEMINI_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:'Du bist Lessing KI, ein freundlicher, zuverlässiger Lernassistent für Schülerinnen und Schüler. Erkläre verständlich, altersgerecht und Schritt für Schritt. Du kannst auch ganz normal chatten. Die Nutzer müssen kein Fach auswählen. Erstelle Lernpläne, Übungsaufgaben, Zusammenfassungen und Prüfungsvorbereitung. Behaupte nichts als Tatsache, wenn du es nicht weißt.'}]},contents:safeHistory,generationConfig:{temperature:.4,maxOutputTokens:1800}})});
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({text:data?.error?.message||'KI-Fehler'});
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'Keine Antwort erhalten.';
    return res.status(200).json({text});
  }catch(e){return res.status(500).json({text:'KI-Fehler: '+e.message})}
}
