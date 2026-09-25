# Lessing Schulportal – KI-Fix

## KI
Die KI verwendet standardmäßig `gemini-3.6-flash` statt des nicht mehr verfügbaren `gemini-2.5-flash`.

- Alte gespeicherte `gemini-2.x`-Einstellungen werden beim Laden automatisch auf `gemini-3.6-flash` umgestellt.
- Falls ein API-Konto das Modell nicht anbietet, versucht die API automatisch `gemini-3.8-flash`.
- Die KI benötigt in Vercel weiterhin `GEMINI_API_KEY`.

Google führt Gemini 3.6 Flash als stabiles Modell; Gemini 3.8 Flash ist ebenfalls aktuell verfügbar.

## Anmeldung
- Großadmin: `admin / 1234`
- Hauptadministrator: `lessing / Schulen`
- Normale Admins können weitere Admin- und Mitarbeiterkonten erstellen.
- Das Systemkonto `admin` und das Hauptkonto `lessing` sind geschützt und können nicht gelöscht werden.
- Keine Schülerkonten.
- Mitarbeiter- und Admin-Konten können verwaltet werden.

## Microsoft
Für den Microsoft-Schul-Login müssen Client-ID, Tenant-ID und SPA-Redirect-URL in Microsoft Entra konfiguriert werden.

## Schulzeiten
In der KI gibt es jetzt "Mein Schultag". Montag bis Freitag können individuelle Schulschlusszeiten (z. B. Montag 13:20 und andere Tage 16:00) eingetragen werden. Diese Zeiten werden automatisch an die Lern-KI für Lernpläne und Zeitplanung übergeben.


## KI-Chat-Speicherung
- KI-Chats werden ausschließlich für angemeldete Admin-Konten (`admin`/`bigadmin`) dauerhaft gespeichert.
- Nicht angemeldete Nutzer und normale Schülerkonten erhalten einen nicht-persistenten Chat; beim Neuladen wird dieser nicht aus dem gemeinsamen Speicher geladen.
- Dadurch wird verhindert, dass ein gemeinsamer Gast-Chat zwischen verschiedenen Nutzern angezeigt wird.


## Finaler Stand
- Hauptkonto: `lessing` / `Schulen`
- Großadmin: `admin` / `1234`
- Normale Admins sehen keinen Großadmin und können Admin-/Mitarbeiterkonten erstellen.
- Schulschluss im Terminformular: 13:20 Uhr oder 15:50 Uhr.
- KI-Chats werden nur für angemeldete Admin-/Großadmin-Konten gespeichert und nach Konto getrennt.
- Die KI-Chatfläche passt ihre Höhe an den tatsächlichen Inhalt an; lange Verläufe werden innerhalb des Chatbereichs gescrollt.
- Der übrige Portalaufbau wurde aus dem bestehenden Stand übernommen.

## Neuer Stand 25.09.2026
- Startseite auf das neue Lessing-Schulen-Coaching-Layout umgestellt: linke Navigation, drei Hauptbereiche und Anmelden oben rechts.
- Kontakt: Besucher können ohne Schülerkonto direkt mit der Administration schreiben.
- Hilfe: integrierte Schritt-für-Schritt-Anleitung.
- KI-Chat: künstliche Leerflächen nach dem Start/bei Nachrichten entfernt; der Chatbereich wächst nur nach tatsächlichem Inhalt und scrollt erst bei langen Verläufen.
- Kontakt-Chat: Alle Admin-Konten können denselben Kontakt-Chat sehen, wenn der gemeinsame Vercel/Upstash-KV-Speicher eingerichtet ist. Ohne diesen Speicher funktioniert der Kontakt lokal im Browser; geräteübergreifende Synchronisierung ist dann technisch nicht möglich.
- Es wurden keine Schülerkonten hinzugefügt.
