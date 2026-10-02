import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {advanceDvd,createDvdScreensaver} from '../waiting-games.js';

test('DVD fallback remains inside the screen for an hour and changes color',()=>{
 const s={x:35,y:80,vx:110,vy:83,color:0};let colors=new Set();
 for(let n=0;n<216000;n++){advanceDvd(s,1/60);assert(s.x>=0&&s.x<=600);assert(s.y>=0&&s.y<=341);colors.add(s.color)}
 assert.equal(colors.size,6);
});
test('DVD draws immediately without media, pauses when hidden, resumes and cleans up',async()=>{
 const old={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};let frames=new Map(),seq=0;const nodes=[];const listeners=new Map();
 globalThis.requestAnimationFrame=fn=>{frames.set(++seq,fn);return seq};globalThis.cancelAnimationFrame=id=>frames.delete(id);
 globalThis.document={hidden:false,addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k),createElement(tag){const node={style:{},setAttribute(){},addEventListener(){},removeAttribute(){},load(){},pause(){},play:()=>Promise.reject(Error('autoplay blocked')),getContext:()=>new Proxy({},{get:()=>()=>{}})};nodes.push(node);return node}};
 try{const clean=createDvdScreensaver({append(){}});assert.equal(nodes.length,1);assert.equal(nodes[0].style.display,'block');assert.equal(frames.size,1);globalThis.document.hidden=true;listeners.get('visibilitychange')();assert.equal(frames.size,0);globalThis.document.hidden=false;listeners.get('visibilitychange')();assert.equal(frames.size,1);clean();assert.equal(frames.size,0);assert.equal(listeners.size,0)}finally{Object.assign(globalThis,old)}
});
test('Memory matches all pairs, rejects repeat clicks, and restarts cleanly',()=>{
 function element(){return{children:[],textContent:'',classList:{add(){},remove(){}},setAttribute(){},append(...n){this.children.push(...n)},replaceChildren(){this.children=[]}}}
 const context={document:{createElement:element},setTimeout:()=>1,clearTimeout(){},Math};vm.createContext(context);
 const script=readFileSync(new URL('../app.js',import.meta.url),'utf8'),start=script.indexOf('function startMemory(root)'),end=script.indexOf('\nconst starsNavigation',start);vm.runInContext('let gameCleanup=()=>{};'+script.slice(start,end),context);
 const root=element();context.root=root;vm.runInContext('startMemory(root)',context);assert.equal(root.children[1].children.length,16);
 // Keep the shuffle deterministic, so every two consecutive cards are a pair.
 context.Math=Object.create(Math);context.Math.random=()=>.999999;vm.runInContext('startMemory(root)',context);const cards=root.children[1].children;
 for(let i=0;i<16;i+=2){cards[i].onclick({stopPropagation(){}});cards[i].onclick({stopPropagation(){}});cards[i+1].onclick({stopPropagation(){}});assert(cards[i].disabled&&cards[i+1].disabled)}
 assert.match(root.children[0].textContent,/8\/8 Paare · 8 Züge/);root.children[2].onclick({stopPropagation(){}});assert.match(root.children[0].textContent,/0\/8 Paare · 0 Züge/);assert.equal(root.children[1].children.length,16);
});
test('maintenance quizzes render all difficulty levels and reaction timer stays short',()=>{
 const nodes=new Map();let timer;function node(){return{children:[],className:'',style:{},value:'',disabled:false,append(b){this.children.push(b)},querySelector(s){if(!this.parts)this.parts=new Map();if(!this.parts.has(s))this.parts.set(s,node());return this.parts.get(s)}}}
 const context={document:{createElement:node},$:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s)},safe:x=>String(x),gameLabels:{math:'Mathe',vocab:'Vokabeln',logic:'Logik',reaction:'Reaktion'},setTimeout:(fn,ms)=>{timer={fn,ms};return 1},clearTimeout(){timer=null},performance:{now:()=>100},Math};vm.createContext(context);const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');vm.runInContext('let gameCleanup=()=>{};'+source.slice(source.indexOf('function startGame(kind)'),source.indexOf('\nsetInterval(async()=>{try{')),context);
 for(const level of [5,7,9])for(const kind of ['math','vocab','logic']){context.$('#gameLevel').value=String(level);vm.runInContext('startGame('+JSON.stringify(kind)+')',context);const form=context.$('#gameAnswer');form.querySelector('button').disabled=false;form.querySelector('input').value='wrong';form.onsubmit({preventDefault(){}});assert.match(context.$('#gameFeedback').textContent,/Richtige Antwort:/);assert.equal(form.querySelector('button').disabled,true)}
 vm.runInContext("startGame('reaction')",context);const button=context.$('#reactionTarget');button.onclick();assert(timer.ms>=500&&timer.ms<=1500);timer.fn();assert.equal(button.textContent,'JETZT klicken!');button.onclick();assert.match(button.textContent,/ms – erneut starten/);
});
