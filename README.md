# Lessing Coach – Final

## Enthalten
- `index.html` – komplette Oberfläche
- `api/lern-ki.js` – KI-Proxy
- `api/report-ai-error.js` – Fehlerweiterleitung ausschließlich an den Hauptadmin-Webhook

## Admin-Zugänge
- Normaler Admin: `Lessing` / `Schulen`
- Big Admin: `admin` / `1234`
- Wichtig: Die Startpasswörter werden aus `INITIAL_ADMIN_PASSWORD` und `INITIAL_BIG_ADMIN_PASSWORD` gelesen. Für den gewünschten Teststand können dort `Schulen` und `1234` gesetzt werden; neue Admin-Konten verlangen weiterhin starke Passwörter.

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

## Vercel-Konfiguration
Akzeptierte Datenbank-Variablen sind `DATABASE_URL`, `DATABASE_PRISMA_DATABASE_URL` oder `DATABASE_POSTGRES_URL`; `DATABASE_URL` hat Vorrang. Für die KI wird `GEMINI_API_KEY` oder alternativ `OPENAI_API_KEY` benötigt.
