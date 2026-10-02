import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../lessing-stars/studio.js',import.meta.url),'utf8');
test('fullscreen drop awards once and requires four separate taps before revealing rewards',async()=>{
 const nodes=new Map(),timers=[];let awards=0;
 function element(){const classes=new Set();return {classList:{add(k){classes.add(k)},remove(k){classes.delete(k)},contains(k){return classes.has(k)}},style:{setProperty(k,v){this[k]=v}},hidden:false,disabled:false,textContent:'',setAttribute(){},append(){},focus(){},replaceChildren(){}}}
 const $=key=>{if(!nodes.has(key))nodes.set(key,element());return nodes.get(key)};
 const ctx={document:{body:element(),createElement:element,querySelector:()=>$('#main')},$: $,releaseNav:element(),releaseUser:{name:'Tester'},openingDrop:false,collection:{ldrop:1},perform:async()=>{awards++;return {result:{rarity:'EPISCH',coins:100,power:30,credits:100,gems:0}}},extraLogin(){},toast(){},renderMobileShop(){},updateOrientationGate(){},beep(){},activeDrop:'ldrop',setTimeout(fn){timers.push(fn)},window:{addEventListener(){},visualViewport:{addEventListener(){}}}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('// Fullscreen reveal:'),source.indexOf('// Lessing Coach is the host application')),ctx);
 await vm.runInContext("beginDropReveal('ldrop')",ctx);assert.equal(awards,1);assert.equal($('#revealReward').hidden,true);
 for(let i=1;i<=4;i++){const button=$('#revealTap');button.onclick();button.onclick();assert.equal(vm.runInContext('revealTaps',ctx),i);assert.equal($('#revealReward').hidden,i<4);for(const fn of timers.splice(0))fn()}
 assert.equal($('#revealRarity').textContent,'EPISCH');assert.equal($('#revealContinue').hidden,false);assert.equal($('#revealTap').disabled,true);$('#revealTap').onclick();assert.equal(vm.runInContext('revealTaps',ctx),4);assert.equal(awards,1);
 $('#revealContinue').onclick();assert.equal($('#main').inert,false);assert.equal(vm.runInContext("reveal.classList.contains('hidden')",ctx),true);
});
