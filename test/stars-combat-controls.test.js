import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as engine from '../lib/stars-game.js';

test('combat: keyboard movement, short touch attacks, cancellation, training and lobby exit',async()=>{
 const nodes=new Map(),inputs=[],frames=[];let now=10000,lastRoom;
 const paint=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(obj,key)=>obj[key]||(()=>{})});
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',style:{},innerHTML:'',clientWidth:844,clientHeight:390,width:0,height:0,isConnected:true,disabled:false,classList:{add(){},remove(){}},focus(){this.focused=true},setPointerCapture(){},getContext:()=>paint,toDataURL:()=> 'data:image/webp;base64,figure',addEventListener(){}});return nodes.get(id)};
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
 c.document.onkeydown({key:'d',preventDefault(){}});now+=100;frames.pop()();await Promise.resolve();assert.ok(me.x>x);
 c.document.onkeyup({key:'d'});
 const pointer={pointerId:2,preventDefault(){}};node('battleFire').onpointerdown(pointer);node('battleFire').onpointerup(pointer);now+=100;frames.pop()();await Promise.resolve();
 assert.equal(inputs.at(-1).fire,true,'A short tap must survive until the next update');assert.ok(me.ammo<3);
 now+=100;frames.pop()();await Promise.resolve();assert.equal(inputs.at(-1).fire,false,'A released attack must not stick');
 dirs[0].onpointerdown(pointer);dirs[0].onpointercancel(pointer);now+=100;frames.pop()();await Promise.resolve();assert.equal(inputs.at(-1).dy,0);
 await node('battleLeave').onclick();assert.equal(c.current,'home');assert.equal(c.document.onkeydown,null);const count=inputs.length;frames.pop()();await Promise.resolve();assert.equal(inputs.length,count,'Exited matches must stop ticking');
});
