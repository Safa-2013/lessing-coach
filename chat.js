const $=id=>document.getElementById(id);
const gate=$('profileGate'), msgs=$('aiMessages'), input=$('aiInput'), send=$('aiSend');
let profile=JSON.parse(localStorage.getItem('lessing_ai_profile')||'null');
let history=[]; let activeSubject='';
function activate(p){profile=p;localStorage.setItem('lessing_ai_profile',JSON.stringify(p));gate.hidden=true;msgs.hidden=false;input.disabled=false;send.disabled=false;input.focus();}
if(profile) activate(profile);
$('startAi').onclick=()=>{const f=$('pFirst').value.trim(),l=$('pLast').value.trim(),c=$('pClass').value.trim();if(!f||!l||!c){alert('Bitte Vorname, Nachname und Klasse eingeben.');return}activate({first:f,last:l,klass:c});};
function addBubble(type,text,meta=''){const d=document.createElement('div');d.className=type==='user'?'ai-bubble user':'ai-bubble';d.innerHTML=(type==='ai'?'<b>Lessing KI</b>':'<b>Du</b>')+'<p>'+esc(text)+'</p><small>'+esc(meta||nowTime())+'</small>';msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}
async function reportError(error,question){const item={created:Date.now(),question,error:String(error?.message||error)};const a=JSON.parse(localStorage.getItem('lessing_ai_errors')||'[]');a.push(item);localStorage.setItem('lessing_ai_errors',JSON.stringify(a));try{await fetch('/api/ai-error',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)})}catch(_){} }
async function sendMessage(){const q=input.value.trim();if(!q||!profile)return;addBubble('user',q);history.push({role:'user',content:q});input.value='';send.disabled=true;const typing=document.createElement('div');typing.className='ai-bubble typing';typing.id='typing';typing.innerHTML='<b>Lessing KI</b><p>Antwort wird erstellt …</p>';msgs.appendChild(typing);msgs.scrollTop=msgs.scrollHeight;
 try{const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history,profile,subject:activeSubject})});const data=await r.json();if(!r.ok)throw new Error(data.error||'KI-Fehler');document.getElementById('typing')?.remove();addBubble('ai',data.text);history.push({role:'assistant',content:data.text});}
 catch(e){document.getElementById('typing')?.remove();addBubble('ai','Die KI konnte gerade nicht antworten. Der Fehler wurde für die Administration protokolliert.');await reportError(e,q);} finally{send.disabled=false;input.focus();}}
send.onclick=sendMessage;input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}};
document.querySelectorAll('.subjects button').forEach(b=>b.onclick=()=>{activeSubject=b.dataset.subject;input.value='Erkläre mir '+activeSubject+' verständlich.';input.focus();});
document.querySelectorAll('.quick button').forEach(b=>b.onclick=()=>{input.value=b.dataset.prompt||b.textContent.replace('…','').trim();input.focus();});
document.querySelectorAll('.ai-cards button').forEach(b=>b.onclick=()=>{input.value=b.dataset.prompt||'';input.focus();});
$('attachBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=e=>{const file=e.target.files?.[0];if(!file)return;addBubble('user','📎 '+file.name);input.value='Bitte analysiere die angehängte Datei: '+file.name+' (Dateiinhalt muss vom Backend verarbeitet werden).';input.focus();};
$('micBtn').onclick=()=>{if(!('webkitSpeechRecognition'in window||'SpeechRecognition'in window)){alert('Spracherkennung wird von diesem Browser nicht unterstützt.');return;}const R=window.SpeechRecognition||window.webkitSpeechRecognition,r=new R();r.lang='de-DE';r.onresult=e=>{input.value=e.results[0][0].transcript;input.focus()};r.start();};
$('themeBtn').onclick=()=>document.body.classList.toggle('soft-ai');
