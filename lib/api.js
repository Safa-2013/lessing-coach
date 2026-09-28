import { randomBytes, randomUUID, createHash, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { database } from './db.js';

const now = () => Date.now();
const id = () => randomUUID();
const digest = value => createHash('sha256').update(value).digest('hex');
const hashPassword = password => { const salt = randomBytes(16).toString('hex'); return `${salt}:${pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex')}`; };
const checkPassword = (password, stored) => { const [salt, hash] = stored.split(':'); return !!hash && timingSafeEqual(Buffer.from(hash, 'hex'), pbkdf2Sync(password, salt, 210000, 32, 'sha256')); };
const clean = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
const json = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)); };
const fail = (code, message) => { const e = new Error(message); e.status = code; throw e; };
const permitted = (session, permission) => session.role === 'big' || session.role === 'admin' && session.permissions.includes(permission);

async function seed(db) {
  const all = await db.query('SELECT id, username FROM accounts WHERE username=$1 OR username=$2', ['Lessing', 'admin']);
  for (const [username, role, password] of [['Lessing', 'admin', process.env.INITIAL_ADMIN_PASSWORD || 'Schulen'], ['admin', 'big', process.env.INITIAL_BIG_ADMIN_PASSWORD || '1234']]) {
    if (!all.some(a => a.username === username)) await db.query('INSERT INTO accounts (id,username,password_hash,role,permissions,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (username) DO NOTHING', [id(), username, hashPassword(password), role, JSON.stringify(['appointments','chats','content']), now()]);
  }
}
async function sessionFor(req, res, db) {
  const token = /(?:^|;\s*)lessing_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
  let session;
  if (token) session = (await db.query('SELECT s.visitor_id, s.account_id, a.role, a.permissions FROM sessions s LEFT JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>$2', [digest(token), now()]))[0];
  if (!session) {
    session = { visitor_id: id(), account_id: null, role: null, permissions: '[]' };
    await issue(req, res, db, session);
  }
  session.permissions = JSON.parse(session.permissions || '[]');
  return session;
}
async function issue(req, res, db, session) {
  const token = randomBytes(32).toString('base64url');
  await db.query('INSERT INTO sessions (token_hash,visitor_id,account_id,expires_at) VALUES ($1,$2,$3,$4)', [digest(token), session.visitor_id, session.account_id, now() + 30 * 86400000]);
  res.setHeader('Set-Cookie', `lessing_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.VERCEL || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
}
function bodyOf(req) { if (typeof req.body === 'object' && req.body) return req.body; try { return JSON.parse(req.body || '{}'); } catch { fail(400, 'Ungültige Daten'); } }
function requireAdmin(session, permission) { if (!permitted(session, permission)) fail(403, 'Kein Zugriff'); }
function scope(session) { return { role: session.role || 'visitor', permissions: session.permissions }; }

export default async function api(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const path = '/' + String(req.query?.path || url.pathname.replace(/^\/api\/?/, '')).replace(/^\//, '');
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) fail(405, 'Methode nicht erlaubt');
    if (req.method !== 'GET') {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) fail(403, 'Ungültige Herkunft');
    }
    const db = await database();
    await seed(db);
    let session = await sessionFor(req, res, db);
    const body = req.method === 'GET' ? {} : bodyOf(req);
    if (path === '/bootstrap' && req.method === 'GET') {
      const rows = await db.query('SELECT key,value FROM content');
      return json(res, 200, { session: scope(session), content: Object.fromEntries(rows.map(r => [r.key, r.value])) });
    }
    if (path === '/login' && req.method === 'POST') {
      const account = (await db.query('SELECT * FROM accounts WHERE username=$1', [clean(body.username, 80)]))[0];
      if (!account || !checkPassword(String(body.password || ''), account.password_hash)) fail(401, 'Anmeldung fehlgeschlagen');
      const old = /(?:^|;\s*)lessing_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      if (old) await db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(old)]);
      session = { visitor_id: session.visitor_id, account_id: account.id, role: account.role, permissions: JSON.parse(account.permissions) };
      await issue(req, res, db, session);
      return json(res, 200, { session: scope(session) });
    }
    if (path === '/logout' && req.method === 'POST') {
      const old = /(?:^|;\s*)lessing_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
      if (old) await db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(old)]);
      await issue(req, res, db, { visitor_id: id(), account_id: null });
      return json(res, 200, { session: { role: 'visitor', permissions: [] } });
    }
    if (path === '/appointments' && req.method === 'POST') {
      const fields = ['first_name','last_name','class_name','subject','topic','requested_at'].map(k => clean(body[k], k === 'topic' ? 500 : 100));
      if (fields.some(x => !x)) fail(400, 'Bitte alle Felder ausfüllen');
      const code = 'LS-' + randomBytes(9).toString('hex').toUpperCase();
      await db.query('INSERT INTO appointments (id,code,visitor_id,first_name,last_name,class_name,subject,topic,requested_at,status,note,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', [id(), code, session.visitor_id, ...fields, 'Anfrage eingegangen', '', now(), now()]);
      return json(res, 201, { code, status: 'Anfrage eingegangen' });
    }
    if (path === '/appointments' && req.method === 'GET') {
      const code = clean(url.searchParams.get('code'), 40).toUpperCase();
      if (!code) fail(400, 'Anfragecode fehlt');
      const appointment = (await db.query('SELECT code,first_name,last_name,class_name,subject,topic,requested_at,status,note,updated_at FROM appointments WHERE code=$1', [code]))[0];
      if (!appointment) fail(404, 'Kein Termin zu diesem Code gefunden');
      return json(res, 200, { appointment });
    }
    if (path === '/messages' && req.method === 'GET') {
      const rows = await db.query('SELECT id,author,body,created_at FROM messages WHERE visitor_id=$1 ORDER BY created_at ASC LIMIT 200', [session.visitor_id]);
      return json(res, 200, { messages: rows });
    }
    if (path === '/messages' && req.method === 'POST') {
      const message = clean(body.message, 2000);
      if (!message) fail(400, 'Nachricht fehlt');
      await db.query('INSERT INTO messages (id,visitor_id,author,body,created_at) VALUES ($1,$2,$3,$4,$5)', [id(), session.visitor_id, 'visitor', message, now()]);
      return json(res, 201, { ok: true });
    }
    if (path === '/ai/threads' && req.method === 'GET') {
      const threads = await db.query('SELECT id,title,created_at FROM ai_threads WHERE visitor_id=$1 ORDER BY created_at DESC LIMIT 50', [session.visitor_id]);
      return json(res, 200, { threads });
    }
    if (path === '/ai/threads' && req.method === 'POST') {
      const thread = { id: id(), title: clean(body.title, 80) || 'Neuer Chat' };
      await db.query('INSERT INTO ai_threads (id,visitor_id,title,created_at) VALUES ($1,$2,$3,$4)', [thread.id, session.visitor_id, thread.title, now()]);
      return json(res, 201, { thread });
    }
    if (path.startsWith('/ai/threads/') && req.method === 'GET') {
      const thread = (await db.query('SELECT id,title FROM ai_threads WHERE id=$1 AND visitor_id=$2', [path.split('/')[3], session.visitor_id]))[0];
      if (!thread) fail(404, 'Chat nicht gefunden');
      const messages = await db.query('SELECT role,body,created_at FROM ai_messages WHERE thread_id=$1 AND visitor_id=$2 ORDER BY created_at ASC LIMIT 100', [thread.id, session.visitor_id]);
      return json(res, 200, { thread, messages });
    }
    if (path === '/ai/progress' && req.method === 'GET') {
      const threads = await db.query('SELECT id FROM ai_threads WHERE visitor_id=$1', [session.visitor_id]);
      const questions = await db.query('SELECT id FROM ai_messages WHERE visitor_id=$1 AND role=$2', [session.visitor_id, 'user']);
      return json(res, 200, { chats: threads.length, questions: questions.length });
    }
    if (path === '/ai/ask' && req.method === 'POST') {
      const prompt = clean(body.message, 4000), threadId = clean(body.thread_id, 50);
      if (!prompt) fail(400, 'Frage fehlt');
      const thread = (await db.query('SELECT id FROM ai_threads WHERE id=$1 AND visitor_id=$2', [threadId, session.visitor_id]))[0];
      if (!thread) fail(404, 'Chat nicht gefunden');
      if (!process.env.OPENAI_API_KEY) fail(503, 'Lern-KI ist noch nicht eingerichtet: OPENAI_API_KEY fehlt.');
      const recent = await db.query('SELECT role,body FROM ai_messages WHERE thread_id=$1 AND visitor_id=$2 ORDER BY created_at DESC LIMIT 12', [threadId, session.visitor_id]);
      const count = await db.query('SELECT id FROM ai_messages WHERE visitor_id=$1 AND role=$2 AND created_at>$3 LIMIT 11', [session.visitor_id, 'user', now() - 60000]);
      if (count.length >= 10) fail(429, 'Bitte eine Minute warten, bevor du weitere Fragen sendest.');
      const upstream = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', store: false, max_output_tokens: 900, instructions: 'Du bist ein freundlicher deutschsprachiger Lerncoach für Schüler. Erkläre verständlich und altersgerecht. Unterstütze beim selbstständigen Lernen; bei Hausaufgaben erst den Lösungsweg erklären. Keine erfundenen Fakten. Gib bei Unsicherheit diese an. Verwende keine persönlichen Namen.', input: [...recent.reverse().map(r => ({ role: r.role, content: r.body })), { role: 'user', content: prompt }] }), signal: AbortSignal.timeout(25000) });
      if (!upstream.ok) fail(502, 'KI-Dienst ist gerade nicht erreichbar. Bitte später erneut versuchen.');
      const result = await upstream.json();
      const answer = result.output?.flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n').trim();
      if (!answer) fail(502, 'Die KI hat keine Antwort zurückgegeben.');
      await db.query('INSERT INTO ai_messages (id,thread_id,visitor_id,role,body,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [id(), threadId, session.visitor_id, 'user', prompt, now()]);
      await db.query('INSERT INTO ai_messages (id,thread_id,visitor_id,role,body,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [id(), threadId, session.visitor_id, 'assistant', answer, now()]);
      return json(res, 200, { answer });
    }
    if (path === '/admin/appointments' && req.method === 'GET') {
      requireAdmin(session, 'appointments');
      return json(res, 200, { appointments: await db.query('SELECT * FROM appointments ORDER BY created_at DESC LIMIT 200') });
    }
    if (path === '/admin/appointments' && req.method === 'PATCH') {
      requireAdmin(session, 'appointments');
      const allowed = ['Anfrage eingegangen','In Bearbeitung','Bestätigt','Abgesagt'];
      if (!allowed.includes(body.status)) fail(400, 'Ungültiger Status');
      await db.query('UPDATE appointments SET status=$1,note=$2,updated_at=$3 WHERE id=$4', [body.status, clean(body.note, 500), now(), clean(body.id, 50)]);
      return json(res, 200, { ok: true });
    }
    if (path === '/admin/chats' && req.method === 'GET') {
      requireAdmin(session, 'chats');
      const chats = await db.query('SELECT visitor_id, MAX(created_at) AS last_at, COUNT(*) AS count FROM messages GROUP BY visitor_id ORDER BY last_at DESC LIMIT 100');
      return json(res, 200, { chats });
    }
    if (path.startsWith('/admin/chats/') && req.method === 'GET') {
      requireAdmin(session, 'chats');
      return json(res, 200, { messages: await db.query('SELECT id,author,body,created_at FROM messages WHERE visitor_id=$1 ORDER BY created_at ASC LIMIT 200', [path.split('/')[3]]) });
    }
    if (path.startsWith('/admin/chats/') && req.method === 'POST') {
      requireAdmin(session, 'chats');
      const target = path.split('/')[3], message = clean(body.message, 2000);
      if (!message || !(await db.query('SELECT id FROM messages WHERE visitor_id=$1 LIMIT 1', [target])).length) fail(400, 'Chat oder Nachricht fehlt');
      await db.query('INSERT INTO messages (id,visitor_id,author,body,created_at) VALUES ($1,$2,$3,$4,$5)', [id(), target, 'admin', message, now()]);
      return json(res, 201, { ok: true });
    }
    if (path === '/admin/content' && req.method === 'PATCH') {
      requireAdmin(session, 'content');
      if (!['about','help','hero'].includes(body.key)) fail(400, 'Ungültiger Inhalt');
      await db.query('INSERT INTO content (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [body.key, clean(body.value, 3000)]);
      return json(res, 200, { ok: true });
    }
    if (path === '/admin/accounts' && req.method === 'GET') {
      if (session.role !== 'big') fail(403, 'Kein Zugriff');
      return json(res, 200, { accounts: await db.query("SELECT id,username,role,permissions,created_at FROM accounts WHERE role='admin' ORDER BY created_at ASC") });
    }
    if (path === '/admin/accounts' && req.method === 'POST') {
      if (session.role !== 'big') fail(403, 'Kein Zugriff');
      const username = clean(body.username, 80), password = String(body.password || '');
      if (!/^[a-zA-Z0-9_-]{3,80}$/.test(username) || password.length < 10) fail(400, 'Benutzername oder Passwort ungültig (mindestens 10 Zeichen)');
      const permissions = JSON.stringify(['appointments','chats','content'].filter(p => body.permissions?.includes(p)));
      await db.query('INSERT INTO accounts (id,username,password_hash,role,permissions,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [id(), username, hashPassword(password), 'admin', permissions, now()]);
      return json(res, 201, { ok: true });
    }
    if (path.startsWith('/admin/accounts/') && req.method === 'PATCH') {
      if (session.role !== 'big') fail(403, 'Kein Zugriff');
      const target = path.split('/')[3];
      const permissions = JSON.stringify(['appointments','chats','content'].filter(p => body.permissions?.includes(p)));
      await db.query("UPDATE accounts SET permissions=$1 WHERE id=$2 AND role='admin'", [permissions, target]);
      if (body.password) {
        if (String(body.password).length < 10) fail(400, 'Passwort braucht mindestens 10 Zeichen');
        await db.query("UPDATE accounts SET password_hash=$1 WHERE id=$2 AND role='admin'", [hashPassword(body.password), target]);
      }
      return json(res, 200, { ok: true });
    }
    if (path.startsWith('/admin/accounts/') && req.method === 'DELETE') {
      if (session.role !== 'big') fail(403, 'Kein Zugriff');
      const target = path.split('/')[3];
      await db.query("DELETE FROM sessions WHERE account_id=$1", [target]);
      await db.query("DELETE FROM accounts WHERE id=$1 AND role='admin'", [target]);
      return json(res, 200, { ok: true });
    }
    if (path === '/admin/password' && req.method === 'PATCH') {
      if (!session.account_id) fail(403, 'Kein Zugriff');
      const account = (await db.query('SELECT password_hash FROM accounts WHERE id=$1', [session.account_id]))[0];
      if (!checkPassword(String(body.current || ''), account.password_hash) || String(body.next || '').length < 10) fail(400, 'Aktuelles Passwort falsch oder neues Passwort zu kurz (mindestens 10 Zeichen)');
      await db.query('UPDATE accounts SET password_hash=$1 WHERE id=$2', [hashPassword(body.next), session.account_id]);
      return json(res, 200, { ok: true });
    }
    fail(404, 'Seite nicht gefunden');
  } catch (e) {
    if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : 'Serverfehler. Bitte Konfiguration prüfen.' });
    if (!e.status) console.error(e);
  }
}
