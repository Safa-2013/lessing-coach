import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') || '';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession:false } });

const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const token=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');

async function auth(req:Request){
  const raw=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!raw) return null;
  const h=await sha(raw);
  const {data}=await supabase.from('lessing_sessions').select('user_id,expires_at').eq('token_hash',h).maybeSingle();
  if(!data || new Date(data.expires_at)<=new Date()) return null;
  const {data:u}=await supabase.from('lessing_users').select('id,username,role,display_name,active').eq('id',data.user_id).maybeSingle();
  return u?.active?u:null;
}
const need=(u:any,roles:string[])=>!!u&&roles.includes(u.role);

async function login(body:any){
  const username=String(body.username||'').trim().toLowerCase(), password=String(body.password||'');
  const {data:u}=await supabase.from('lessing_users').select('*').ilike('username',username).maybeSingle();
  if(!u||!u.active||u.password_hash!==await sha(password)) return json({error:'Benutzername oder Passwort falsch.'},401);
  const raw=token(), hash=await sha(raw), exp=new Date(Date.now()+1000*60*60*24*30).toISOString();
  await supabase.from('lessing_sessions').insert({token_hash:hash,user_id:u.id,expires_at:exp});
  return json({token:raw,user:{id:u.id,username:u.username,role:u.role,display_name:u.display_name}});
}

async function listAccounts(u:any){
  const {data,error}=await supabase.from('lessing_users').select('id,username,role,display_name,active,created_at').order('created_at');
  if(error) return json({error:error.message},500);
  const rows=(data||[]).filter((x:any)=>u.role==='bigadmin'||x.role!=='bigadmin');
  return json({accounts:rows});
}

async function accountAction(u:any,b:any){
  const action=b.subaction;
  if(action==='list') return listAccounts(u);
  if(action==='create'){
    const role=['admin','staff'].includes(b.role)?b.role:(u.role==='bigadmin'?'bigadmin':null);
    if(!role) return json({error:'Keine Berechtigung für diese Rolle.'},403);
    if(role==='bigadmin'&&u.role!=='bigadmin') return json({error:'Keine Berechtigung.'},403);
    if(!b.username||!b.password) return json({error:'Benutzername und Passwort erforderlich.'},400);
    const {data,error}=await supabase.from('lessing_users').insert({username:String(b.username).trim().toLowerCase(),password_hash:await sha(String(b.password)),role,display_name:String(b.display_name||b.username),created_by:u.id}).select('id,username,role,display_name,active').single();
    if(error) return json({error:error.message},400); return json({account:data});
  }
  if(action==='delete'){
    const {data:target}=await supabase.from('lessing_users').select('id,role,username').eq('id',b.id).maybeSingle();
    if(!target||target.id===u.id) return json({error:'Konto kann nicht gelöscht werden.'},400);
    if(target.role==='bigadmin'&&u.role!=='bigadmin') return json({error:'Nicht erlaubt.'},403);
    await supabase.from('lessing_users').delete().eq('id',target.id); return json({ok:true});
  }
  if(action==='password'){
    const {data:target}=await supabase.from('lessing_users').select('id,role').eq('id',b.id).maybeSingle();
    if(!target) return json({error:'Konto nicht gefunden.'},404);
    if(target.role==='bigadmin'&&u.role!=='bigadmin') return json({error:'Nicht erlaubt.'},403);
    await supabase.from('lessing_users').update({password_hash:await sha(String(b.password||''))}).eq('id',target.id); return json({ok:true});
  }
  if(action==='active'){
    const {data:target}=await supabase.from('lessing_users').select('id,role').eq('id',b.id).maybeSingle();
    if(!target || (target.role==='bigadmin'&&u.role!=='bigadmin')) return json({error:'Nicht erlaubt.'},403);
    await supabase.from('lessing_users').update({active:!!b.active}).eq('id',target.id); return json({ok:true});
  }
  return json({error:'Unbekannte Kontenaktion'},400);
}

async function teachers(b:any,u:any){
  if(b.subaction==='list'){
    const {data}=await supabase.from('lessing_teachers').select('*').eq('active',true).order('area').order('name'); return json({teachers:data||[]});
  }
  if(!need(u,['admin','bigadmin'])) return json({error:'Nicht erlaubt.'},403);
  if(b.subaction==='create'){
    const {data,error}=await supabase.from('lessing_teachers').insert({area:b.area,name:b.name,color:b.color||'#4f8cff'}).select().single(); if(error)return json({error:error.message},400); return json({teacher:data});
  }
  if(b.subaction==='update'){await supabase.from('lessing_teachers').update({area:b.area,name:b.name,color:b.color||'#4f8cff',active:b.active!==false}).eq('id',b.id);return json({ok:true});}
  if(b.subaction==='delete'){await supabase.from('lessing_teachers').update({active:false}).eq('id',b.id);return json({ok:true});}
  return json({error:'Unbekannte Lehrkraftaktion'},400);
}

async function appointmentPublic(b:any){
  if(b.subaction==='create'){
    if(!b.first_name||!b.last_name||!b.class_name||!b.area||!b.school_end) return json({error:'Bitte alle Pflichtfelder ausfüllen.'},400);
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code='';
    do{code=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('');}while((await supabase.from('lessing_appointments').select('id').eq('code',code).maybeSingle()).data);
    const {data,error}=await supabase.from('lessing_appointments').insert({code,first_name:b.first_name,last_name:b.last_name,class_name:b.class_name,area:b.area,teacher_id:b.teacher_id||null,school_end:b.school_end,desired_date:b.desired_date||null,desired_start:b.desired_start||null,desired_end:b.desired_end||null,message:b.message||''}).select('code,status,school_end,area,teacher_id').single();
    if(error)return json({error:error.message},400); return json({appointment:data});
  }
  if(b.subaction==='get'){
    const {data,error}=await supabase.from('lessing_appointments').select('*,lessing_teachers(name,color,area),lessing_appointment_messages(*)').eq('code',String(b.code||'').toUpperCase()).maybeSingle();
    if(error||!data)return json({error:'Code nicht gefunden.'},404); return json({appointment:data});
  }
  if(b.subaction==='message'){
    const {data:a}=await supabase.from('lessing_appointments').select('id').eq('code',String(b.code||'').toUpperCase()).maybeSingle(); if(!a)return json({error:'Code nicht gefunden.'},404);
    await supabase.from('lessing_appointment_messages').insert({appointment_id:a.id,sender:'student',body:String(b.body||'')}); return json({ok:true});
  }
  return json({error:'Unbekannte Anfrageaktion'},400);
}

async function appointments(u:any,b:any){
  if(!need(u,['admin','bigadmin','staff']))return json({error:'Nicht erlaubt.'},403);
  if(b.subaction==='list'){
    const {data,error}=await supabase.from('lessing_appointments').select('*,lessing_teachers(name,color,area),lessing_appointment_messages(*)').order('created_at',{ascending:false}); if(error)return json({error:error.message},500); return json({appointments:data||[]});
  }
  if(b.subaction==='manual' && need(u,['admin','bigadmin'])){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
    const {data,error}=await supabase.from('lessing_appointments').insert({code,first_name:b.first_name,last_name:b.last_name,class_name:b.class_name,area:b.area,teacher_id:b.teacher_id||null,school_end:b.school_end||'15:50',confirmed_date:b.date,confirmed_start:b.start,confirmed_end:b.end,status:'Bestätigt',admin_note:b.admin_note||'',confirmed_at:new Date().toISOString()}).select().single(); if(error)return json({error:error.message},400); return json({appointment:data});
  }
  if(b.subaction==='update'){
    const {data:a}=await supabase.from('lessing_appointments').select('*').eq('id',b.id).maybeSingle(); if(!a)return json({error:'Termin nicht gefunden.'},404);
    if(['Bestätigt'].includes(b.status||'') && b.teacher_id){
      const {data:conf}=await supabase.from('lessing_appointments').select('id').eq('teacher_id',b.teacher_id).eq('confirmed_date',b.date).eq('status','Bestätigt').neq('id',b.id).lt('confirmed_start',b.end).gt('confirmed_end',b.start).limit(1);
      if((conf||[]).length)return json({error:'Diese Lehrkraft ist zu dieser Zeit bereits gebucht.'},409);
    }
    const patch:any={status:b.status||a.status,teacher_id:b.teacher_id??a.teacher_id,admin_note:b.admin_note??a.admin_note};
    if(b.status==='Bestätigt'){patch.confirmed_date=b.date;patch.confirmed_start=b.start;patch.confirmed_end=b.end;patch.confirmed_at=new Date().toISOString();}
    const {data,error}=await supabase.from('lessing_appointments').update(patch).eq('id',b.id).select().single(); if(error)return json({error:error.message},400); return json({appointment:data});
  }
  if(b.subaction==='delete' && need(u,['admin','bigadmin'])){await supabase.from('lessing_appointments').delete().eq('id',b.id);return json({ok:true});}
  return json({error:'Unbekannte Terminaktion'},400);
}

async function chats(u:any,b:any){
  if(!u)return json({error:'Anmeldung erforderlich.'},401);
  if(b.subaction==='list'){const {data}=await supabase.from('lessing_chats').select('id,title,updated_at,created_at').eq('user_id',u.id).order('updated_at',{ascending:false});return json({chats:data||[]});}
  if(b.subaction==='get'){const {data}=await supabase.from('lessing_chats').select('*').eq('id',b.id).eq('user_id',u.id).maybeSingle();return data?json({chat:data}):json({error:'Chat nicht gefunden.'},404);}
  if(b.subaction==='save'){const payload={user_id:u.id,title:b.title||'Neuer Chat',messages:b.messages||[],updated_at:new Date().toISOString()}; if(b.id){const {data}=await supabase.from('lessing_chats').update(payload).eq('id',b.id).eq('user_id',u.id).select().single();return json({chat:data});}const {data}=await supabase.from('lessing_chats').insert(payload).select().single();return json({chat:data});}
  if(b.subaction==='delete'){await supabase.from('lessing_chats').delete().eq('id',b.id).eq('user_id',u.id);return json({ok:true});}
  if(b.subaction==='rename'){await supabase.from('lessing_chats').update({title:String(b.title||'Neuer Chat'),updated_at:new Date().toISOString()}).eq('id',b.id).eq('user_id',u.id);return json({ok:true});}
  return json({error:'Unbekannte Chataktion'},400);
}

async function ai(u:any,b:any){
  if(!GEMINI_KEY)return json({error:'KI ist noch nicht aktiviert. Hinterlege GEMINI_API_KEY in der Supabase Edge Function.'},503);
  const history=(b.history||[]).slice(-16).map((m:any)=>({role:m.role==='model'?'model':'user',parts:[{text:String(m.text||'')}]}));
  const parts:any[]=[{text:`Du bist Lessing KI, ein schneller, freundlicher Lernassistent für Schülerinnen und Schüler. Antworte auf Deutsch, klar und altersgerecht. Normaler Smalltalk ist erlaubt. Wenn es um Lernen geht, erkläre statt nur die Lösung zu nennen. Modus: ${b.mode||'Normal chatten'}. Klasse: ${b.grade||'nicht angegeben'}.`},{text:String(b.question||'')}];
  const resp=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contents:[...history,{role:'user',parts}],generationConfig:{temperature:0.3,maxOutputTokens:2048}})});
  const data=await resp.json(); if(!resp.ok)return json({error:data?.error?.message||'Gemini-Fehler'},502);
  return json({answer:data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('')||'Keine Antwort erhalten.'});
}

async function settings(u:any,b:any){
  if(b.subaction==='get'){const {data}=await supabase.from('lessing_settings').select('payload').eq('id',1).single();return json({settings:data?.payload||{}});}
  if(!need(u,['admin','bigadmin']))return json({error:'Nicht erlaubt.'},403);
  await supabase.from('lessing_settings').upsert({id:1,payload:b.payload||{},updated_by:u.id,updated_at:new Date().toISOString()}); return json({ok:true});
}

Deno.serve(async(req)=>{
  try{
    const body=await req.json().catch(()=>({}));
    const action=body.action;
    if(action==='login')return await login(body);
    const u=await auth(req);
    if(action==='logout'&&u){const raw=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';await supabase.from('lessing_sessions').delete().eq('token_hash',await sha(raw));return json({ok:true});}
    if(action==='me')return u?json({user:u}):json({user:null});
    if(action==='accounts')return u?await accountAction(u,body):json({error:'Anmeldung erforderlich.'},401);
    if(action==='teachers')return await teachers(body,u);
    if(action==='public_appointment')return await appointmentPublic(body);
    if(action==='appointments')return await appointments(u,body);
    if(action==='chats')return await chats(u,body);
    if(action==='ai')return await ai(u,body);
    if(action==='settings')return await settings(u,body);
    return json({error:'Unbekannte Aktion'},400);
  }catch(e){return json({error:String(e?.message||e)},500)}
});
