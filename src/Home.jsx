
export default function Home() {
  return (
    <div className="lessing-home">
      <aside>
        <h2>🎓 Lessing Coach</h2>
        <p>Dein KI-Lernassistent</p>
        <nav>
          <div>💬 Neuer Chat</div>
          <div>📅 Lernplaner</div>
          <div>📝 Aufgaben</div>
          <div>🎓 Prüfungsvorbereitung</div>
          <div>📄 Zusammenfassungen</div>
          <div>🛠 Tools</div>
          <div>⚙ Einstellungen</div>
        </nav>
      </aside>

      <main>
        <h1>Was möchtest du heute lernen?</h1>
        <p>Dein persönlicher KI-Lernassistent. Stelle Fragen, erhalte Erklärungen und erstelle Lernpläne.</p>

        <section className="subjects">
          {["Mathematik","Deutsch","Englisch","Biologie","Chemie","Physik","Geschichte","Erdkunde","Informatik","Weitere Fächer"].map(x =>
            <button key={x}>{x}</button>
          )}
        </section>

        <div className="chat-input">
          <input placeholder="Stelle mir eine Frage..." />
          <button>↑</button>
        </div>

        <section className="cards">
          <article>Lernplan erstellen</article>
          <article>Aufgaben lösen</article>
          <article>Themen verstehen</article>
        </section>
      </main>
    </div>
  );
}
