# Lessing Schulen Coaching auf GitHub und Vercel starten

1. Die ZIP entpacken und **den Inhalt** in ein GitHub-Repository hochladen. `index.html`, `package.json`, `vercel.json`, `api/`, `lib/` und `assets/` müssen direkt im Stammverzeichnis liegen.
2. Das Repository in Vercel importieren. Als Root Directory das Stammverzeichnis verwenden. Das Projekt ist eine einfache Node.js-Website, kein GitHub-Pages-Projekt.
3. Eine PostgreSQL-Datenbank bereitstellen und in Vercel unter *Settings → Environment Variables* `DATABASE_URL` mit ihrer Verbindungsadresse anlegen. Ohne diese Variable speichert die veröffentlichte Website keine Anfragen, Chats oder Termine.
4. Für echte Antworten der Lern-KI zusätzlich `OPENAI_API_KEY` setzen. Optional: `OPENAI_MODEL`. Der API-Schlüssel bleibt ausschließlich auf dem Server.
5. Vor der **ersten** Veröffentlichung `INITIAL_ADMIN_PASSWORD` und `INITIAL_BIG_ADMIN_PASSWORD` auf unterschiedliche, starke Kennwörter mit mindestens 10 Zeichen setzen. Ohne diese Variablen werden die Startkonten nicht erstellt. Die Variablen legen nur neue Konten an; vorhandene Kennwörter anschließend im Adminbereich ändern.
6. Deploy auslösen und die veröffentlichte Adresse öffnen. Prüfen: Anfrage erstellen und Code merken, Terminstatus abrufen, Nachricht senden, Adminantwort schicken, Status ändern und KI-Frage stellen.

Die Datenbanktabellen und Startkonten werden beim ersten API-Aufruf angelegt. Lokal: Node.js 22 oder neuer installieren, `npm ci` und `npm start` ausführen, dann `http://localhost:3000` öffnen. Lokal speichert SQLite Daten in `.data/lessing.sqlite`; diese Datei wird nicht ins Repository hochgeladen.

**Wichtig:** Nur die HTML-Datei bei GitHub Pages hochzuladen reicht nicht; dort laufen die Node.js-API und PostgreSQL-Anbindung nicht. Die Vorschau-HTML ist eine getrennte, lokale Ansicht zum Design-Test und gehört nicht zum produktiven Betrieb.
