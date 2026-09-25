(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function go(id){ location.hash = id; }

  function show(){
    const id = (location.hash || "#start").slice(1);
    const valid = document.getElementById(id) ? id : "start";
    $$(".page").forEach(p => p.classList.toggle("hidden", p.id !== valid));
    $$("#sidebar a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + valid));
    $("#sidebar").classList.remove("open");
    if(valid === "ki" && !$("#messages").children.length){
      msg("ai","Hallo! Ich bin deine Lern-KI. Was möchtest du lernen?");
    }
  }

  function msg(type,text){
    const d=document.createElement("div");
    d.className="msg " + type;
    d.textContent=text;
    $("#messages").appendChild(d);
    $("#messages").scrollTop=$("#messages").scrollHeight;
  }

  function localAI(q){
    const s=q.toLowerCase().trim();

    if(/^(hi|hallo|hey|guten tag|moin)\b/.test(s))
      return "Hallo! 👋 Was möchtest du lernen? Du kannst mich auch ganz normal etwas fragen.";

    if(s.includes("lernplan"))
      return "Gerne. Für einen passenden Lernplan brauche ich Fach, Thema, Prüfungstermin und ungefähr wie viele Minuten du pro Tag lernen möchtest.";

    if(s.includes("aufgabe") || s.includes("übung"))
      return "Gerne. Schreib mir Fach, Klassenstufe und Thema. Wenn du möchtest, erstelle ich dir Aufgaben zuerst ohne Lösungen und danach mit ausführlichen Lösungen.";

    if(s.includes("mathe") || /(\d+\s*[+\-*/]\s*\d+)/.test(s))
      return "Bei Mathematik kann ich dir den Rechenweg Schritt für Schritt erklären. Schick mir die vollständige Aufgabe, dann gehen wir sie gemeinsam durch.";

    if(s.includes("englisch"))
      return "Bei Englisch kann ich Grammatik, Vokabeln, Übersetzungen, Texte und Übungen erklären. Schreib mir einfach das Thema oder den Satz.";

    if(s.includes("deutsch"))
      return "Bei Deutsch kann ich Grammatik, Rechtschreibung, Aufsätze, Textanalyse und Literatur erklären. Schick mir deine konkrete Aufgabe.";

    if(s.includes("chemie"))
      return "Bei Chemie kann ich dir Begriffe, Reaktionsgleichungen und Zusammenhänge verständlich erklären. Schick mir das Thema oder die Aufgabe.";

    if(s.includes("physik"))
      return "Bei Physik können wir Formeln, Einheiten und Rechenwege Schritt für Schritt durchgehen. Schick mir die konkrete Aufgabe.";

    if(s.includes("biologie"))
      return "Bei Biologie kann ich dir biologische Prozesse einfach erklären und anschließend passende Übungsfragen erstellen.";

    if(s.includes("geschichte"))
      return "Bei Geschichte kann ich dir Ereignisse, Ursachen und Folgen verständlich erklären. Nenne mir einfach das Thema.";

    if(s.includes("wer bist") || s.includes("was kannst"))
      return "Ich bin die Lern-KI von Lessing Schulen Coaching. Ich kann dir beim Erklären, Üben, Zusammenfassen und Planen helfen.";

    return "Verstanden. Schreib mir deine Frage oder Aufgabe möglichst vollständig. Ich helfe dir Schritt für Schritt und kann dir auf Wunsch auch ein Beispiel oder Übungsaufgaben dazu geben.";
  }

  async function ask(textFromQuick){
    const input=$("#input");
    const text=(textFromQuick ?? input.value).trim();
    if(!text) return;
    input.value="";
    msg("user",text);

    const load=document.createElement("div");
    load.className="msg ai";
    load.textContent="Denke nach …";
    $("#messages").appendChild(load);
    $("#messages").scrollTop=$("#messages").scrollHeight;

    await new Promise(r=>setTimeout(r,220));
    load.textContent=localAI(text);
    $("#messages").scrollTop=$("#messages").scrollHeight;
  }

  window.go = go;
  window.addEventListener("hashchange", show);
  show();

  $("#menu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#send").addEventListener("click",()=>ask());
  $("#input").addEventListener("keydown",(e)=>{ if(e.key==="Enter"){e.preventDefault();ask();} });
  $$(".quick button").forEach(b=>b.addEventListener("click",()=>ask(b.dataset.q)));
  $("#new").addEventListener("click",()=>{$("#messages").innerHTML="";msg("ai","Neuer Chat gestartet. Was möchtest du lernen?");});

  $("#coachingForm").addEventListener("submit",(e)=>{
    e.preventDefault();
    $("#formResult").hidden=false;
    $("#formResult").textContent="Die Anfrage wurde lokal vorbereitet. Für eine echte Übermittlung an das Team wird später ein Backend benötigt.";
  });

  $("#lookupBtn").addEventListener("click",()=>{
    const code=$("#code").value.trim();
    $("#lookupResult").hidden=false;
    $("#lookupResult").textContent=code
      ? "Anfragecode erkannt: " + code + ". Eine echte Terminabfrage benötigt eine angeschlossene Datenbank."
      : "Bitte zuerst einen Anfragecode eingeben.";
  });

  $("#contactSend").addEventListener("click",()=>{
    const v=$("#contactInput").value.trim();
    $("#contactResult").hidden=false;
    $("#contactResult").textContent=v ? "Nachricht vorbereitet. Für das tatsächliche Senden wird später ein Backend benötigt." : "Bitte zuerst eine Nachricht eingeben.";
  });
})();