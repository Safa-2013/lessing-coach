const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
function go(id){location.hash=id}
function show(){let id=location.hash.slice(1)||"start";$$(".page").forEach(p=>p.classList.toggle("hidden",p.id!==id));$$("nav a").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+id));$("#sidebar").classList.remove("open");if(id==="ki"&&!localStorage.getItem("lessing_profile"))$("#modal").classList.add("show")}
addEventListener("hashchange",show);show();$("#menu").onclick=()=>$("#sidebar").classList.toggle("open");

let profile=JSON.parse(localStorage.getItem("lessing_profile")||"null"),history=[];
function msg(type,text){let d=document.createElement("div");d.className="msg "+type;d.textContent=text;$("#messages").appendChild(d);$("#messages").scrollTop=$("#messages").scrollHeight}
function startChat(){profile={first:$("#first").value.trim(),last:$("#last").value.trim(),klass:$("#klass").value.trim()};if(!profile.first||!profile.last||!profile.klass)return;localStorage.setItem("lessing_profile",JSON.stringify(profile));$("#modal").classList.remove("show");$("#input").disabled=false;$("#send").disabled=false;msg("ai","Hallo! Was möchtest du heute lernen?")}
if(profile){$("#input").disabled=false;$("#send").disabled=false;msg("ai","Hallo! Was möchtest du heute lernen?")}
$("#start").onclick=startChat;
async function ask(){let text=$("#input").value.trim();if(!text)return;$("#input").value="";msg("user",text);let load=document.createElement("div");load.className="msg ai";load.textContent="Denke nach …";$("#messages").appendChild(load);
if(!window.LESSING_AI_ENDPOINT){load.textContent="Die KI-Verbindung ist noch nicht eingerichtet. Trage in config.js die URL deines sicheren KI-Backends ein.";$("#messages").scrollTop=$("#messages").scrollHeight;return}
try{let r=await fetch(window.LESSING_AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,profile,history})});let d=await r.json();if(!r.ok)throw Error(d.error||"KI-Fehler");load.textContent=d.text||"Keine Antwort erhalten.";history.push({role:"user",text}, {role:"model",text:d.text||""})}catch(e){load.textContent="Die KI konnte gerade nicht antworten.";console.error(e)}$("#messages").scrollTop=$("#messages").scrollHeight}
$("#send").onclick=ask;$("#input").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();ask()}};$$(".quick button").forEach(b=>b.onclick=()=>{if(!profile){$("#modal").classList.add("show");return}$("#input").value=b.dataset.q;ask()});$("#new").onclick=()=>{$("#messages").innerHTML="";history=[];msg("ai","Neuer Chat gestartet. Was möchtest du lernen?")};
