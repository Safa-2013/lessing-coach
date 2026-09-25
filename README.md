# Lessing Schulen Coaching – flache Projektstruktur

Alle Dateien liegen direkt im Hauptordner. Es gibt keinen `api`-Unterordner.

Enthalten sind:
- Startseite
- mobile Navigation
- Termin & Coaching
- Termine / Anfragecode
- Lern-KI-Ansicht
- Kontakt-Chat
- Hilfe
- Über Lessing
- Adminbereich
- vorbereitete KI-/Fehler-Endpunkte
- Supabase-Schema

Wichtig:
Eine echte serverseitige KI und geräteübergreifende Admin-Synchronisierung können nicht allein durch eine statische ZIP entstehen. Dafür muss ein externer Backend-/Supabase-Endpunkt in `backend-config.js` eingetragen und eingerichtet werden. Die Website fällt ohne diesen Endpunkt nicht auf eine kaputte `/api/...`-Route zurück.
