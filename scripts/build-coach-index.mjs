import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
let game=readFileSync(new URL('lessing-stars/spiel.html',root),'utf8');
game=game.replace(/<script id="stars-entry-guard">[\s\S]*?<\/script>/,'');
game=game.replace('<head>','<head><base href="/lessing-stars/">');
game=game.replace("location.origin+'/lessing-stars/?room='","new URL(document.baseURI).origin+'/?room='");
game=game.replace('new URL(location.href).searchParams','new URL(parent.location.href).searchParams');
const bridge=`<script>document.addEventListener('click',function(event){const link=event.target.closest('a');if(!link)return;const url=new URL(link.href),origin=new URL(document.baseURI).origin;if(url.origin===origin&&['/','/index.html','/coach.html'].includes(url.pathname)){event.preventDefault();event.stopImmediatePropagation();if(typeof stopOnline==='function')stopOnline();parent.postMessage({type:'lessing-coach-home'},origin);}},true);</script>`;
game=game.replace('</body>',bridge+'</body>');
const embedded=Buffer.from(game).toString('base64');
const integration=`
<style id="coach-stars-integration">#coachStarsOverlay{position:fixed;inset:0;width:100%;height:100dvh;z-index:10000;background:#102945}#coachStarsOverlay[hidden]{display:none}#coachStarsFrame{display:block;border:0;width:100%;height:100%}body.coach-stars-open{overflow:hidden}</style>
<section id="coachStarsOverlay" hidden aria-label="Lessing Stars"><iframe id="coachStarsFrame" title="Lessing Stars" allow="fullscreen; autoplay" referrerpolicy="same-origin"></iframe></section>
<script id="coachStarsDocument" type="application/json">"${embedded}"</script>
<script id="coachStarsController">
(function(){
 const overlay=document.getElementById('coachStarsOverlay'),frame=document.getElementById('coachStarsFrame');let focusBefore;
 window.openLessingStars=function(){focusBefore=document.activeElement;document.querySelector('.shell').inert=true;overlay.hidden=false;document.body.classList.add('coach-stars-open');const bytes=Uint8Array.from(atob(JSON.parse(document.getElementById('coachStarsDocument').textContent)),c=>c.charCodeAt(0));frame.srcdoc=new TextDecoder().decode(bytes);frame.focus();};
 window.closeLessingStars=function(){overlay.hidden=true;document.body.classList.remove('coach-stars-open');document.querySelector('.shell').inert=false;frame.removeAttribute('srcdoc');window.dispatchEvent(new Event('lessing-coach-home'));focusBefore?.focus();};
 window.addEventListener('message',function(event){if(event.source===frame.contentWindow&&event.origin===location.origin&&event.data?.type==='lessing-coach-home')window.closeLessingStars();});
})();
</script>`;
let coach=readFileSync(new URL('coach.html',root),'utf8');
const waiting=readFileSync(new URL('waiting-games.js',root),'utf8').replace(/export function /g,'function ');
const app=readFileSync(new URL('app.js',root),'utf8').replace("import { createDvdScreensaver } from './waiting-games.js';",waiting).replace(/<\/script/gi,'<\\/script');
coach=coach.replace(/<script type="module" src="\/app\.js[^\"]*"><\/script>/,()=>'<script type="module" id="coachApplication">'+app+'</script>');
coach=coach.replace('</body>',integration+'</body>');
writeFileSync(new URL('index.html',root),coach);
console.log('Coach index with embedded Stars:',Buffer.byteLength(coach),'bytes');
