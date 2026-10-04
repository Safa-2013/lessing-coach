import { randomBytes } from 'node:crypto';
import { clamp } from './stars-game.js';

const fail=(status,message)=>{const e=Error(message);e.status=status;throw e};
const THEMES=['school','forest','night'];
const TYPES=['wall','bush','lava'];

const DEFAULT_MAPS=[
  {id:'schoolyard',name:'Schulhof-Chaos',theme:'school',duration:120,hazardDamage:200,published:true,cells:[
    {x:80,y:360,type:'wall'},{x:120,y:360,type:'wall'},{x:600,y:360,type:'wall'},{x:640,y:360,type:'wall'},
    {x:80,y:1040,type:'wall'},{x:120,y:1040,type:'wall'},{x:600,y:1040,type:'wall'},{x:640,y:1040,type:'wall'},
    {x:200,y:480,type:'bush'},{x:520,y:480,type:'bush'},{x:200,y:920,type:'bush'},{x:520,y:920,type:'bush'}
  ]},
  {id:'knowledge_mine',name:'Wissensmine',theme:'night',duration:120,hazardDamage:180,published:true,cells:[
    {x:160,y:400,type:'wall'},{x:560,y:400,type:'wall'},{x:160,y:1000,type:'wall'},{x:560,y:1000,type:'wall'},
    {x:280,y:520,type:'bush'},{x:440,y:520,type:'bush'},{x:280,y:880,type:'bush'},{x:440,y:880,type:'bush'}
  ]},
  {id:'aula_arena',name:'Aula-Arena',theme:'school',duration:150,hazardDamage:220,published:true,cells:[
    {x:120,y:560,type:'wall'},{x:600,y:560,type:'wall'},{x:120,y:840,type:'wall'},{x:600,y:840,type:'wall'},
    {x:80,y:720,type:'bush'},{x:640,y:720,type:'bush'}
  ]}
];

export function safeMapCell(x,y){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x%40!==0||y%40!==0)return false;
  if(x<0||x>720||y<240||y>1160)return false;
  // Keep the central combat zone free so generated maps remain playable.
  if(x>=200&&x<=520&&y>=600&&y<=800)return false;
  return true;
}

function cleanCells(input){
  if(!Array.isArray(input))return [];
  const used=new Set(),cells=[];
  for(const cell of input.slice(0,150)){
    if(!cell||typeof cell!=='object')continue;
    const x=Number(cell.x),y=Number(cell.y),type=String(cell.type||'');
    const key=x+':'+y;
    if(!safeMapCell(x,y)||!TYPES.includes(type)||used.has(key))continue;
    used.add(key);cells.push({x,y,type});
  }
  return cells;
}

export async function maps(db,admin=false){
  const rows=await db.query('SELECT data FROM stars_maps');
  const custom=rows.map(r=>{try{return JSON.parse(r.data)}catch{return null}}).filter(Boolean);
  const override=new Map(custom.map(m=>[m.id,m]));
  return [...DEFAULT_MAPS.map(m=>override.get(m.id)||m),...custom.filter(m=>!DEFAULT_MAPS.some(d=>d.id===m.id))]
    .filter(m=>!m.deleted&&(admin||m.published));
}

export async function editMap(db,user,body){
  if(user.role!=='admin')fail(403,'Nur Admin');
  let id=String(body.id||'').trim().toLowerCase();
  if(!id)id='map_'+randomBytes(6).toString('hex');
  if(!/^[a-z0-9_]{1,40}$/.test(id))fail(400,'Ungültige Karten-ID');
  if(body.delete===true){
    const existing=(await maps(db,true)).find(m=>m.id===id);
    if(!existing)fail(404,'Spielfeld nicht gefunden');
    const data={...existing,deleted:true,published:false};
    await db.query('INSERT INTO stars_maps(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2',[id,JSON.stringify(data)]);
    return {map:data,maps:await maps(db,true)};
  }
  const name=String(body.name||'').trim().slice(0,30);
  if(!name)fail(400,'Name fehlt');
  let rawCells=body.cells;
  if(typeof rawCells==='string'){try{rawCells=JSON.parse(rawCells)}catch{fail(400,'Kartenfelder sind ungültig')}}
  const cells=cleanCells(rawCells);
  const data={
    id,name,
    theme:THEMES.includes(body.theme)?body.theme:'school',
    duration:Math.round(clamp(Number(body.duration)||120,30,300)),
    hazardDamage:Math.round(clamp(Number(body.hazardDamage)||200,50,1000)),
    cells,
    published:body.published===true
  };
  await db.query('INSERT INTO stars_maps(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2',[id,JSON.stringify(data)]);
  return {map:data,maps:await maps(db,true)};
}
