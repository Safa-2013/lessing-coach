# Lessing Schulportal – KI-Fix

## KI
Die KI verwendet standardmäßig `gemini-3.6-flash` statt des nicht mehr verfügbaren `gemini-2.5-flash`.

- Alte gespeicherte `gemini-2.x`-Einstellungen werden beim Laden automatisch auf `gemini-3.6-flash` umgestellt.
- Falls ein API-Konto das Modell nicht anbietet, versucht die API automatisch `gemini-3.8-flash`.
- Die KI benötigt in Vercel weiterhin `GEMINI_API_KEY`.

Google führt Gemini 3.6 Flash als stabiles Modell; Gemini 3.8 Flash ist ebenfalls aktuell verfügbar.

## Anmeldung
- Großadmin: `admin / 1234`
- Hauptadministrator: `lessing / admin123`
- Keine Schülerkonten.
- Mitarbeiter- und Admin-Konten können verwaltet werden.

## Microsoft
Für den Microsoft-Schul-Login müssen Client-ID, Tenant-ID und SPA-Redirect-URL in Microsoft Entra konfiguriert werden.

## Schulzeiten
In der KI gibt es jetzt "Mein Schultag". Montag bis Freitag können individuelle Schulschlusszeiten (z. B. Montag 13:20 und andere Tage 16:00) eingetragen werden. Diese Zeiten werden automatisch an die Lern-KI für Lernpläne und Zeitplanung übergeben.
