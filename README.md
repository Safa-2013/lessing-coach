# Lessing Schulportal

## Start
- Startdatei: `index.html`
- API: `api/lern-ki.js`

## Lern-KI
Die Lern-KI verwendet die Google Gemini API serverseitig.
In Vercel muss als Environment Variable gesetzt sein:

`GEMINI_API_KEY`

Die API verwendet standardmäßig `gemini-3.8-flash` und versucht bei Modell-Verfügbarkeit automatisch weitere aktuelle Flash-Modelle.

## Konten
- Großadmin: `admin` / `1234`
- Hauptadministrator: `lessing` / `Schulen`

## Wichtig
Die vier Dateien müssen in der deployten Struktur so liegen, dass `index.html` im Projekt-Root und `api/lern-ki.js` im Root-Verzeichnis `api/` liegen.
