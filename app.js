const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const modal=$("#profileModal"), promptEl=$("#prompt"), send=$("#send"), messages=$("#messages"), label=$("#studentLabel");
let profile=JSON.parse(localStorage.getItem("lessing_profile")||"null"), history=[];

function showPage(){const id=location.hash.slice(1)||"home";$$(".page").forEach(x=>x.classList.toggle("hidden",x.id!==id));$$(".sidebar a").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+id));if(id==="ki"&&!profile)modal.classList.add("show")}
window.addEventListener("hashchange",showPage);showPage();

$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");

function addMessage(role,text){const d=document.createElement("div");d.className="msg "+role;d.textContent=text;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;return d}
function enableChat(){promptEl.disabled=false;send.disabled=false;label.textContent=`${profile.first} ${profile.last} · Klasse ${profile.class}`;messages.innerHTML="";addMessage("ai",`Hallo ${profile.first}! Ich bin deine Lern-KI. Was möchtest du heute lernen?`)}
$("#start").onclick=()=>{const first=$("#first").value.trim(),last=$("#last").value.trim(),klass=$("#className").value.trim();if(!first||!last||!klass)return;profile={first,last,class:klass};localStorage.setItem("lessing_profile",JSON.stringify(profile));modal.classList.remove("show");enableChat()};
if(profile)enableChat();

async function ask(){
 const text=promptEl.value.trim();if(!text||!profile)return;
 promptEl.value="";addMessage("user",text);send.disabled=true;
 const loading=addMessage("ai","Denke nach …");
 history.push({role:"user",parts:[{text}]});
 try{
  const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text,history,profile})});
  const data=await r.json();loading.remove();
  if(!r.ok)throw new Error(data.error||"KI-Fehler");
  addMessage("ai",data.text||"Ich konnte gerade keine Antwort erzeugen.");
  history.push({role:"model",parts:[{text:data.text||""}]});
 }catch(e){loading.remove();addMessage("ai","Die KI konnte gerade nicht antworten. Bitte versuche es gleich noch einmal.");console.error(e)}
 finally{send.disabled=false;promptEl.focus()}
}
send.onclick=ask;promptEl.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask()}};
$$(".quick button").forEach(b=>b.onclick=()=>{if(!profile){modal.classList.add("show");return}promptEl.value=b.dataset.q;ask()});
$("#newChat").onclick=()=>{history=[];enableChat()};

document.addEventListener("click",e=>{const a=e.target.closest("a[href^='#']");if(a)$("#sidebar").classList.remove("open")});
