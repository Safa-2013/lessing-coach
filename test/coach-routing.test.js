import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('complete lobby fits short landscape viewports without vertical scrolling',()=>{
 const source=readFileSync(new URL('../lessing-stars/studio.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function fitCompleteLobby(){'),source.indexOf("window.addEventListener('resize',fitCompleteLobby)"));
 for(const [width,height] of [[844,220],[667,210],[568,180],[1366,768]]){
  const styles={},ctx={window:{visualViewport:{width,height,offsetLeft:0,offsetTop:0}},releaseNav:{getBoundingClientRect:()=>({height:48})},document:{documentElement:{style:{setProperty(k,v){styles[k]=v}}}}};vm.createContext(ctx);vm.runInContext(code+'fitCompleteLobby()',ctx);
  assert.equal(styles['--stars-width'],width+'px');assert.equal(styles['--stars-height'],height-48+'px');assert.equal(styles['--stars-left'],'0px');assert.equal(styles['--stars-top'],'0px');
 }
});
test('Coach is the host home and includes the complete Stars document in its index',()=>{
 const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
 const index=read('index.html');assert(index.includes('<title>Lessing Schulen Coaching</title>'));
 const data=/<script id="coachStarsDocument" type="application\/json">([\s\S]*?)<\/script>/.exec(index);
 const game=Buffer.from(JSON.parse(data[1]),'base64').toString('utf8');assert(game.includes('function initializeStars'));assert(game.includes('lessing-coach-home'));assert(game.includes('<base href="/lessing-stars/">'));assert(!game.includes('stars-entry-guard'));
 assert(index.includes('frame.srcdoc='));assert(!index.includes('iframe src="/lessing-stars/'));
 const config=JSON.parse(read('vercel.json')),routes=config.redirects;assert(!routes.some(r=>r.source==='/'));assert(!routes.some(r=>r.source==='/index.html'));assert(routes.every(r=>r.permanent===false&&r.destination==='/'));assert(config.rewrites.some(r=>r.source==='/api/:path*'));
 const stars=read('lessing-stars/index.html');assert(stars.includes("link.href='/coach.html'"));assert(stars.includes('stars-entry-guard'));
 const version=/versionBadge.textContent='([^']+)'/.exec(read('lessing-stars/studio.js'))[1];assert(stars.includes(version));assert(game.includes(version));
});
test('restored admin sessions require a new login, player sessions retain progress',async()=>{
 const source=readFileSync(new URL('../lessing-stars/release.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('async function restoredStarsAccount(){'),source.indexOf('function finishAccessCheck(){'));
 for(const role of ['admin','player']){
  const calls=[];let loggedOut=false;
  const context={starsRequest:async(path)=>{calls.push(path);if(path==='logout'){loggedOut=true;return {ok:true}}return {user:loggedOut?null:{name:'Tester',role}}}};
  vm.createContext(context);vm.runInContext(code,context);const restored=await vm.runInContext('restoredStarsAccount()',context);
  if(role==='admin'){assert.equal(restored.user,null);assert.deepEqual(calls,['status','logout'])}else{assert.equal(restored.user.role,'player');assert.deepEqual(calls,['status'])}
 }
});
test('touch portrait blocks games while landscape and desktop remain available',()=>{
 const source=readFileSync(new URL('../lessing-stars/release.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf('function portraitPlayBlocked(){'),source.indexOf('async function starsRequest'));
 for(const [portrait,coarse,touches,blocked] of [[true,true,1,true],[true,false,5,true],[false,true,1,false],[true,false,0,false]]){
  const context={matchMedia:q=>({matches:q.includes('portrait')?portrait:coarse}),navigator:{maxTouchPoints:touches}};
  vm.createContext(context);vm.runInContext(code,context);assert.equal(vm.runInContext('portraitPlayBlocked()',context),blocked);
 }
});
