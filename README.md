# Lessing Schulen Coaching

## Deployment
Die Website ist als statische Oberfläche aufgebaut und enthält zusätzlich einen Vercel-KI-Endpunkt unter `/api/ai`.

### Echte Lern-KI
In Vercel unter **Settings → Environment Variables** setzen:
- `GEMINI_API_KEY` = dein Google-Gemini-API-Key

Danach neu deployen. Der Schlüssel wird ausschließlich serverseitig verwendet und nicht in den Browser-Code geschrieben.

### Gemeinsame Admin-/Chat-Daten
Die aktuelle ZIP speichert Demo-/Fallback-Daten lokal im Browser. Für echte geräteübergreifende Chats, mehrere Admins, Rollen und Big-Admin-Rechte muss ein gemeinsamer Backend-Dienst (z. B. Supabase) mit seinen Projektzugangsdaten verbunden werden. Ohne diese Zugangsdaten kann eine ZIP keine Nachrichten zwischen verschiedenen Geräten übertragen.
