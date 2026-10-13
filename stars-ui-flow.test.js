import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as engine from '../lib/stars-game.js';

test('UI bridge restores a guest, opens four-tap server drops and retains combat range',async()=>{
 const nodes=new Map(),toasts=[],calls=[];const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',style:{},classList:{add(){},remove(){}},addEventListener(){},isConnected:true});return nodes.get(id)};
 const progress=engine.fresh('Gast');let reveal;
 const context={Image:class{},console,AbortSignal,Promise,crypto:{randomUUID:()=> 'test-operation-12345'},location:{protocol:'http:'},window:{addEventListener(){}},document:{addEventListener(){}},$:node,$$:()=>[],state:{session:{admin:true},stats:{},quests:{},friends:[],skins:{},activeSkin:{}},save(){},renderHud(){},renderPage(){},current:'home',toast:m=>toasts.push(m),BRAWLER_ART:{hamza:'sprite'},MODES:[],actionLock:false,engine,escapeHtml:x=>String(x),clearTimeout,cancelAnimationFrame(){},requestAnimationFrame(){return 1},setTimeout,
 fetch:async(url,options)=>{const path=url.split('/api/stars/')[1];calls.push({path,body:options.body?JSON.parse(options.body):undefined});let data={};if(path==='status')data={user:{name:'gast_test',role:'guest'},progress};if(path==='catalog')data={catalog:engine.BASE};if(path==='maps')data={maps:[]};if(path==='skins')data={skins:[]};if(path==='action')data={progress,result:{rarity:'EPISCH',coins:100,power:20,credits:30,gems:0}};return {ok:true,json:async()=>data}},showReveal:(kind,batches)=>{reveal={kind,batches}}
 };
 for(const name of ['allBrawlers','brawlerArt','selectBrawler','upgradeBrawler','buy','claimDaily','openRewards','claimQuest','claimPass','claimPath','wireLogin','wireProfile','wirePlay','startMatch','renderMatch','adminPage','wireAdmin','wireMapEditor','passPage','questsPage','dailyPage','skinsPage','buySkin','playPage','today','go'])context[name]=()=>[];
 vm.createContext(context);
 const code=readFileSync(new URL('../stars-runtime.js',import.meta.url),'utf8').replace("import('./lib/stars-game.js')",'Promise.resolve(engine)');vm.runInContext(code,context);
 await new Promise(resolve=>setTimeout(resolve,30));assert.equal(context.state.session.admin,false);assert.equal(context.state.coins,1500);assert.equal(toasts.length,0);
 const fighter=vm.runInContext('allBrawlers()[0]',context);assert.equal(fighter.combatRange,420);assert.equal(fighter.range,5);
 vm.runInContext("openRewards('drop',1)",context);await new Promise(resolve=>setTimeout(resolve,30));assert.equal(reveal.batches[0].serverAwarded,true);assert.equal(reveal.batches[0].items[0].value,100);assert.equal(context.actionLock,true);assert.ok(calls.find(c=>c.path==='action').body.requestId);
 const html=readFileSync(new URL('../stars-embedded.html',import.meta.url),'utf8');assert.match(html,/if\(!batch.serverAwarded\)/);assert.match(html,/if\(taps===4\)/);assert.match(html,/id="stars-runtime-bundle"/);assert.match(html,/const StarsCombatEngine=/);assert.match(html,/const StarsCombatAtlas=/);
});
