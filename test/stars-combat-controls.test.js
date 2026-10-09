import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as engine from '../lib/stars-game.js';

test('combat: keyboard movement, short touch attacks, cancellation, training and lobby exit',async()=>{
 const nodes=new Map(),inputs=[],frames=[];let now=10000,lastRoom;
 const paint=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(obj,key)=>obj[key]||(()=>{})});
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',style:{},innerHTML:'',clientWidth:844,clientHeight:390,width:0,height:0,isConnected:true,disabled:false,classList:{add(){},remove(){}},focus(){this.focused=true},getBoundingClientRect(){return {left:0,top:0,width:112,height:112}},setPointerCapture(){},getContext:()=>paint,toDataURL:()=> 'data:image/webp;base64,figure',addEventListener(){}});return nodes.get(id)};
 const dirs=['up','left','down','right'].map(dir=>Object.assign(node(dir),{dataset:{dir}}));
 const wrapped={...engine,applyInput(room,name,input,time){lastRoom=room;inputs.push(input);engine.applyInput(room,name,input,time)}};
 const progress=engine.fresh('Gast');const c={console,AbortSignal,Promise,crypto:{randomUUID:()=> 'test-op-12345'},Date:class extends Date{static now(){return now}},location:{protocol:'http:'},window:{addEventListener(){}},document:{addEventListener(){},createElement:()=>node('spriteCanvas')},devicePixelRatio:1,Image:class{complete=false;naturalWidth=0},$:id=>node(id.replace(/^#/,'')),$$:selector=>selector==='[data-dir]'?dirs:[],state:{mode:'Showdown',selected:'hamza',session:{},stats:{},quests:{},friends:[],skins:{},activeSkin:{}},save(){},renderHud(){},renderPage(){},current:'home',toast(){},BRAWLER_ART:{hamza:'portrait-card'},MODES:[],actionLock:false,engine:wrapped,escapeHtml:String,clamp:engine.clamp,clearTimeout,cancelAnimationFrame(){},requestAnimationFrame(fn){frames.push(fn);return frames.length},setTimeout,modal(){},closeModal(){},
 fetch:async url=>{const path=url.split('/api/stars/')[1];return {ok:true,json:async()=>path==='status'?{user:{name:'gast_test',role:'guest'},progress}:path==='catalog'?{catalog:engine.BASE}:path==='maps'?{maps:[]}:{skins:[]}}},go(id){c.current=id}
 };
 for(const name of ['allBrawlers','brawlerArt','selectBrawler','upgradeBrawler','buy','claimDaily','openRewards','claimQuest','claimPass','claimPath','wireLogin','wireProfile','wirePlay','startMatch','renderMatch','adminPage','wireAdmin','wireMapEditor','passPage','questsPage','dailyPage','skinsPage','buySkin','playPage','today'])c[name]=()=>[];
 vm.createContext(c);vm.runInContext(readFileSync(new URL('../stars-runtime.js',import.meta.url),'utf8').replace("import('./lib/stars-game.js')",'Promise.resolve(engine)'),c);
 await new Promise(r=>setTimeout(r,10));await vm.runInContext('Stars.startLocal()',c);await Promise.resolve();
 assert.equal(c.current,'match');assert.equal(lastRoom.actors.length,10);assert.ok(node('battleCanvas').focused);
 const me=lastRoom.actors[0],x=me.x;
 c.document.onkeydown({key:'Unidentified',code:'KeyD',preventDefault(){}});now+=100;frames.pop()();await Promise.resolve();assert.ok(me.x>x);
 c.document.onkeyup({key:'Unidentified',code:'KeyD'});
 c.document.onkeydown({key:' ',code:'Space',repeat:false,preventDefault(){}});c.document.onkeyup({key:' ',code:'Space'});now+=100;frames.pop()();await Promise.resolve();assert.equal(inputs.at(-1).fire,true,'Fast keyboard taps must survive until the simulation consumes them');
 const pointer={pointerId:2,preventDefault(){}};node('battleFire').onpointerdown(pointer);node('battleFire').onpointerup(pointer);now+=100;frames.pop()();await Promise.resolve();
 assert.equal(inputs.at(-1).fire,true,'A short tap must survive until the next update');assert.ok(me.ammo<3);
 now+=100;frames.pop()();await Promise.resolve();assert.equal(inputs.at(-1).fire,false,'A released attack must not stick');
 const stick=node('battleStick');stick.onpointerdown({pointerId:3,clientX:95,clientY:56,preventDefault(){}});now+=100;frames.pop()();await Promise.resolve();assert.ok(inputs.at(-1).dx>.9);assert.equal(inputs.at(-1).dy,0);stick.onpointercancel({pointerId:3});
 const aimPointer={pointerId:4,clientX:10,clientY:10,preventDefault(){}};node('battleFire').onpointerdown(aimPointer);node('battleFire').onpointermove({...aimPointer,clientX:60});now+=100;frames.pop()();await Promise.resolve();assert.equal(inputs.at(-1).fire,false,'Dragging aims without prematurely firing');node('battleFire').onpointerup({...aimPointer,clientX:60});now+=100;frames.pop()();await Promise.resolve();assert.equal(inputs.at(-1).fire,true);assert.equal(inputs.at(-1).angle,0,'Released shot retains the chosen direction');
 node('battleSuper').onpointerdown({...aimPointer,pointerId:5});node('battleSuper').onpointercancel({pointerId:5});now+=100;frames.pop()();await Promise.resolve();assert.equal(inputs.at(-1).super,false,'Cancelled super does not fire');
 dirs[0].onpointerdown(pointer);dirs[0].onpointercancel(pointer);now+=100;frames.pop()();await Promise.resolve();assert.equal(inputs.at(-1).dy,0);
 await node('battleLeave').onclick();assert.equal(c.current,'home');assert.equal(c.document.onkeydown,null);const count=inputs.length;frames.pop()();await Promise.resolve();assert.equal(inputs.length,count,'Exited matches must stop ticking');
});

test('shipped game bundles its exact controls, engine and matching sprite atlas',()=>{
 const html=readFileSync(new URL('../stars-embedded.html',import.meta.url),'utf8');
 const runtime=html.match(/<script id="stars-runtime-bundle">([\s\S]*?)<\/script>/)[1];
 assert.equal(runtime,readFileSync(new URL('../stars-runtime.js',import.meta.url),'utf8'));
 const bundled=html.match(/<script id="stars-combat-engine">([\s\S]*?)<\/script>/)[1];const c={};vm.createContext(c);vm.runInContext(bundled,c);
 vm.runInContext("globalThis.room={mode:'showdown',players:[{username:'test',id:'lex',team:0}]};StarsCombatEngine.beginRoom(room,StarsCombatEngine.BASE,10000);StarsCombatEngine.applyInput(room,'test',{seq:1,dx:1,dy:0,fire:true,angle:0},10000);StarsCombatEngine.tick(room,10100)",c);
 assert.equal(c.room.actors.length,10);assert.ok(c.room.actors[0].x>120);assert.ok(c.room.bullets.length);
 assert.match(bundled,/const StarsCombatAtlas="assets\/combat-brawlers-v1\.png"/);
 assert.ok(readFileSync(new URL("../assets/combat-brawlers-v1.png",import.meta.url)).length>100000);
});


test('3D renderer emits spatial, lit meshes for ten fighters and falls back without WebGL',()=>{
 const source=readFileSync(new URL('../stars-renderer3d.js',import.meta.url),'utf8');const html=readFileSync(new URL('../stars-embedded.html',import.meta.url),'utf8');assert.equal(html.match(/<script id="stars-renderer3d">([\s\S]*?)<\/script>/)[1],source);
 const buffers=[];let drawCount=0;const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,bufferData:(target,data)=>buffers.push(data),drawArrays:(mode,start,count)=>drawCount=count},{get:(obj,key)=>obj[key]||(()=>({}))});const c={};vm.createContext(c);vm.runInContext(source,c);assert.equal(c.createStars3D({getContext:()=>null}),null);const renderer=c.createStars3D({getContext:()=>gl});const room={mode:'showdown',players:[{username:'tester',id:'lex',team:0}]};engine.beginRoom(room,engine.BASE,10000);const view=renderer.draw(room,room.actors[0],{},engine.BASE,1,10000,844,390,1);assert.equal(view.tilt,.72);assert.ok(drawCount>1000);assert.ok(buffers[0].every(Number.isFinite));const depths=[];for(let i=2;i<buffers[0].length;i+=9)depths.push(buffers[0][i]);assert.ok(Math.max(...depths)>=80);assert.ok(Math.min(...depths)<0);renderer.dispose();
});
