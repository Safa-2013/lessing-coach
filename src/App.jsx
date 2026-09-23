import {useState} from 'react';

export default function App(){
 const [page,setPage]=useState('home');

 return <div className="app">
 <aside>
  <h2>🎓 Lessing Coach</h2>
  <button onClick={()=>setPage('home')}>🏠 Startseite</button>
  <button onClick={()=>setPage('calendar')}>📅 Terminplaner</button>
  <button onClick={()=>setPage('ai')}>🤖 KI-Lernassistent</button>
  <button>📚 Lernpläne</button>
  <button>📝 Aufgaben</button>
  <button>⚙ Einstellungen</button>
  <div className="profile">👤 Benutzer<br/>Admin</div>
 </aside>

 <main>
 {page==='home' && <>
 <h1>Was möchtest du heute lernen?</h1>
 <div className="cards">
 <div>📅 Terminplaner</div>
 <div>🤖 KI-Lernassistent</div>
 <div>📝 Aufgaben</div>
 </div>
 </>}

 {page==='calendar' && <><h1>Terminplaner</h1><p>Hier kommen Termine und Kalender.</p></>}

 {page==='ai' && <><h1>KI-Lernassistent</h1>
 <div className="chat">Schreibe deine Frage...</div>
 <input placeholder="Nachricht schreiben..."/>
 </>}
 </main>
 </div>
}