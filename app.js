const $ = selector => document.querySelector(selector);
function showManagedCopy(key, value) { const target = $('#' + key + 'Copy'); target.textContent = value || ''; target.classList.toggle('hidden', !value); }
const aiSide = $('.ai-side');
aiSide.insertAdjacentHTML('afterbegin', '<div class="ai-brand"><span class="cap-symbol">✦</span><span>Lessing Coach<small>Dein KI-Lernassistent</small></span></div><button class="ai-back" data-page="start">← Startseite</button>');
const aiMain = $('.ai-main');
const heading = document.createElement('div'); heading.className = 'ai-heading';
aiMain.insertBefore(heading, aiMain.firstChild);
heading.append(aiMain.querySelector('h1'), aiMain.querySelector('.ai-sub'));
const cap = document.createElement('img'); cap.src = 'assets/ai-cap.png'; cap.alt = ''; cap.className = 'ai-cap'; heading.append(cap);
aiMain.insertAdjacentHTML('beforeend', '<div class="ai-footer">„Wissen ist der Schlüssel zu deiner Zukunft.“</div>');
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const state = { session: { role:'visitor', permissions:[] }, content:{}, threadId:null, currentChat:null };
let toastTimer;
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 6000); }
async function request(path, options = {}) {
  const response = await fetch('/api/' + path, { credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, ...options });
  let result;
  try { result = await response.json(); } catch { throw new Error('Serverantwort konnte nicht gelesen werden'); }
  if (!response.ok) throw new Error(result.error || 'Anfrage fehlgeschlagen');
  return result;
}
const send = (path, data, method='POST') => request(path, { method, body:JSON.stringify(data) });
function navigate(page) {
  if (page === 'adminPanel' && state.session.role === 'visitor') page = 'login';
  document.body.classList.toggle('ai-mode', page === 'ki');
  $('.view.active')?.classList.remove('active');
  $('#' + page)?.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open');
  window.scrollTo({ top:0, behavior:'instant' });
  if (page === 'contact') loadMessages();
  if (page === 'ki') loadThreads();
  if (page === 'adminPanel') loadAdmin();
  history.replaceState(null, '', '#' + page);
}
function renderAuth() {
  const isStaff = state.session.role !== 'visitor';
  $('#topLogin').textContent = isStaff ? 'Verwaltung' : 'Anmelden';
  $('#topLogin').dataset.page = isStaff ? 'adminPanel' : 'login';
  const nav = $('.login-nav'); nav.lastChild.textContent = isStaff ? 'Verwaltung' : 'Anmeldung'; nav.dataset.page = isStaff ? 'adminPanel' : 'login';
  if (state.session.role === 'big' && !$('#accountList')) $('#adminAccounts').innerHTML = `<h2>Admin-Konten</h2><div id="accountList"></div><form id="createAdmin"><label class="field">Neuer Benutzername<input name="username" required minlength="3"></label><label class="field">Passwort (mindestens 10 Zeichen)<input name="password" type="password" required minlength="10"></label><label><input type="checkbox" name="appointments" checked> Termine</label> <label><input type="checkbox" name="chats" checked> Chats</label> <label><input type="checkbox" name="content" checked> Inhalte</label><p><button class="primary">Admin erstellen</button></p></form>`;
  $('#adminAccounts').classList.toggle('hidden', state.session.role !== 'big');
  for (const [permission, element] of [['appointments','#adminAppointments'],['chats','#adminChats'],['content','#adminContent']]) $(element).classList.toggle('hidden', !(state.session.role === 'big' || state.session.permissions.includes(permission)));
}
async function boot() {
  try {
    const data = await request('bootstrap'); state.session = data.session; state.content = data.content;
    $('#heroText').textContent = data.content.hero || $('#heroText').textContent;
    showManagedCopy('about', data.content.about);
    showManagedCopy('help', data.content.help);
  } catch(e) { toast(e.message); }
  finally {
    renderAuth();
    const target = location.hash.slice(1);
    if (target && $('#' + target)?.classList.contains('view')) navigate(target);
    else document.querySelector('.nav button[data-page="start"]').classList.add('active');
  }
}
document.addEventListener('click', e => {
  const page = e.target.closest('[data-page]')?.dataset.page;
  if (page) navigate(page);
  const prompt = e.target.closest('[data-prompt]')?.dataset.prompt;
  if (prompt) { navigate('ki'); $('#aiForm input').value = prompt; $('#aiForm input').focus(); }
  const subject = e.target.closest('[data-subject]')?.dataset.subject;
  if (subject) { $('#aiForm input').value = `Hilf mir beim Lernen für ${subject}. Frage zuerst, was ich üben möchte.`; $('#aiForm input').focus(); }
});
$('#menuToggle').onclick = () => { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('open'); };
$('#scrim').onclick = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open'); };
$('#appointmentForm').onsubmit = async e => {
  e.preventDefault(); const form = e.currentTarget, button = form.querySelector('button'); button.disabled = true;
  try { const data = await send('appointments', Object.fromEntries(new FormData(form))); $('#appointmentResult').innerHTML = `<div class="result">Anfrage gesendet! Dein persönlicher Anfragecode:<br><span class="code">${safe(data.code)}</span><br>Bewahre ihn auf, damit du den Status unter „Termine“ prüfen kannst.</div>`; form.reset(); }
  catch(err) { toast(err.message); } finally { button.disabled = false; }
};
$('#lookupForm').onsubmit = async e => {
  e.preventDefault(); const code = new FormData(e.currentTarget).get('code');
  try { const {appointment:a} = await request('appointments?code=' + encodeURIComponent(code)); $('#lookupResult').innerHTML = `<div class="result"><strong>${safe(a.status)}</strong><p>${safe(a.subject)} · ${safe(a.topic)}</p><p>Terminwunsch: ${safe(a.requested_at.replace('T',' '))}</p>${a.note ? `<p>Änderung: ${safe(a.note)}</p>` : ''}<small>Zuletzt aktualisiert: ${new Date(Number(a.updated_at)).toLocaleString('de-DE')}</small></div>`; }
  catch(err) { $('#lookupResult').innerHTML = `<div class="result notice">${safe(err.message)}</div>`; }
};
function bubbles(messages, target) {
  target.innerHTML = messages.map(m => `<div class="bubble ${m.author === 'visitor' || m.role === 'user' ? 'mine' : ''}">${target.id === 'contactMessages' && m.author !== 'visitor' ? '<span class="sender">Lessing Schulen Coaching</span>' : ''}${safe(m.body)}<small>${new Date(Number(m.created_at)).toLocaleString('de-DE')}</small></div>`).join('');
  target.scrollTop = target.scrollHeight;
}
async function loadMessages() {
  try { const {messages} = await request('messages'); bubbles(messages.length ? messages : [{author:'admin',body:'Hallo! 👋 Schreibe uns deine Frage oder Anfrage. Unser Team meldet sich so bald wie möglich.',created_at:Date.now()}], $('#contactMessages')); }
  catch(e) { $('#contactMessages').innerHTML = `<div class="chat-error" role="alert">Der Chat kann gerade nicht geladen werden. ${safe(e.message)}</div>`; toast(e.message); }
}
$('#contactForm').onsubmit = async e => {
  e.preventDefault(); const form = e.currentTarget, field = form.elements.message, message = field.value; form.querySelector('button').disabled = true;
  try { await send('messages', {message}); field.value = ''; await loadMessages(); }
  catch(err) { toast(err.message); } finally { form.querySelector('button').disabled = false; }
};
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const form = e.currentTarget;
  try { const data = await send('login', Object.fromEntries(new FormData(form))); state.session = data.session; form.reset(); renderAuth(); navigate('adminPanel'); }
  catch(err) { toast(err.message); }
};
$('#logout').onclick = async () => { try { const data = await send('logout', {}); state.session = data.session; state.threadId = null; renderAuth(); navigate('start'); } catch(e) { toast(e.message); } };
async function loadThreads() {
  try { const {threads} = await request('ai/threads'); $('#threadList').innerHTML = threads.map(t => `<button data-thread="${safe(t.id)}">💬 ${safe(t.title)}</button>`).join(''); }
  catch(e) { toast(e.message); }
}
$('#threadList').onclick = async e => { const id = e.target.closest('[data-thread]')?.dataset.thread; if (id) openThread(id); };
async function openThread(id) {
  try { const {messages} = await request('ai/threads/' + encodeURIComponent(id)); state.threadId = id; bubbles(messages, $('#aiMessages')); }
  catch(e) { toast(e.message); }
}
$('#newThread').onclick = () => { state.threadId = null; $('#aiMessages').innerHTML = ''; $('#aiForm input').focus(); };
$('#progressButton').onclick = async () => { try { const p = await request('ai/progress'); toast(`Dein Lernfortschritt in diesem Browser: ${p.chats} Chats und ${p.questions} Fragen.`); } catch(e) { toast(e.message); } };
$('#aiForm').onsubmit = async e => {
  e.preventDefault(); const form = e.currentTarget, input = form.elements.message, question = input.value.trim(), button = form.querySelector('button');
  if (!question) return; button.disabled = true;
  try {
    if (!state.threadId) { const {thread} = await send('ai/threads', {title:question.slice(0,55)}); state.threadId = thread.id; await loadThreads(); }
    const {answer} = await send('ai/ask', {thread_id:state.threadId,message:question}); input.value = ''; await openThread(state.threadId);
    if (!answer) throw new Error('Keine Antwort');
  } catch(err) { toast(err.message); } finally { button.disabled = false; }
};
const can = permission => state.session.role === 'big' || state.session.permissions.includes(permission);
async function loadAdmin() {
  if (state.session.role === 'visitor') return;
  try {
    if (can('appointments')) { const {appointments} = await request('admin/appointments'); $('#appointmentList').innerHTML = appointments.length ? appointments.map(a => `<div class="list-item"><strong>${safe(a.first_name)} ${safe(a.last_name)}</strong> <span class="pill">${safe(a.status)}</span><p class="small">${safe(a.class_name)} · ${safe(a.subject)} · ${safe(a.requested_at.replace('T',' '))}</p><p>${safe(a.topic)}</p><p class="small">Code: ${safe(a.code)}</p><form class="statusForm" data-id="${safe(a.id)}"><div class="row"><select class="field" name="status">${['Anfrage eingegangen','In Bearbeitung','Bestätigt','Abgelehnt'].map(s => `<option ${s===a.status?'selected':''}>${s}</option>`).join('')}</select><input class="field" name="note" maxlength="500" placeholder="Änderung / Rückmeldung" value="${safe(a.note)}"><button class="primary">Speichern</button></div></form></div>`).join('') : '<p class="muted">Noch keine Anfragen.</p>'; }
    if (can('chats')) { const {chats} = await request('admin/chats'); $('#chatList').innerHTML = chats.length ? chats.map((c,i) => `<button class="primary" data-chat="${safe(c.visitor_id)}" style="margin:4px">Chat ${i+1} · ${Number(c.count)} Nachrichten</button>`).join('') : '<p class="muted">Noch keine Nachrichten.</p>'; if (state.currentChat) await openAdminChat(state.currentChat); }
    if (can('content')) $('#contentEditor').innerHTML = ['hero','about','help'].map(key => `<form class="contentForm" data-key="${key}"><label class="field">${{hero:'Startseite',about:'Über Lessing',help:'Hilfe'}[key]}<textarea name="value" maxlength="3000">${safe(state.content[key] || '')}</textarea></label><button class="primary">Speichern</button></form>`).join('');
    if (state.session.role === 'big') await loadAccounts();
  } catch(e) { toast(e.message); }
}
async function loadAccounts() {
  const {accounts} = await request('admin/accounts');
  $('#accountList').innerHTML = accounts.map(a => { const permissions = JSON.parse(a.permissions); return `<div class="list-item"><strong>${safe(a.username)}</strong><form class="accountForm" data-id="${safe(a.id)}"><div class="row">${['appointments','chats','content'].map(p=>`<label><input type="checkbox" name="${p}" ${permissions.includes(p)?'checked':''}> ${{appointments:'Termine',chats:'Chats',content:'Inhalte'}[p]}</label>`).join('')}</div><label class="field">Neues Passwort (optional)<input type="password" name="password" minlength="10"></label><button class="primary">Rechte speichern</button> <button class="primary danger" type="button" data-delete="${safe(a.id)}">Löschen</button></form></div>`; }).join('');
}
$('#reloadAdmin').onclick = loadAdmin;
$('#appointmentList').onsubmit = async e => { if (!e.target.matches('.statusForm')) return; e.preventDefault(); const form=e.target; try { await send('admin/appointments', {id:form.dataset.id,...Object.fromEntries(new FormData(form))}, 'PATCH'); toast('Termin aktualisiert'); await loadAdmin(); } catch(err) { toast(err.message); } };
$('#chatList').onclick = e => { const id=e.target.closest('[data-chat]')?.dataset.chat; if (id) openAdminChat(id); };
async function openAdminChat(id) { state.currentChat=id; try { const {messages} = await request('admin/chats/'+encodeURIComponent(id)); $('#adminChatDetail').innerHTML = `<div class="chat-area" style="height:350px;min-height:250px;margin-top:15px"><div class="chat-scroll" id="staffMessages"></div><form class="composer" id="staffForm"><input name="message" required maxlength="2000" placeholder="Antwort schreiben …"><button class="primary">➤</button></form></div>`; bubbles(messages.map(m=>({...m,author:m.author==='admin'?'visitor':'admin'})), $('#staffMessages')); } catch(e) { toast(e.message); } }
$('#adminChatDetail').onsubmit = async e => { if (e.target.id!=='staffForm') return; e.preventDefault(); const form=e.target; try { await send('admin/chats/'+encodeURIComponent(state.currentChat), {message:form.elements.message.value}); await openAdminChat(state.currentChat); } catch(err) { toast(err.message); } };
$('#contentEditor').onsubmit = async e => { if (!e.target.matches('.contentForm')) return; e.preventDefault(); const form=e.target,key=form.dataset.key,value=form.elements.value.value; try { await send('admin/content',{key,value},'PATCH'); state.content[key]=value; if (key==='hero') $('#heroText').textContent=value; else showManagedCopy(key,value); toast('Inhalt gespeichert'); } catch(err){toast(err.message);} };
const permissions = form => ['appointments','chats','content'].filter(p=>form.elements[p]?.checked);
$('#adminAccounts').onsubmit = async e => { const form=e.target; if (form.id==='createAdmin') { e.preventDefault(); try { await send('admin/accounts',{username:form.elements.username.value,password:form.elements.password.value,permissions:permissions(form)}); form.reset(); await loadAccounts(); toast('Admin erstellt'); } catch(err){toast(err.message);} } else if (form.matches('.accountForm')) { e.preventDefault(); try { await send('admin/accounts/'+form.dataset.id,{permissions:permissions(form),password:form.elements.password.value},'PATCH'); await loadAccounts(); toast('Admin aktualisiert'); } catch(err){toast(err.message);} } };
$('#adminAccounts').onclick = async e => { const id=e.target.dataset.delete; if (!id || !confirm('Dieses Admin-Konto wirklich löschen?')) return; try { await request('admin/accounts/'+id,{method:'DELETE'}); await loadAccounts(); }catch(err){toast(err.message);} };
$('#passwordForm').onsubmit = async e => { e.preventDefault(); const form=e.target; try { await send('admin/password',Object.fromEntries(new FormData(form)),'PATCH'); form.reset(); toast('Passwort geändert'); }catch(err){toast(err.message);} };
boot();
