const $=id=>document.getElementById(id);
const gate=$("profileGate"), msgs=$("aiMessages"), input=$("aiInput"), send=$("aiSend");
let profile=JSON.parse(localStorage.getItem("lessing_ai_profile")||"null");
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function activate(p){profile=p;localStorage.setItem("lessing_ai_profile",JSON.stringify(p));gate.hidden=true;msgs.hidden=false;input.disabled=false;send.disabled=false}
if(profile) activate(profile);
$("startAi").onclick=()=>{const f=$("pFirst").value.trim(),l=$("pLast").value.trim(),c=$("pClass").value.trim();if(!f||!l||!c){alert("Bitte Vorname, Nachname und Klasse eingeben.");return}activate({first:f,last:l,klass:c})};
function addBubble(type,html){const d=document.createElement("div");d.className=type==="user"?"ai-bubble user":"ai-bubble";d.innerHTML=html;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight}
function demoAnswer(q){
 const s=q.toLowerCase();
 if(s.includes("lernplan")) return "Gerne. Nenne mir Fach, Prüfungstermin und wie viele Minuten du pro Tag lernen kannst. Dann erstelle ich dir einen Lernplan.";
 if(s.includes("mathe")||s.includes("gleichung")) return "Gerne! Schreib mir die konkrete Aufgabe. Ich erkläre dir jeden Rechenschritt verständlich und kann danach ähnliche Übungsaufgaben erstellen.";
 if(s.includes("zusammenfass")) return "Schick mir den Text hier hinein oder hänge eine Datei an. Ich kann ihn kurz, ausführlich oder als Lernzettel zusammenfassen.";
 if(s.includes("englisch")) return "Klar. Ich kann dir Vokabeln, Grammatik, Übersetzungen und Übungen geben. Schreib mir einfach dein Thema.";
 return "Ich habe deine Frage erhalten. In dieser ZIP ist die KI-Oberfläche vollständig funktionsfähig und enthält eine lokale Antwortlogik. Für echte freie KI-Antworten kannst du anschließend einen KI-API-Endpunkt anschließen.";
}
function sendMessage(){const q=input.value.trim();if(!q||!profile)return;addBubble("user","<p>"+escapeHtml(q)+"</p>");input.value="";setTimeout(()=>addBubble("ai","<b>Lessing KI</b><p>"+escapeHtml(demoAnswer(q))+"</p>"),250)}
send.onclick=sendMessage;input.onkeydown=e=>{if(e.key==="Enter")sendMessage()};
document.querySelectorAll(".subjects button").forEach(b=>b.onclick=()=>{input.value="Erkläre mir "+b.dataset.subject+" verständlich.";input.focus()});
document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>{input.value=b.textContent.replace("…","").trim();input.focus()});
document.querySelectorAll(".ai-cards button").forEach(b=>b.onclick=()=>{input.value=b.dataset.prompt;input.focus()});
$("attachBtn").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>{if(e.target.files[0]){addBubble("user","<p>📎 "+escapeHtml(e.target.files[0].name)+"</p>");setTimeout(()=>addBubble("ai","<b>Lessing KI</b><p>Die Datei wurde aufgenommen. Für eine echte Inhaltsanalyse muss noch dein KI-/Datei-Backend verbunden werden.</p>"),250)}};
$("micBtn").onclick=()=>alert("Mikrofon-Funktion ist für diese Frontend-Version vorbereitet.");
$("themeBtn").onclick=()=>document.body.classList.toggle("soft-ai");
