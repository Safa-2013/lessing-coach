export default async function handler(req,res){
 const key=process.env.GEMINI_API_KEY;
 if(!key)return res.status(503).json({error:"GEMINI_API_KEY fehlt"});
 const q=req.body?.question||"";
 const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",{
 method:"POST",
 headers:{"Content-Type":"application/json","x-goog-api-key":key},
 body:JSON.stringify({contents:[{parts:[{text:q}]}]})
 });
 const d=await r.json();
 res.json({answer:d.candidates?.[0]?.content?.parts?.[0]?.text||"Keine Antwort"});
}
