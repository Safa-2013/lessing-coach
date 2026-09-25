LESSING COACH – ADMIN / KI UPDATE

- Keine Schülerkonten.
- Hauptadmin: Lessing / Schulen
- Normaler Admin: admin / 1234
- Hauptadmin kann andere Admin-Konten ohne deren Passwort öffnen.
- Hauptadmin bleibt normalen Admins gegenüber verborgen.
- Normale Admins können weitere normale Admin-Konten erstellen.
- KI-Fehler werden ausschließlich im Hauptadmin-Bereich „KI-Fehler“ gesammelt.
- Optional kann settings.aiErrorEndpoint auf einen eigenen serverseitigen Endpoint gesetzt werden; nur dieser Endpoint erhält die Fehlerdaten.
- Schüler-/öffentliche Ansicht und Admin-Design sind getrennt.

Wichtig: Diese ZIP ist weiterhin eine einzelne HTML-App mit localStorage. Für echte gemeinsame Konten und Fehlerzustellung über mehrere Geräte braucht die Anwendung einen serverseitigen Speicher/Auth-Dienst. Die Oberfläche verhindert die Anzeige für normale Admins, ersetzt aber keine serverseitige Zugriffskontrolle.
