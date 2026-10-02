import {randomBytes} from 'node:crypto';
import {clamp} from './stars-game.js';
const fail=(status,message)=>{const error=Error(message);error.status=status;throw error};
export const safeMapCell=(x,y)=>y>=220&&y<=1190&&!(x<540&&x+40>220&&y<830&&y+40>610);
export async function maps(db,admin=false){return (await db.query('SELECT data FROM stars_maps')).map(row=>JSON.parse(row.data)).filter(map=>admin||map.published)}
export async function editMap(db,user,body){
 if(user.role!=='admin')fail(403,'Nur Admin');
 const id=String(body.id||'map_'+randomBytes(6).toString('hex'));if(!/^map_[a-z0-9_]{1,30}$/.test(id))fail(400,'Ungültige Karten-ID');
 const name=String(body.name||'').trim().slice(0,30);if(!name)fail(400,'Name fehlt');
 if(!Array.isArray(body.cells)||body.cells.length>300)fail(400,'Maximal 300 Felder');
 const used=new Set(),cells=[];
 for(const cell of body.cells){const x=Number(cell.x),y=Number(cell.y);if(!Number.isInteger(x)||!Number.isInteger(y)||x%40||y%40||x<0||x>720||y<0||y>1400||!['wall','bush','lava'].includes(cell.type))fail(400,'Ungültiges Feld');if(!safeMapCell(x,y))fail(400,'Startplätze und die zentrale Zielzone müssen frei bleiben');const key=x+':'+y;if(used.has(key))continue;used.add(key);cells.push({x,y,type:cell.type})}
 const data={id,name,cells,theme:['school','forest','night'].includes(body.theme)?body.theme:'school',duration:Math.round(clamp(body.duration||120,30,300)),hazardDamage:Math.round(clamp(body.hazardDamage||200,50,1000)),published:body.published===true};
 await db.query('INSERT INTO stars_maps(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2',[id,JSON.stringify(data)]);
 await db.query('INSERT INTO stars_audit(id,actor,action,created_at) VALUES($1,$2,$3,$4)',[randomBytes(12).toString('hex'),user.username,'Spielfeld gespeichert: '+id,Date.now()]);
 return {map:data,maps:await maps(db,true)};
}
