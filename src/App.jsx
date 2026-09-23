export default function App(){
return <div className="app">
<aside>
<h2>🎓 Lessing Coach</h2><p>Dein KI-Lernassistent</p>
<nav>
<div>💬 Neuer Chat</div><div>📅 Lernplaner</div><div>📝 Aufgaben</div><div>🎓 Prüfungsvorbereitung</div><div>📄 Zusammenfassungen</div><div>⚙ Einstellungen</div>
</nav>
</aside>
<main>
<h1>Was möchtest du heute lernen?</h1>
<p>Dein KI-Lernassistent für Fragen, Erklärungen und Lernpläne.</p>
<div className="subjects">
{["Mathematik","Deutsch","Englisch","Biologie","Chemie","Physik","Geschichte","Erdkunde","Informatik"].map(x=><button>{x}</button>)}
</div>
<div className="input"><input placeholder="Stelle mir eine Frage..."/><button>↑</button></div>
<div className="cards"><section>Lernplan erstellen</section><section>Aufgaben lösen</section><section>Themen verstehen</section></div>
</main>
</div>
}