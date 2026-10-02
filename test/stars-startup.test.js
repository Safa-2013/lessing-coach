import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../lessing-stars/release.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function finishAccessCheck(){'),source.indexOf('initializeStars();'));
function context(data){const nodes=new Map(),events=[];let loading=true;const $=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:''});return nodes.get(id)};$('#starsStartup').hidden=false;const ctx={$ ,document:{documentElement:{removeAttribute(){loading=false;events.push('shown')}}},restoredStarsAccount:async()=>data,releaseUser:null,releaseReady:false,accountKey:'guest',accounts:{},freshProgress:()=>({}),syncProgress(){},applyStatus(){events.push('maintenance')},loadCatalog:async()=>{events.push('catalog')},acceptAccount(){},URL,location:{href:'http://localhost/lessing-stars/spiel.html'},netBanner:{},toast(){}};vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,$,events,isLoading:()=>loading}}
test('maintenance renders before catalog and does not wait for a second request',async()=>{const c=context({maintenance:true,user:null});await vm.runInContext('initializeStars()',c.ctx);assert.equal(c.events[0],'maintenance');assert.equal(c.events[1],'shown');assert(!c.events.includes('catalog'));assert.equal(c.isLoading(),false);assert.equal(c.ctx.releaseReady,true)});
test('failed access check never reveals the lobby and offers retry',async()=>{const c=context({});c.ctx.restoredStarsAccount=async()=>{throw Error('Offline')};await vm.runInContext('initializeStars()',c.ctx);assert.equal(c.isLoading(),true);assert.equal(c.$('#starsStartup').hidden,false);assert.equal(c.$('#starsStartupRetry').hidden,false);assert.match(c.$('#starsStartupMessage').textContent,/nicht erreichbar/)});
test('catalog denial does not trap guests behind the server-error screen',async()=>{const c=context({maintenance:false,user:null});c.ctx.loadCatalog=async()=>{throw Error('Bitte anmelden')};await vm.runInContext('initializeStars()',c.ctx);assert.equal(c.isLoading(),false);assert.equal(c.$('#starsStartup').hidden,true);assert.equal(c.ctx.releaseReady,true);assert.equal(c.ctx.accountKey,'guest');assert.match(c.ctx.netBanner.textContent,/BRAWLER-LISTE/)});

test('expired sessions clear privileged UI and allow continuing as a guest without a login prompt',async()=>{
 const code=source.slice(source.indexOf('async function refreshStarsStatus(){'),source.indexOf('setInterval(()=>refreshStarsStatus()'));
 for(const role of ['admin','guest']){
  const events=[],ctx={releaseUser:{name:'tester',role},accountKey:'tester',accounts:{},starsRequest:async()=>({user:null,maintenance:true}),registeredPlayer:()=>role!=='guest',stopOnline(){events.push('stop')},freshProgress:name=>({name}),syncProgress(){events.push('sync')},returnLobby(){events.push('lobby')},applyStatus(){assert.equal(ctx.releaseUser,null);events.push('status')},toast(){events.push('toast')}};
  vm.createContext(ctx);vm.runInContext(code,ctx);await vm.runInContext('refreshStarsStatus()',ctx);
  assert.equal(ctx.accountKey,'guest');assert.equal(ctx.accounts.guest.progress.name,'Gast');assert(events.indexOf('sync')<events.indexOf('status'));assert(events.includes('lobby'));assert.equal(events.includes('toast'),role!=='guest');
 }
});
