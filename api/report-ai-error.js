export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false});
  try{
    const body=req.body||{};
    const payload={
      target:'BIG_ADMIN',
      created:body.created||new Date().toISOString(),
      message:String(body.message||'Unbekannter KI-Fehler').slice(0,4000),
      question:String(body.question||'').slice(0,4000),
      mode:String(body.mode||'').slice(0,100),
      admin:String(body.admin||'').slice(0,100),
      endpoint:String(body.endpoint||'').slice(0,500)
    };
    const webhook=process.env.BIG_ADMIN_ERROR_WEBHOOK;
    if(webhook){
      const r=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok) return res.status(502).json({ok:false,text:'Fehler konnte nicht an den Hauptadmin übermittelt werden.'});
    }
    return res.status(202).json({ok:true,delivered:Boolean(webhook)});
  }catch(e){return res.status(500).json({ok:false,text:'Fehler beim Übermitteln des KI-Fehlers.'})}
}
