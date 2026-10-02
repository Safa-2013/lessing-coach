import { randomBytes, randomUUID, createHash, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { fresh,normalize } from './stars-game.js';
import { schema,catalog,action,fighterEdit,roomAction } from './stars-services.js';
import {maps,editMap} from './stars-maps.js';
import {skins,editSkin} from './stars-skins.js';
import {generateStarsDraft} from './stars-ai.js';
import {brawlerImage} from './stars-image.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
const passwordHash=p=>{const salt=randomBytes(16).toString('hex');return salt+':'+pbkdf2Sync(p,salt,120000,32,'sha256').toString('hex')};
const verify=(p,h)=>{const [salt,digest]=h.split(':');return timingSafeEqual(Buffer.from(digest,'hex'),pbkdf2Sync(p,salt,120000,32,'sha256'))};
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
export default async function starsApi(req,res,db,path){
 try{
 if(!['GET','POST','PATCH'].includes(req.method))return reply(res,405,{error:'Methode nicht erlaubt'});
 if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{error:'Ungültige Herkunft'});
 const body=typeof req.body==='object'?req.body:JSON.parse(req.body||'{}');
 if(!db.starsReady)db.starsReady=(async()=>{
 await db.query('CREATE TABLE IF NOT EXISTS stars_users (username TEXT PRIMARY KEY, password_hash TEXT NOT NULL, role TEXT NOT NULL, progress TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL DEFAULT \'\')');
 await db.query('CREATE TABLE IF NOT EXISTS stars_sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, expires_at BIGINT NOT NULL)');
 if(!(await db.query('SELECT username FROM stars_users WHERE username=$1',['admin'])).length)await db.query('INSERT INTO stars_users(username,password_hash,role,progress) VALUES($1,$2,$3,$4) ON CONFLICT(username) DO NOTHING',['admin',passwordHash(process.env.STARS_ADMIN_PASSWORD||'1234'),'admin',JSON.stringify(fresh('Admin'))]);
 await schema(db);
 })().catch(e=>{db.starsReady=null;throw e});await db.starsReady;
 const token=/(?:^|;\s*)stars_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];
 const user=token?(await db.query('SELECT u.* FROM stars_users u JOIN stars_sessions s ON s.username=u.username WHERE s.token=$1 AND s.expires_at>$2',[sha(token),Date.now()]))[0]:null;
 const readMaintenance=async()=>{const row=(await db.query('SELECT value FROM content WHERE key=$1',['maintenance']))[0];let m={};try{m=JSON.parse(row?.value||'{}')}catch{}return m};
 if(path==='/stars/catalog'&&req.method==='GET')return reply(res,200,{catalog:await catalog(db,user?.role==='admin')});
 if(path==='/stars/skins'&&req.method==='GET')return reply(res,200,{skins:await skins(db,user?.role==='admin')});
 if(path==='/stars/maps'&&req.method==='GET')return reply(res,200,{maps:await maps(db,user?.role==='admin')});
 const m=await readMaintenance();const maintenance={maintenance:!!(m.all||m.sections?.stars),message:m.message||'Lessing Stars wird gerade gewartet.',all:!!m.all};
 if(path==='/stars/status'&&req.method==='GET')return reply(res,200,{...maintenance,user:user?{name:user.username,role:user.role,blocked:!!user.blocked,reason:user.reason}:null,progress:user?JSON.parse(user.progress):null});
 if(path==='/stars/guest'&&req.method==='POST'){
  if(user?.blocked)return reply(res,403,{error:'Konto gesperrt'});
  if(maintenance.maintenance&&user?.role!=='admin')return reply(res,503,{error:maintenance.message});
  if(user)return reply(res,200,{...maintenance,user:{name:user.username,role:user.role},progress:JSON.parse(user.progress)});
  const username='gast_'+randomBytes(6).toString('hex'),progress=fresh('Gast');
  await db.query('INSERT INTO stars_users(username,password_hash,role,progress) VALUES($1,$2,$3,$4)',[username,passwordHash(randomBytes(32).toString('hex')),'guest',JSON.stringify(progress)]);
  const newToken=randomBytes(32).toString('hex');await db.query('INSERT INTO stars_sessions(token,username,expires_at) VALUES($1,$2,$3)',[sha(newToken),username,Date.now()+7*86400000]);
  res.setHeader('Set-Cookie',`stars_session=${newToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.VERCEL?'; Secure':''}`);
  return reply(res,200,{...maintenance,user:{name:username,role:'guest'},progress});
 }
 if(['/stars/login','/stars/register'].includes(path)&&req.method==='POST'){
 const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');if(!/^[\p{L}\p{N}_ -]{2,18}$/u.test(username)||password.length<4||password.length>200)return reply(res,400,{error:'Name oder Passwort ungültig'});
 let found=(await db.query('SELECT * FROM stars_users WHERE username=$1',[username]))[0];
 if(path==='/stars/register'){if(maintenance.maintenance)return reply(res,503,{error:maintenance.message});if(found||username==='guest')return reply(res,409,{error:'Name bereits vergeben'});await db.query('INSERT INTO stars_users(username,password_hash,role,progress) VALUES($1,$2,$3,$4)',[username,passwordHash(password),'player',JSON.stringify(fresh(String(body.username).trim()))]);found=(await db.query('SELECT * FROM stars_users WHERE username=$1',[username]))[0]}
 else if(!found||!verify(password,found.password_hash))return reply(res,401,{error:'Name oder Passwort falsch'});
 if(found.blocked)return reply(res,403,{error:'Konto gesperrt: '+found.reason});if(maintenance.maintenance&&found.role!=='admin')return reply(res,503,{error:maintenance.message});
 const newToken=randomBytes(32).toString('hex');await db.query('INSERT INTO stars_sessions(token,username,expires_at) VALUES($1,$2,$3)',[sha(newToken),username,Date.now()+7*86400000]);res.setHeader('Set-Cookie',`stars_session=${newToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.VERCEL?'; Secure':''}`);return reply(res,200,{user:{name:username,role:found.role},progress:JSON.parse(found.progress),...maintenance});
 }
 if(path==='/stars/logout'&&req.method==='POST'){if(token)await db.query('DELETE FROM stars_sessions WHERE token=$1',[sha(token)]);res.setHeader('Set-Cookie','stars_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return reply(res,200,{ok:true})}
 if(!user)return reply(res,401,{error:'Bitte anmelden'});if(user.blocked)return reply(res,403,{error:'Konto gesperrt'});
 if(maintenance.maintenance&&user.role!=='admin')return reply(res,503,{error:maintenance.message});
 if(path==='/stars/action'&&req.method==='POST')return reply(res,200,await action(db,user,body));
 if((path==='/stars/rooms'&&req.method==='GET')||(path.startsWith('/stars/room/')&&req.method==='POST'))return reply(res,200,await roomAction(db,user,path,{...body,_method:req.method}));
 if(path==='/stars/progress'&&req.method==='PATCH'){
  const incoming=body.progress;if(!incoming)return reply(res,400,{error:'Ungültige Daten'});
  const p=normalize(JSON.parse(user.progress),user.username);
  if(JSON.stringify(incoming.wallet)!==JSON.stringify(p.wallet)||Number(incoming.views?.credits)!==p.views.credits)return reply(res,403,{error:'Guthaben wird nur durch den Server verändert.'});
  return reply(res,200,await action(db,user,{action:'profile',name:incoming.name,color:incoming.views?.color,avatar:incoming.views?.avatar}));
 }
 if(path==='/stars/password'&&req.method==='POST'){if(!verify(String(body.current||''),user.password_hash))return reply(res,403,{error:'Aktuelles Passwort falsch'});const next=String(body.next||'');if(next.length<6||next.length>200)return reply(res,400,{error:'Neues Passwort: mindestens 6 Zeichen'});await db.query('UPDATE stars_users SET password_hash=$1 WHERE username=$2',[passwordHash(next),user.username]);await db.query('DELETE FROM stars_sessions WHERE username=$1 AND token<>$2',[user.username,sha(token)]);return reply(res,200,{ok:true})}
 if(user.role!=='admin')return reply(res,403,{error:'Nur Admin'});
 if(path==='/stars/admin/skin'&&req.method==='POST')return reply(res,200,await editSkin(db,user,body));
 if(path==='/stars/admin/image'&&req.method==='POST'){const count=await db.query('SELECT id FROM stars_audit WHERE actor=$1 AND action=$2 AND created_at>$3',[user.username,'Bild-KI',Date.now()-120000]);if(count.length>=2)return reply(res,429,{error:'Bitte zwei Minuten warten.'});await db.query('INSERT INTO stars_audit(id,actor,action,created_at) VALUES($1,$2,$3,$4)',[randomUUID(),user.username,'Bild-KI',Date.now()]);return reply(res,200,await brawlerImage(body));}
 if(path==='/stars/admin/ai'&&req.method==='POST'){const count=await db.query('SELECT id FROM stars_audit WHERE actor=$1 AND action=$2 AND created_at>$3',[user.username,'KI-Entwurf',Date.now()-60000]);if(count.length>=5)return reply(res,429,{error:'Bitte eine Minute warten.'});await db.query('INSERT INTO stars_audit(id,actor,action,created_at) VALUES($1,$2,$3,$4)',[randomUUID(),user.username,'KI-Entwurf',Date.now()]);return reply(res,200,await generateStarsDraft(body));}
 if(path==='/stars/admin/fighter/delete'&&req.method==='POST'){const id=String(body.id||'');if(id==='lex')return reply(res,400,{error:'Der Start-Brawler bleibt erhalten. Du kannst ihn bearbeiten.'});const found=(await catalog(db,true)).find(f=>f.id===id);if(!found)return reply(res,404,{error:'Brawler fehlt'});await db.transaction(async tx=>{await tx.query('INSERT INTO stars_fighters(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2',[id,JSON.stringify({...found,deleted:true,published:false})]);for(const row of await tx.query('SELECT username,progress FROM stars_users ORDER BY username'+(db.dialect==='postgres'?' FOR UPDATE':''))){const p=normalize(JSON.parse(row.progress),row.username);p.collection.brawlers=p.collection.brawlers.filter(f=>f!==id);if(p.fighters.selected===id)p.fighters.selected='lex';delete p.fighters.levels[id];delete p.fighters.trophies[id];await tx.query('UPDATE stars_users SET progress=$1 WHERE username=$2',[JSON.stringify(p),row.username])}});const saved=(await db.query('SELECT progress FROM stars_users WHERE username=$1',[user.username]))[0];return reply(res,200,{catalog:await catalog(db,true),progress:JSON.parse(saved.progress)})}
 if(path==='/stars/admin/fighter'&&req.method==='POST')return reply(res,200,await fighterEdit(db,user,body));
 if(path==='/stars/admin/map'&&req.method==='POST')return reply(res,200,await editMap(db,user,body));
 if(path==='/stars/admin/audit'&&req.method==='GET')return reply(res,200,{events:await db.query('SELECT actor,action,created_at FROM stars_audit ORDER BY created_at DESC LIMIT 100')});
 if(path==='/stars/admin/accounts'&&req.method==='GET')return reply(res,200,{accounts:await db.query('SELECT username,role,blocked,reason FROM stars_users')});
 if(path==='/stars/admin/block'&&req.method==='PATCH'){if(body.username==='admin')return reply(res,400,{error:'Admin kann nicht gesperrt werden'});await db.query('UPDATE stars_users SET blocked=$1,reason=$2 WHERE username=$3',[body.blocked?1:0,String(body.reason||'').slice(0,150),String(body.username)]);return reply(res,200,{ok:true})}
 if(path==='/stars/admin/maintenance'&&req.method==='PATCH'){m.sections={...m.sections,stars:body.maintenance===true};if(body.message)m.message=String(body.message).trim().slice(0,700);await db.query('INSERT INTO content(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2',['maintenance',JSON.stringify(m)]);return reply(res,200,{maintenance:!!(m.all||m.sections.stars),message:m.message,all:!!m.all})}
 return reply(res,404,{error:'Nicht gefunden'});
 }catch(e){return reply(res,e.status||500,{error:e.status?e.message:'Stars-Server konnte die Anfrage nicht bearbeiten.'})}
}
