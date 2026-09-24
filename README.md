# Lessing Schulportal – korrigierte Version

## Enthalten
- Startseite getrennt von der Lern-KI
- Lern-KI mit dunkler, farbiger Oberfläche
- keine Schülerkonten
- Termin-/Coaching-Anfragen mit persönlichem Code
- Bereiche: Lerncoaching, Schulleitung, Beratung, Streitklärung
- Lehrkräfte je Bereich auswählbar
- Montag–Freitag, Stundenplan 08:00–16:00
- bestätigte und offene Termine getrennt
- farbliche Kennzeichnung der Bereiche
- Admin und Großadmin
- Großadmin: `admin` / `1234`
- normale Admins können den Großadmin nicht sehen
- Großadmin kann Konten erstellen/löschen
- Admins können Termine und Lehrkräfte verwalten
- Design-Editor
- Vercel API für Lern-KI vorbereitet

## Echte KI
In Vercel als Environment Variable setzen:
`GEMINI_API_KEY=...`
Optional:
`GEMINI_MODEL=gemini-2.5-flash`

## Microsoft-Schulkonto
Für echtes Microsoft/Entra-SSO muss eine Entra-App registriert und deren Client-ID im Admin eingetragen werden. Zusätzlich muss die Redirect-URL der Vercel-Domain in Entra freigegeben werden. Der ZIP enthält die vorbereitete Stelle in den Einstellungen; ohne diese Konfiguration kann kein echter Microsoft-OAuth-Login stattfinden.
