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
  if (process.env.DATABASE_URL) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 6000 });
    query = async (sql, args = []) => (await pool.query(sql, args)).rows;
  } else {
    if (process.env.VERCEL) {
      const error = new Error('Datenbank noch nicht eingerichtet. Bitte DATABASE_URL im Vercel-Projekt setzen und erneut veröffentlichen.');
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
    'CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, visitor_id TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, class_name TEXT NOT NULL, subject TEXT NOT NULL, topic TEXT NOT NULL, requested_at TEXT NOT NULL, status TEXT NOT NULL, note TEXT NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS ai_threads (id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, title TEXT NOT NULL, created_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS ai_messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, visitor_id TEXT NOT NULL, role TEXT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
  ];
  for (const statement of statements) await query(statement);
  return { query };
}
