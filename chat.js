const cm=document.getElementById("chatMessages"),ci=document.getElementById("chatInput"),sb=document.getElementById("sendBtn");
let profile=JSON.parse(localStorage.getItem("lessing_ai_profile")||"null");
if(!profile){const first=prompt("Vorname");const last=prompt("Nachname");const klass=prompt("Klasse");if(first&&last&&klass){profile={first,last,klass};localStorage.setItem("lessing_ai_profile",JSON.stringify(profile));startChat()}else{document.querySelector(".chat-input-row").style.opacity=".45"}}
else startChat();
function startChat(){ci.disabled=false;sb.disabled=false;const n=document.createElement("div");n.className="bubble ai";n.innerHTML="<b>Lessing KI</b><p>Hallo "+escapeHtml(profile.first)+"! Du bist in Klasse "+escapeHtml(profile.klass)+". Was möchtest du lernen?</p>";cm.appendChild(n)}
function send(){const v=ci.value.trim();if(!v)return;const u=document.createElement("div");u.className="bubble user";u.innerHTML="<p>"+escapeHtml(v)+"</p>";cm.appendChild(u);ci.value="";setTimeout(()=>{const a=document.createElement("div");a.className="bubble ai";a.innerHTML="<b>Lessing KI</b><p>Ich habe deine Frage erhalten. In der vollständigen Version wird hier die angeschlossene KI-Antwort angezeigt.</p>";cm.appendChild(a)},300)}
sb.addEventListener("click",send);ci.addEventListener("keydown",e=>{if(e.key==="Enter")send()});document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>{ci.value=b.textContent.replace("…","").trim();ci.focus()});
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
