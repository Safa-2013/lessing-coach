import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {database} from '../lib/db.js';
import starsApi from '../lib/stars-api.js';
import {BASE,beginRoom,applyInput,tick} from '../lib/stars-game.js';

process.chdir(mkdtempSync(join(tmpdir(),'lessing-stars-')));
delete process.env.DATABASE_URL;
process.env.STARS_ADMIN_PASSWORD='test-admin-password';
async function call(path,body,cookie='',method=body?'POST':'GET'){
 const db=await database();const res={headers:{},setHeader(k,v){this.headers[k]=v},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers)},end(text){this.data=JSON.parse(text)}};
 await starsApi({method,body,headers:{host:'localhost',cookie}},res,db,'/stars/'+path);
 return {status:res.status,data:res.data,cookie:res.headers['Set-Cookie']?.split(';')[0]||cookie};
}
test('transactions roll back and serialize concurrent resource updates',async()=>{
 const db=await database();await db.query('CREATE TABLE counters(id TEXT PRIMARY KEY, value INTEGER)');await db.query('INSERT INTO counters VALUES($1,$2)',['n',0]);
 await assert.rejects(db.transaction(async tx=>{await tx.query('UPDATE counters SET value=99');throw Error('rollback')}));
 assert.equal((await db.query('SELECT value FROM counters'))[0].value,0);
 await Promise.all(Array.from({length:12},()=>db.transaction(async tx=>{const value=(await tx.query('SELECT value FROM counters'))[0].value;await tx.query('UPDATE counters SET value=$1',[value+1])})));
 assert.equal((await db.query('SELECT value FROM counters'))[0].value,12);
});
test('guest, admin, grants, catalog, drops, multiplayer and maintenance',async()=>{
 const guest=await call('guest',{});assert.equal(guest.status,200);assert.equal(guest.data.user.role,'guest');assert.equal(guest.data.progress.wallet.coins,1500);assert.equal(guest.data.progress.wallet.power,1000);assert.equal(guest.data.progress.wallet.gems,100);assert.deepEqual(guest.data.progress.collection.brawlers,['lex']);
 assert.equal((await call('admin/accounts',undefined,guest.cookie)).status,403);
 const admin=await call('login',{username:'admin',password:'test-admin-password'});assert.equal(admin.status,200);
 assert.equal((await call('admin/account/create',{username:'spieler',password:'abcdef'},admin.cookie)).status,200);
 const player=await call('login',{username:'spieler',password:'abcdef'});assert.equal(player.status,200);
 const grant={username:'spieler',amounts:{coins:200,power:100},requestId:'grant-integration-001'};
 assert.equal((await call('admin/account/grant',grant,admin.cookie)).data.progress.wallet.coins,1700);
 assert.equal((await call('admin/account/grant',grant,admin.cookie)).data.progress.wallet.coins,1700);
 assert.equal((await call('admin/account/grant',{...grant,amounts:{coins:999}},admin.cookie)).status,409);
 const fighter=await call('admin/fighter',{name:'Test Brawler',hp:4000,damage:900,range:420,speed:190,reload:1,superDamage:2000,cost:100,published:true},admin.cookie);assert.equal(fighter.status,200);
 assert.ok((await call('catalog')).data.catalog.some(f=>f.name==='Test Brawler'));
 const upgraded=await call('action',{action:'upgrade',id:'lex'},player.cookie);assert.equal(upgraded.data.progress.fighters.levels.lex,2);assert.equal(upgraded.data.progress.wallet.coins,1300);
 const before=upgraded.data.progress.collection.ldrop;
 const dropBody={action:'opendrop',type:'ldrop',requestId:'drop-integration-001'};
 const drop=await call('action',dropBody,player.cookie);assert.equal(drop.status,200);assert.equal(drop.data.progress.collection.ldrop,before-1);assert.ok(drop.data.result.coins>0);
 const repeated=await call('action',dropBody,player.cookie);assert.equal(repeated.data.progress.wallet.coins,drop.data.progress.wallet.coins);assert.equal(repeated.data.progress.collection.ldrop,before-1);assert.deepEqual(repeated.data.result,drop.data.result);
 assert.equal((await call('action',{action:'daily'},player.cookie)).status,200);assert.equal((await call('action',{action:'daily'},player.cookie)).status,409);
 const created=await call('room/create',{mode:'showdown',private:true},player.cookie);assert.equal(created.status,200);const code=created.data.room.code;
 const joined=await call('room/join',{code},guest.cookie);assert.equal(joined.data.room.players.length,2);
 assert.equal((await call('room/start',{code},guest.cookie)).status,403);
 const started=await call('room/start',{code},player.cookie);assert.equal(started.status,200);assert.equal(started.data.room.actors.length,10);
 const beforeX=started.data.room.actors.find(a=>a.username==='spieler').x;
 await new Promise(r=>setTimeout(r,35));
 const moved=await call('room/input',{code,seq:1,dx:1,dy:0,fire:true,angle:0},player.cookie);assert.equal(moved.status,200);const shooter=moved.data.room.actors.find(a=>a.username==='spieler');assert.ok(shooter.x>beforeX,'The first input response must already include movement');assert.ok(shooter.ammo<3,'The first input response must already include the shot');
 const db=await database();const saved=JSON.parse((await db.query('SELECT data FROM stars_rooms WHERE code=$1',[code]))[0].data);saved.time=.001;saved.lastTick=Date.now()-100;await db.query('UPDATE stars_rooms SET data=$1 WHERE code=$2',[JSON.stringify(saved),code]);
 const ended=await call('room/state',{code},player.cookie);assert.equal(ended.data.room.phase,'finished');assert.equal(ended.data.progress.stats.matches,1);
 assert.equal((await call('room/state',{code},player.cookie)).data.progress.stats.matches,1,'A result cannot award twice');
 assert.equal((await call('admin/fighter/delete',{id:fighter.data.fighter.id},admin.cookie)).status,200);
 assert.ok(!(await call('catalog')).data.catalog.some(f=>f.name==='Test Brawler'));
 assert.equal((await call('admin/maintenance',{maintenance:true,message:'Testwartung'},admin.cookie,'PATCH')).status,200);
 assert.equal((await call('action',{action:'daily'},player.cookie)).status,503);
 assert.equal((await call('admin/accounts',undefined,admin.cookie)).status,200);
 await call('admin/maintenance',{maintenance:false},admin.cookie,'PATCH');
 await call('logout',{},player.cookie);assert.equal((await call('status',undefined,player.cookie)).data.user,null);
});
test('six modes, movement, projectiles and collision use the same engine',()=>{
 for(const mode of ['showdown','gems','control','ball','bounty','knockout']){
  const room={mode,players:[{username:'p',id:'lex',team:0}],map:{cells:[],duration:120}};beginRoom(room,BASE,10000);
  assert.equal(room.actors.length,mode==='showdown'?10:6);const me=room.actors[0],x=me.x;
  applyInput(room,'p',{seq:1,dx:1,dy:0,fire:true,angle:0},10000);tick(room,10200);
  assert.ok(me.x>x);assert.ok(room.bullets.some(b=>b.owner==='p'));assert.ok(me.ammo<3);
  assert.ok(room.actors.every(a=>a.hp>0));
 }
 const collision={mode:'showdown',players:[{username:'p',id:'lex',team:0}],map:{cells:[],duration:120}};beginRoom(collision,BASE,10000);const me=collision.actors[0],x=me.x;collision.walls=[{x:x+30,y:me.y-50,w:40,h:100}];applyInput(collision,'p',{seq:1,dx:1,dy:0},10000);tick(collision,10500);assert.ok(me.x<=x+11,'Walls block movement');
 const combat={mode:'showdown',players:[{username:'p',id:'lex',team:0},{username:'q',id:'lina',team:1}],map:{cells:[],duration:120}};beginRoom(combat,BASE,10000);combat.actors=combat.actors.slice(0,2);Object.assign(combat.actors[0],{x:200,y:700});Object.assign(combat.actors[1],{x:350,y:700});const hp=combat.actors[1].hp;applyInput(combat,'p',{seq:1,dx:0,dy:0,fire:true,angle:0},10000);tick(combat,10300);assert.ok(combat.actors[1].hp<hp,'Projectiles damage a target');combat.actors[0].charge=100;applyInput(combat,'p',{seq:2,dx:0,dy:0,super:true,angle:0},10300);tick(combat,10340);assert.equal(combat.actors[0].charge,0);assert.ok(combat.bullets.some(b=>b.super));
});
