const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);

function show(){
  const id=location.hash.slice(1)||"start";
  $$(".page").forEach(p=>p.classList.toggle("hidden",p.id!==id));
  $$("#sidebar a").forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+id));
  $("#sidebar").classList.remove("open");
  if(id==="ki" && !$("#messages").children.length) msg("ai","Hallo! Ich bin deine Lern-KI. Was möchtest du lernen?");
}
function go(id){location.hash=id}
addEventListener("hashchange",show);
show();

$("#menu").onclick=()=>$("#sidebar").classList.toggle("open");

function msg(type,text){
  const d=document.createElement("div");
  d.className="msg "+type;
  d.textContent=text;
  $("#messages").appendChild(d);
  $("#messages").scrollTop=$("#messages").scrollHeight;
}

function localAnswer(q){
  const s=q.toLowerCase();
  if(s.includes("lernplan")) return "Klar. Nenne mir Fach, Thema, Prüfungstermin und wie viele Minuten du pro Tag lernen möchtest. Dann erstelle ich dir einen strukturierten Lernplan.";
  if(s.includes("aufgabe")||s.includes("übung")) return "Gerne. Nenne mir Fach, Klassenstufe und Thema. Ich kann dir passende Übungsaufgaben mit Lösungen und Erklärungen vorbereiten.";
  if(s.includes("mathe")||s.includes("rechnung")) return "Gerne bei Mathe. Schreib mir die Aufgabe vollständig. Ich erkläre dir den Rechenweg Schritt für Schritt und nicht nur das Ergebnis.";
  if(s.includes("englisch")) return "Klar. Ich kann Grammatik, Vokabeln, Texte, Übersetzungen und Übungen erklären. Schick mir einfach dein Thema.";
  if(s.includes("deutsch")) return "Gerne. Ich kann dir bei Grammatik, Rechtschreibung, Aufsätzen, Textanalyse und Literatur helfen.";
  return "Gerne! Schreib mir deine Frage möglichst genau. Ich kann dir Themen erklären, Aufgaben Schritt für Schritt lösen und beim Erstellen von Lernplänen helfen.";
}

async function ask(){
  const input=$("#input");
  const text=input.value.trim();
  if(!text)return;
  input.value="";
  msg("user",text);

  const load=document.createElement("div");
  load.className="msg ai";
  load.textContent="Denke nach …";
  $("#messages").appendChild(load);

  const endpoint=window.LESSING_AI_ENDPOINT||"";
  if(!endpoint){
    setTimeout(()=>{load.textContent=localAnswer(text);$("#messages").scrollTop=$("#messages").scrollHeight},350);
    return;
  }

  try{
    const r=await fetch(endpoint,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:text})
    });
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||"KI-Fehler");
    load.textContent=d.text||d.answer||"Keine Antwort erhalten.";
  }catch(e){
    console.error(e);
    load.textContent="Die KI-Verbindung ist momentan nicht erreichbar. Die Oberfläche funktioniert, aber der externe KI-Dienst antwortet gerade nicht.";
  }
  $("#messages").scrollTop=$("#messages").scrollHeight;
}

$("#send").onclick=ask;
$("#input").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();ask()}};
$$(".quick button").forEach(b=>b.onclick=()=>{ $("#input").value=b.dataset.q; ask(); });
$("#new").onclick=()=>{$("#messages").innerHTML="";msg("ai","Neuer Chat gestartet. Was möchtest du lernen?")};
