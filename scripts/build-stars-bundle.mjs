import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../lessing-stars/',import.meta.url),file=new URL('index.html',root);
let html=readFileSync(file,'utf8');
html=html.replace(/<html\b[^>]*>/, '<html lang="de" data-stars-loading="true">');
const guard='<script id="stars-entry-guard">if(["/","/index.html"].includes(location.pathname)){location.replace("/coach.html")}</script>';
html=html.replace(/<script id="stars-entry-guard">[\s\S]*?<\/script>/,'');
html=html.replace('<head>','<head>'+guard);
const startup='<section id="starsStartup" class="stars-startup" role="status"><div><h1>LESSING STARS</h1><p id="starsStartupMessage">Zugang und Wartungsstatus werden geprüft …</p><button id="starsStartupRetry" hidden>ERNEUT PRÜFEN</button><a href="/coach.html">← Lessing Coach</a></div></section>';
html=html.replace(/<section id="starsStartup"[\s\S]*?<\/section>/,'');
html=html.replace('<body>','<body>'+startup);
const campus='data:image/webp;base64,'+readFileSync(new URL('assets/campus-fix06.webp',root)).toString('base64');
html=html.replace(/<style id="campus-background">[\s\S]*?<\/style>/,'');
html=html.replace('</head>','<style id="campus-background">:root{--campus-background:url("'+campus+'")}</style></head>');
for(const [id,name,kind] of [['bundled-release-css','release.css','style'],['bundled-release-js','release.js','script'],['bundled-studio-css','studio.css','style'],['bundled-studio-js','studio.js','script']]){
 const text=readFileSync(new URL(name,root),'utf8').replace(/<\/script/gi,'<\\/script');
 const block=`<${kind} id="${id}">\n${text}\n</${kind}>`;
 const pattern=new RegExp(`<${kind} id="${id}">[\\s\\S]*?<\\/${kind}>`);
 if(pattern.test(html))html=html.replace(pattern,()=>block);
 else html=html.replace(kind==='style'?'</head>':'</body>',`${block}\n${kind==='style'?'</head>':'</body>'}`);
}
html=html.replace('<title>Lessing Stars · Lobby</title>','<title>Lessing Stars · Studio</title>');
writeFileSync(file,html);
writeFileSync(new URL('spiel.html',root),html);
console.log('Bundled',fileURLToPath(file),Buffer.byteLength(html),'bytes');
