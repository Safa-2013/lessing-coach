# Lessing Coach – aktualisierte Version

## Enthalten
- komplette bestehende Lessing-Schulportal-Oberfläche
- 13:20 **oder** 15:50 als Schulschluss-Auswahl
- normaler KI-Chat
- mehrere lokale KI-Chats mit Namen, Verlauf und Export
- Bild/PDF/Text-Anhang für die KI
- Lernplan-/Quiz-/Erklär-Modi
- Admin-Bereich und Design-Editor aus dem bisherigen Stand
- lokale Sicherung/Import
- serverseitige Gemini-Anbindung über `/api/lern-ki`

## Gemini verbinden
In Vercel unter **Settings → Environment Variables** setzen:

- `GEMINI_API_KEY` = dein Google AI Studio API-Key
- optional `GEMINI_MODEL` = `gemini-3.8-flash`

Der Schlüssel wird **nicht** in `index.html` gespeichert.

## Wichtig
Die aktuelle Version speichert Portal-Daten wie Terminanfragen weiterhin lokal im Browser. Für echte Konten, geräteübergreifende Chatverläufe und zentrale Schulspeicherung braucht es als nächsten Backend-Schritt eine eigene Datenbank/Auth-Schicht.
