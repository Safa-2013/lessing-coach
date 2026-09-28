import { holidayOn } from './holidays.js';
import { makeSchedule } from './calendar-ui.js';

const $ = selector => document.querySelector(selector);
function showManagedCopy(key, value) { const target = $('#' + key + 'Copy'); target.textContent = value || ''; target.classList.toggle('hidden', !value); }
const aiSide = $('.ai-side');
aiSide.insertAdjacentHTML('afterbegin', '<button class="ai-back" data-page="start">← Zurück zur Startseite</button><div class="ai-brand"><span class="cap-symbol">✦</span><span>Lessing Coach<small>Dein KI-Lernassistent</small></span></div>');
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
const studentSchedule = makeSchedule($('#studentSchedule'),request);
const adminSchedule = makeSchedule($('#adminSchedule'),request,true);
let activeAdminTab = 'overview';
function showAdminTab(tab) {
  const selected=document.querySelector(`[data-admin-tab="${tab}"]`);
  if (!selected || selected.classList.contains('hidden')) tab='overview';
  activeAdminTab=tab;
  document.querySelectorAll('[data-admin-tab]').forEach(button=>{button.classList.toggle('active',button.dataset.adminTab===tab);button.setAttribute('aria-current',button.dataset.adminTab===tab?'page':'false');});
  document.querySelectorAll('[data-admin-section]').forEach(section=>section.classList.toggle('active',section.dataset.adminSection===tab));
  if(tab==='calendar') adminSchedule.refresh();
}
function navigate(page) {
  if (page === 'adminPanel' && state.session.role === 'visitor') page = 'login';
  if (page === 'login') $('#loginForm').reset();
  document.body.dataset.page = page;
  document.body.classList.toggle('ai-mode', page === 'ki');
  $('.view.active')?.classList.remove('active');
  $('#' + page)?.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open');
  window.scrollTo({ top:0, behavior:'instant' });
  if (page === 'contact') loadMessages();
  if (page === 'coaching') loadCalendar();
  if (page === 'termine') studentSchedule.refresh();
  if (page === 'ki') loadThreads();
  if (page === 'adminPanel') { showAdminTab(activeAdminTab); loadAdmin(); }
  history.replaceState(null, '', '#' + page);
}
async function loadCatalog() {
  try {
    const {categories, teachers} = await request('catalog');
    const categorySelect=$('#appointmentCategory'), teacherSelect=$('#appointmentTeacher'), legend=$('#categoryLegend');
    if (categorySelect) categorySelect.innerHTML='<option value="">Bereich auswählen …</option>'+categories.map(c=>`<option value="${safe(c.id)}">${safe(c.name)}</option>`).join('');
    if (teacherSelect) teacherSelect.innerHTML='<option value="">Lehrkraft auswählen …</option>'+teachers.map(t=>`<option value="${safe(t.id)}">${safe(t.name)}</option>`).join('');
    if (legend) legend.innerHTML=categories.map(c=>`<span class="category-chip" style="--category-color:${safe(c.color)}"><i></i>${safe(c.name)}</span>`).join('');
  } catch(e) { toast(e.message); }
}
function renderAuth() {
  const isStaff = state.session.role !== 'visitor';
  $('#topLogin').textContent = isStaff ? 'Verwaltung' : 'Anmelden';
  $('#topLogin').dataset.page = isStaff ? 'adminPanel' : 'login';
  $('#adminAccounts').classList.toggle('hidden', !isStaff);
  for (const [permission, element] of [['appointments','#adminAppointments'],['chats','#adminChats'],['content','#adminContent']]) {
    $(element).classList.toggle('hidden', !(state.session.role === 'big' || state.session.permissions.includes(permission)));
  }
  document.querySelectorAll('[data-admin-tab]').forEach(button => {
    const required = button.dataset.requires;
    button.classList.toggle('hidden', !!required && !(state.session.role==='big' || state.session.permissions.includes(required)));
  });
}
async function boot() {
  try {
    const data = await request('bootstrap'); state.session = data.session; state.content = data.content; await loadCatalog();
    $('#heroText').textContent = data.content.hero || $('#heroText').textContent;
    showManagedCopy('about', data.content.about);
    showManagedCopy('help', data.content.help);
  } catch(e) { toast(e.message); }
  finally {
    renderAuth();
    const target = location.hash.slice(1);
    if (target && $('#' + target)?.classList.contains('view')) navigate(target);
    else { document.body.dataset.page = 'start'; document.querySelector('.nav button[data-page="start"]').classList.add('active'); }
  }
}
document.addEventListener('click', e => {
  const page = e.target.closest('[data-page]')?.dataset.page;
  if (page) navigate(page);
  const prompt = e.target.closest('[data-prompt]')?.dataset.prompt;
  if (prompt) { navigate('ki'); $('#aiForm input[name="message"]').value = prompt; $('#aiForm input[name="message"]').focus(); }
  const subject = e.target.closest('[data-subject]')?.dataset.subject;
  if (subject) { $('#aiForm input[name="message"]').value = `Hilf mir beim Lernen für ${subject}. Frage zuerst, was ich üben möchte.`; $('#aiForm input[name="message"]').focus(); }
});
$('.admin-tabs').onclick=e=>{const tab=e.target.closest('[data-admin-tab]:not(.hidden)')?.dataset.adminTab;if(tab)showAdminTab(tab);};
$('#menuToggle').onclick = () => { $('#sidebar').classList.toggle('open'); $('#scrim').classList.toggle('open'); };
$('#scrim').onclick = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('open'); };
const berlinToday = () => {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const dayLabel = value => new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString('de-DE',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});
const schoolEndLabel = value => ({'13:20':'13:20 Uhr','15:50':'15:50 Uhr',later:'später als 15:50 Uhr'})[value] || 'nicht angegeben';
let calendarOffset = 0, calendarRequest = 0, calendarDays = {};
const monthAt = offset => { const today=berlinToday(); return new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1+offset,1)); };
function renderCalendar() {
  const month = monthAt(calendarOffset), today=berlinToday(), max= new Date(`${today}T00:00:00Z`);
  max.setUTCMonth(max.getUTCMonth()+6);
  $('#calendarMonth').textContent = month.toLocaleDateString('de-DE',{timeZone:'UTC',month:'long',year:'numeric'});
  $('#calendarPrev').disabled = calendarOffset === 0;
  $('#calendarNext').disabled = calendarOffset === 6;
  const count = new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate();
  const spaces = (month.getUTCDay()+6)%7;
  const weekdays = ['Mo','Di','Mi','Do','Fr','Sa','So'].map(day=>`<span class="calendar-weekday">${day}</span>`).join('');
  const selected = $('#appointmentForm').elements.requested_at.value;
  $('#calendarDays').innerHTML = weekdays + Array.from({length:spaces},()=>'<span></span>').join('') + Array.from({length:count},(_,i)=>{
    const date=`${month.getUTCFullYear()}-${String(month.getUTCMonth()+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;
    const info=calendarDays[date], holiday=holidayOn(date), availability=info?.hasAppointments||info?.hasRequests?'Nicht verfügbar':'Verfügbar';
    const status=holiday?`${holiday} · ${availability}`:availability;
    const disabled=date<today||date>max.toISOString().slice(0,10)||Boolean(info?.hasAppointments);
    return `<button type="button" data-date="${date}" class="calendar-day ${holiday?'holiday':info?.hasAppointments?'busy':info?.hasRequests?'pending':'free'} ${selected===date?'selected':''}" aria-label="${dayLabel(date)}: ${status}" aria-pressed="${selected===date}" ${disabled?'disabled':''}><span>${i+1}</span><span class="calendar-dot" aria-hidden="true"></span></button>`;
  }).join('');
  if (selected) {
    const info=calendarDays[selected];
    $('#calendarStatus').textContent=`Gewählt: ${dayLabel(selected)} · ${holidayOn(selected)?holidayOn(selected)+' · ':''}Der Tag ist vorgemerkt. Die Uhrzeit wird später abgestimmt.`;
  }
}
async function loadCalendar() {
  const month=monthAt(calendarOffset).toISOString().slice(0,7), current=++calendarRequest;
  calendarDays={}; renderCalendar();
  $('#calendarStatus').textContent='Kalender wird geladen …';
  try {
    const {days}=await request('appointments/calendar?month='+month);
    if (current !== calendarRequest) return;
    calendarDays=Object.fromEntries(days.map(day=>[day.date,day])); renderCalendar();
    if (!$('#appointmentForm').elements.requested_at.value) $('#calendarStatus').textContent='Grün: verfügbar · Grau: nicht verfügbar · Lila: Ferien BW. Wähle einen Tag.';
  } catch(e) { if (current===calendarRequest) { renderCalendar(); $('#calendarStatus').textContent='Kalenderdaten konnten nicht geladen werden: '+e.message; } }
}
$('#calendarPrev').onclick=()=>{ if(calendarOffset>0){calendarOffset--;loadCalendar();} };
$('#calendarNext').onclick=()=>{ if(calendarOffset<6){calendarOffset++;loadCalendar();} };
$('#calendarDays').onclick=e=>{
  const day=e.target.closest('[data-date]:not(:disabled)'); if (!day) return;
  $('#appointmentForm').elements.requested_at.value=day.dataset.date;
  renderCalendar();
};
$('#appointmentForm').onsubmit = async e => {
  e.preventDefault(); const form = e.currentTarget, button = form.querySelector('button[type="submit"]');
  if (!form.elements.requested_at.value) { $('#calendarStatus').textContent='Bitte wähle zuerst einen Tag im Kalender.'; $('#bookingCalendar').scrollIntoView({block:'center'}); return; }
  button.disabled = true;
  try { const data = await send('appointments', Object.fromEntries(new FormData(form))); $('#appointmentResult').innerHTML = `<div class="result">Anfrage gesendet! Dein persönlicher Anfragecode:<br><span class="code">${safe(data.code)}</span><br>Bewahre ihn auf, damit du den Status unter „Termine“ prüfen kannst.</div>`; form.reset(); await loadCalendar(); }
  catch(err) { toast(err.message); } finally { button.disabled = false; }
};
$('#lookupForm').onsubmit = async e => {
  e.preventDefault(); const code = new FormData(e.currentTarget).get('code');
  try { const {appointment:a} = await request('appointments?code=' + encodeURIComponent(code)); $('#lookupResult').innerHTML = `<div class="result"><strong>${safe(a.status)}</strong><p>${safe(a.subject==='Coaching'?'Coaching · ':a.subject+' · ')}${safe(a.topic)}</p><p>Gewählter Tag: ${safe(dayLabel(a.requested_at))}</p><p>Schule aus: ${safe(schoolEndLabel(a.school_end))}</p>${a.note ? `<p>Rückmeldung: ${safe(a.note)}</p>` : ''}<small>Zuletzt aktualisiert: ${new Date(Number(a.updated_at)).toLocaleString('de-DE')}</small></div>`; }
  catch(err) { $('#lookupResult').innerHTML = `<div class="result notice">${safe(err.message)}</div>`; }
};
function bubbles(messages, target) {
  target.innerHTML = messages.map(m => `<div class="bubble ${m.author === 'visitor' || m.role === 'user' ? 'mine' : ''}">${target.id === 'contactMessages' && m.author !== 'visitor' ? '<span class="sender">Lessing Schulen Coaching</span>' : ''}${safe(m.body)}<small>${new Date(Number(m.created_at)).toLocaleString('de-DE')}</small></div>`).join('');
  target.scrollTop = target.scrollHeight;
}
async function loadMessages() {
  try { const {messages} = await request('messages'); bubbles(messages.length ? messages : [{author:'admin',body:'Hallo! 👋 Schreibe uns deine Frage oder Anfrage. Unser Team meldet sich so bald wie möglich.',created_at:Date.now()}], $('#contactMessages')); }
  catch(e) { bubbles([{author:'admin',body:'Hallo! 👋 Schreibe uns hier deine Frage oder Anfrage. Unser Team meldet sich so schnell wie möglich bei dir.',created_at:Date.now()}], $('#contactMessages')); $('#contactMessages').insertAdjacentHTML('beforeend', `<div class="chat-error" role="alert">Der Chat kann gerade nicht geladen werden. ${safe(e.message)}</div>`); toast(e.message); }
}
$('#contactForm').onsubmit = async e => {
  e.preventDefault(); const form = e.currentTarget, field = form.elements.message, message = field.value; form.querySelector('button').disabled = true;
  try { await send('messages', {message}); field.value = ''; await loadMessages(); }
  catch(err) { toast(err.message); } finally { form.querySelector('button').disabled = false; }
};
$('#contactAttach').onclick = () => $('#contactFile').click();
$('#contactFile').onchange = async e => {
  const file = e.target.files?.[0]; if (!file) return;
  if (!/\.(txt|md)$/i.test(file.name) || file.size > 1500) { toast('Bitte eine Textdatei (.txt oder .md) bis 1,5 KB auswählen.'); e.target.value = ''; return; }
  const input = $('#contactForm').elements.message;
  input.value = (input.value + `\n[${file.name}]\n` + await file.text()).trim().slice(0,2000);
  input.focus(); e.target.value = '';
};
$('#contactEmoji').onclick = () => { const field = $('#contactForm').elements.message; field.value += ' 😊'; field.focus(); };
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); const form = e.currentTarget;
  const credentials = Object.fromEntries(new FormData(form));
  form.reset();
  try { const data = await send('login', credentials); state.session = data.session; renderAuth(); navigate('adminPanel'); }
  catch(err) { toast(err.message); }
};
$('#logout').onclick = async () => { try { const data = await send('logout', {}); state.session = data.session; state.threadId = null; state.currentChat=null; $('#adminChatDetail').replaceChildren(); $('#loginForm').reset(); renderAuth(); navigate('start'); } catch(e) { toast(e.message); } };
window.addEventListener('pageshow', () => { if (state.session.role === 'visitor') $('#loginForm').reset(); });
async function loadThreads() {
  try { const {threads} = await request('ai/threads'); $('#threadList').innerHTML = threads.map(t => `<button data-thread="${safe(t.id)}">💬 ${safe(t.title)}</button>`).join(''); }
  catch(e) { toast(e.message); }
}
$('#threadList').onclick = async e => { const id = e.target.closest('[data-thread]')?.dataset.thread; if (id) openThread(id); };
async function openThread(id) {
  try { const {messages} = await request('ai/threads/' + encodeURIComponent(id)); state.threadId = id; bubbles(messages, $('#aiMessages')); }
  catch(e) { toast(e.message); }
}
$('#newThread').onclick = () => { state.threadId = null; $('#aiMessages').innerHTML = ''; $('#aiUtility').classList.add('hidden'); $('#aiForm input[name="message"]').focus(); };
function utility(html) { const panel=$('#aiUtility'); panel.innerHTML=html; panel.classList.remove('hidden'); panel.scrollIntoView({block:'nearest'}); }
$('#notesButton').onclick = () => { utility('<h2>Notizen</h2><p>Deine Notizen werden nur in diesem Browser gespeichert.</p><textarea id="aiNotes" aria-label="Notizen" placeholder="Schreibe deine Notizen …"></textarea>'); const notes=$('#aiNotes'); notes.value=localStorage.getItem('lessing_notes') || ''; notes.oninput=()=>localStorage.setItem('lessing_notes',notes.value.slice(0,10000)); notes.focus(); };
$('#toolsButton').onclick = async () => { utility('<h2>Tools</h2><p id="aiToolStatus">Lernfortschritt wird geladen …</p>'); try { const p=await request('ai/progress'); $('#aiToolStatus').textContent=`${p.chats} Chats und ${p.questions} Fragen in diesem Browser.`; } catch(e) { $('#aiToolStatus').textContent=e.message; } };
$('#settingsButton').onclick = () => { utility('<h2>Einstellungen</h2><label><input type="checkbox" id="aiMotion"> Animationen reduzieren</label>'); $('#aiMotion').checked=document.body.classList.contains('reduced-motion'); $('#aiMotion').onchange=e=>{document.body.classList.toggle('reduced-motion',e.target.checked); localStorage.setItem('lessing_less_motion',String(e.target.checked));}; };
document.body.classList.toggle('reduced-motion',localStorage.getItem('lessing_less_motion')==='true');
$('#aiTheme').onclick = () => { document.body.classList.toggle('ai-light'); $('#aiTheme').textContent=document.body.classList.contains('ai-light')?'☾':'☼'; };
$('#aiAttach').onclick = () => $('#aiFile').click();
$('#aiFile').onchange = async e => { const file=e.target.files?.[0]; if (!file) return; if (!/\.(txt|md)$/i.test(file.name) || file.size>3000) { toast('Bitte eine Textdatei (.txt oder .md) bis 3 KB auswählen.'); e.target.value=''; return; } const input=$('#aiForm').elements.message; input.value=(input.value+`\n[${file.name}]\n`+await file.text()).trim().slice(0,4000); input.focus(); e.target.value=''; };
$('#aiVoice').onclick = () => { const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition; if (!SpeechRecognition) { toast('Spracheingabe wird von diesem Browser nicht unterstützt.'); return; } const recognizer=new SpeechRecognition(); recognizer.lang='de-DE'; recognizer.onresult=e=>{const input=$('#aiForm').elements.message; input.value=(input.value+' '+e.results[0][0].transcript).trim().slice(0,4000);input.focus();}; recognizer.onerror=()=>toast('Spracheingabe konnte nicht gestartet werden.');recognizer.start(); };
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
    if (can('appointments')) {
      const [{appointments},{byStatus,upcoming}]=await Promise.all([request('admin/appointments'),request('admin/overview')]);
      const totals=Object.fromEntries(byStatus.map(row=>[row.status,Number(row.count)]));
      const total=Object.values(totals).reduce((sum,count)=>sum+count,0);
      $('#adminStats').innerHTML=[['Alle Anfragen',total],['Kommende Termine',upcoming],['Offene Anfragen',(totals['Anfrage eingegangen']||0)+(totals['In Bearbeitung']||0)],['Bestätigt',totals['Bestätigt']||0]].map(([label,value])=>`<div class="admin-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
      $('#adminOverviewList').innerHTML=`<div class="panel"><h3>Neueste Anfragen</h3>${appointments.length?appointments.slice(0,5).map(a=>`<div class="admin-overview-item"><span>${safe(dayLabel(a.requested_at))}</span><strong>${safe(a.category_name||a.topic)}</strong><span class="pill">${safe(a.status)}</span></div>`).join(''):'<p class="muted">Noch keine Anfragen vorhanden.</p>'}</div>`;
      $('#appointmentList').innerHTML = appointments.length ? appointments.map(a => `<div class="list-item">
        <strong>${safe(a.first_name)} ${safe(a.last_name)}</strong> <span class="pill" style="border-left:4px solid ${safe(a.category_color||'#3B82F6')}">${safe(a.status)}</span>
        <p class="small">${safe(a.class_name)} · ${safe(a.category_name||a.subject)} · ${safe(a.teacher_name||'Lehrkraft nicht gesetzt')} · ${safe(dayLabel(a.requested_at))} · Schule aus: ${safe(schoolEndLabel(a.school_end))}</p>
        <p>${safe(a.topic)}</p><p class="small">Code: ${safe(a.code)}</p>
        <form class="statusForm" data-id="${safe(a.id)}"><div class="row"><select class="field" name="status">${['Anfrage eingegangen','In Bearbeitung','Bestätigt','Abgelehnt'].map(s => `<option ${s===a.status?'selected':''}>${s}</option>`).join('')}</select><input class="field" name="note" maxlength="500" placeholder="Änderung / Rückmeldung" value="${safe(a.note)}"><button class="primary">Speichern</button></div></form>
      </div>`).join('') : '<p class="muted">Noch keine Anfragen.</p>';
    } else { $('#adminStats').innerHTML='<div class="admin-stat">Kein Zugriff auf Termine.</div>'; $('#adminOverviewList').innerHTML=''; }
    if (can('chats')) { const {chats} = await request('admin/chats'); $('#chatList').innerHTML = chats.length ? chats.map((c,i) => `<button class="primary" data-chat="${safe(c.visitor_id)}" style="margin:4px">Chat ${i+1} · ${Number(c.count)} Nachrichten</button>`).join('') : '<p class="muted">Noch keine Nachrichten.</p>'; if (state.currentChat) await openAdminChat(state.currentChat); }
    if (can('content')) $('#contentEditor').innerHTML = ['hero','about','help'].map(key => `<form class="contentForm" data-key="${key}"><label class="field">${{hero:'Startseite',about:'Über Lessing',help:'Hilfe'}[key]}<textarea name="value" maxlength="3000">${safe(state.content[key] || '')}</textarea></label><button class="primary">Speichern</button></form>`).join('');
    if (isStaffForAccounts()) await loadAccounts();
    if (can('appointments')) { await loadStaffManagement(); }
  } catch(e) { toast(e.message); }
}
function isStaffForAccounts(){ return state.session.role === 'admin' || state.session.role === 'big'; }
async function loadAccounts() {
  const box=$('#accountList'); if(!box) return;
  const {accounts} = await request('admin/accounts');
  box.innerHTML = accounts.length ? accounts.map(a => {
    const permissions = JSON.parse(a.permissions);
    return `<div class="list-item"><strong>${safe(a.username)}</strong><span class="pill">Admin</span><form class="accountForm" data-id="${safe(a.id)}"><div class="row">${['appointments','chats','content'].map(p=>`<label><input type="checkbox" name="${p}" ${permissions.includes(p)?'checked':''}> ${{appointments:'Termine',chats:'Chats',content:'Inhalte'}[p]}</label>`).join('')}</div><label class="field">Neues Passwort (optional)<input type="password" name="password" minlength="10"></label><button class="primary">Speichern</button> <button class="primary danger" type="button" data-delete="${safe(a.id)}">Löschen</button></form></div>`;
  }).join('') : '<p class="muted">Noch keine normalen Admin-Konten vorhanden.</p>';
}
async function loadStaffManagement() {
  const [{teachers},{categories}] = await Promise.all([request('admin/teachers'),request('admin/categories')]);
  $('#teacherList').innerHTML = teachers.length ? teachers.map(t=>`<div class="list-item row"><input class="field teacher-name" data-id="${safe(t.id)}" value="${safe(t.name)}"><button class="primary" data-save-teacher="${safe(t.id)}">Speichern</button><button class="primary danger" data-delete-teacher="${safe(t.id)}">Entfernen</button></div>`).join('') : '<p class="muted">Noch keine Lehrkräfte.</p>';
  $('#categoryList').innerHTML = categories.map(c=>`<div class="list-item row"><input class="field category-name" data-id="${safe(c.id)}" value="${safe(c.name)}"><input type="color" class="category-color" data-id="${safe(c.id)}" value="${safe(c.color)}" title="Farbe"><button class="primary" data-save-category="${safe(c.id)}">Speichern</button><button class="primary danger" type="button" data-delete-category="${safe(c.id)}">Deaktivieren</button></div>`).join('');
}
$('#reloadAdmin').onclick = loadAdmin;
$('#appointmentList').onsubmit = async e => { if (!e.target.matches('.statusForm')) return; e.preventDefault(); const form=e.target; try { await send('admin/appointments', {id:form.dataset.id,...Object.fromEntries(new FormData(form))}, 'PATCH'); toast('Termin aktualisiert'); await loadAdmin(); } catch(err) { toast(err.message); } };
$('#chatList').onclick = e => { const id=e.target.closest('[data-chat]')?.dataset.chat; if (id) openAdminChat(id); };
async function openAdminChat(id) {
  const detail=$('#adminChatDetail');
  if (state.currentChat !== id || !detail.querySelector('#staffForm')) {
    detail.innerHTML = `<div class="chat-area" style="height:350px;min-height:250px;margin-top:15px"><div class="chat-scroll" id="staffMessages"></div><form class="composer" id="staffForm"><input name="message" required maxlength="2000" placeholder="Antwort schreiben …" autocomplete="off"><button class="primary">➤</button></form></div>`;
  }
  state.currentChat=id;
  try {
    const {messages} = await request('admin/chats/'+encodeURIComponent(id));
    if (state.currentChat !== id) return;
    bubbles(messages.map(m=>({...m,author:m.author==='admin'?'visitor':'admin'})), detail.querySelector('#staffMessages'));
  } catch(e) { toast(e.message); }
}
$('#adminChatDetail').onsubmit = async e => {
  if (e.target.id!=='staffForm') return;
  e.preventDefault();
  const form=e.target, target=state.currentChat, message=form.elements.message.value.trim(), button=form.querySelector('button');
  if (!message || button.disabled) return;
  button.disabled=true;
  try {
    await send('admin/chats/'+encodeURIComponent(target), {message});
    if (state.currentChat === target) {
      if (form.elements.message.value.trim() === message) form.elements.message.value='';
      await openAdminChat(target);
    }
  } catch(err) { toast(err.message); }
  finally { button.disabled=false; }
};
$('#contentEditor').onsubmit = async e => { if (!e.target.matches('.contentForm')) return; e.preventDefault(); const form=e.target,key=form.dataset.key,value=form.elements.value.value; try { await send('admin/content',{key,value},'PATCH'); state.content[key]=value; if (key==='hero') $('#heroText').textContent=value; else showManagedCopy(key,value); toast('Inhalt gespeichert'); } catch(err){toast(err.message);} };
const permissions = form => ['appointments','chats','content'].filter(p=>form.elements[p]?.checked);
$('#adminAccounts').onsubmit = async e => {
  const form=e.target;
  if (form.id==='createAdmin') {
    e.preventDefault();
    try { await send('admin/accounts',{username:form.elements.username.value,password:form.elements.password.value,permissions:permissions(form)}); form.reset(); await loadAccounts(); toast('Admin erstellt'); }
    catch(err){toast(err.message);}
  } else if (form.matches('.accountForm')) {
    e.preventDefault();
    try { await send('admin/accounts/'+form.dataset.id,{permissions:permissions(form),password:form.elements.password.value},'PATCH'); await loadAccounts(); toast('Admin aktualisiert'); }
    catch(err){toast(err.message);}
  }
};
$('#adminAccounts').onclick = async e => {
  const del=e.target.dataset.delete;
  if (del) { if (!confirm('Dieses normale Admin-Konto wirklich löschen?')) return; try { await request('admin/accounts/'+del,{method:'DELETE'}); await loadAccounts(); } catch(err){toast(err.message);} return; }
  const teacherId=e.target.dataset.deleteTeacher;
  if (teacherId) { try { await request('admin/teachers/'+teacherId,{method:'DELETE'}); await loadStaffManagement(); await loadCatalog(); toast('Lehrkraft deaktiviert'); } catch(err){toast(err.message);} return; }
  const saveTeacher=e.target.dataset.saveTeacher;
  if (saveTeacher) { const input=document.querySelector(`.teacher-name[data-id="${CSS.escape(saveTeacher)}"]`); try { await send('admin/teachers/'+saveTeacher,{name:input.value},'PATCH'); await loadStaffManagement(); await loadCatalog(); toast('Lehrkraft gespeichert'); } catch(err){toast(err.message);} return; }
  const deleteCategory=e.target.dataset.deleteCategory;
  if (deleteCategory) { try { await request('admin/categories/'+deleteCategory,{method:'DELETE'}); await loadStaffManagement(); await loadCatalog(); adminSchedule.refresh(); toast('Bereich deaktiviert'); } catch(err){toast(err.message);} return; }
  const saveCategory=e.target.dataset.saveCategory;
  if (saveCategory) { const name=document.querySelector(`.category-name[data-id="${CSS.escape(saveCategory)}"]`).value; const color=document.querySelector(`.category-color[data-id="${CSS.escape(saveCategory)}"]`).value; try { await send('admin/categories/'+saveCategory,{name,color},'PATCH'); await loadStaffManagement(); await loadCatalog(); adminSchedule.refresh(); toast('Bereich gespeichert'); } catch(err){toast(err.message);} }
};
$('#teacherCreate').onsubmit=async e=>{e.preventDefault();try{await send('admin/teachers',{name:e.target.elements.name.value});e.target.reset();await loadStaffManagement();await loadCatalog();toast('Lehrkraft hinzugefügt');}catch(err){toast(err.message);}};
$('#categoryCreate').onsubmit=async e=>{e.preventDefault();try{await send('admin/categories',{name:e.target.elements.name.value,color:e.target.elements.color.value});e.target.reset();e.target.elements.color.value='#3B82F6';await loadStaffManagement();await loadCatalog();adminSchedule.refresh();toast('Bereich hinzugefügt');}catch(err){toast(err.message);}};
$('#passwordForm').onsubmit = async e => { e.preventDefault(); const form=e.target; try { await send('admin/password',Object.fromEntries(new FormData(form)),'PATCH'); form.reset(); toast('Passwort geändert'); }catch(err){toast(err.message);} };
boot();
