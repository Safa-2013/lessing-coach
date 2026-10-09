# Lessing Coach + Lessing Stars · Update 10

Die ZIP enthält die vollständige Website. `index.html` ist weiterhin die
Startseite von Lessing Coach. Der Terminplaner behält seine Gestaltung.
Lessing Stars öffnet innerhalb der Website; der Coach-Button schließt das Spiel.

## Lokal starten

Node.js ab Version 22 installieren, ZIP entpacken, im Projektordner ausführen:

```
npm install
npm start
```

Anschließend `http://localhost:3000` öffnen. Auf einem Handy dieselbe Adresse
mit der lokalen IP des Computers verwenden, beispielsweise
`http://192.168.1.20:3000`. Beide Geräte müssen im selben WLAN sein.
Eine HTML-Vorschau in der Dateien-App führt keinen Spielserver aus.

## Enthaltene Änderungen

- Serverkonten und Gastzugang; Abmelden, Passwort ändern und Spielkonto löschen.
- Start: Hamza.S., 1500 Münzen, 100 Juwelen, 1000 Powerpunkte, 100 Credits.
- Zentral gespeicherte Käufe, Upgrades, Skins, Belohnungen und Spielstände.
- Drops mit vier Tipps vor der Anzeige; serverseitig vergebene Belohnungen
  werden im Browser nicht erneut addiert. Vorgangs-IDs verhindern doppelte
  Servergutschriften bei wiederholten Anfragen.
- Eine gemeinsame Kampflogik für Training und Serverräume: Bewegung,
  Projektile, Treffer, Wände, Nachladen, Supers, zehn Figuren im Showdown.
- Showdown, Juwelenjagd, Kontrolle, Brawlball, Kopfgeld und Knockout.
- Private Räume mit Code; Gastgeber startet, freie Plätze bekommen Bots.
- Admin: Konten erstellen, sperren/entsperren, Ressourcen/Brawler vergeben;
  Brawler, Skins und Maps erstellen, bearbeiten, veröffentlichen und löschen.
- Figuren-Designer mit Farben, Kopf-/Körperproportionen und Kopfschmuck;
  Bilder hochladen; Angriffs- und Superparameter einstellen.
- Maps auf einem Raster zeichnen, testen und beim Spielstart auswählen.
- Gemeinsame Text-KI für Lerncoach und Admin-Werkstatt. Lern-KI verarbeitet
  zusätzlich PDF, PNG, JPEG und WebP bis 2 MB je Anfrage.
- KI-Entwürfe müssen im Editor geprüft und veröffentlicht werden.
- Foto → Brawler erzeugt einen transparenten **2D-Sprite in 3D-Optik**.
  Es erzeugt kein animiertes 3D-Modell. Bewegung und Schüsse kommen aus
  der Spielengine.

## Server einrichten

Für Vercel müssen die Dateien mit ihrer Ordnerstruktur im Repository liegen.
Nur `index.html` oder die ZIP-Datei hochzuladen reicht nicht.
Vercel verwendet `api/index.js` und die Regeln in `vercel.json`.

Benötigte serverseitige Umgebungsvariablen:

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | Persistente PostgreSQL-Datenbank für Vercel und mehrere Geräte |
| `STARS_ADMIN_PASSWORD` | Passwort für das Spielkonto `admin` beim ersten Anlegen |
| `GEMINI_API_KEY` oder `OPENAI_API_KEY` | Lern-KI und Textentwürfe |
| `OPENAI_API_KEY` | Zusätzlich erforderlich für Foto → Brawler |
| `GEMINI_MODEL` / `OPENAI_MODEL` | Optionales Textmodell; Gemini kann ein verfügbares Flash-Modell ermitteln |
| `STARS_IMAGE_MODEL` | Optionales Modell für die Bildbearbeitung |

Schlüssel ausschließlich am Server konfigurieren. Kein API-Schlüssel gehört
in eine HTML-Datei. KI-Aufrufe können Kosten beim Anbieter verursachen.

Lokal verwendet das Projekt SQLite in `.data/lessing.sqlite`.
Das lokale Spiel-Admin-Passwort ist ohne Konfiguration `1234`.
Auf Vercel wird ohne `STARS_ADMIN_PASSWORD` kein bekanntes Standardpasswort
vergeben. Eine nachträgliche Änderung der Umgebungsvariable verändert kein
bereits bestehendes Kontopasswort; dafür die Passwortänderung im Spiel nutzen.
Coach verwendet weiterhin seine bisherigen Admin-Einstellungen.

## Prüfung und offene Veröffentlichungsschritte

`npm test` prüft Coach-Termine, Rollen, Wartung, Datenbanktransaktionen,
Spielkonten, Ressourcenverteilung, Drops, Räume, Bewegung/Projektile,
UI-Anbindung, Skriptsyntax und KI-Anfrageformate.

Ein tatsächlicher iPhone-/Safari-Test und ein Live-Test mit deinen
KI-Zugangsdaten sind noch erforderlich. Der Testbrowser konnte in dieser
Arbeitsumgebung nicht installiert werden. Eine fehlerfreie Darstellung
auf jedem Gerät ist deshalb nicht bestätigt.

Die ZIP wurde nicht in GitHub hochgeladen und nicht auf Vercel veröffentlicht.
Online-Räume funktionieren nur mit einem laufenden gemeinsamen Server.
Freunde-/Clubanzeigen und Einstellungen aus der bisherigen Oberfläche sind
weiterhin teilweise lokal; ein E-Mail-Passwort-Reset ist nicht enthalten.

Vor Veröffentlichung Betreiber-/Kontaktangaben und Datenschutzhinweise
vervollständigen. KI-Anhänge werden zum gewählten KI-Anbieter übertragen;
die Datei selbst wird hier nicht in der Chat-Datenbank gespeichert. Fragen
und Antworten werden im jeweiligen Coach-Chat gespeichert.
Persönliche Dateien nur hochladen, wenn diese Übertragung gewollt ist.

## Datensicherung

Lokal: `npm run backup` erstellt eine SQLite-Sicherung im Ordner `backups`.
Diese enthält vertrauliche Daten und Passwort-Hashes; nicht im öffentlichen
Repository ablegen. Zur Wiederherstellung Server stoppen und die Sicherung
als `.data/lessing.sqlite` einsetzen; alte `-wal`/`-shm`-Dateien entfernen.

PostgreSQL: Sicherungen über den Datenbankanbieter oder `pg_dump` einrichten.
Eine Sicherung zunächst in einer getrennten Datenbank wiederherstellen und
prüfen. Automatische Sicherungen sind noch nicht auf deinem Konto eingerichtet.

## Änderung vom 08.10.2026: Lern-KI ohne gespeicherten Verlauf

Nur die Verlaufsspeicherung wurde geändert. Aktuelle Nachrichten bleiben im Arbeitsspeicher der offenen KI-Ansicht, damit Folgefragen weiterhin funktionieren. Beim neuen Chat, Verlassen oder Neuladen werden sie verworfen. Keine neuen KI-Nachrichten oder Chattitel werden in der Website-Datenbank gespeichert. Beim Öffnen der Lern-KI entfernt die Website alte gespeicherte KI-Chats des aktuellen Browsers. Kontakt-Chats, Notizen, Termine, Spiel, Modellwahl und übrige Ansicht bleiben unverändert. Dies betrifft die Website-Speicherung; die Datenverarbeitung des KI-Anbieters wird dadurch nicht geändert.

## Spielkorrektur vom 08.10.2026
- Ausschließlich Lessing Stars geändert; Coach-Ansicht, Terminlogik und Lern-KI unverändert.
- Kampflayout zusätzlich direkt eingebettet: Steuerung und Lobby-Schaltfläche im sichtbaren Bildschirm. Spieldateien haben eine neue Cache-Version.
- Kurze Touch-Angriffe werden bis zum nächsten Spielupdate behalten. Loslassen und Pointer-Abbruch beenden die Bewegung.
- Neue Matches ignorieren verspätete Antworten und Animationen alter Matches. Lobby-Wechsel funktioniert auch, wenn das Verlassen des Serverraums scheitert.
- Vollständige transparente Designerfiguren statt Brawler-Karten im Kampf; hochgeladene Figuren/Skins haben Vorrang.
- Training nutzt ausgewählte Powerstufe und Skin. Tastaturfokus liegt beim Start auf dem Spielfeld.
- 17 automatisierte Tests, einschließlich echter Spielengine mit simulierten Tastatur- und Touch-Eingaben. Ein echter iPhone-Safari-Test ist hier nicht durchgeführt: Der Browserdownload war nicht verfügbar.

## Joystick- und Zielsteuerung
- Linker analoger Joystick: Richtung und Geschwindigkeit, auch diagonal.
- Angriffs- und Super-Schaltfläche: Ziehen zum Zielen, Loslassen zum Schießen; kurzer Tipp nutzt das nächste Ziel. Pointer-Abbruch löst keinen Angriff aus.
- Computer: WASD/Pfeile, Maus zum Zielen, Linksklick für Angriff, Rechtsklick/E für Super, Leertaste für Angriff.
- Kamera folgt weich auf beiden Achsen; Ziellinie, Laufbewegung, Munitionsanzeige.
- Kein identischer Nachbau des Brawl-Stars-Spielgefühls zugesichert; Browser-/Gerätetest weiterhin erforderlich.

## iMac und Figuren – 08.10.2026
- Engine, Steuerung und neue Brawler-Grafiken sind direkt in stars-embedded.html enthalten. Externe JS-Dateien und der Engine-Import sind für diese ausgelieferte Spielseite nicht erforderlich.
- Physische KeyW/KeyA/KeyS/KeyD/KeyE-Tasten, Maussteuerung und expliziter Spielfeldfokus.
- Neun transparente Ganzkörper-Sprites anhand der vorhandenen Brawler-Shopvorlage mit Bildgenerierung erstellt. Kampf und Brawler-/Match-Vorschau greifen auf dieselben neuen Figuren zu; eigene hochgeladene Bilder haben Vorrang. Die Grafiken sind abgeleitet, keine exakten 3D-Modelle.
- Neue Cache-Version bundled13. Vollständiges Paket hochladen, nicht nur die Coach-index.html.
- Browserprüfung auf einem echten iMac ist weiterhin nicht durchgeführt.


Spiel-Update 16: Laufbewegungen von Armen und Beinen, Atmen, Blinzeln, Waffenrückstoß, Mündungsfeuer und Trefferblinken. Bewegung in Online-Runden wird lokal vorausberechnet und mit dem Server abgeglichen. Im Match steht "3D v16". Keine Geräteprüfung auf echtem iMac/iPhone; 19 automatisierte Tests bestanden.


Steuerungsupdate 3D v17: Rechtsklick halten zum Zielen, Linksklick zum Schießen (auch gleichzeitig). Super bleibt E oder die Super-Taste. WASD nach physischer Tastenposition; Positionsabgleich wird geglättet. 19 automatisierte Tests bestanden; kein echter Safari-/iMac-Hardwaretest.
