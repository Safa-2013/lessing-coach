# Lessing Schulportal – korrigierte Version

## Enthalten
- Startseite des Schulportals bleibt getrennt von der Lern-KI.
- Lern-KI ohne Fachauswahl, dunkle/bunte Oberfläche.
- Anmeldung per Benutzername/Passwort.
- Microsoft Schul-/Office-365-Anmeldung über Microsoft Entra ID / MSAL, sobald Client-ID und Redirect-URI eingerichtet sind.
- Keine Schülerkonten.
- Schüler stellen Terminanfragen ohne Konto und erhalten einen 6-stelligen Anfragecode.
- Mehrere Termine können denselben Anfragecode verwenden.
- Bereiche: Lerncoaching, Schulleitung, Beratung, Streitklärung – jeweils eigene Farbe.
- Lehrkraftauswahl wird automatisch auf den gewählten Bereich begrenzt.
- Admin kann Termine bestätigen, bearbeiten und löschen.
- Terminüberschneidungen derselben Lehrkraft werden blockiert.
- Stundenplan Montag–Freitag, 08:00–16:00 in 30-Minuten-Schritten.
- Großadmin kann Admin-, Mitarbeiter- und Großadmin-Konten erstellen.
- Normale Admins sehen den Großadmin-Bereich nicht.
- Passwortänderung und Lehrkraft-Bearbeitung vorhanden.
- Design-Editor für Portal-Farben.
- Lern-KI über `/api/lern-ki` mit Gesprächsverlauf.

## Systemkonto
- Benutzername: `admin`
- Passwort: `1234`

Dieses Konto ist als System-Großadmin angelegt und kann nicht gelöscht werden.

## Vercel / KI
Environment Variable setzen:
`GEMINI_API_KEY=...`
Optional:
`GEMINI_MODEL=gemini-2.5-flash`

## Microsoft Entra
Im Admin → Einstellungen Client-ID und Tenant eintragen.
Als SPA-Redirect-URI muss exakt die Domain eingetragen werden, auf der das Portal läuft, z. B. `https://deine-domain.de`.
Benötigte Delegated Permissions für den Popup-Login: `openid`, `profile`, `email`, `User.Read`.

## Wichtiger technischer Hinweis
Diese ZIP ist eine eigenständig lauffähige Frontend-Version mit Browser-Speicherung. Für echte gemeinsame Daten auf mehreren Geräten braucht das Portal zusätzlich eine zentrale Datenbank (z. B. Supabase) und serverseitige Authentifizierung. Microsoft SSO und die Gemini-KI benötigen die oben genannten Konfigurationen.
