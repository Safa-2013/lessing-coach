import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
const stars=fs.readFileSync(new URL('../stars-embedded.html',import.meta.url),'utf8');
test('Safari storage denial and quota do not abort game actions',()=>{
 const code=stars.slice(stars.indexOf('function resilientStorage('),stars.indexOf("const localStorage=resilientStorage"));
 for(const deniedGetter of [false,true]){
  const window={};Object.defineProperty(window,'localStorage',{get(){if(deniedGetter)throw Error('denied');return {getItem(){throw Error('denied')},setItem(){throw Error('quota')},removeItem(){throw Error('denied')}}}});
  const context=vm.createContext({window,Map});vm.runInContext(code,context);
  const storage=context.resilientStorage('localStorage');
  storage.setItem('progress','saved');assert.equal(storage.getItem('progress'),'saved');
  storage.removeItem('progress');assert.equal(storage.getItem('progress'),null);
  assert.equal(window.lessingStorageTemporary,true);
 }
});
test('Startup releases loading screen even when images never finish',()=>{
 const code=stars.slice(stars.indexOf('let bootFinished=false;'),stars.indexOf("if(location.hash.startsWith"));
 let hidden=0,onboarding=0;const tasks=[];
 const context=vm.createContext({$:()=>({classList:{add(name){assert.equal(name,'hide');hidden++}}}),sessionStorage:{getItem(){return null}},onboard(){onboarding++},setTimeout(fn,delay){tasks.push({fn,delay})},preload(){return new Promise(()=>{})}});
 vm.runInContext(code,context);assert.equal(hidden,0);
 assert.equal(tasks[0].delay,1800);tasks[0].fn();context.finishBoot();
 assert.equal(hidden,1);assert.equal(onboarding,1);
});
test('All shipped inline scripts parse',()=>{
 for(const file of ['index.html','stars-embedded.html']){
  const html=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   const module=/type=["']module["']/.test(match[1]);
   if(module){const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:match[2],encoding:'utf8'});assert.equal(result.status,0,result.stderr)}
   else new vm.Script(match[2],{filename:file});
  }
 }
});
