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
  // The two reserved accounts are controlled by Vercel Environment Variables.
  // Existing installations are migrated as well: old role names and old password
  // hashes must not make the current Vercel credentials fail.
  const accounts = await db.query('SELECT id, username, role FROM accounts WHERE username=$1 OR username=$2', ['Lessing', 'admin']);
  const defaults = [
    ['Lessing', 'admin', process.env.INITIAL_ADMIN_PASSWORD],
    ['admin', 'big', process.env.INITIAL_BIG_ADMIN_PASSWORD]
  ];
  for (const [username, role, password] of defaults) {
    if (!password || password.length < 4) continue;
    const existing = accounts.find(a => a.username === username);
    if (!existing) {
      await db.query(
        'INSERT INTO accounts (id,username,password_hash,role,permissions,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (username) DO NOTHING',
        [id(), username, hashPassword(password), role, JSON.stringify(['appointments','chats','content']), now()]
      );
    } else {
      // Keep the Vercel environment variable as the source of truth for these
      // two built-in accounts. This also repairs installations created by an
      // earlier version that used a different role name (e.g. "master").
      await db.query(
        'UPDATE accounts SET password_hash=$1, role=$2, permissions=$3 WHERE username=$4',
        [hashPassword(password), role, JSON.stringify(['appointments','chats','content']), username]
      );
    }
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
  const staff = Boolean(session.account_id);
  const seconds = staff ? 15 * 60 : 30 * 86400;
  await db.query('INSERT INTO sessions (token_hash,visitor_id,account_id,expires_at) VALUES ($1,$2,$3,$4)', [digest(token), session.visitor_id, session.account_id, now() + seconds * 1000]);
  // Staff cookies expire with the browser session as well as on the server after 15 minutes.
  res.setHeader('Set-Cookie', `lessing_session=${token}; HttpOnly; SameSite=Lax; Path=/${staff ? '' : `; Max-Age=${seconds}`}${process.env.VERCEL || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
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
      const fields = ['first_name','last_name','class_name','topic','requested_at'].map(k => clean(body[k], k === 'topic' ? 500 : 100));
      if (fields.some(x => !x)) fail(400, 'Bitte alle Felder ausfüllen');
      const schoolEnd = clean(body.school_end, 20);
      if (!['13:20', '15:50', 'later'].includes(schoolEnd)) fail(400, 'Bitte wähle aus, wann du Schule aus hast');
      const categoryId = clean(body.category_id, 80);
      const teacherId = clean(body.teacher_id, 80);
      const category = categoryId ? (await db.query('SELECT id,name,color FROM categories WHERE id=$1 AND active=1', [categoryId]))[0] : null;
      const teacher = teacherId ? (await db.query('SELECT id,name FROM teachers WHERE id=$1 AND active=1', [teacherId]))[0] : null;
      if (!category) fail(400, 'Bitte wähle einen Bereich aus');
      if (!teacher) fail(400, 'Bitte wähle eine Lehrkraft aus');
      const date = fields[4];
      const berlin = new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date());
      const part = type => berlin.find(p => p.type === type).value;
      const today = `${part('year')}-${part('month')}-${part('day')}`;
      const maxDate = new Date(`${today}T00:00:00Z`); maxDate.setUTCMonth(maxDate.getUTCMonth() + 6);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date < today || date > maxDate.toISOString().slice(0,10)) fail(400, 'Bitte einen gültigen Tag innerhalb der nächsten sechs Monate wählen');
      // 10 characters encode 50 random bits; older LS codes remain usable.
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let random = randomBytes(8).readBigUInt64BE() & ((1n << 50n) - 1n);
      let suffix = '';
      for (let i = 0; i < 10; i++) { suffix = alphabet[Number(random & 31n)] + suffix; random >>= 5n; }
      const code = 'LC-' + suffix;
      await db.query('INSERT INTO appointments (id,code,visitor_id,first_name,last_name,class_name,subject,topic,requested_at,status,note,created_at,updated_at,school_end,category_id,teacher_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)', [id(), code, session.visitor_id, fields[0], fields[1], fields[2], category.name, fields[3], fields[4], 'Anfrage eingegangen', '', now(), now(), schoolEnd, category.id, teacher.id]);
      return json(res, 201, { code, status: 'Anfrage eingegangen' });
    }
    if (path === '/appointments/calendar' && req.method === 'GET') {
      const month = clean(url.searchParams.get('month'), 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail(400, 'Ungültiger Kalendermonat');
      const next = new Date(`${month}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
      const rows = await db.query('SELECT requested_at,status,category_id,teacher_id FROM appointments WHERE requested_at >= $1 AND requested_at < $2 AND status <> $3', [`${month}-01`,next.toISOString().slice(0,10),'Abgelehnt']);
      const days = {};
      for (const row of rows) {
        const date = row.requested_at.slice(0,10);
        days[date] ??= {date,hasAppointments:false,hasRequests:false};
        if (row.status === 'Bestätigt') days[date].hasAppointments = true;
        else days[date].hasRequests = true;
      }
      // Students receive availability only: never names, topics, codes, teachers or category details.
      return json(res, 200, { days:Object.values(days) });
    }
    if (path === '/appointments' && req.method === 'GET') {
      const code = clean(url.searchParams.get('code'), 40).toUpperCase();
      if (!code) fail(400, 'Anfragecode fehlt');
      const appointment = (await db.query('SELECT code,first_name,last_name,class_name,subject,topic,requested_at,school_end,status,note,updated_at FROM appointments WHERE code=$1', [code, session.visitor_id]))[0];
      if (!appointment) fail(404, 'Kein Termin zu diesem Code in dieser Sitzung gefunden. Verwende das Gerät, auf dem die Anfrage erstellt wurde.');
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
      if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) fail(503, 'Lern-KI ist noch nicht eingerichtet: GEMINI_API_KEY oder OPENAI_API_KEY fehlt.');
      const recent = await db.query('SELECT role,body FROM ai_messages WHERE thread_id=$1 AND visitor_id=$2 ORDER BY created_at DESC LIMIT 12', [threadId, session.visitor_id]);
      const count = await db.query('SELECT id FROM ai_messages WHERE visitor_id=$1 AND role=$2 AND created_at>$3 LIMIT 11', [session.visitor_id, 'user', now() - 60000]);
      if (count.length >= 10) fail(429, 'Bitte eine Minute warten, bevor du weitere Fragen sendest.');
      const instructions = 'Du bist ein freundlicher deutschsprachiger Lerncoach für Schüler. Erkläre verständlich und altersgerecht. Unterstütze beim selbstständigen Lernen; bei Hausaufgaben erst den Lösungsweg erklären. Keine erfundenen Fakten. Gib bei Unsicherheit diese an. Verwende keine persönlichen Namen.';
      const upstream = process.env.GEMINI_API_KEY
        ? await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.5-flash')}:generateContent`, { method:'POST', headers:{ 'x-goog-api-key':process.env.GEMINI_API_KEY, 'Content-Type':'application/json' }, body:JSON.stringify({ system_instruction:{parts:[{text:instructions}]}, contents:[...recent.reverse().map(r=>({role:r.role==='assistant'?'model':'user',parts:[{text:r.body}]})),{role:'user',parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:900} }), signal:AbortSignal.timeout(25000) })
        : await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', store: false, max_output_tokens: 900, instructions, input: [...recent.reverse().map(r => ({ role: r.role, content: r.body })), { role: 'user', content: prompt }] }), signal: AbortSignal.timeout(25000) });
      if (!upstream.ok) {
        const provider = process.env.GEMINI_API_KEY ? 'Gemini' : 'OpenAI';
        // Record only the status; never log the API key, student question or provider response.
        console.error('[ai/ask] upstream error', { provider, status:upstream.status });
        const errors = {
          400:'Die KI-Anfrage wurde vom Anbieter abgelehnt. Bitte später erneut versuchen.',
          401:'Der KI-API-Schlüssel wird vom Anbieter nicht akzeptiert. Bitte die Server-Einstellung prüfen.',
          402:'Das Guthaben beim KI-Anbieter reicht derzeit nicht aus.',
          403:'Der KI-API-Schlüssel hat keine Berechtigung oder das Kontingent ist gesperrt. Bitte die Server-Einstellung prüfen.',
          404:'Das eingestellte KI-Modell ist nicht verfügbar. Bitte die Server-Einstellung prüfen.',
          429:'Das Kontingent des KI-Anbieters ist ausgeschöpft. Bitte später erneut versuchen.'
        };
        fail(upstream.status === 429 ? 429 : 502, errors[upstream.status] || 'KI-Dienst ist gerade nicht erreichbar. Bitte später erneut versuchen.');
      }
      const result = await upstream.json();
      const answer = (process.env.GEMINI_API_KEY ? result.candidates?.[0]?.content?.parts?.map(part=>part.text || '').join('\n') : result.output?.flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n'))?.trim();
      if (!answer) fail(502, 'Die KI hat keine Antwort zurückgegeben.');
      await db.query('INSERT INTO ai_messages (id,thread_id,visitor_id,role,body,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [id(), threadId, session.visitor_id, 'user', prompt, now()]);
      await db.query('INSERT INTO ai_messages (id,thread_id,visitor_id,role,body,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [id(), threadId, session.visitor_id, 'assistant', answer, now()]);
      return json(res, 200, { answer });
    }
    if (path === '/catalog' && req.method === 'GET') {
      const categories = await db.query('SELECT id,name,color FROM categories WHERE active=1 ORDER BY name');
      const teachers = await db.query('SELECT id,name FROM teachers WHERE active=1 ORDER BY name');
      return json(res, 200, {categories, teachers});
    }
    if (path === '/admin/teachers' && req.method === 'GET') {
      requireAdmin(session, 'appointments');
      return json(res, 200, {teachers: await db.query('SELECT id,name,active,created_at FROM teachers ORDER BY active DESC,name')});
    }
    if (path === '/admin/teachers' && req.method === 'POST') {
      requireAdmin(session, 'appointments');
      const name = clean(body.name, 120);
      if (name.length < 2) fail(400, 'Lehrkraftname fehlt');
      await db.query('INSERT INTO teachers (id,name,active,created_at) VALUES ($1,$2,1,$3)', [id(),name,now()]);
      return json(res, 201, {ok:true});
    }
    if (path.startsWith('/admin/teachers/') && req.method === 'PATCH') {
      requireAdmin(session, 'appointments');
      const target=path.split('/')[3], name=clean(body.name,120);
      if (name.length<2) fail(400,'Lehrkraftname fehlt');
      await db.query('UPDATE teachers SET name=$1,active=$2 WHERE id=$3',[name,body.active===false?0:1,target]);
      return json(res,200,{ok:true});
    }
    if (path.startsWith('/admin/teachers/') && req.method === 'DELETE') {
      requireAdmin(session, 'appointments');
      const target=path.split('/')[3];
      await db.query('UPDATE teachers SET active=0 WHERE id=$1',[target]);
      return json(res,200,{ok:true});
    }
    if (path === '/admin/categories' && req.method === 'GET') {
      requireAdmin(session, 'appointments');
      return json(res,200,{categories:await db.query('SELECT id,name,color,active,created_at FROM categories ORDER BY active DESC,name')});
    }
    if (path === '/admin/categories' && req.method === 'POST') {
      requireAdmin(session, 'appointments');
      const name = clean(body.name, 80), color = clean(body.color, 20);
      if (!/^#[0-9a-fA-F]{6}$/.test(color) || name.length < 2) fail(400, 'Ungültige Kategorie');
      await db.query('INSERT INTO categories (id,name,color,active,created_at) VALUES ($1,$2,$3,1,$4)', [id(), name, color, now()]);
      return json(res, 201, {ok:true});
    }
    if (path.startsWith('/admin/categories/') && req.method === 'PATCH') {
      requireAdmin(session, 'appointments');
      const target=path.split('/')[3], name=clean(body.name,80), color=clean(body.color,20);
      if(!/^#[0-9a-fA-F]{6}$/.test(color) || name.length<2) fail(400,'Ungültige Kategorie');
      await db.query('UPDATE categories SET name=$1,color=$2,active=$3 WHERE id=$4',[name,color,body.active===false?0:1,target]);
      return json(res,200,{ok:true});
    }
    if (path.startsWith('/admin/categories/') && req.method === 'DELETE') {
      requireAdmin(session, 'appointments');
      const target = path.split('/')[3];
      await db.query('UPDATE categories SET active=0 WHERE id=$1', [target]);
      return json(res, 200, {ok:true});
    }
    if (path === '/admin/appointments' && req.method === 'GET') {
      requireAdmin(session, 'appointments');
      return json(res, 200, { appointments: await db.query(`SELECT a.*, c.name AS category_name, c.color AS category_color, t.name AS teacher_name
        FROM appointments a
        LEFT JOIN categories c ON c.id=a.category_id
        LEFT JOIN teachers t ON t.id=a.teacher_id
        ORDER BY a.created_at DESC LIMIT 200`) });
    }
    if (path === '/admin/overview' && req.method === 'GET') {
      requireAdmin(session, 'appointments');
      const byStatus = await db.query('SELECT status, COUNT(*) AS count FROM appointments GROUP BY status');
      const upcoming = await db.query('SELECT COUNT(*) AS count FROM appointments WHERE requested_at >= $1 AND status=$2', [new Date().toISOString().slice(0,10),'Bestätigt']);
      return json(res, 200, {byStatus,upcoming:Number(upcoming[0]?.count||0)});
    }
    if (path === '/admin/calendar' && req.method === 'GET') {
      requireAdmin(session, 'appointments');
      const from = clean(url.searchParams.get('from'), 10), to = clean(url.searchParams.get('to'), 10);
      const valid = day => /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0,10) === day;
      if (!valid(from) || !valid(to) || from > to || Date.parse(to) - Date.parse(from) > 370 * 86400000) fail(400, 'Ungültiger Kalenderzeitraum');
      return json(res, 200, { appointments: await db.query(`SELECT a.id,a.code,a.first_name,a.last_name,a.class_name,a.topic,a.school_end,a.requested_at,a.status,a.note,
        c.name AS category_name,c.color AS category_color,t.name AS teacher_name
        FROM appointments a
        LEFT JOIN categories c ON c.id=a.category_id
        LEFT JOIN teachers t ON t.id=a.teacher_id
        WHERE a.requested_at >= $1 AND a.requested_at < $2
        ORDER BY a.requested_at ASC LIMIT 1500`, [from,to]) });
    }
    if (path === '/admin/appointments' && req.method === 'PATCH') {
      requireAdmin(session, 'appointments');
      const allowed = ['Anfrage eingegangen','In Bearbeitung','Bestätigt','Abgelehnt'];
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
      if (!['admin','big'].includes(session.role)) fail(403, 'Kein Zugriff');
      return json(res, 200, { accounts: await db.query("SELECT id,username,role,permissions,created_at FROM accounts WHERE role='admin' ORDER BY created_at ASC") });
    }
    if (path === '/admin/accounts' && req.method === 'POST') {
      if (!['admin','big'].includes(session.role)) fail(403, 'Kein Zugriff');
      const username = clean(body.username, 80), password = String(body.password || '');
      if (!/^[a-zA-Z0-9_-]{3,80}$/.test(username) || password.length < 10) fail(400, 'Benutzername oder Passwort ungültig (mindestens 10 Zeichen)');
      const permissions = JSON.stringify(['appointments','chats','content'].filter(p => body.permissions?.includes(p)));
      await db.query('INSERT INTO accounts (id,username,password_hash,role,permissions,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [id(), username, hashPassword(password), 'admin', permissions, now()]);
      return json(res, 201, { ok: true });
    }
    if (path.startsWith('/admin/accounts/') && req.method === 'PATCH') {
      if (!['admin','big'].includes(session.role)) fail(403, 'Kein Zugriff');
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
      if (!['admin','big'].includes(session.role)) fail(403, 'Kein Zugriff');
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
