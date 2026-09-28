import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let dbPromise;
export async function database() {
  if (!dbPromise) dbPromise = connect().catch(e => { dbPromise = undefined; throw e; });
  return dbPromise;
}

async function connect() {
  let query;
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PRISMA_DATABASE_URL || process.env.DATABASE_POSTGRES_URL;
  if (connectionString) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 6000 });
    query = async (sql, args = []) => (await pool.query(sql, args)).rows;
  } else {
    if (process.env.VERCEL) {
      const error = new Error('Datenbank noch nicht eingerichtet. Bitte DATABASE_URL (oder DATABASE_PRISMA_DATABASE_URL / DATABASE_POSTGRES_URL) im Vercel-Projekt setzen und erneut veröffentlichen.');
      error.status = 503;
      throw error;
    }
    mkdirSync('.data', { recursive: true });
    const local = new DatabaseSync(resolve('.data/lessing.sqlite'));
    local.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    query = async (sql, args = []) => {
      const bindings = [];
      const sqliteSql = sql.replace(/\$(\d+)/g, (_, n) => { bindings.push(args[Number(n) - 1]); return '?'; });
      const statement = local.prepare(sqliteSql);
      return statement.all(...bindings);
    };
  }
  const statements = [
    'CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, permissions TEXT NOT NULL, created_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, account_id TEXT, expires_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, visitor_id TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, class_name TEXT NOT NULL, subject TEXT NOT NULL, topic TEXT NOT NULL, requested_at TEXT NOT NULL, appointment_time TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL, note TEXT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, school_end TEXT NOT NULL DEFAULT \'\', category_id TEXT, teacher_id TEXT)',
    'CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS ai_threads (id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, title TEXT NOT NULL, created_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS ai_messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, visitor_id TEXT NOT NULL, role TEXT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  ];
  for (const statement of statements) await query(statement);
  // Existing installations keep their appointments; new requests also record school end.
  for (const alter of [
    "ALTER TABLE appointments ADD COLUMN school_end TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE appointments ADD COLUMN category_id TEXT",
    "ALTER TABLE appointments ADD COLUMN teacher_id TEXT",
    "ALTER TABLE appointments ADD COLUMN appointment_time TEXT NOT NULL DEFAULT ''"
  ]) {
    try { await query(alter); }
    catch (error) {
      if (!/duplicate column|already exists/i.test(error.message)) throw error;
    }
  }
  await query("CREATE TABLE IF NOT EXISTS teachers (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL)");
  await query("CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at BIGINT NOT NULL)");
  await query("CREATE TABLE IF NOT EXISTS teacher_categories (teacher_id TEXT NOT NULL, category_id TEXT NOT NULL, PRIMARY KEY (teacher_id,category_id))");
  await query("CREATE TABLE IF NOT EXISTS chat_profiles (chat_key TEXT PRIMARY KEY, visitor_id TEXT NOT NULL UNIQUE, class_name TEXT NOT NULL, created_at BIGINT NOT NULL)");
  await query("CREATE TABLE IF NOT EXISTS appointment_notes (id TEXT PRIMARY KEY, appointment_id TEXT, code TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, class_name TEXT NOT NULL, category_name TEXT NOT NULL, teacher_name TEXT NOT NULL, requested_at TEXT NOT NULL, appointment_time TEXT NOT NULL, note TEXT NOT NULL, reason TEXT NOT NULL, created_at BIGINT NOT NULL)");
  const categorySeeds = [
    ['beratung','Beratung','#F59E0B'],
    ['schulleitung','Schulleitung','#8B5CF6'],
    ['lerncoaching','Lerncoaching','#10B981'],
    ['konflikte','Konflikte klären','#EF4444'],
    ['sonstiges','Sonstiges','#3B82F6']
  ];
  for (const [cid,name,color] of categorySeeds) {
    await query("INSERT INTO categories (id,name,color,active,created_at) VALUES ($1,$2,$3,1,$4) ON CONFLICT (id) DO NOTHING", [cid,name,color,Date.now()]);
  }
  return { query };
}
