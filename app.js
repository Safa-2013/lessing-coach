const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const DB_KEY="lessing_students_v2";
const SESSION_KEY="lessing_current_student_v2";
let db=JSON.parse(localStorage.getItem(DB_KEY)||"{}");
let current=JSON.parse(localStorage.getItem(SESSION_KEY)||"null");

function save(){localStorage.setItem(DB_KEY,JSON.stringify(db))}
function key(f,l,c){return (f+"|"+l+"|"+c).trim().toLowerCase()}
function showPage(id){
  $$(".page").forEach(p=>p.classList.remove("active-page"));
  $("#"+id)?.classList.add("active-page");
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===id));
  $("#sidebar").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
  if(id==="termine")renderAppointments();
  if(id==="contact")renderContact();
  if(id==="ki")renderKI();
}
window.showPage=showPage;
$$(".nav-item").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
$("#menuBtn").onclick=()=>$("#sidebar").classList.toggle("open");
$("#loginBtn").onclick=$("#mobileAccountBtn").onclick=()=>$("#loginModal").classList.remove("hidden");
$$("[data-close]").forEach(x=>x.onclick=()=>$("#loginModal").classList.add("hidden"));

function openAccount(){
  const f=$("#firstName").value.trim(),l=$("#lastName").value.trim(),c=$("#className").value.trim();
  const err=$("#loginError");
  if(!f||!l||!c){err.textContent="Bitte Vorname, Nachname und Klasse eingeben.";return}
  const k=key(f,l,c);
  if(!db[k]) db[k]={firstName:f,lastName:l,className:c,appointments:[],chats:[{id:Date.now(),title:"Neuer Chat",messages:[{who:"ai",text:"Hallo! 👋 Ich bin deine Lern-KI. Stell mir einfach eine Frage."}]}],activeChat:0,contact:[]};
  current=db[k]; current._key=k; db[k]=current; save(); localStorage.setItem(SESSION_KEY,JSON.stringify({key:k}));
  $("#loginModal").classList.add("hidden"); updateAccountUI(); renderAppointments(); renderContact(); renderKI();
}
$("#accountLogin").onclick=openAccount;
$("#firstName").addEventListener("keydown",e=>{if(e.key==="Enter")openAccount()});
function updateAccountUI(){
  const logged=!!current;
  const text=logged?`${current.firstName} ${current.lastName}<small>Klasse ${current.className}</small>`:"Noch nicht angemeldet";
  $("#topAccount").innerHTML=logged?`👤 ${text}`:"";
  $("#accountMini").innerHTML=logged?`<b>${current.firstName} ${current.lastName}</b><br><small>Klasse ${current.className}</small>`:"";
  $("#accountMini").style.display=logged?"block":"none";
  $("#loginBtn").textContent=logged?"Konto wechseln":"Anmelden";
  $("#studentLabel").textContent=logged?`${current.firstName} ${current.lastName} · ${current.className}`:"Nicht angemeldet";
  $("#coachStudent").textContent=logged?`Angemeldet als ${current.firstName} ${current.lastName} · Klasse ${current.className}`:"Bitte zuerst anmelden.";
  $("#termStudent").textContent=logged?`Deine Termine · ${current.firstName} ${current.lastName}`:"Bitte zuerst anmelden.";
}
function ensure(){if(!current){$("#loginModal").classList.remove("hidden");return false}return true}

function renderAppointments(){
  const box=$("#appointmentsList"); if(!current){box.innerHTML="<p>Bitte zuerst anmelden.</p>";return}
  if(!current.appointments.length){box.innerHTML="<p>Noch keine Termine oder Anfragen vorhanden.</p>";return}
  box.innerHTML=current.appointments.map(a=>`<div class="appointment"><b>${esc(a.area)}</b><br>${esc(a.subject||"Ohne Fach")} · ${esc(a.date)} · ${esc(a.time)}<br><small>${esc(a.note||"")}</small><br><span class="status">${esc(a.status)}</span></div>`).join("");
}
$("#createAppointment").onclick=()=>{
  if(!ensure())return;
  const date=$("#coachDate").value,time=$("#coachTime").value;
  if(!date||!time){$("#appointmentResult").classList.remove("hidden");$("#appointmentResult").textContent="Bitte Datum und Uhrzeit auswählen.";return}
  const a={id:Date.now(),area:$("#coachArea").value,subject:$("#coachSubject").value,note:$("#coachNote").value,date,time,status:"Anfrage erhalten"};
  current.appointments.push(a);db[current._key]=current;save();
  $("#appointmentResult").classList.remove("hidden");$("#appointmentResult").innerHTML="<b>Anfrage gespeichert.</b><br>Sie gehört jetzt zu deinem Schülerkonto.";
  renderAppointments();
};

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function activeChat(){return current?.chats?.[current.activeChat||0]}
function renderKI(){
  if(!current){$("#messages").innerHTML='<div class="msg ai"><b>Lern-KI</b><span>Bitte melde dich an, damit dein KI-Verlauf gespeichert werden kann.</span></div>';return}
  const ch=activeChat();$("#messages").innerHTML=(ch.messages||[]).map(m=>`<div class="msg ${m.who}">${m.who==="ai"?"<b>Lern-KI</b>":""}<span>${esc(m.text)}</span></div>`).join("");
  $("#messages").scrollTop=$("#messages").scrollHeight;
}
function saveCurrent(){db[current._key]=current;save()}
function addChatMessage(who,text){activeChat().messages.push({who,text});saveCurrent();renderKI()}
function localAI(q){
  const x=q.toLowerCase();
  if(x.includes("lernplan"))return "Gerne. Nenne mir Fach, Prüfungstermin und wie viele Minuten du pro Tag lernen kannst. Dann erstelle ich dir einen Lernplan mit Wiederholungen und Pausen.";
  if(x.includes("mathe"))return "Schick mir die Matheaufgabe oder das Thema. Ich erkläre den Rechenweg Schritt für Schritt und gebe dir danach eine ähnliche Übung.";
  if(x.includes("zusammenfass"))return "Schick mir den Text. Ich kann ihn zusammenfassen und anschließend die wichtigsten Begriffe und Prüfungsfragen herausarbeiten.";
  if(x.includes("aufgaben"))return "Gerne. Nenne mir Fach und Thema sowie dein Niveau. Ich kann dir passende Aufgaben erstellen und anschließend die Lösungen erklären.";
  return "Klar! Stell mir deine Frage ganz normal. Ich kann Themen erklären, Aufgaben Schritt für Schritt bearbeiten und dir beim Lernen helfen.";
}
async function askAI(q){
  if(!ensure()||!q.trim())return;
  addChatMessage("user",q);$("#prompt").value="";$("#aiStatus").textContent="Antwort wird vorbereitet …";
  const endpoint=window.LESSING_CONFIG?.AI_ENDPOINT||"";
  if(endpoint){
    try{
      const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q,student:{firstName:current.firstName,lastName:current.lastName,className:current.className}})});
      if(!r.ok)throw new Error();
      const d=await r.json();addChatMessage("ai",d.reply||"Keine Antwort erhalten.");$("#aiStatus").textContent="Bereit";return;
    }catch(e){$("#aiStatus").textContent="KI-Backend nicht erreichbar – lokaler Modus aktiv."}
  }
  setTimeout(()=>{addChatMessage("ai",localAI(q));$("#aiStatus").textContent="Bereit"},250);
}
$("#send").onclick=()=>askAI($("#prompt").value);
$("#prompt").addEventListener("keydown",e=>{if(e.key==="Enter")askAI(e.target.value)});
$$(".quick button").forEach(b=>b.onclick=()=>askAI(b.dataset.q));
$$(".subject-row button").forEach(b=>b.onclick=()=>{$("#prompt").value=`Hilf mir bei ${b.dataset.subject}. `;$("#prompt").focus()});
$("#newChat").onclick=()=>{
  if(!ensure())return;
  current.chats.push({id:Date.now(),title:"Neuer Chat",messages:[{who:"ai",text:"Neuer Chat gestartet. Was möchtest du lernen?"}]});
  current.activeChat=current.chats.length-1;saveCurrent();renderKI();
};
$("#attachBtn").onclick=()=>$("#fileInput").click();

function renderContact(){
  const box=$("#contactMessages");if(!current){box.innerHTML='<div class="contact-msg team"><b>Lessing Schulen Coaching</b><span>Bitte melde dich an, damit dein persönlicher Chat gespeichert werden kann.</span></div>';return}
  let html=`<div class="contact-msg team"><b>Lessing Schulen Coaching</b><span>Hallo! 👋<br>Schreibe uns hier deine Frage oder Anfrage. Deine Nachricht wird an alle Admins weitergeleitet.<br>Wir melden uns so schnell wie möglich bei dir.</span><time>Heute</time></div>`;
  html+=current.contact.map(m=>`<div class="contact-msg user"><span>${esc(m.text)}</span><time>${esc(m.time)} ✓✓</time></div>`).join("");
  box.innerHTML=html;
}
function sendContact(){
  if(!ensure())return;
  const v=$("#contactInput").value.trim();if(!v)return;
  current.contact.push({text:v,time:new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})});
  saveCurrent();$("#contactInput").value="";renderContact();
}
$("#contactSend").onclick=sendContact;$("#contactInput").addEventListener("keydown",e=>{if(e.key==="Enter")sendContact()});
$("#emojiBtn").onclick=()=>$("#contactInput").value+=" 😊";
$("#attachContact").onclick=()=>$("#fileInput").click();

if(current?.key && db[current.key]){current=db[current.key];current._key=current.key;delete current.key}
updateAccountUI();renderAppointments();renderContact();renderKI();
