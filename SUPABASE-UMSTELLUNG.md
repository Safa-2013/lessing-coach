# Lessing Coach – Supabase-Umstellung vorbereitet

Stand: 25.11.2026. Zielprojekt: clmyssuuyfdhyxekzunq.

## Tatsächlich erledigt

Die vier öffentlich abrufbaren Hauptdateien der ursprünglichen ZIP stimmten
bytegenau mit lessing-coaching.vercel.app überein. Der vorhandene PostgreSQL-
Adapter funktioniert unabhängig von Prisma; Supabase benötigt keine neue
Frontend-Bibliothek und keinen öffentlich sichtbaren Datenbankschlüssel.

Die Admin-Ersteinrichtung läuft nun einmal je Serverinstanz und erneut bei
geänderten Admin-Umgebungsvariablen, statt bei jeder API-Anfrage Passwörter
neu zu hashen und zu speichern. Gleichzeitige Anfragen teilen die Einrichtung.
Fehlgeschlagene Initialisierung kann wiederholt werden.

Der Wartungsstatus wird bei sichtbarer Seite alle 60 statt alle 15 Sekunden
abgerufen. Versteckte Tabs und Offline-Geräte pausieren; Fehler verlängern das
Intervall bis fünf Minuten. Es laufen keine überlappenden Statusanfragen.
Änderungen sind sowohl in app.js als auch im eingebetteten Skript in index.html.
Serverseitige Wartungssperren und Sitzungskontrollen bleiben aktiv.

## Noch nicht ausgeführt

Die aktuelle Supabase-Verbindung verweigerte Zugriff auf das Zielprojekt.
Das Vercel-Projekt war in der verfügbaren Vercel-Verbindung nicht auffindbar.
Deshalb wurden keine Produktionsdaten exportiert, keine Tabellen im Ziel
angelegt, keine Vercel-Variablen geändert und keine neue Version veröffentlicht.
Das beiliegende Skript wurde noch nicht gegen die echten Datenbanken ausgeführt.
Die alten SQLite-Dateien aus der Oktober-ZIP sind kein aktuelles Backup der
Produktionsdaten und werden nicht als Migrationsquelle verwendet.

## Sichere Reihenfolge bei verfügbarem Zugriff

1. Vorhandene Prisma-Datenbank bestehen lassen. Für den Export muss sie wieder
   erreichbar sein. planLimitReached verhindert auch das Auslesen; Freigabe
   im Prisma-Konto bzw. durch Support ist notwendig. Kein kostenpflichtiger
   Tarifwechsel ist durch dieses Paket veranlasst.
2. Aktive Schreibzugriffe auf die alte Website für die gesamte Übertragung
   anhalten. Der Snapshot des Skripts ist konsistent, spätere Schreibzugriffe
   in Prisma würden aber nicht in Supabase landen.
3. Bestehende Vercel-Konfiguration sichern. Den effektiven bisherigen Chat-Schlüssel
   als CHAT_ID_SECRET beibehalten: bereits gesetztes CHAT_ID_SECRET, sonst die
   bisherige DATABASE_URL, sonst INITIAL_ADMIN_PASSWORD, sonst lessing-chat.
   Ohne diesen Schritt verändert der Wechsel der DATABASE_URL die Zuordnung
   bestehender Schüler-Chats. Geheimnisse ausschließlich in Umgebungsvariablen
   speichern, niemals in Git, Screenshots oder diesem Dokument.
4. Supabase Data API deaktiviert lassen. Für das Übertragungsskript aus dem
   Connect-Dialog die Direct-Verbindung verwenden, bei fehlender IPv6-Erreichbarkeit
   den Session-Pooler. Passwörter mit Sonderzeichen URL-kodieren und die
   erforderlichen SSL-/Zertifikatsparameter übernehmen.
5. Auf einem Rechner mit Node >=22, npm sowie passenden PostgreSQL-Clients
   pg_dump und pg_restore zunächst npm ci ausführen. SOURCE_DATABASE_URL auf
   die bisherige Verbindung und TARGET_DATABASE_URL auf Supabase setzen.
   npm run migrate:postgres prüft Quelle, Ziel und Tabellen, ohne zu schreiben.
6. npm run migrate:postgres -- --apply erstellt ein privates Backup unter backups/,
   übernimmt Tabellen und Daten in einer Transaktion und vergleicht Zeilenzahlen.
   Existierende App-Tabellen im Ziel führen zum Abbruch; es wird nichts gelöscht
   oder überschrieben. Quellzugriffe sind nur lesend. Row Level Security wird
   aktiviert und anon/authenticated erhalten keine Tabellenrechte. Die App
   verwendet weiterhin die serverseitige PostgreSQL-Verbindung.
7. Erst nach erfolgreicher Übertragung in Vercel DATABASE_URL auf die Supabase-
   Verbindung des Transaction-Poolers setzen. Host und Benutzername exakt aus
   dem Supabase-Connect-Dialog übernehmen. CHAT_ID_SECRET aus Schritt 3 sowie
   vorhandene Admin- und KI-Variablen beibehalten. Alte Prisma-Variablen für
   Rückfall vorerst aufbewahren; DATABASE_URL hat im Code Vorrang.
8. Diese aktualisierten Dateien deployen. Bootstrap, Anmeldung, bestehende
   Chats, Termine, Lehrerkalender und Stars-Spielstände prüfen. Bei Problemen
   bisherigen Code und DATABASE_URL zurücksetzen. Nach neuen Schreibzugriffen
   in Supabase müssen diese vor einem Rückfall abgeglichen werden.
9. Prisma erst nach bestätigter Übertragung und Funktionstests kündigen/löschen.

Backups enthalten persönliche Daten und Passwort-Hashes: privat aufbewahren.
Dieses Paket enthält keinen Produktions-Dump und keine Zugangsdaten.

Dokumentation:
https://supabase.com/docs/guides/database/connecting-to-postgres
https://www.prisma.io/docs/postgres/error-reference
