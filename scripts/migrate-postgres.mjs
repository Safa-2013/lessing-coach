import { spawnSync } from 'node:child_process';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const help = `Lessing Coach: PostgreSQL sicher nach Supabase übertragen
Benötigt: Node >=22, npm ci, pg_dump und pg_restore (passende PostgreSQL-Version).
SOURCE_DATABASE_URL = bestehende Prisma-Verbindung
TARGET_DATABASE_URL = Supabase Direct- oder Session-Pooler-Verbindung
npm run migrate:postgres              Nur Verbindungen, Tabellen und Ziel prüfen
npm run migrate:postgres -- --apply   Backup erstellen und in leeres Ziel übertragen
Bestehende Tabellen im Ziel werden niemals überschrieben. Quelle bleibt unverändert.
Vor --apply alte Website für Schreibzugriffe schließen; Verbindungslimits bei Prisma
müssen auch für den Export aufgehoben sein. Keine Passwörter als Kommandoargumente.`;
if (process.argv.includes('--help')) { console.log(help); process.exit(0); }
const unknown = process.argv.slice(2).filter(x => x !== '--apply');
if (unknown.length) { console.error('Unbekannte Option. Nutze --help.'); process.exit(1); }
const sourceURL = process.env.SOURCE_DATABASE_URL;
const targetURL = process.env.TARGET_DATABASE_URL;
const allowed = new Set(['accounts','sessions','appointments','messages','ai_threads','ai_messages','content','teachers','teacher_calendar_codes','categories','teacher_categories','chat_profiles','chat_staff_notes','appointment_notes','stars_users','stars_sessions','stars_receipts','stars_skins','stars_maps','stars_fighters','stars_rooms','stars_rewards','stars_audit']);
const quote = name => '"' + name.replaceAll('"','""') + '"';
let source, target, snapshot;
try {
  if (!sourceURL || !targetURL) throw Error('SOURCE_DATABASE_URL und TARGET_DATABASE_URL fehlen.');
  const a = new URL(sourceURL), b = new URL(targetURL);
  if (![a.protocol,b.protocol].every(p => ['postgres:','postgresql:'].includes(p))) throw Error('PostgreSQL-Verbindungen erforderlich.');
  if (a.hostname === b.hostname && a.port === b.port && a.pathname === b.pathname && a.username === b.username) throw Error('Quelle und Ziel dürfen nicht gleich sein.');
  const { Pool } = await import('pg');
  source = new Pool({connectionString:sourceURL,max:1,connectionTimeoutMillis:15000});
  target = new Pool({connectionString:targetURL,max:1,connectionTimeoutMillis:15000});
  snapshot = await source.connect();
  await snapshot.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const tables = (await snapshot.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(x=>x.tablename);
  if (!tables.includes('accounts') || !tables.includes('content')) throw Error('Quelle ist keine vollständige Lessing-Coach-Datenbank.');
  if (tables.some(t=>!allowed.has(t))) throw Error('Unbekannte Tabellen in der Quelle: Übertragung vor Ausführung manuell prüfen.');
  const existing = (await target.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
  if (existing.some(x=>allowed.has(x.tablename))) throw Error('Ziel enthält bereits App-Tabellen. Abbruch ohne Überschreiben.');
  const counts = {};
  for (const name of tables) counts[name] = (await snapshot.query(`SELECT count(*)::text AS count FROM public.${quote(name)}`)).rows[0].count;
  console.log('Quelle erreichbar; Ziel erreichbar und frei. Tabellen/Zeilen:', counts);
  if (!process.argv.includes('--apply')) {
    console.log('Prüfung erfolgreich. Es wurden keine Daten verändert. Für Übertragung --apply verwenden.');
  } else {
    for (const tool of ['pg_dump','pg_restore']) {
      const r = spawnSync(tool,['--version'],{encoding:'utf8'});
      if (r.error || r.status !== 0) throw Error(`${tool} fehlt. PostgreSQL-Client installieren.`);
    }
    const directory = resolve('backups'); mkdirSync(directory,{recursive:true,mode:0o700});
    const file = resolve(directory,`prisma-before-supabase-${new Date().toISOString().replaceAll(':','-')}.dump`);
    const snapshotID = (await snapshot.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    // Credentials travel through the subprocess environment, never command arguments.
    // This dump is the authoritative backup; the source database is read-only.
    const dump = spawnSync('pg_dump',['--format=custom','--no-owner','--no-acl',`--snapshot=${snapshotID}`,`--file=${file}`,...tables.map(t=>`--table=public.${quote(t)}`)],{env:{...process.env,PGDATABASE:sourceURL},encoding:'utf8',maxBuffer:1024*1024});
    if (dump.error || dump.status !== 0) throw Error('Backup fehlgeschlagen. Ziel wurde nicht verändert. PostgreSQL-Version und Quellzugriff prüfen.');
    chmodSync(file,0o600);
    await snapshot.query('COMMIT'); snapshot.release(); snapshot = null;
    console.log('Backup erstellt:', file);
    const restore = spawnSync('pg_restore',['--single-transaction','--exit-on-error','--no-owner','--no-acl','--dbname='+b.pathname.slice(1),file],{env:{...process.env,PGHOST:b.hostname,PGPORT:b.port||'5432',PGUSER:decodeURIComponent(b.username),PGPASSWORD:decodeURIComponent(b.password),PGSSLMODE:b.searchParams.get('sslmode')||'verify-full',...(b.searchParams.get('sslrootcert')?{PGSSLROOTCERT:b.searchParams.get('sslrootcert')}:{})},encoding:'utf8',maxBuffer:1024*1024});
    if (restore.error || restore.status !== 0) throw Error('Import fehlgeschlagen und zurückgerollt. Backup bleibt erhalten.');
    const client = await target.connect();
    try {
      await client.query('BEGIN');
      for (const name of tables) {
        const actual = (await client.query(`SELECT count(*)::text AS count FROM public.${quote(name)}`)).rows[0].count;
        if (actual !== counts[name]) throw Error(`Zeilenanzahl stimmt nicht überein: ${name}. Keine Freigabe für Produktivwechsel.`);
        await client.query(`ALTER TABLE public.${quote(name)} ENABLE ROW LEVEL SECURITY`);
        await client.query(`REVOKE ALL ON TABLE public.${quote(name)} FROM anon, authenticated`);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    console.log('Übertragung und Zeilenzahlen geprüft. Zugriff für Browser-Rollen gesperrt. Vercel wurde noch nicht umgestellt.');
  }
} catch (e) {
  let message = String(e.message);
  for (const secret of [sourceURL,targetURL].filter(Boolean)) message = message.replaceAll(secret,'[VERBINDUNG VERDECKT]');
  console.error(message); process.exitCode = 1;
} finally {
  if (snapshot) { await snapshot.query('ROLLBACK').catch(()=>{}); snapshot.release(); }
  await Promise.all([source?.end(),target?.end()]);
}
