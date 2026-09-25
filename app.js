const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const DB="lessing_v3_db",GUEST="lessing_v3_guest";
let data=JSON.parse(localStorage.getItem(DB)||'{"students":{},"contacts":[]}');
let student=JSON.parse(localStorage.getItem("lessing_v3_student")||"null");
let admin=JSON.parse(sessionStorage.getItem("lessing_v3_admin")||"null");
function save(){localStorage.setItem(DB,JSON.stringify(data))}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function showPage(id){$$(".page").forEach(p=>p.classList.remove("active"));$("#"+id)?.classList.add("active");$$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===id));$("#sidebar").classList.remove("open");if(id==="termine")lookup();if(id==="contact")renderContact();if(id==="ki")renderAI();if(id==="admin")renderAdmin()}
window.showPage=showPage;
$$(".nav").forEach(n=>n.onclick=()=>showPage(n.dataset.page));
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");

$("#adminLogin").onclick=$("#mobileAdmin").onclick=()=>$("#adminModal").classList.remove("hidden");
$$("[data-close]").forEach(b=>b.onclick=()=>$("#adminModal").classList.add("hidden"));
$("#doAdmin").onclick=()=>{
 const u=$("#adminUser").value.trim(),p=$("#adminPass").value,hit=(window.LESSING_CONFIG.ADMINS||[]).find(a=>a.user===u&&a.pass===p);
 if(!hit){$("#adminError").textContent="Benutzername oder Passwort falsch.";return}
 admin={user:hit.user,name:hit.name};sessionStorage.setItem("lessing_v3_admin",JSON.stringify(admin));$("#adminModal").classList.add("hidden");showPage("admin");$("#adminLogin").textContent=hit.name;renderAdmin()
};
$("#adminLogout").onclick=()=>{admin=null;sessionStorage.removeItem("lessing_v3_admin");showPage("home");$("#adminLogin").textContent="Anmelden"};

function studentKey(f,l,c){return `${f.trim().toLowerCase()}|${l.trim().toLowerCase()}|${c.trim().toLowerCase()}`}
function identify(f,l,c){
 const k=studentKey(f,l,c);
 if(!data.students[k])data.students[k]={firstName:f,lastName:l,className:c,appointments:[],chat:[{who:"ai",text:"Hallo! 👋 Ich bin deine Lern-KI. Stell mir einfach deine Frage."}],contact:[]};
 student={key:k,...data.students[k]};data.students[k]=student;localStorage.setItem("lessing_v3_student",JSON.stringify({key:k}));save();updateStudentUI();renderAI();renderContact()
}
function updateStudentUI(){
 if(student&&data.students[student.key])student=data.students[student.key];
 if(student){$("#studentBadge").innerHTML=`<b>${esc(student.firstName)} ${esc(student.lastName)}</b><br><small>Klasse ${esc(student.className)}</small>`;$("#studentBadge").classList.remove("hidden");$("#studentTop").textContent=`${student.firstName} ${student.lastName} · ${student.className}`}else{$("#studentBadge").classList.add("hidden");$("#studentTop").textContent=""}
}
function createAppointment(){
 const f=$("#sFirst").value.trim(),l=$("#sLast").value.trim(),c=$("#sClass").value.trim(),d=$("#date").value,t=$("#time").value;
 if(!f||!l||!c||!d||!t){$("#created").classList.remove("hidden");$("#created").textContent="Bitte Vorname, Nachname, Klasse, Datum und Uhrzeit ausfüllen.";return}
 identify(f,l,c);
 const a={id:Date.now(),firstName:f,lastName:l,className:c,area:$("#area").value,subject:$("#subject").value,date:d,time:t,note:$("#note").value,status:"Anfrage erhalten"};
 data.students[student.key].appointments.push(a);save();student=data.students[student.key];$("#created").classList.remove("hidden");$("#created").innerHTML="<b>Termin-Anfrage gespeichert.</b><br>Du bist jetzt automatisch mit diesem Schülerprofil verbunden.";lookup()
}
$("#create").onclick=createAppointment;
function lookup(){
 const box=$("#myAppointments");if(!box)return;
 let s=student;
 if(!s){box.innerHTML="<p>Noch kein Schülerprofil aktiv. Erstelle zuerst eine Termin-Anfrage.</p>";return}
 if(!s.appointments.length){box.innerHTML="<p>Für dieses Schülerprofil gibt es noch keine Termine.</p>";return}
 box.innerHTML=s.appointments.map(a=>`<div class="appointment"><b>${esc(a.area)}</b><br>${esc(a.subject||"Ohne Fach")} · ${esc(a.date)} · ${esc(a.time)}<br>${esc(a.note)}<br><span class="status">${esc(a.status)}</span></div>`).join("")
}
$("#lookup").onclick=()=>{const q=$("#lookupName").value.trim().toLowerCase();if(!q)return;const found=Object.values(data.students).find(s=>`${s.firstName} ${s.lastName}`.toLowerCase()===q);if(found){student=found;localStorage.setItem("lessing_v3_student",JSON.stringify({key:student.key}));updateStudentUI();lookup()}else{$("#myAppointments").innerHTML="<p>Kein Schülerprofil mit diesem Namen gefunden.</p>"}};

function aiAnswer(q){
 const x=q.toLowerCase();
 if(x.includes("lernplan"))return "Ich kann dir einen Lernplan erstellen. Nenne mir Fach, Thema, Prüfungstermin und wie viele Minuten du an jedem Tag lernen kannst. Dann teile ich den Stoff in konkrete Lernblöcke, Wiederholungen und Pausen auf.";
 if(x.includes("mathe")||x.includes("rechnung"))return "Schick mir die vollständige Matheaufgabe. Ich erkläre zuerst, was gesucht ist, zeige den Rechenweg Schritt für Schritt und prüfe anschließend das Ergebnis.";
 if(x.includes("zusammenfass"))return "Schick mir den Text hier hinein. Ich fasse ihn verständlich zusammen und kann anschließend die wichtigsten Begriffe und mögliche Prüfungsfragen herausarbeiten.";
 if(x.includes("aufgabe")||x.includes("übungs"))return "Gerne. Nenne Fach, Thema und Klassenstufe. Ich erstelle mehrere passende Aufgaben und kann die Lösungen danach Schritt für Schritt erklären.";
 return "Gerne! Ich kann dir bei normalen Fragen helfen, Themen verständlich erklären, Aufgaben Schritt für Schritt bearbeiten, Texte zusammenfassen und Lernpläne erstellen. Schreib mir einfach genau, was du wissen möchtest.";
}
async function ask(q){
 if(!q.trim())return;
 if(!student){ // KI darf ohne Anmeldung benutzt werden
   if(!data.guest)data.guest={chat:[]}; data.guest.chat.push({who:"user",text:q});save()
 }else{data.students[student.key].chat.push({who:"user",text:q});save()}
 renderAI();$("#prompt").value="";$("#aiStatus").textContent="Antwort wird erstellt …";
 const endpoint=window.LESSING_CONFIG.AI_ENDPOINT;
 if(endpoint){try{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q,student:student?{firstName:student.firstName,lastName:student.lastName,className:student.className}:null})});if(!r.ok)throw Error();const d=await r.json();addAI(d.reply||"Keine Antwort erhalten.");$("#aiStatus").textContent="Bereit";return}catch(e){$("#aiStatus").textContent="KI-Backend nicht erreichbar – lokale Hilfe wird verwendet."}}
 setTimeout(()=>{addAI(aiAnswer(q));$("#aiStatus").textContent="Bereit"},250)
}
function addAI(text){if(student){data.students[student.key].chat.push({who:"ai",text});save()}else{data.guest??={chat:[]};data.guest.chat.push({who:"ai",text});save()}renderAI()}
function renderAI(){
 const arr=student?((data.students[student.key]||{}).chat||[]):((data.guest||{}).chat||[]);
 $("#messages").innerHTML=(arr.length?arr:[{who:"ai",text:"Hallo! 👋 Stell mir eine Frage."}]).map(m=>`<div class="msg ${m.who}">${m.who==="ai"?"<b>Lern-KI</b>":""}<span>${esc(m.text)}</span></div>`).join("");
 $("#aiStudent").textContent=student?`${student.firstName} ${student.lastName} · ${student.className}`:"Gast – keine Anmeldung nötig";
 $("#messages").scrollTop=$("#messages").scrollHeight
}
$("#send").onclick=()=>ask($("#prompt").value);$("#prompt").addEventListener("keydown",e=>{if(e.key==="Enter")ask(e.target.value)});
$$(".quick button").forEach(b=>b.onclick=()=>ask(b.textContent.includes("Lernplan")?"Erstelle mir einen Lernplan.":b.textContent.includes("Zusammen")?"Fasse diesen Text zusammen.":b.textContent.includes("Übungs")?"Gib mir passende Übungsaufgaben.":"Erkläre mir dieses Thema einfach."));
$$(".subjects button").forEach(b=>b.onclick=()=>{$("#prompt").value=`Hilf mir bei ${b.textContent.replace(/^[^ ]+ /,"")}: `;$("#prompt").focus()});
$("#newChat").onclick=()=>{if(student){data.students[student.key].chat=[{who:"ai",text:"Neuer Chat gestartet. Was möchtest du lernen?"}];save();renderAI()}else{data.guest={chat:[{who:"ai",text:"Neuer Chat gestartet. Was möchtest du lernen?"}]};save();renderAI()}};

function renderContact(){
 const box=$("#contactMessages");const arr=student?(data.students[student.key]?.contact||[]):[];
 let html=`<div class="contact-m"><b>Lessing Schulen Coaching</b><span>Hallo! 👋<br>Schreibe uns hier deine Frage oder Anfrage. Deine Nachricht wird an alle Admins weitergeleitet.<br>Wir melden uns so schnell wie möglich bei dir.</span><time>Heute</time></div>`;
 html+=arr.map(m=>`<div class="contact-m user"><span>${esc(m.text)}</span><time>${esc(m.time)} ✓✓</time></div>`).join("");box.innerHTML=html
}
$("#contactSend").onclick=()=>{const v=$("#contactInput").value.trim();if(!v)return;if(!student){alert("Für den persönlichen Kontakt-Chat wird dein Schülerprofil benötigt. Erstelle zuerst einen Termin.");showPage("coaching");return}data.students[student.key].contact.push({text:v,time:new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})});save();$("#contactInput").value="";renderContact()};
$("#emoji").onclick=()=>$("#contactInput").value+=" 😊";
function renderAdmin(){
 if(!admin)return;
 const all=Object.values(data.students);
 $("#adminAppointments").innerHTML=all.flatMap(s=>s.appointments.map(a=>`<div class="admin-item"><b>${esc(a.firstName)} ${esc(a.lastName)} · ${esc(a.className)}</b><br>${esc(a.area)} · ${esc(a.subject)}<br>${esc(a.date)} ${esc(a.time)}<br><small>${esc(a.note)}</small></div>`)).join("")||"<p>Keine Anfragen.</p>";
 $("#adminContacts").innerHTML=all.flatMap(s=>(s.contact||[]).map(m=>`<div class="admin-item"><b>${esc(s.firstName)} ${esc(s.lastName)}</b><br>${esc(m.text)}<br><small>${esc(m.time)}</small></div>`)).join("")||"<p>Keine Nachrichten.</p>"
}
updateStudentUI();renderAI();renderContact();
