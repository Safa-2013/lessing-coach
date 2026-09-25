export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({text:'Method not allowed'});
  try{
    const {message='',history=[],model=process.env.GEMINI_MODEL||'gemini-2.5-flash'}=req.body||{};
    if(!message.trim()) return res.status(400).json({text:'Bitte schreibe eine Frage.'});
    if(!process.env.GEMINI_API_KEY) return res.status(503).json({text:'Die Lern-KI ist noch nicht aktiviert. Hinterlege in Vercel die Umgebungsvariable GEMINI_API_KEY.'});
    const safeHistory=Array.isArray(history)?history.slice(-20).filter(x=>x&&typeof x.text==='string').map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.text.slice(0,6000)}]})):[];
    safeHistory.push({role:'user',parts:[{text:message.slice(0,6000)}]});
    // Alte/deaktivierte Modelle niemals weiterverwenden. Das Portal läuft standardmäßig mit einem aktuellen stabilen Flash-Modell.
    let selectedModel=(typeof model==='string'&&model.trim())?model.trim():'gemini-3.6-flash';
    
    const payload={systemInstruction:{parts:[{text:'Du bist Lessing KI, ein freundlicher, zuverlässiger Lernassistent für Schülerinnen und Schüler. Erkläre verständlich, altersgerecht und Schritt für Schritt. Du kannst auch ganz normal chatten. Die Nutzer müssen kein Fach auswählen. Erstelle Lernpläne, Übungsaufgaben, Zusammenfassungen und Prüfungsvorbereitung. Behaupte nichts als Tatsache, wenn du es nicht weißt.'}]},contents:safeHistory,generationConfig:{maxOutputTokens:1800}};
    let r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${process.env.GEMINI_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    let data=await r.json();
    // Falls ein Account das bevorzugte Modell noch nicht anbietet, einmal automatisch auf ein aktuelles stabiles Flash-Modell wechseln.
    if(!r.ok && selectedModel!=='gemini-2.5-flash' && (r.status===400 || r.status===404 || r.status===429)){
      r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      data=await r.json();
    }
    if(!r.ok) return res.status(r.status).json({text:data?.error?.message||'KI-Fehler'});
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'Keine Antwort erhalten.';
    return res.status(200).json({text});
  }catch(e){return res.status(500).json({text:'KI-Fehler: '+e.message})}
}
