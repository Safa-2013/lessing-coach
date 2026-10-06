import { holidayOn } from './holidays.js';

const weekdays = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const iso = date => date.toISOString().slice(0,10);
const utcDay = value => new Date(`${value}T00:00:00Z`);
const addDays = (day, number) => { const d=utcDay(day); d.setUTCDate(d.getUTCDate()+number); return iso(d); };
const monthStart = day => day.slice(0,7)+'-01';
const addMonths = (day, number) => { const d=utcDay(monthStart(day)); d.setUTCMonth(d.getUTCMonth()+number); return iso(d); };
const longDate = day => utcDay(day).toLocaleDateString('de-DE',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});
const monday = day => addDays(day,-((utcDay(day).getUTCDay()+6)%7));
const localToday = () => {
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get = type => parts.find(p=>p.type===type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

export function makeSchedule(root, request, admin=false) {
  let anchor=localToday(), mode='month', days={}, detailDay='', sequence=0, loaded=false;
  const body=root.querySelector('.schedule-body');
  const controls=root.querySelector('.schedule-controls');
  const appointmentList=day=>days[day]||[];
  const status=day=>{
    const list=appointmentList(day);
    return {confirmed:list.some(a=>a.status==='Bestätigt'||a.hasAppointments),pending:list.some(a=>a.status&&!['Bestätigt','Abgelehnt'].includes(a.status)||a.hasRequests)};
  };
  const info=day=>{
    const vacation=holidayOn(day), state=status(day);
    const availability=admin?(state.confirmed?'Bereits Termine':state.pending?'Anfragen vorhanden':'Noch keine Termine'):(state.confirmed?'Nicht verfügbar':'Verfügbar');
    return { vacation, state, color:vacation?`holiday ${state.confirmed?'confirmed':state.pending?'requested':''}`:state.confirmed?'confirmed':state.pending?'requested':'available',
      text:vacation?`${vacation} · ${availability}`:availability };
  };
  function interval() {
    if(mode==='week') { const from=monday(anchor); return [from,addDays(from,7)]; }
    if(mode==='year') return [`${anchor.slice(0,4)}-01-01`,`${Number(anchor.slice(0,4))+1}-01-01`];
    const from=monthStart(anchor); return [from,addMonths(from,1)];
  }
  function button(day,small=false) {
    const a=info(day), count=appointmentList(day).length;
    const events=admin&&count&&!small?`<span class="schedule-events">${appointmentList(day).slice(0,2).map(item=>`<span class="schedule-event" style="--category-color:${esc(item.category_color||'#3B82F6')}"><i></i>${esc(item.category_name||item.topic)} · ${esc(item.teacher_name||'Lehrkraft')}</span>`).join('')}${count>2?`<span>+ ${count-2} weitere</span>`:''}</span>`:'';
    const color=admin&&appointmentList(day)[0]?.category_color;
    return `<button type="button" class="schedule-day ${a.color}${detailDay===day?' is-selected':''}" ${color?`style="--category-color:${esc(color)}"`:''} data-schedule-date="${day}" aria-label="${esc(longDate(day)+': '+a.text)}"><strong>${Number(day.slice(-2))}</strong>${small?'':`<span class="schedule-day-state">${esc(a.text)}</span>`}${events}</button>`;
  }
  function month(day,small=false) {
    const first=monthStart(day), count=utcDay(addMonths(first,1)); count.setUTCDate(0);
    const offset=(utcDay(first).getUTCDay()+6)%7;
    const grid=`<div class="schedule-month-grid ${small?'compact':''}">${weekdays.map(d=>`<span class="schedule-weekday">${d}</span>`).join('')}${Array.from({length:offset},()=>'<span></span>').join('')}${Array.from({length:count.getUTCDate()},(_,i)=>button(addDays(first,i),small)).join('')}</div>`;
    if(!small) return grid;
    return `<article class="schedule-year-month"><h3>${utcDay(first).toLocaleDateString('de-DE',{month:'long',timeZone:'UTC'})}</h3>${grid}</article>`;
  }
  function render() {
    const [from,to]=interval();
    controls.querySelector('.schedule-period').textContent=mode==='week'?`${longDate(from)} – ${longDate(addDays(to,-1))}`:mode==='month'?utcDay(from).toLocaleDateString('de-DE',{month:'long',year:'numeric',timeZone:'UTC'}):anchor.slice(0,4);
    controls.querySelectorAll('[data-mode]').forEach(button=>button.classList.toggle('active',button.dataset.mode===mode));
    let content;
    if(mode==='week') content=`<div class="schedule-week">${Array.from({length:7},(_,i)=>{const day=addDays(from,i);return `<div class="schedule-week-column"><header>${weekdays[i]}<small>${longDate(day)}</small></header>${button(day)}</div>`;}).join('')}</div>`;
    else if(mode==='year') content=`<div class="schedule-year">${Array.from({length:12},(_,i)=>month(`${anchor.slice(0,4)}-${String(i+1).padStart(2,'0')}-01`,true)).join('')}</div>`;
    else content=month(from);
    if(detailDay) {
      const a=info(detailDay), list=appointmentList(detailDay);
      const details=admin&&list.length?list.map(item=>`<div class="schedule-detail-row" style="border-left:4px solid ${esc(item.category_color||'#3B82F6')}"><span class="pill">${esc(item.status)}</span><strong>${esc(item.requester_type==='parent'?(item.child_name||'Kind nicht angegeben'):item.first_name+' '+item.last_name)}</strong><span>${item.requester_type==='parent'?'Eltern-Anfrage · ':''}${esc(item.category_name||item.topic)} · ${esc(item.teacher_name||'Lehrkraft')} · ${esc(item.appointment_time||'Uhrzeit offen')}</span><small>${esc(item.code)}</small></div>`).join(''):'';
      content+=`<div class="schedule-details"><h3>${longDate(detailDay)}</h3><p>${esc(a.text)}${admin&&list.length?` · ${list.length} ${list.length===1?'Eintrag':'Einträge'}`:''}</p>${details}</div>`;
    }
    body.innerHTML=content;
  }
  async function refresh() {
    const current=++sequence, [from,to]=interval();
    body.innerHTML='<p class="schedule-loading">Kalender wird geladen …</p>';
    try {
      let rows;
      if(admin) rows=(await request(`admin/calendar?from=${from}&to=${to}`)).appointments;
      else {
        const first=monthStart(from), last=monthStart(addDays(to,-1));
        const months=[]; for(let m=first;m<=last;m=addMonths(m,1)) months.push(m.slice(0,7));
        rows=(await Promise.all(months.map(m=>request('appointments/calendar?month='+m)))).flatMap(result=>result.days);
      }
      if(current!==sequence) return;
      days={}; for(const row of rows) { const day=row.date||row.requested_at?.slice(0,10); (days[day]??=[]).push(row); }
      loaded=true; render();
    } catch(error) { if(current===sequence){loaded=false;body.innerHTML=`<p class="schedule-loading" role="alert">Kalender konnte nicht geladen werden: ${esc(error.message)}</p>`;} }
  }
  controls.onclick=event=>{
    const target=event.target.closest('button'); if(!target) return;
    if(target.dataset.mode) { mode=target.dataset.mode; detailDay=''; refresh(); return; }
    if(target.classList.contains('schedule-today')) { anchor=localToday(); detailDay=''; refresh(); return; }
    const direction=target.classList.contains('schedule-next')?1:target.classList.contains('schedule-prev')?-1:0;
    if(direction) { anchor=mode==='week'?addDays(anchor,7*direction):mode==='year'?`${Number(anchor.slice(0,4))+direction}-01-01`:addMonths(anchor,direction); detailDay=''; refresh(); }
  };
  body.onclick=event=>{
    const day=event.target.closest('[data-schedule-date]')?.dataset.scheduleDate; if(!day) return;
    if(mode==='year') { anchor=day; mode='month'; detailDay=day; refresh(); }
    else { detailDay=day; render(); }
  };
  return {refresh,ensure:()=>{if(!loaded)refresh();}};
}
