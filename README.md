# Lessing Coach – Final

## Enthalten
- `index.html` – komplette Oberfläche
- `api/lern-ki.js` – KI-Proxy
- `api/report-ai-error.js` – Fehlerweiterleitung ausschließlich an den Hauptadmin-Webhook

## Admin-Zugänge
- Hauptadmin: `Lessing` / `Schulen`
- Normaler Admin: `admin` / `1234`

Normale Admins sehen keinen Hauptadmin und können nur normale Admin-Konten erstellen. Der Hauptadmin kann normale Admin-Konten ohne deren Passwort öffnen.

## KI
Die Oberfläche sendet jetzt korrekt `message` an `/api/lern-ki`. Der API-Key bleibt ausschließlich in Vercel als `GEMINI_API_KEY`.
Optional kann mit `GEMINI_MODEL` ein anderes unterstütztes Gemini-Modell gewählt werden; Standard ist `gemini-2.5-flash`.

## Chat-Speicherung
Öffentliche KI-Chats werden nicht gespeichert. Wenn ein Admin angemeldet ist und die Lern-KI öffnet, wird dessen Chat separat unter seinem Admin-Konto im Browser gespeichert. Beim Abmelden wird der sichtbare Chat geleert.

## KI-Fehler
`/api/report-ai-error` leitet Fehler nur an `BIG_ADMIN_ERROR_WEBHOOK` weiter. Ohne gesetzten Webhook wird nichts an einen anderen Empfänger gesendet.

Vercel-Umgebungsvariablen:
- `GEMINI_API_KEY`
- optional `GEMINI_MODEL`
- optional `BIG_ADMIN_ERROR_WEBHOOK`

Wichtig: Diese Version verwendet für Konten und lokale Einstellungen weiterhin Browser-Speicher. Für echte zentrale Konten über mehrere Geräte wird zusätzlich eine serverseitige Datenbank/Auth benötigt.
