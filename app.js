const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);

function go(id){location.hash=id}
function show(){
  const id=(location.hash||"#start").slice(1);
  const valid=["start","coaching","termine","ki","about","hilfe","kontakt"].includes(id)?id:"start";
  $$(".page").forEach(p=>p.classList.toggle("hidden",p.id!==valid));
  $$("#sidebar nav a").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+valid));
  $("#sidebar")?.classList.remove("open");
  if(valid==="ki"&&!$("#messages").children.length) addMsg("ai","Hallo! 👋 Ich bin deine Lern-KI. Du kannst ganz normal mit mir chatten, Aufgaben schicken oder einen Lernplan anfordern.");
}
addEventListener("hashchange",show);show();

$("#menu")?.addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$$('[data-go]').forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));

function addMsg(type,text){
  const d=document.createElement("div");d.className="msg "+type;d.textContent=text;$("#messages").appendChild(d);$("#messages").scrollTop=$("#messages").scrollHeight;
}

function localAnswer(q){
  const s=q.toLowerCase();
  if(/lernplan/.test(s)) return "Sehr gerne. Nenne mir Fach, Thema, Prüfungstermin und wie viele Minuten du pro Tag lernen kannst. Daraus kann ich dir einen Tagesplan mit Lernzielen, Pausen und Wiederholungen aufbauen.";
  if(/aufgabe|übung|übungen/.test(s)) return "Klar. Nenne mir Fach, Klassenstufe und Thema. Ich kann dir Aufgaben in verschiedenen Schwierigkeitsstufen geben und danach jede Lösung Schritt für Schritt erklären.";
  if(/mathe|rechnung|gleichung|prozent/.test(s)) return "Schick mir die vollständige Matheaufgabe. Ich gehe den Rechenweg Schritt für Schritt durch und erkläre auch, warum jeder Schritt gemacht wird.";
  if(/deutsch|aufsatz|grammatik|rechtschreibung/.test(s)) return "Gerne. Schick mir den Text oder das Thema. Ich kann Grammatik, Rechtschreibung, Aufsatz, Textanalyse und Argumentation verständlich erklären.";
  if(/englisch|vokabel|grammar/.test(s)) return "Gerne. Schick mir dein Englisch-Thema. Wir können Grammatik, Vokabeln, Übersetzung, Schreiben oder Prüfungsvorbereitung gemeinsam üben.";
  if(/chemie|physik|bio|biologie|geschichte|erdkunde|informatik/.test(s)) return "Gerne. Nenne mir das konkrete Thema und deine Klassenstufe. Ich erkläre es einfach und kann danach passende Fragen zum Üben stellen.";
  if(/hallo|hi|hey/.test(s)) return "Hallo! 👋 Was möchtest du heute lernen? Du kannst mich auch ganz normal etwas fragen.";
  return "Verstanden. Schreib mir einfach mehr dazu. Ich kann dir etwas erklären, gemeinsam Aufgaben lösen, dich abfragen oder einen Lernplan erstellen.";
}

async function ask(text){
  const q=(text||$("#input").value).trim();if(!q)return;
  $("#input").value="";addMsg("user",q);
  const load=document.createElement("div");load.className="msg ai";load.textContent="Ich denke kurz nach …";$("#messages").appendChild(load);
  const endpoint=String(window.LESSING_AI_ENDPOINT||"").trim();
  if(!endpoint){setTimeout(()=>{load.textContent=localAnswer(q);},250);return;}
  try{
    const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||"Backend nicht erreichbar");
    load.textContent=data.text||data.answer||localAnswer(q);
  }catch(e){load.textContent=localAnswer(q);$("#mode").textContent="Lokaler Lernmodus";}
}

$("#send")?.addEventListener("click",()=>ask());
$("#input")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();ask()}});
$$('.quick button').forEach(b=>b.addEventListener("click",()=>ask(b.dataset.q)));
$("#new")?.addEventListener("click",()=>{$("#messages").innerHTML="";$("#mode").textContent="Bereit";addMsg("ai","Neuer Chat gestartet. Was möchtest du lernen?")});
$("#attach")?.addEventListener("click",()=>alert("Datei-Upload wird in dieser reinen 4-Dateien-Version nicht benötigt. Du kannst Aufgaben direkt in den Chat schreiben."));

$("#coachingForm")?.addEventListener("submit",e=>{e.preventDefault();const r=$("#formResult");r.className="result ok";r.textContent="Anfrage vorbereitet. In dieser statischen Version wird noch nichts an einen Server übertragen.";r.classList.remove("hidden")});
$("#lookupForm")?.addEventListener("submit",e=>{e.preventDefault();const r=$("#lookupResult");r.className="result";r.textContent="Der Anfragecode wurde geprüft. Für echte gespeicherte Termine muss später eine Datenbank angebunden werden.";r.classList.remove("hidden")});
$("#contactSend")?.addEventListener("click",()=>{const i=$("#contactInput"),v=i.value.trim();if(!v)return;const b=document.createElement("div");b.className="bubble";b.textContent=v;$(".contact-chat").insertBefore(b,$(".contact-chat .composer"));i.value=""});
