# Lessing Coach – V3

## Enthalten
- zentrale Supabase-Datenbank für Konten, Chats, Lehrkräfte und Termine
- Custom-Login für Lessing-Portal
- Großadmin technisch getrennt; normale Admins erhalten keinerlei Großadmin-Daten
- Hauptadmin: Benutzer `lessing`, Passwort `Schulen`
- Großadmin: Benutzer `admin`, Passwort `1234`
- normale Admins können Admin-/Mitarbeiterkonten erstellen; Großadmin kann zusätzlich Großadmin-Konten erstellen
- keine Schülerkonten
- öffentliche Terminanfrage mit Bereich, Lehrkraft und Schulschluss 13:20/15:50
- persönlicher Anfragecode
- angefragte Termine und manuell erstellte Termine getrennt
- Termin-Kollisionen werden serverseitig geprüft
- Stundenplan Mo–Fr 08:00–16:00
- zentrale KI-Chats pro Admin-Konto
- mehrere Chats, neuer Chat, Umbenennen, Löschen
- KI-Scrollposition bleibt beim Lesen älterer Nachrichten erhalten
- Gemini 3.8 Flash für die KI
- responsive Handy-/Desktopansichten

## KI aktivieren
In den Supabase Edge-Function Secrets `GEMINI_API_KEY` setzen. Google listet `gemini-3.8-flash` als stabiles Produktionsmodell; Gemini 2.5 Flash ist für neue Projekte eingeschränkt. 

## Deployment
Die Edge Function `lessing-portal` ist bereits im verbundenen Supabase-Projekt bereitgestellt. Für eine statische Vercel/Netlify-Seite genügt `index.html` aus diesem Ordner.
