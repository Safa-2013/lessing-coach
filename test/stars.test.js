import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import api from '../lib/api.js';
import {database} from '../lib/db.js';
import {BASE,beginRoom,applyInput,tick} from '../lib/stars-game.js';
process.chdir(mkdtempSync(join(tmpdir(),'stars-release-')));
async function call(path,body,client,method=body?'POST':'GET'){const res={setHeader(k,v){if(k==='Set-Cookie'&&client)client.cookie=v.split(';')[0]},writeHead(n){this.statusCode=n},end(s){this.data=JSON.parse(s)}};await api({url:'/api/stars/'+path,method,body:JSON.stringify(body||{}),headers:{host:'localhost',cookie:client?.cookie||''}},res);return res}
test('server accounts, editor, shared rooms, protected economy and exactly-once rewards',async()=>{
 const a={},b={},admin={};
 assert.equal((await call('register',{username:'Alice',password:'test1234'},a)).statusCode,200);
 const start=(await call('status',null,a)).data.progress;assert.equal(start.wallet.coins,500);assert.deepEqual(start.collection.brawlers,['lex']);assert.deepEqual(start.fighters.trophies,{});
 assert.equal((await call('register',{username:'Bob',password:'test1234'},b)).statusCode,200);
 assert.equal((await call('login',{username:'admin',password:'1234'},admin)).statusCode,200);
 assert.equal((await call('progress',{progress:{wallet:{coins:999999}}},a,'PATCH')).statusCode,403);
 const claim=await call('action',{action:'daily'},a);assert.equal(claim.statusCode,200);assert.equal(claim.data.progress.wallet.coins,600);
 assert.equal((await call('action',{action:'daily'},a)).statusCode,409);
 const payload={name:'TEST HERO',hp:6000,damage:900,range:450,speed:200,reload:1,superDamage:2000,cost:300,rarity:'EPISCH',published:false,projectiles:3,superProjectiles:5,projectileColor:'#ef3488'};
 assert.equal((await call('admin/fighter',payload,a)).statusCode,403);
 const edited=await call('admin/fighter',payload,admin);assert.equal(edited.statusCode,200);const id=edited.data.fighter.id;
 assert.equal(edited.data.fighter.projectiles,3);assert.equal(edited.data.fighter.superProjectiles,5);assert.equal(edited.data.fighter.projectileColor,'#ef3488');
 const guestCatalog=await call('catalog',null,{});assert.equal(guestCatalog.statusCode,200);assert(guestCatalog.data.catalog.some(f=>f.id==='lex'));assert(!guestCatalog.data.catalog.some(f=>f.id===id));
 assert(!((await call('catalog',null,a)).data.catalog.some(f=>f.id===id)));
 await call('admin/fighter',{...payload,id,published:true},admin);assert((await call('catalog',null,a)).data.catalog.some(f=>f.id===id));
 const created=await call('room/create',{mode:'gems',private:false},a);assert.equal(created.statusCode,200);const code=created.data.room.code;
 assert.equal((await call('room/join',{code},b)).data.room.players.length,2);
 assert.equal((await call('room/start',{code},b)).statusCode,403);
 const running=await call('room/start',{code},a);assert.equal(running.data.room.actors.length,6);assert.equal(running.data.room.phase,'playing');
 const initial=running.data.room.actors[0];const input=await call('room/input',{code,seq:1,dx:999,dy:-999,x:999,hp:999999,fire:true,angle:0},a);const actor=input.data.room.actors[0];assert.equal(actor.maxHp,initial.maxHp);assert.equal(actor.input.dx,1);assert.equal(actor.input.dy,-1);assert(actor.x<760);
 assert.equal((await call('status',null,a)).data.progress.stats.matches,0);
 const db=await database();const row=(await db.query('SELECT data FROM stars_rooms WHERE code=$1',[code]))[0];const room=JSON.parse(row.data);room.time=.01;room.score=[11,0];await db.query('UPDATE stars_rooms SET data=$1 WHERE code=$2',[JSON.stringify(room),code]);
 await new Promise(r=>setTimeout(r,30));const ended=await call('room/state',{code},a);assert.equal(ended.data.room.phase,'finished');assert.equal(ended.data.progress.stats.matches,1);const coins=ended.data.progress.wallet.coins;
 const again=await call('room/state',{code},a);assert.equal(again.data.progress.wallet.coins,coins);assert.equal(again.data.progress.stats.matches,1);
 assert.equal((await call('status',null,b)).data.progress.stats.matches,1);
 await call('admin/maintenance',{maintenance:true,message:'Test Wartung'},admin,'PATCH');assert.equal((await call('room/create',{},a)).statusCode,503);assert.equal((await call('room/create',{},admin)).statusCode,200);
 await call('admin/maintenance',{maintenance:false},admin,'PATCH');await call('admin/block',{username:'bob',blocked:true,reason:'test'},admin,'PATCH');assert.equal((await call('action',{action:'daily'},b)).statusCode,403);
 const oldAdminCookie=admin.cookie;assert.equal((await call('logout',{},admin)).statusCode,200);assert.equal((await call('status',null,admin)).data.user,null);
 assert.equal((await call('admin/fighter',payload,admin)).statusCode,401);
 assert.equal((await call('admin/fighter',payload,{cookie:oldAdminCookie})).statusCode,401);
 assert.equal((await call('login',{username:'admin',password:'1234'},admin)).statusCode,200);
 assert((await call('catalog',null,admin)).data.catalog.some(f=>f.id===id));
});
test('combat damage, ammunition, level stats and stale input rejection',()=>{
 const r={players:[{username:'a',id:'lex',team:0,level:3},{username:'b',id:'lex',team:1}],mode:'gems'};beginRoom(r,BASE,1000);assert.equal(r.actors[0].maxHp,5280);const [a,b]=r.actors;a.x=380;a.y=600;b.x=380;b.y=760;r.walls=[];for(const c of r.actors.slice(2)){c.dead=true;c.respawn=999}applyInput(r,'a',{seq:5,dx:0,dy:0,angle:Math.PI/2,fire:true},1000);applyInput(r,'a',{seq:4,dx:1,dy:1},1000);assert.equal(a.input.dx,0);tick(r,1450);assert(b.hp<b.maxHp);assert(a.ammo<3);assert(a.charge>0);
});

test('guests play without credentials, resume progress and cannot administer or bypass maintenance',async()=>{
 const guest={},admin={};
 const entered=await call('guest',{},guest);assert.equal(entered.statusCode,200);
 assert.equal(entered.data.user.role,'guest');assert.equal(entered.data.progress.name,'Gast');
 assert.equal(entered.data.progress.wallet.coins,500);assert.deepEqual(entered.data.progress.collection.brawlers,['lex']);
 assert.equal((await call('action',{action:'daily'},guest)).statusCode,200);
 const resumed=await call('guest',{},guest);assert.equal(resumed.data.user.name,entered.data.user.name);assert.equal(resumed.data.progress.wallet.coins,600);
 assert.equal((await call('admin/fighter',{name:'Forbidden'},guest)).statusCode,403);
 const created=await call('room/create',{mode:'showdown',private:true},guest);assert.equal(created.statusCode,200);
 assert.equal((await call('room/start',{code:created.data.room.code},guest)).data.room.phase,'playing');
 await call('login',{username:'admin',password:'1234'},admin);
 await call('admin/maintenance',{maintenance:true},admin,'PATCH');
 assert.equal((await call('guest',{},{})).statusCode,503);assert.equal((await call('guest',{},guest)).statusCode,503);
 await call('admin/maintenance',{maintenance:false},admin,'PATCH');
 await call('logout',{},guest);assert.equal((await call('status',null,guest)).data.user,null);
});

test('custom maps are admin-only, published centrally, and used by real matches',async()=>{
 const admin={},player={};await call('login',{username:'admin',password:'1234'},admin);await call('register',{username:'MapTester',password:'test1234'},player);
 assert.equal((await call('catalog',null,player)).data.catalog.find(f=>f.id==='lex').name,'Hamza. S.');
 const payload={name:'Hamzas Arena',theme:'night',duration:45,hazardDamage:300,published:false,cells:[{x:80,y:320,type:'wall'},{x:480,y:960,type:'lava'},{x:600,y:400,type:'bush'}]};
 assert.equal((await call('admin/map',payload,player)).statusCode,403);
 assert.equal((await call('admin/map',{...payload,cells:[{x:160,y:120,type:'wall'}]},admin)).statusCode,400);
 const saved=await call('admin/map',payload,admin);assert.equal(saved.statusCode,200);const mapId=saved.data.map.id;
 assert(!(await call('maps',null,player)).data.maps.some(m=>m.id===mapId));assert.equal((await call('room/create',{mapId},player)).statusCode,404);
 await call('admin/map',{...payload,id:mapId,published:true},admin);assert((await call('maps',null,player)).data.maps.some(m=>m.id===mapId));
 const created=await call('room/create',{mapId,mode:'showdown'},player);assert.equal(created.data.room.map.name,payload.name);
 const running=(await call('room/start',{code:created.data.room.code},player)).data.room;assert.equal(running.time,45);assert.deepEqual(running.walls,[{x:80,y:320,w:40,h:40}]);assert.equal(running.hazards.length,1);assert.equal(running.bushes.length,1);
 const actor=running.actors[0];for(const bot of running.actors.slice(1)){bot.dead=true;bot.respawn=999}running.mode='control';actor.x=500;actor.y=980;actor.lastSeen=running.lastTick;const hp=actor.hp;tick(running,running.lastTick+500);assert(actor.hp<hp-140);
});

test('designer projectile counts and colors reach the combat simulation',()=>{
 const f={...BASE[0],projectiles:3,superProjectiles:5,projectileColor:'#ef3488'},room={players:[{username:'designer',id:f.id,team:0}],mode:'control'};
 beginRoom(room,[f],1000);room.walls=[];for(const bot of room.actors.slice(1)){bot.dead=true;bot.respawn=999}const a=room.actors[0];a.x=380;a.y=600;
 applyInput(room,'designer',{seq:1,dx:0,dy:0,angle:0,fire:true},1000);tick(room,1040);assert.equal(room.bullets.length,3);assert(room.bullets.every(b=>b.color==='#ef3488'));
 a.cool=0;a.charge=100;applyInput(room,'designer',{seq:2,dx:0,dy:0,angle:0,super:true},1040);tick(room,1080);assert.equal(room.bullets.filter(b=>b.super).length,5);assert.equal(a.charge,0);
});

test('AI workshop is admin-only, validates drafts, shares provider settings and saves cosmetic skins',async()=>{
 const admin={},guest={};await call('login',{username:'admin',password:'1234'},admin);await call('guest',{},guest);
 assert.equal((await call('admin/ai',{kind:'map',prompt:'Ein Wald-Spielfeld'},guest)).statusCode,403);
 const oldFetch=global.fetch,oldKey=process.env.OPENAI_API_KEY,oldGemini=process.env.GEMINI_API_KEY;process.env.OPENAI_API_KEY='test-only';delete process.env.GEMINI_API_KEY;let response={name:'Eis-Held',hp:999999,damage:1200,design:{outfit:'#55aaff',hat:'crown'}};
 global.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(options.body).model,process.env.OPENAI_MODEL||'gpt-4.1-mini');return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify(response)}]}]})}};
 try{
  const d=await call('admin/ai',{kind:'brawler',prompt:'Ein Eis-Held mit Krone'},admin);assert.equal(d.statusCode,200);assert.equal(d.data.draft.hp,20000);assert.equal(d.data.draft.published,false);assert.equal(d.data.draft.design.hat,'crown');
  response={name:'Wald',cells:[{x:80,y:240,type:'wall'},{x:80,y:240,type:'wall'},{x:240,y:640,type:'lava'},{x:9,y:240,type:'wall'}]};const m=await call('admin/ai',{kind:'map',prompt:'Ein Wald mit Lava'},admin);assert.equal(m.statusCode,200);assert.equal(m.data.draft.cells.length,1);
  const skin=await call('admin/skin',{name:'Eis-Outfit',image:'data:image/png;base64,YWJj',cost:50,published:false},admin);assert.equal(skin.statusCode,200);const id=skin.data.skin.id;assert(!(await call('skins',null,guest)).data.skins.some(s=>s.id===id));assert.equal((await call('action',{action:'skin',id},guest)).statusCode,404);
  await call('admin/skin',{...skin.data.skin,published:true},admin);assert.equal((await call('action',{action:'skin',id},guest)).statusCode,409);const applied=await call('action',{action:'skin',id},admin);assert.equal(applied.data.progress.views.skin,id);const room=await call('room/create',{private:true},admin);const started=await call('room/start',{code:room.data.room.code},admin);assert.equal(started.data.room.actors[0].skinId,id);
  response={name:'Unbrauchbar',cells:[]};assert.equal((await call('admin/ai',{kind:'map',prompt:'Ein leeres Feld'},admin)).statusCode,502);
 }finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldGemini!==undefined)process.env.GEMINI_API_KEY=oldGemini}
});

test('Showdown has ten separate spawns, normal movement and editable healing/dash supers',()=>{
 const r={players:[{username:'test',id:'lex',team:0}],mode:'showdown'};beginRoom(r,BASE,1000);assert.equal(r.actors.length,10);assert.equal(new Set(r.actors.map(a=>a.x+':'+a.y)).size,10);const a=r.actors[0],x=a.x;applyInput(r,'test',{seq:1,dx:1,dy:0,angle:0},1000);tick(r,1200);assert(a.x>x);a.charge=100;a.superType='heal';a.hp=100;applyInput(r,'test',{seq:2,dx:0,dy:0,super:true},1200);tick(r,1240);assert(a.hp>100);a.cool=0;a.charge=100;a.superType='dash';const before=a.x;applyInput(r,'test',{seq:3,dx:0,dy:0,angle:0,super:true},1240);tick(r,1280);assert(a.x>before);
});
test('admin deletes a brawler and player selection safely returns to starter',async()=>{const admin={};await call('login',{username:'admin',password:'1234'},admin);const saved=await call('admin/fighter',{name:'Delete me',hp:4000,damage:1000,published:true},admin);const id=saved.data.fighter.id;await call('action',{action:'select',id},admin);assert.equal((await call('admin/fighter/delete',{id},admin)).statusCode,200);assert(!(await call('catalog',null,admin)).data.catalog.some(f=>f.id===id));assert.equal((await call('status',null,admin)).data.progress.fighters.selected,'lex');assert.equal((await call('admin/fighter/delete',{id:'lex'},admin)).statusCode,400)});
test('ten real players fit a Showdown room; the eleventh is rejected',async()=>{const host={};await call('guest',{},host);const room=await call('room/create',{mode:'showdown'},host),code=room.data.room.code;for(let i=0;i<9;i++){const guest={};await call('guest',{},guest);assert.equal((await call('room/join',{code},guest)).statusCode,200)}const extra={};await call('guest',{},extra);assert.equal((await call('room/join',{code},extra)).statusCode,409);const started=await call('room/start',{code},host);assert.equal(started.data.room.actors.length,10);assert(started.data.room.actors.every(a=>!a.bot))});
test('browser timestamp sequences keep updating movement instead of freezing after first request',()=>{const room={players:[{username:'a',id:'lex',team:0}],mode:'showdown'};beginRoom(room,BASE,1000);const t=Date.now();applyInput(room,'a',{seq:t,dx:1,dy:0},1000);applyInput(room,'a',{seq:t+1,dx:0,dy:-1},1100);assert.equal(room.actors[0].lastSeq,t+1);assert.equal(room.actors[0].input.dy,-1);applyInput(room,'a',{seq:t,dx:-1},1200);assert.equal(room.actors[0].input.dy,-1)});
test('photo-to-brawler endpoint requires admin and sends a transparent image edit without exposing the key',async()=>{const admin={},guest={};await call('login',{username:'admin',password:'1234'},admin);await call('guest',{},guest);assert.equal((await call('admin/image',{image:'data:image/png;base64,YWJj'},guest)).statusCode,403);const oldFetch=global.fetch,oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-private';global.fetch=async(url,opts)=>{assert.equal(url,'https://api.openai.com/v1/images/edits');assert.equal(opts.body.get('background'),'transparent');assert.equal(opts.body.get('output_format'),'webp');assert.match(opts.body.get('prompt'),/3D-styled/);return {ok:true,json:async()=>({data:[{b64_json:'YWJj'}]})}};try{const result=await call('admin/image',{image:'data:image/png;base64,YWJj',prompt:'Eis-Handschuhe'},admin);assert.equal(result.statusCode,200);assert.equal(result.data.image,'data:image/webp;base64,YWJj');assert(!JSON.stringify(result.data).includes('test-private'))}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey}});
