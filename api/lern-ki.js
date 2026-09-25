export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({text:'Method not allowed'});
  try{
    const {message='',history=[],model='gemini-3.8-flash'}=req.body||{};
    if(!String(message).trim()) return res.status(400).json({text:'Bitte schreibe eine Frage.'});
    const key=process.env.GEMINI_API_KEY;
    if(!key) return res.status(503).json({text:'Die Lern-KI ist nicht verbunden. In Vercel fehlt die Umgebungsvariable GEMINI_API_KEY.'});

    const safeHistory=Array.isArray(history)
      ? history.slice(-20).filter(x=>x&&typeof x.text==='string'&&x.text.trim())
          .map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.text.slice(0,8000)}]}))
      : [];
    safeHistory.push({role:'user',parts:[{text:String(message).slice(0,8000)}]});

    const requested=typeof model==='string'&&model.trim()?model.trim():'gemini-3.8-flash';
    const candidates=[requested,'gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-2.5-flash']
      .filter((v,i,a)=>v&&!a.slice(0,i).includes(v)&&!/^gemini-2\\./.test(v) || v==='gemini-2.5-flash');
    const system='Du bist Lessing KI, ein sehr guter, freundlicher und zuverlässiger Lernassistent für Schülerinnen und Schüler. Du kannst ganz normal chatten und gleichzeitig beim Lernen helfen. Erkläre verständlich, altersgerecht und Schritt für Schritt. Unterstütze Mathematik, Deutsch, Englisch, Biologie, Chemie, Physik, Geschichte, Erdkunde, Informatik und weitere Fächer. Erstelle Lernpläne, Übungsaufgaben, Zusammenfassungen und Prüfungsvorbereitung. Wenn Angaben fehlen, frage gezielt nach. Erfinde keine Fakten. Antworte standardmäßig auf Deutsch, außer der Nutzer bittet um eine andere Sprache.';
    const payload={systemInstruction:{parts:[{text:system}]},contents:safeHistory,generationConfig:{maxOutputTokens:2200}};

    let lastError='Unbekannter KI-Fehler.';
    for(const selectedModel of candidates){
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(key)}`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
      });
      const data=await r.json().catch(()=>({}));
      if(r.ok){
        const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();
        if(text) return res.status(200).json({text,model:selectedModel});
        lastError='Die KI hat keine Antwort zurückgegeben.';
        continue;
      }
      lastError=data?.error?.message||`Modell ${selectedModel} konnte nicht verwendet werden.`;
      // Authentication, quota and malformed-request errors should be shown immediately;
      // model availability errors can try the next current model.
      if([401,403,429].includes(r.status)) return res.status(r.status).json({text:`KI-Fehler: ${lastError}`});
    }
    return res.status(502).json({text:`Kein verfügbares Gemini-Modell konnte die Anfrage beantworten. Letzter Fehler: ${lastError}`});
  }catch(e){return res.status(500).json({text:'KI-Fehler: '+(e?.message||String(e))});}
}
