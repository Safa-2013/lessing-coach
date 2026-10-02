import { holidayOn } from './holidays.js';
import { makeSchedule } from './calendar-ui.js';
import { createDvdScreensaver } from './waiting-games.js';

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
  const response = await fetch('/api/' + path, { credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, signal:AbortSignal.timeout(12000), ...options });
  let result;
  try { result = await response.json(); } catch { throw new Error('Serverantwort konnte nicht gelesen werden'); }
  if (!response.ok) {
    if(response.status===401&&path!=='login'){
      state.session={role:'visitor',permissions:[]};renderAuth();
      if(document.querySelector('.view.active')?.id==='adminPanel')navigate('login');
    }
    throw new Error(result.error || 'Anfrage fehlgeschlagen');
  }
  return result;
}
const send = (path, data, method='POST') => request(path, { method, body:JSON.stringify(data) });
const studentSchedule = makeSchedule($('#studentSchedule'),request);async function loadMyAppointments(){const box=$('#myAppointments');if(!box)return;try{const {appointments}=await request('appointments/mine');box.innerHTML=appointments.length?appointments.map(a=>`<div class="list-item"><div class="row"><strong>${safe(a.subject)}</strong><span class="pill">${safe(a.status)}</span></div><p>${safe(dayLabel(a.requested_at))}${a.appointment_time?' · '+safe(a.appointment_time)+' Uhr':''}</p><p class="small">${safe(a.topic)}</p><small>Dein Code: ${safe(a.code)}</small></div>`).join(''):'<p class="muted">Du hast auf diesem Gerät noch keine eigenen Terminanfragen.</p>';}catch(e){box.innerHTML='<p class="muted">Eigene Termine konnten nicht geladen werden.</p>';}}

const adminSchedule = makeSchedule($('#adminSchedule'),request,true);
let activeAdminTab = 'overview';
function showAdminTab(tab) {
  const selected=document.querySelector(`[data-admin-tab="${tab}"]`);
  if (!selected || selected.hidden || selected.classList.contains('hidden') || (['maintenance','design'].includes(tab)&&state.session.role!=='big')) tab='overview';
  activeAdminTab=tab;
  document.querySelectorAll('[data-admin-tab]').forEach(button=>{button.classList.toggle('active',button.dataset.adminTab===tab);button.setAttribute('aria-current',button.dataset.adminTab===tab?'page':'false');});
  document.querySelectorAll('[data-admin-section]').forEach(section=>section.classList.toggle('active',section.dataset.adminSection===tab));
  if(tab==='calendar') adminSchedule.refresh();
  if(tab==='maintenance')renderMaintenanceForm();
}
const pageScroll={};
function closeMobileMenu(){ $('#sidebar').classList.remove('open');$('#scrim').classList.remove('open');document.body.classList.remove('menu-open');$('#menuToggle').setAttribute('aria-expanded','false'); }
function navigate(page,options={}) {
  if (page === 'adminPanel' && state.session.role === 'visitor') page = 'login';
  if(maintenanceBlocked(page)){showMaintenance(page);return;}
  const previous=document.querySelector('.view.active')?.id;
  if(previous===page){closeMobileMenu();return;}
  gameCleanup();
  if(previous)pageScroll[previous]=window.scrollY;
  if (page === 'login' && !document.getElementById('login').classList.contains('active')) $('#loginForm').reset();
  document.body.dataset.page = page;
  document.body.classList.toggle('ai-mode', page === 'ki');
  $('.view.active')?.classList.remove('active');
  $('#' + page)?.classList.add('active');
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  closeMobileMenu();
  requestAnimationFrame(()=>window.scrollTo({top:options.restore?(pageScroll[page]||0):0,behavior:'auto'}));
  if (page === 'contact') initChat();
  if (page === 'coaching') loadCalendar();
  if (page === 'termine') { studentSchedule.refresh(); loadMyAppointments(); }
  if (page === 'ki') loadThreads();
  if (page === 'adminPanel' && state.session.role==='big') $('#bigDesignTab').hidden=false;
  if (page === 'adminPanel') { showAdminTab(activeAdminTab); loadAdmin(); }
  if(!options.history&&location.hash!=='#'+page)history.pushState({page},'','#'+page);
}
async function loadCatalog() {
  try {
    const {categories, teachers} = await request('catalog'); window.lessingCatalog={categories,teachers};
    const categorySelect=$('#appointmentCategory'), teacherSelect=$('#appointmentTeacher'), legend=$('#categoryLegend');
    if(categorySelect) categorySelect.innerHTML='<option value="">Bereich auswählen …</option>'+categories.map(c=>`<option value="${safe(c.id)}">${safe(c.name)}</option>`).join('');
    const renderTeachers=()=>{if(!teacherSelect)return;const cid=categorySelect?.value;const available=cid?teachers.filter(t=>(t.category_ids||[]).includes(cid)):[];teacherSelect.innerHTML=cid?(available.length?'<option value="">Lehrkraft auswählen …</option>'+available.map(t=>`<option value="${safe(t.id)}">${safe(t.name)}</option>`).join(''):'<option value="">Keine Lehrkraft für diesen Bereich hinterlegt</option>'):'<option value="">Erst Bereich auswählen …</option>';const hint=$('#categoryTeacherHint');const category=categories.find(c=>c.id===cid);if(hint)hint.textContent=category?(available.length?`${category.name}: ${available.map(t=>t.name).join(' · ')}`:`${category.name}: Noch keine Lehrkraft hinterlegt`):'';if(available.length===1)teacherSelect.value=available[0].id;};
    categorySelect?.addEventListener('change',renderTeachers); renderTeachers();
    if(legend) legend.innerHTML=categories.map(c=>`<span class="category-chip" style="--category-color:${safe(c.color)}"><i></i>${safe(c.name)}</span>`).join('');
  } catch(e){toast(e.message);}
}
function renderAuth() {
  const isStaff = state.session.role !== 'visitor';
  $('#maintenanceTab').hidden=state.session.role!=='big';
  $('#bigDesignTab').hidden=state.session.role!=='big';
  if(state.session.role==='big') renderMaintenanceForm();
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
    const data = await request('bootstrap'); state.session = data.session; state.content = data.content; try { maintenance=JSON.parse(data.content.maintenance||'{}'); } catch {} await loadCatalog();
    $('#heroText').textContent = data.content.hero || $('#heroText').textContent;
    showManagedCopy('about', data.content.about);
    showManagedCopy('help', data.content.help);
    renderPublishedDesign();
  } catch(e) { toast(e.message); }
  finally {
    renderAuth();
    const target = location.hash.slice(1);
    if (target && $('#' + target)?.classList.contains('view')) navigate(target,{history:true,restore:true});
    else navigate('start',{history:true});
    document.documentElement.removeAttribute('data-loading');
  }
}
document.addEventListener('click', e => {
  const page = e.target.closest('button[data-page], a[data-page]')?.dataset.page;
  if (page) navigate(page);
  const prompt = e.target.closest('[data-prompt]')?.dataset.prompt;
  if (prompt) { if(maintenanceBlocked('ki')||(/lernplan/i.test(prompt)&&maintenanceBlocked('planner'))){showMaintenance(/lernplan/i.test(prompt)?'planner':'ki');return;} navigate('ki'); $('#aiForm input[name="message"]').value = prompt; $('#aiForm input[name="message"]').focus(); }
  const subject = e.target.closest('[data-subject]')?.dataset.subject;
  if (subject) { $('#aiForm input[name="message"]').value = `Hilf mir beim Lernen für ${subject}. Frage zuerst, was ich üben möchte.`; $('#aiForm input[name="message"]').focus(); }
});
$('.admin-tabs').onclick=e=>{const tab=e.target.closest('[data-admin-tab]:not(.hidden)')?.dataset.adminTab;if(tab)showAdminTab(tab);};
$('#menuToggle').onclick=e=>{e.stopPropagation();const open=!$('#sidebar').classList.contains('open');$('#sidebar').classList.toggle('open',open);$('#scrim').classList.toggle('open',open);document.body.classList.toggle('menu-open',open);$('#menuToggle').setAttribute('aria-expanded',String(open));};
$('#scrim').onclick=closeMobileMenu;
window.addEventListener('popstate',()=>{const p=location.hash.slice(1)||'start';if($('#'+p)?.classList.contains('view'))navigate(p,{history:true,restore:true});});
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
async function syncStudentPassword(){
  const {enabled}=await request('student-settings');
  const field=$('#studentPasswordField'), input=field.querySelector('input');
  field.classList.toggle('hidden',!enabled); input.disabled=!enabled; input.required=enabled;
}
async function initChat(){try{await syncStudentPassword();const me=await request('chat/me');$('#chatGate').classList.toggle('hidden',me.authenticated);$('#chatArea').classList.toggle('hidden',!me.authenticated);if(me.authenticated){$('#chatClassLabel').textContent=`Klasse ${me.class_name}`;await loadMessages();}}catch(e){toast(e.message);}}
$('#chatLoginForm').onsubmit=async e=>{e.preventDefault();try{const d=await send('chat/login',Object.fromEntries(new FormData(e.currentTarget)));$('#chatGate').classList.add('hidden');$('#chatArea').classList.remove('hidden');$('#chatClassLabel').textContent=`Klasse ${d.class_name}`;e.currentTarget.reset();await loadMessages();}catch(err){toast(err.message);}};
$('#chatLogout').onclick=async()=>{try{await send('chat/logout',{});$('#chatArea').classList.add('hidden');$('#chatGate').classList.remove('hidden');$('#contactMessages').replaceChildren();}catch(e){toast(e.message);}};
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
            $('#appointmentList').innerHTML=appointments.length?appointments.map(a=>`<div class="list-item appointment-admin-card" style="--category-color:${safe(a.category_color||'#3B82F6')}"><div class="row"><strong>${safe(a.first_name)} ${safe(a.last_name)}</strong><span class="pill">${safe(a.status)}</span><span class="category-chip" style="--category-color:${safe(a.category_color||'#3B82F6')}"><i></i>${safe(a.category_name||a.subject)}</span></div><p class="small">${safe(a.class_name)} · ${safe(a.teacher_name||'Lehrkraft nicht gesetzt')} · ${safe(dayLabel(a.requested_at))} · ${safe(a.appointment_time||'Uhrzeit offen')} · Schule aus: ${safe(schoolEndLabel(a.school_end))}</p><p>${safe(a.topic)}</p><p class="small">Code: ${safe(a.code)}</p><form class="statusForm" data-id="${safe(a.id)}"><div class="grid2"><label class="field">Datum<input type="date" name="requested_at" value="${safe(a.requested_at)}"></label><label class="field">Uhrzeit<input type="time" name="appointment_time" value="${safe(a.appointment_time||'')}"></label><label class="field">Bereich<select name="category_id" class="category-edit" data-current="${safe(a.category_id||'')}"></select></label><label class="field">Lehrkraft<select name="teacher_id" class="teacher-edit" data-current="${safe(a.teacher_id||'')}"></select></label></div><label class="field">Status<select name="status"><option ${a.status==='Anfrage eingegangen'?'selected':''}>Anfrage eingegangen</option><option ${a.status==='In Bearbeitung'?'selected':''}>In Bearbeitung</option><option ${a.status==='Bestätigt'?'selected':''}>Bestätigt</option><option ${a.status==='Abgelehnt'?'selected':''}>Abgelehnt</option><option ${a.status==='Erledigt'?'selected':''}>Erledigt</option><option ${a.status==='Nicht erschienen'?'selected':''}>Nicht erschienen</option></select></label><label class="field">Rückmeldung / Notiz<input name="note" maxlength="500" placeholder="z. B. Termin bestätigt / verschoben" value="${safe(a.note)}"></label><div class="row"><button type="button" class="primary" data-accept="${safe(a.id)}">Anfrage annehmen</button><button type="button" class="primary" data-reschedule="${safe(a.id)}">Termin verschieben</button><button type="button" class="primary danger" data-reject="${safe(a.id)}">Ablehnen</button><button class="primary">Speichern</button></div></form></div>`).join(''):'<p class="muted">Noch keine Anfragen.</p>';
      const catalog=window.lessingCatalog||{categories:[],teachers:[]}; document.querySelectorAll('.appointment-admin-card').forEach(card=>{const cf=card.querySelector('.category-edit'),tf=card.querySelector('.teacher-edit');if(!cf||!tf)return;const currentC=cf.dataset.current,currentT=tf.dataset.current;cf.innerHTML=catalog.categories.map(c=>`<option value="${safe(c.id)}" ${c.id===currentC?'selected':''}>${safe(c.name)}</option>`).join('');const fill=()=>{const cid=cf.value,ts=catalog.teachers.filter(t=>(t.category_ids||[]).includes(cid));tf.innerHTML=ts.map(t=>`<option value="${safe(t.id)}" ${t.id===currentT?'selected':''}>${safe(t.name)}</option>`).join('')||'<option value="">Keine Lehrkraft</option>';};cf.onchange=fill;fill();});
      }
    if (can('chats')) {
      const {chats}=await request('admin/chats');state.staffChats=chats;
      renderStaffChats();
      if(state.currentChat) await openAdminChat(state.currentChat);
    }
    if (can('content')) $('#contentEditor').innerHTML = ['hero','about','help'].map(key => `<form class="contentForm" data-key="${key}"><label class="field">${{hero:'Startseite',about:'Über Lessing',help:'Hilfe'}[key]}<textarea name="value" maxlength="3000">${safe(state.content[key] || '')}</textarea></label><button class="primary">Speichern</button></form>`).join('');
    if(isStaffForAccounts()){
      const settings=await request('student-settings');
      $('#studentPasswordToggle').checked=settings.enabled;
    }
    if(state.session.role==='big') $('#bigDesignTab').hidden=false;
    if (isStaffForAccounts()) await loadAccounts();
    if (can('appointments')) { await loadStaffManagement(); await loadAppointmentNotes(); }
  } catch(e) { toast(e.message); }
}
function isStaffForAccounts(){ return state.session.role === 'admin' || state.session.role === 'big'; }
async function loadAccounts() {
  const box=$('#accountList'); if(!box) return;
  const {accounts} = await request('admin/accounts');
  box.innerHTML = accounts.length ? accounts.map(a => `<div class="list-item"><strong>${safe(a.username)}</strong><span class="pill">Admin · Vollzugriff</span><form class="accountForm" data-id="${safe(a.id)}"><label class="field">Neues Passwort (optional)<input type="password" name="password" minlength="10"></label><button class="primary">Speichern</button> <button class="primary danger" type="button" data-delete="${safe(a.id)}">Löschen</button></form></div>`).join('') : '<p class="muted">Noch keine normalen Admin-Konten vorhanden.</p>';
}
async function loadStaffManagement() {
  const [{teachers},{categories}] = await Promise.all([request('admin/teachers'),request('admin/categories')]);
  $('#teacherList').innerHTML=teachers.length?teachers.map(t=>`<div class="list-item teacher-card"><div class="row"><input class="field teacher-name" data-id="${safe(t.id)}" value="${safe(t.name)}"><button class="primary" data-save-teacher="${safe(t.id)}">Speichern</button><button class="primary danger" data-delete-teacher="${safe(t.id)}">Entfernen</button></div><div class="teacher-categories"><strong>Bereiche:</strong><div class="row">${categories.map(c=>`<label><input type="checkbox" class="teacher-category" data-teacher="${safe(t.id)}" data-category="${safe(c.id)}" ${(t.category_ids||[]).includes(c.id)?'checked':''}> ${safe(c.name)}</label>`).join('')}</div></div></div>`).join(''):'<p class="muted">Noch keine Lehrkräfte.</p>';
  $('#categoryList').innerHTML=categories.map(c=>`<div class="list-item row"><input class="field category-name" data-id="${safe(c.id)}" value="${safe(c.name)}"><input type="color" class="category-color" data-id="${safe(c.id)}" value="${safe(c.color)}" title="Farbe"><button class="primary" data-save-category="${safe(c.id)}">Speichern</button><button class="primary danger" type="button" data-delete-category="${safe(c.id)}">Deaktivieren</button></div>`).join('');
}
async function loadAppointmentNotes() {
  const box=$('#appointmentNotesList'); if(!box) return;
  const {notes}=await request('admin/appointment-notes');
  box.innerHTML=notes.length?notes.map(n=>`<div class="list-item appointment-note-card"><div class="row"><strong>${safe(n.category_name)}</strong><span class="pill">${safe(n.reason)}</span><span class="small">${safe(dayLabel(n.requested_at))} · ${safe(n.appointment_time||'Uhrzeit offen')}</span></div><p class="small">${safe(n.first_name)} ${safe(n.last_name)} · ${safe(n.class_name)} · ${safe(n.teacher_name)}</p><p>${safe(n.note)}</p><div class="row"><button type="button" class="primary danger" data-delete-note="${safe(n.id)}">Notiz endgültig löschen</button></div></div>`).join(''):'<p class="muted">Keine archivierten Notizen.</p>';
}
function rejectChoiceModal(form){
  return new Promise(resolve=>{
    const wrap=document.createElement('div'); wrap.className='overlay'; wrap.style.cssText='position:fixed;inset:0;background:rgba(10,20,40,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
    wrap.innerHTML=`<div class="panel" style="max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.25)"><h2>Anfrage ablehnen</h2><p class="muted">Was soll mit der Anfrage passieren?</p><label class="field">Notiz (optional)<textarea id="rejectNote" maxlength="500" placeholder="Warum wurde die Anfrage abgelehnt?"></textarea></label><div class="row" style="flex-wrap:wrap"><button type="button" class="primary" data-choice="note">Ablehnen &amp; in Notizen speichern</button><button type="button" class="primary danger" data-choice="delete">Ablehnen &amp; komplett löschen</button><button type="button" data-choice="reject">Nur ablehnen</button><button type="button" data-choice="cancel">Abbrechen</button></div></div>`;
    document.body.appendChild(wrap);
    wrap.onclick=e=>{const b=e.target.closest('[data-choice]');if(!b)return;const choice=b.dataset.choice;const note=wrap.querySelector('#rejectNote').value.trim();wrap.remove();resolve({choice,note});};
  });
}
$('#reloadAdmin').onclick = loadAdmin;
$('#appointmentList').onsubmit=async e=>{if(!e.target.matches('.statusForm'))return;e.preventDefault();const form=e.target;try{await send('admin/appointments',{id:form.dataset.id,...Object.fromEntries(new FormData(form))},'PATCH');toast('Termin gespeichert');await loadAdmin();}catch(err){toast(err.message);}};
$('#appointmentList').onclick=async e=>{
  const noteBtn=e.target.closest('[data-delete-note]');
  if(noteBtn){try{await send('admin/appointment-notes/'+encodeURIComponent(noteBtn.dataset.deleteNote),{},'DELETE');toast('Notiz gelöscht');await loadAppointmentNotes();}catch(err){toast(err.message);}return;}
  const btn=e.target.closest('[data-accept],[data-reject],[data-reschedule]');if(!btn)return;
  const form=btn.closest('.statusForm'); const data=Object.fromEntries(new FormData(form)); data.id=form.dataset.id;
  try{
    if(btn.dataset.reject){
      const result=await rejectChoiceModal(form); if(result.choice==='cancel')return;
      await send('admin/appointments/'+encodeURIComponent(data.id)+'/reject',{action:result.choice,note:result.note});
      toast(result.choice==='note'?'Anfrage abgelehnt und in Notizen gespeichert':result.choice==='delete'?'Anfrage vollständig gelöscht':'Anfrage abgelehnt');
    } else {
      if(btn.dataset.accept){data.status='Bestätigt';data.note=data.note||'Anfrage angenommen';}
      if(btn.dataset.reschedule){data.status='Bestätigt';data.note=data.note||'Termin verschoben';}
      await send('admin/appointments',data,'PATCH');
      toast(btn.dataset.reschedule?'Termin verschoben':'Anfrage angenommen');
    }
    await loadAdmin();
  }catch(err){toast(err.message);}
};
document.querySelector('[data-admin-section="notes"]')?.addEventListener('click', async e=>{const b=e.target.closest('[data-delete-note]');if(!b)return;try{await send('admin/appointment-notes/'+encodeURIComponent(b.dataset.deleteNote),{},'DELETE');toast('Notiz gelöscht');await loadAppointmentNotes();}catch(err){toast(err.message);}});
function renderStaffChats(){
 const term=($('#staffChatSearch')?.value||'').trim().toLocaleLowerCase('de');
 const chats=(state.staffChats||[]).filter(c=>[c.display_name,c.class_name,c.last_message].join(' ').toLocaleLowerCase('de').includes(term));
 $('#chatList').innerHTML=chats.length?chats.map(c=>`<button type="button" class="staff-chat-card ${state.currentChat===c.visitor_id?'selected':''}" data-chat="${safe(c.visitor_id)}"><strong>${safe(c.display_name)}</strong><span>${safe(c.class_name)} · ${Number(c.count)} Nachrichten</span><small>${safe(c.last_message||'')}</small></button>`).join(''):'<p class="muted">Keine passenden Chats.</p>';
}
$('#staffChatSearch').oninput=renderStaffChats;
$('#chatList').onclick = e => { const id=e.target.closest('[data-chat]')?.dataset.chat; if (id) openAdminChat(id); };
async function openAdminChat(id) {
  const detail=$('#adminChatDetail');
  if (state.currentChat !== id || !detail.querySelector('#staffForm')) {
    detail.innerHTML = `<div id="staffStudentHeader" class="panel nested"></div><div class="chat-area" style="height:350px;min-height:250px;margin-top:15px"><div class="chat-scroll" id="staffMessages"></div><form class="composer" id="staffForm"><input name="message" required maxlength="2000" placeholder="Antwort schreiben …" autocomplete="off"><button class="primary">➤</button></form></div>`;
  }
  state.currentChat=id;
  try {
    const student=(state.staffChats||[]).find(c=>c.visitor_id===id);
    const header=detail.querySelector('#staffStudentHeader');
    if(header){
      header.innerHTML=`<h3>${safe(student?.display_name||'Schüler (älteres Konto)')}</h3><p class="muted">${safe(student?.class_name||'Klasse unbekannt')} · Nur für das Schulteam sichtbar</p><button type="button" class="danger" id="deleteStaffChat">Chat endgültig löschen</button><label class="field">Interne Notiz (Schüler sehen diese nicht)<textarea id="staffInternalNote" maxlength="1000" rows="2">${safe(student?.internal_note||'')}</textarea></label><button class="primary" type="button" id="saveStaffNote">Notiz speichern</button><div id="staffStudentAppointments"></div>`;
      header.querySelector('#saveStaffNote').onclick=async()=>{try{await send('admin/chats/'+encodeURIComponent(id)+'/note',{note:header.querySelector('#staffInternalNote').value},'PATCH');if(student)student.internal_note=header.querySelector('#staffInternalNote').value;toast('Interne Notiz gespeichert');}catch(e){toast(e.message);}};
      header.querySelector('#deleteStaffChat').onclick=async()=>{if(!confirm('Diesen Chat wirklich endgültig löschen?'))return;try{await request('admin/chats/'+encodeURIComponent(id)+'/delete',{method:'DELETE'});state.currentChat=null;await loadAdminChats();detail.innerHTML='';toast('Chat gelöscht');}catch(e){toast(e.message);}};
      try{const {appointments}=await request('admin/chats/'+encodeURIComponent(id)+'/appointments');header.querySelector('#staffStudentAppointments').innerHTML='<h4>Termine dieses Schülers</h4>'+(appointments.length?appointments.map(a=>`<p class="small">${safe(a.subject)} · ${safe(dayLabel(a.requested_at))} · ${safe(a.appointment_time||'Uhrzeit offen')} · ${safe(a.status)}</p>`).join(''):'<p class="muted">Keine Termine vorhanden.</p>');}catch{}
    }
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
const permissions = () => ['appointments','chats','content'];
$('#adminAccounts').onsubmit = async e => {
  const form=e.target;
  if (form.id==='createAdmin') {
    e.preventDefault();
    try { await send('admin/accounts',{username:form.elements.username.value,password:form.elements.password.value,permissions:permissions()}); form.reset(); await loadAccounts(); toast('Admin erstellt'); }
    catch(err){toast(err.message);}
  } else if (form.matches('.accountForm')) {
    e.preventDefault();
    try { await send('admin/accounts/'+form.dataset.id,{permissions:permissions(),password:form.elements.password.value},'PATCH'); await loadAccounts(); toast('Admin aktualisiert'); }
    catch(err){toast(err.message);}
  }
};
$('#adminAccounts').onclick = async e => {
  const del=e.target.dataset.delete;
  if (del) { if (!confirm('Dieses normale Admin-Konto wirklich löschen?')) return; try { await request('admin/accounts/'+del,{method:'DELETE'}); await loadAccounts(); } catch(err){toast(err.message);} return; }
};
document.querySelector('[data-admin-section="staff"]').onclick = async e => {
  const teacherId=e.target.dataset.deleteTeacher;
  if (teacherId) { try { await request('admin/teachers/'+teacherId,{method:'DELETE'}); await loadStaffManagement(); await loadCatalog(); toast('Lehrkraft deaktiviert'); } catch(err){toast(err.message);} return; }
  const saveTeacher=e.target.dataset.saveTeacher;
  if (saveTeacher) { const input=document.querySelector(`.teacher-name[data-id="${CSS.escape(saveTeacher)}"]`); const category_ids=[...document.querySelectorAll(`.teacher-category[data-teacher="${CSS.escape(saveTeacher)}"]:checked`)].map(x=>x.dataset.category); try { await send('admin/teachers/'+saveTeacher,{name:input.value,category_ids},'PATCH'); await loadStaffManagement(); await loadCatalog(); toast('Lehrkraft gespeichert'); } catch(err){toast(err.message);} return; }
  const deleteCategory=e.target.dataset.deleteCategory;
  if (deleteCategory) { try { await request('admin/categories/'+deleteCategory,{method:'DELETE'}); await loadStaffManagement(); await loadCatalog(); adminSchedule.refresh(); toast('Bereich deaktiviert'); } catch(err){toast(err.message);} return; }
  const saveCategory=e.target.dataset.saveCategory;
  if (saveCategory) { const name=document.querySelector(`.category-name[data-id="${CSS.escape(saveCategory)}"]`).value; const color=document.querySelector(`.category-color[data-id="${CSS.escape(saveCategory)}"]`).value; try { await send('admin/categories/'+saveCategory,{name,color},'PATCH'); await loadStaffManagement(); await loadCatalog(); adminSchedule.refresh(); toast('Bereich gespeichert'); } catch(err){toast(err.message);} }
};
// Bereichszuordnungen beim Anklicken speichern, ohne die Ansicht neu aufzubauen.
$('#teacherList').addEventListener('change', async e => {
  if (!e.target.matches('.teacher-category')) return;
  const checkbox=e.target, teacherId=checkbox.dataset.teacher;
  const card=checkbox.closest('.teacher-card');
  const name=card.querySelector('.teacher-name').value;
  const category_ids=[...card.querySelectorAll('.teacher-category:checked')].map(x=>x.dataset.category);
  const boxes=[...card.querySelectorAll('.teacher-category')];
  boxes.forEach(x=>x.disabled=true);
  try {
    await send('admin/teachers/'+encodeURIComponent(teacherId),{name,category_ids},'PATCH');
    await loadCatalog();
    toast('Bereiche gespeichert');
  } catch(err) {
    checkbox.checked=!checkbox.checked;
    toast(err.message);
  } finally {
    boxes.forEach(x=>x.disabled=false);
  }
});
$('#teacherCreate').onsubmit=async e=>{e.preventDefault();try{await send('admin/teachers',{name:e.target.elements.name.value});e.target.reset();await loadStaffManagement();await loadCatalog();toast('Lehrkraft hinzugefügt');}catch(err){toast(err.message);}};
$('#categoryCreate').onsubmit=async e=>{e.preventDefault();try{await send('admin/categories',{name:e.target.elements.name.value,color:e.target.elements.color.value});e.target.reset();e.target.elements.color.value='#3B82F6';await loadStaffManagement();await loadCatalog();adminSchedule.refresh();toast('Bereich hinzugefügt');}catch(err){toast(err.message);}};
$('#passwordForm').onsubmit = async e => { e.preventDefault(); const form=e.target; try { await send('admin/password',Object.fromEntries(new FormData(form)),'PATCH'); form.reset(); toast('Passwort geändert'); }catch(err){toast(err.message);} };

let maintenance={};
const maintenanceLabels={start:'Startseite',coaching:'Termin & Coaching',termine:'Termine',ki:'Lern-KI',contact:'Chat',planner:'Lernplaner',stars:'Lessing Stars'};
const gameLabels={math:'Mathe-Quiz',vocab:'Vokabeltrainer',memory:'Memory',reaction:'Reaktionsspiel',logic:'Logik-Quiz',dvd:'DVD-Video'};
let gameCleanup=()=>{};
let maintenanceOrigin='start';
function maintenanceBlocked(page){return state.session.role!=='big'&&!['login','maintenancePage'].includes(page)&&(maintenance.all||maintenance.sections?.[page]);}
function renderMaintenanceForm(){
 if(state.session.role!=='big')return;
 const f=$('#maintenanceForm');f.innerHTML=`<label class="field"><span><input type="checkbox" name="all" ${maintenance.all?'checked':''}> Gesamte Website sperren (nur Big Admin hat Zugang)</span></label><h3>Einzelne Bereiche sperren</h3>${Object.entries(maintenanceLabels).map(([key,label])=>`<label class="field"><span><input type="checkbox" name="section_${key}" ${maintenance.sections?.[key]?'checked':''}> ${label}</span></label>`).join('')}<label class="field">Titel<input name="title" maxlength="100" value="${safe(maintenance.title||'Wartungsarbeiten')}"></label><label class="field">Nachricht<textarea name="message" maxlength="700">${safe(maintenance.message||'Wir verbessern gerade Lessing Coach. Bitte versuche es später erneut.')}</textarea></label><label class="field"><span><input type="checkbox" name="games" ${maintenance.games!==false?'checked':''}> Spiele während der Wartung erlauben</span></label>${Object.entries(gameLabels).map(([key,label])=>`<label><input type="checkbox" name="game_${key}" ${maintenance.enabledGames?.[key]!==false?'checked':''}> ${label}</label> `).join('')}<p><button class="primary">Wartung speichern</button></p>`;
 f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('button');b.disabled=true;try{const data={all:f.elements.all.checked,games:f.elements.games.checked,title:f.elements.title.value,message:f.elements.message.value,sections:{},enabledGames:{}};for(const k of Object.keys(maintenanceLabels))data.sections[k]=f.elements['section_'+k].checked;for(const k of Object.keys(gameLabels))data.enabledGames[k]=f.elements['game_'+k].checked;maintenance=(await send('admin/maintenance',data,'PATCH')).maintenance;toast('Wartung gespeichert – gilt für alle Geräte.');}catch(err){toast(err.message);}finally{b.disabled=false;}};
}
function showMaintenance(page){
 maintenanceOrigin=page;gameCleanup();const video=$('#maintenancePage video');if(video){video.src=nextMaintenanceVideo();video.load();video.play().catch(()=>{});}document.body.classList.remove('ai-mode');closeMobileMenu();$('.view.active')?.classList.remove('active');$('#maintenancePage').classList.add('active');document.body.dataset.page='maintenancePage';
 $('#maintenanceTitle').textContent=maintenance.title||'Wartungsarbeiten';$('#maintenanceMessage').textContent=maintenance.message||(page==='coaching'||page==='termine'?'Derzeit sind keine Terminerstellungen möglich, da Wartungsarbeiten durchgeführt werden.':'Dieser Bereich wird gerade gewartet. Bitte versuche es später erneut.');
 const box=$('#maintenanceGames');box.replaceChildren();if(maintenance.games===false)return;
 box.innerHTML='<h2 style="margin-top:24px">Lernspiele ab Klasse 5</h2><p>Wähle ein Lernspiel oder schau dir den DVD-Bildschirmschoner an.</p><label class="field">Schwierigkeit<select id="gameLevel"><option value="5">Klasse 5–6</option><option value="7">Klasse 7–8</option><option value="9">Klasse 9+</option></select></label><div class="row" id="gameChoices"></div><div class="panel" id="gameArea"></div>';
 for(const [key,label] of Object.entries(gameLabels)){if(maintenance.enabledGames?.[key]===false)continue;const b=document.createElement('button');b.className='primary';b.textContent=label;b.onclick=()=>startGame(key);$('#gameChoices').append(b);}
 $('#gameArea').textContent='Wähle ein Spiel aus.';
}
function startGame(kind){
 gameCleanup();const level=Number($('#gameLevel')?.value||5);const area=$('#gameArea');let live=true,timer;gameCleanup=()=>{live=false;clearTimeout(timer);};area.innerHTML=`<h3>${gameLabels[kind]}</h3><p class="muted">${safe({math:'Rechne im Kopf oder auf Papier. Gib dein Ergebnis ein, drücke Prüfen und danach Weiter. Dezimalzahlen kannst du mit Komma schreiben.',vocab:'Übersetze das englische Wort ins Deutsche. Gib die Übersetzung ein und drücke Prüfen. Groß- und Kleinschreibung zählen nicht.',memory:'Decke zwei Karten auf und finde zweimal dasselbe Symbol. Du spielst allein. Ziel: alle acht Paare mit möglichst wenigen Zügen finden.',reaction:'Drücke Start. Nach 0,5 bis 1,5 Sekunden wird das Feld grün. Klicke dann möglichst schnell. Ein Klick vor Grün zählt als Fehlstart.',dvd:'Das DVD-Logo bewegt sich automatisch und prallt an den Rändern ab. Schau, ob es eine Ecke trifft.',logic:'Erkenne das Muster der Zahlenfolge und gib die nächste Zahl ein. Drücke Prüfen und danach Weiter.'}[kind])}</p><div id="gameBody"></div>`;const body=$('#gameBody');
 if(kind==='dvd'){startDvdGame(body);return;}
 if(kind==='memory'){startMemory(body);return;}
 if(kind==='reaction'){
  body.innerHTML='<p id="reactionInfo">Drücke Start. Klicke erst, sobald das Feld grün wird.</p><button class="primary" id="reactionTarget">Start</button>';let phase='idle',start=0;const b=$('#reactionTarget');b.onclick=()=>{if(phase==='waiting'){clearTimeout(timer);phase='idle';b.textContent='Zu früh! Erneut starten';b.style.background='';return;}if(phase==='ready'){const ms=Math.round(performance.now()-start);phase='idle';b.textContent=`${ms} ms – erneut starten`;b.style.background='';return;}phase='waiting';b.textContent='Warten …';b.style.background='#b45309';timer=setTimeout(()=>{if(!live)return;phase='ready';start=performance.now();b.style.background='#15803d';b.textContent='JETZT klicken!';},500+Math.random()*1000);};return;
 }
 const vocabSets={5:[['timetable','Stundenplan'],['homework','Hausaufgaben'],['classroom','Klassenzimmer'],['neighbour','Nachbar'],['breakfast','Frühstück'],['library','Bibliothek'],['weather','Wetter'],['journey','Reise'],['exercise','Übung'],['language','Sprache']],7:[['environment','Umwelt'],['opportunity','Gelegenheit'],['responsibility','Verantwortung'],['experience','Erfahrung'],['knowledge','Wissen'],['decision','Entscheidung'],['achievement','Leistung'],['confidence','Selbstvertrauen'],['development','Entwicklung'],['behaviour','Verhalten']],9:[['sustainability','Nachhaltigkeit'],['inequality','Ungleichheit'],['evidence','Beweis'],['consequence','Folge'],['awareness','Bewusstsein'],['assumption','Annahme'],['reliability','Zuverlässigkeit'],['perspective','Perspektive'],['requirement','Anforderung'],['controversy','Kontroverse']]};
 const vocab=vocabSets[level];
 const logicSets={5:[['2, 5, 8, 11, …','14'],['3, 6, 12, 24, …','48'],['1, 4, 9, 16, …','25'],['80, 40, 20, …','10'],['2, 6, 12, 20, …','30'],['1, 2, 4, 7, 11, …','16'],['5, 10, 8, 16, 14, …','28'],['100, 90, 81, 73, …','66'],['4, 7, 13, 25, …','49'],['1, 1, 2, 3, 5, …','8']],7:[['2, 6, 18, 54, …','162'],['1, 8, 27, 64, …','125'],['−12, −7, −2, 3, …','8'],['1, 3, 7, 15, …','31'],['2, 3, 5, 8, 12, …','17'],['81, 27, 9, …','3'],['2, 5, 10, 17, …','26'],['1, 2, 6, 24, …','120'],['4, 9, 19, 39, …','79'],['2, −4, 8, −16, …','32']],9:[['1, 4, 10, 20, 35, …','56'],['2, 3, 5, 9, 17, …','33'],['1, 2, 5, 14, 41, …','122'],['3, 8, 15, 24, …','35'],['1, 4, 13, 40, …','121'],['64, −32, 16, −8, …','4'],['2, 6, 24, 120, …','720'],['0,5; 1,5; 4,5; 13,5; …','40,5'],['2, 7, 17, 37, …','77'],['1, 3, 6, 10, 15, …','21']]};
 const logic=logicSets[level];
 function mathQuestion(){const a=Math.floor(Math.random()*30)+10,b=Math.floor(Math.random()*12)+2;const type=Math.floor(Math.random()*4);if(level===5){return [[`${a} × ${b}`,String(a*b)],[`${a*b} ÷ ${b}`,String(a)],[`${a} + ${b} × 3`,String(a+b*3)],[`${a*4} − (${b} + ${a})`,String(a*3-b)]][type];}if(level===7){return [[`${b*5} % von 200`,String(b*10)],[`−${a} + ${b*4}`,String(b*4-a)],[`${b}x + ${a} = ${b*3+a}. x = ?`,'3'],[`${b}/4 von ${a*4}`,String(b*a)]][type];}return [[`${b}x − ${a} = ${b*7-a}. x = ?`,'7'],[`√${a*a} + ${b}²`,String(a+b*b)],[`Ein Preis von ${a*10} € steigt um 15 %. Neuer Preis?`,String(a*11.5)],[`f(x) = 3x² − 2x. f(${b}) = ?`,String(3*b*b-2*b)]][type];}
 let n=0,score=0;const questions=(kind==='vocab'?vocab:logic).map(x=>[...x]);for(let i=questions.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[questions[i],questions[j]]=[questions[j],questions[i]];}
 function next(){if(n===10){body.innerHTML=`<p>Fertig! ${score} von 10 richtig.</p><button class="primary">Noch einmal</button>`;body.querySelector('button').onclick=()=>startGame(kind);return;}let q,answer;if(kind==='math'){[q,answer]=mathQuestion();}else{[q,answer]=questions[n];q=kind==='vocab'?`Übersetze ins Deutsche: ${q}`:`Welche Zahl folgt? ${q}`;}
 body.innerHTML=`<p>Aufgabe ${n+1}/10 · Punkte ${score}</p><p><strong>${safe(q)}</strong></p><form id="gameAnswer"><label class="field">Deine Antwort<input required autocomplete="off" aria-label="Deine Antwort"></label><button class="primary">Prüfen</button></form><p id="gameFeedback" role="status"></p>`;
 const f=$('#gameAnswer');f.onsubmit=e=>{e.preventDefault();if(f.querySelector('button').disabled)return;const norm=x=>x.trim().toLowerCase().replace(/^(der|die|das) /,'').replace(',', '.');const correct=(kind==='vocab'?[answer,...({Gelegenheit:['Chance'],Leistung:['Erfolg'],Beweis:['Nachweis','Belege'],Folge:['Konsequenz'],Nachbar:['Nachbarin'],Bibliothek:['Bücherei']}[answer]||[])]:[answer]).some(a=>norm(f.querySelector('input').value)===norm(a));if(correct)score++;n++;f.querySelector('button').disabled=true;f.querySelector('input').disabled=true;$('#gameFeedback').textContent=correct?'Richtig!':`Richtige Antwort: ${answer}`;const b=document.createElement('button');b.className='primary';b.textContent='Weiter';b.onclick=next;body.append(b);};}next();
}
setInterval(async()=>{try{const data=await request('maintenance');maintenance=data.maintenance;if(data.session&&data.session.role!==state.session.role){const wasStaff=state.session.role!=='visitor';state.session=data.session;renderAuth();if(wasStaff&&state.session.role==='visitor'&&document.querySelector('.view.active')?.id==='adminPanel'){navigate('login');toast('Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.');}}const page=document.querySelector('.view.active')?.id;if(page&&maintenanceBlocked(page))showMaintenance(page);else if(page==='maintenancePage'&&!maintenanceBlocked(maintenanceOrigin))navigate(maintenanceOrigin==='planner'?'ki':maintenanceOrigin);}catch{}},15000);
queueMicrotask(()=>boot().catch(e=>{document.documentElement.removeAttribute('data-loading');toast('Seite konnte nicht vollständig geladen werden: '+e.message);}));

// Schüler-Passwortschalter: nur die Verwaltung kann den Modus ändern.
$('#saveStudentPassword').onclick=async()=>{
 try{
   const result=await send('admin/student-settings',{enabled:$('#studentPasswordToggle').checked},'PATCH');
   toast(result.enabled?'Schüler-Passwort aktiviert':'Schüler-Passwort deaktiviert');
 }catch(e){toast(e.message);}
};
// Big-Admin-Designer. Änderungen werden erst nach "Ansicht speichern" veröffentlicht.
const designPages=['start','termine','ki','contact'];
let designItems=[],designSelected=null;
function designFor(page){
 try{const a=JSON.parse(state.content['design_'+page]||'[]');return Array.isArray(a)?a:[];}catch{return [];}
}
function renderPublishedDesign(){
 designPages.forEach(page=>{
  const view=document.getElementById(page);if(!view)return;
  view.querySelectorAll('.lessing-design-published').forEach(el=>el.remove());
  const items=designFor(page);if(!items.length)return;
  const layer=document.createElement('div');layer.className='lessing-design-published';
  layer.style.height=Math.max(100,...items.map(i=>i.y+i.h+15))+'px';
  items.forEach(i=>{
    const el=document.createElement('div');el.className='lessing-design-item';
    el.style.cssText=`left:${i.x}px;top:${i.y}px;width:${i.w}px;height:${i.h}px;color:${i.color};background:${i.type==='text'?'transparent':i.bg};font-size:${i.size}px`;
    el.textContent=i.text;layer.append(el);
  });
  view.append(layer);
 });
}
function designPaint(){
 const layer=$('#designLayer');layer.replaceChildren();
 designItems.forEach(i=>{
  const el=document.createElement('div');el.className='design-element'+(designSelected===i.id?' chosen':'');
  el.style.cssText=`left:${i.x}px;top:${i.y}px;width:${i.w}px;height:${i.h}px;color:${i.color};background:${i.type==='text'?'transparent':i.bg};font-size:${i.size}px`;
  el.textContent=i.text;
  const handle=document.createElement('span');handle.className='design-resize';el.append(handle);
  el.onpointerdown=e=>{
    e.preventDefault();designSelected=i.id;designSyncInputs();designPaint();
    const originX=e.clientX,originY=e.clientY,old={...i},resize=e.target.classList.contains('design-resize');
    const move=ev=>{
      if(resize){i.w=Math.max(50,Math.min(1200,old.w+ev.clientX-originX));i.h=Math.max(30,Math.min(900,old.h+ev.clientY-originY));}
      else{i.x=Math.max(0,Math.min(1600,old.x+ev.clientX-originX));i.y=Math.max(0,Math.min(2400,old.y+ev.clientY-originY));}
      designPaint();
    };
    const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop,{once:true});
  };
  layer.append(el);
 });
}
function designSyncInputs(){
 const i=designItems.find(x=>x.id===designSelected);if(!i)return;
 $('#designText').value=i.text;$('#designSize').value=i.size;$('#designColor').value=i.color;$('#designBg').value=i.bg;
}
function designLoad(){
 if(state.session.role!=='big')return;
 const page=$('#designPage').value;designItems=designFor(page).map(i=>({...i}));designSelected=null;
 const frame=$('#designFrame');frame.src='/#'+page;
 frame.onload=()=>{try{frame.contentWindow.document.querySelector('[data-page="'+page+'"]')?.click();}catch{}};
 designPaint();
}
$('#designPage').onchange=designLoad;
document.querySelector('[data-admin-tab="design"]').addEventListener('click',designLoad);
function designAdd(type){
 const i={id:crypto.randomUUID(),type,text:type==='text'?'Neuer Text':type==='box'?'Neues Feld':'Neuer Button',x:20,y:20+designItems.length*25,w:190,h:65,color:'#172554',bg:'#ffffff',size:20};
 designItems.push(i);designSelected=i.id;designSyncInputs();designPaint();
}
$('#designAddText').onclick=()=>designAdd('text');
$('#designAddBox').onclick=()=>designAdd('box');
$('#designAddButton').onclick=()=>designAdd('button');
for(const [selector,key,transform] of [['#designText','text',String],['#designSize','size',Number],['#designColor','color',String],['#designBg','bg',String]]){
 $(selector).oninput=e=>{const i=designItems.find(x=>x.id===designSelected);if(!i)return;i[key]=transform(e.target.value);designPaint();};
}
$('#designDelete').onclick=()=>{designItems=designItems.filter(i=>i.id!==designSelected);designSelected=null;designPaint();};
$('#designSave').onclick=async()=>{
 try{
  const page=$('#designPage').value;
  await send('admin/design',{page,items:designItems},'PATCH');
  state.content['design_'+page]=JSON.stringify(designItems);
  renderPublishedDesign();toast('Ansicht gespeichert');
 }catch(e){toast(e.message);}
};

function nextMaintenanceVideo(){
 const clips=['/assets/maintenance-loop.mp4','/assets/maintenance-loop-violet.mp4','/assets/maintenance-loop-teal.mp4'];
 let last=-1;try{last=Number(localStorage.getItem('lessing_background_clip')??-1);}catch{}
 const next=(last+1)%clips.length;try{localStorage.setItem('lessing_background_clip',String(next));}catch{}return clips[next];
}
function startDvdGame(body){
 body.replaceChildren();gameCleanup=createDvdScreensaver(body);
}

function startMemory(root){
 root.replaceChildren();let active=true,first=null,locked=false,moves=0,found=0,timer;
 const status=document.createElement('p');status.setAttribute('role','status');
 const grid=document.createElement('div');grid.className='memory-grid';
 const restart=document.createElement('button');restart.type='button';restart.className='primary';restart.textContent='Neu starten';
 root.append(status,grid,restart);
 const update=message=>{status.textContent=`${found}/8 Paare · ${moves} Züge${message?' · '+message:''}`;};update('Wähle zwei Karten.');
 const deck=['🚀','🎧','🎮','⚽','🧩','🎨','🛰️','🧪'].flatMap((symbol,id)=>[{symbol,id},{symbol,id}]);
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 for(const [index,item] of deck.entries()){
  const b=document.createElement('button');b.type='button';b.className='memory-card';b.textContent='?';b.setAttribute('aria-label',`Karte ${index+1}, verdeckt`);
  const card={b,id:item.id,open:false,matched:false};
  function close(){card.open=false;b.textContent='?';b.classList.remove('revealed');b.setAttribute('aria-label',`Karte ${index+1}, verdeckt`);}card.close=close;
  b.onclick=e=>{e.stopPropagation();if(!active||locked||card.open||card.matched)return;
   card.open=true;b.textContent=item.symbol;b.classList.add('revealed');b.setAttribute('aria-label',item.symbol);
   if(!first){first=card;update('Wähle die zweite Karte.');return;}
   const other=first;first=null;moves++;
   if(other.id===card.id){other.matched=card.matched=true;other.b.disabled=b.disabled=true;other.b.classList.add('matched');b.classList.add('matched');found++;update(found===8?'Geschafft! Alle Paare gefunden.':'Paar gefunden!');}
   else{locked=true;update('Kein Paar – merke dir die Karten.');timer=setTimeout(()=>{if(!active)return;other.close();card.close();locked=false;update('Wähle zwei Karten.');},1100);}
  };grid.append(b);
 }
 gameCleanup=()=>{active=false;clearTimeout(timer);};
 restart.onclick=e=>{e.stopPropagation();gameCleanup();startMemory(root);};
}

const starsNavigation=document.querySelector('#starsNavigation');starsNavigation.onclick=()=>{if(maintenanceBlocked('stars'))showMaintenance('stars');else location.href='/lessing-stars/'};
