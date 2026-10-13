import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import api from '../lib/api.js';
import { holidayOn } from '../holidays.js';

process.chdir(mkdtempSync(join(tmpdir(), 'lessing-mobile-test-')));
delete process.env.DATABASE_URL;
process.env.INITIAL_ADMIN_PASSWORD = 'Schulen';
process.env.INITIAL_BIG_ADMIN_PASSWORD = '1234';

async function call(path, method='GET', data, cookie='') {
  const response = { headers:{}, setHeader(k,v){this.headers[k.toLowerCase()]=v;}, end(text){this.data=JSON.parse(text);}, get headersSent(){return false;} };
  const routed=path.startsWith('@rewrite:');
  await api({url:routed?'/api/index.js?path='+encodeURIComponent(path.slice(9)):'/api/'+path,method,body:data?JSON.stringify(data):undefined,headers:{cookie,host:'localhost'}},response);
  return {status:response.statusCode,data:response.data,cookie:response.headers['set-cookie']?.split(';')[0]||cookie};
}
function nextSchoolDay(){
  for(let add=1;add<80;add++){
    const d=new Date(Date.now()+add*86400000);const date=d.toISOString().slice(0,10);const wd=d.getUTCDay();
    if(wd!==0&&wd!==6&&!holidayOn(date)) return date;
  }
  throw new Error('no school day found');
}

test('mobile student request needs no slot; parent chooses a school-day slot; staff assigns student slot', async()=>{
  const student=await call('bootstrap');
  const parent=await call('bootstrap');
  const adminSession=await call('bootstrap');
  const login=await call('login','POST',{username:'Lessing',password:'Schulen'},adminSession.cookie);
  const catalog=await call('catalog','GET',null,student.cookie);
  const category=catalog.data.categories[0];
  const createdTeacher=await call('admin/teachers','POST',{name:'Mobile Test'},login.cookie);
  assert.equal(createdTeacher.status,201);
  const catalog2=await call('catalog','GET',null,student.cookie);
  const teacher=catalog2.data.teachers.find(t=>t.name==='Mobile Test');
  await call('admin/teachers/'+teacher.id,'PATCH',{name:'Mobile Test',active:true,category_ids:[category.id]},login.cookie);

  const studentForm={requester_type:'student',first_name:'Lina',last_name:'Test',class_name:'7G2',topic:'Mathe Hilfe',school_end:'13:20',category_id:category.id,teacher_id:teacher.id};
  const studentCreated=await call('appointments','POST',studentForm,student.cookie);
  assert.equal(studentCreated.status,201);
  const studentLookup=await call('appointments?code='+studentCreated.data.code,'GET',null,student.cookie);
  assert.equal(studentLookup.data.appointment.requester_type,'student');
  assert.equal(studentLookup.data.appointment.requested_at,'');
  assert.equal(studentLookup.data.appointment.appointment_time,'');

  const adminList=await call('admin/appointments','GET',null,login.cookie);
  const studentRow=adminList.data.appointments.find(a=>a.code===studentCreated.data.code);
  assert.ok(studentRow);
  assert.equal((await call('admin/appointments','PATCH',{id:studentRow.id,status:'Bestätigt',requested_at:'',appointment_time:'',category_id:category.id,teacher_id:teacher.id,note:''},login.cookie)).status,400);
  const assignedDay=nextSchoolDay();
  assert.equal((await call('admin/appointments','PATCH',{id:studentRow.id,status:'Bestätigt',requested_at:assignedDay,appointment_time:'14:00',category_id:category.id,teacher_id:teacher.id,note:'Termin zugeteilt'},login.cookie)).status,200);

  const parentDay=nextSchoolDay();
  const parentBase={requester_type:'parent',first_name:'Mara',last_name:'Eltern',child_name:'Nela Eltern',class_name:'8a',topic:'Beratung',category_id:category.id,teacher_id:teacher.id,requested_at:parentDay,requested_time:'15:00'};
  assert.equal((await call('appointments','POST',{...parentBase,child_name:''},parent.cookie)).status,400);
  assert.equal((await call('appointments','POST',{...parentBase,requested_time:'17:00'},parent.cookie)).status,400);
  const parentCreated=await call('appointments','POST',parentBase,parent.cookie);
  assert.equal(parentCreated.status,201);
  const parentLookup=await call('appointments?code='+parentCreated.data.code,'GET',null,parent.cookie);
  assert.equal(parentLookup.data.appointment.child_name,'Nela Eltern');
  assert.equal(parentLookup.data.appointment.requested_at,parentDay);
  assert.equal(parentLookup.data.appointment.appointment_time,'15:00');
  assert.equal(parentLookup.data.appointment.school_end,'');
});

test('critical mobile UI is immediately usable and role controller is actually shipped in index.html',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../visual.css',import.meta.url),'utf8');
  assert.match(html,/data-requester-role="student"/);
  assert.match(html,/data-requester-role="parent"/);
  assert.match(html,/function setRequesterRole\(role\)/);
  assert.match(html,/const dayLabel = value => value \?/);
  assert.match(html,/class="mobile-quick-nav"/);
  assert.match(html,/id="schoolEndFieldset"/);
  assert.match(html,/id="parentTimeSlots"/);
  assert.match(html,/Bei Eltern wird keine Schulschluss-Uhrzeit des Kindes abgefragt/);
  assert.doesNotMatch(html,/html\[data-loading="true"\] \.shell\{visibility:hidden;pointer-events:none\}/);
  assert.match(css,/MOBILE-FIRST APPOINTMENTS/);
  assert.match(css,/#appointmentSubmit\{width:100%/);
});

test('staff directly records lesson appointments, edits them, prevents duplicates and keeps names private',async()=>{
  const visitor=await call('bootstrap');
  const staff=await call('login','POST',{username:'Lessing',password:'Schulen'},(await call('bootstrap')).cookie);
  const category=(await call('catalog','GET',null,visitor.cookie)).data.categories[0];
  const teacher=(await call('admin/teachers','POST',{name:'Frau Lenart Test'},staff.cookie)).data;
  await call('admin/teachers/'+teacher.id,'PATCH',{name:'Frau Lenart Test',active:true,category_ids:[category.id]},staff.cookie);
  const input={first_name:'Schüler',last_name:'X',class_name:'7G2',requested_at:'2026-10-13',lesson_period:3,category_id:category.id,teacher_id:teacher.id};
  assert.equal((await call('admin/appointments','POST',input,visitor.cookie)).status,403);
  const created=await call('admin/appointments','POST',input,staff.cookie);assert.equal(created.status,201);
  const calendar=await call('admin/calendar?from=2026-10-12&to=2026-10-19','GET',null,staff.cookie);
  const row=calendar.data.appointments.find(a=>a.id===created.data.appointment.id);
  assert.equal(row.status,'Bestätigt');assert.equal(row.lesson_period,3);assert.equal(row.first_name,'Schüler');assert.equal(row.appointment_time,'');
  assert.equal((await call('appointments?code='+row.code,'GET',null,visitor.cookie)).status,404);
  const publicCalendar=await call('appointments/calendar?month=2026-10','GET',null,visitor.cookie);assert.equal(JSON.stringify(publicCalendar.data).includes('Schüler'),false);assert.equal(JSON.stringify(publicCalendar.data).includes('Frau Lenart'),false);
  assert.equal((await call('admin/appointments','POST',input,staff.cookie)).status,409);
  const next=await call('admin/appointments','POST',{...input,last_name:'Y',lesson_period:4},staff.cookie);assert.equal(next.status,201);
  assert.equal((await call('admin/appointments','PATCH',{id:next.data.appointment.id,status:'Bestätigt',lesson_period:3},staff.cookie)).status,409);
  assert.equal((await call('admin/appointments','PATCH',{id:next.data.appointment.id,status:'Bestätigt',lesson_period:6},staff.cookie)).status,200);
  const concurrent=await Promise.all([call('admin/appointments','POST',{...input,lesson_period:5},staff.cookie),call('admin/appointments','POST',{...input,lesson_period:5},staff.cookie)]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
  for(const invalid of [{lesson_period:13},{lesson_period:0},{requested_at:'2026-02-31'},{teacher_id:'missing'}])assert.equal((await call('admin/appointments','POST',{...input,...invalid},staff.cookie)).status,400);
  assert.equal((await call('admin/appointments','POST',{...input,lesson_period:0,appointment_time:'08:35'},staff.cookie)).status,201);
  assert.equal((await call('@rewrite:admin/appointments','POST',{...input,lesson_period:7},staff.cookie)).status,201,'Vercel rewrite URL must reach the save handler without req.query');
  assert.equal((await call('admin/accounts','POST',{username:'terminadmin',password:'TerminAdmin1234',permissions:[]},staff.cookie)).status,201);
  const normal=await call('login','POST',{username:'terminadmin',password:'TerminAdmin1234'},(await call('bootstrap')).cookie);
  assert.equal(normal.data.session.role,'admin');
  assert.equal((await call('admin/appointments','POST',{...input,lesson_period:9},normal.cookie)).status,201,'A separately created normal admin can create appointments');
  assert.equal((await call('admin/teacher-calendar-code','POST',{teacher_id:teacher.id,code:'NORMAL9'},normal.cookie)).status,200,'Normal admins can also set calendar codes');
  const big=await call('login','POST',{username:'admin',password:'1234'},(await call('bootstrap')).cookie);
  assert.equal((await call('admin/appointments','POST',{...input,lesson_period:10},big.cookie)).status,201,'Big Admin can create appointments too');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/id="directAppointmentForm"/);assert.match(html,/Termin direkt eintragen/);assert.match(html,/name="lesson_period"/);
});

test('teacher calendar codes open only the assigned calendar without login and can be replaced or revoked',async()=>{
  const visitor=(await call('bootstrap')).cookie,staff=(await call('login','POST',{username:'Lessing',password:'Schulen'},(await call('bootstrap')).cookie)).cookie;
  const category=(await call('catalog','GET',null,visitor)).data.categories[0],teachers=[];
  for(const name of ['Kalender Code A','Kalender Code B']){const teacher=(await call('admin/teachers','POST',{name,category_ids:[category.id]},staff)).data;teachers.push(teacher);assert.equal((await call('admin/appointments','POST',{first_name:name,last_name:'Test',class_name:'7G2',requested_at:'2026-10-20',lesson_period:3,teacher_id:teacher.id,category_id:category.id,note:'Interne Notiz'},staff)).status,201)}
  const setCode=(teacher,code,disable=false)=>call('admin/teacher-calendar-code','POST',{teacher_id:teacher.id,code,disable},staff);
  assert.equal((await call('admin/teacher-calendar-code','POST',{teacher_id:teachers[0].id,code:'ABC'},visitor)).status,403);
  assert.equal((await setCode(teachers[0],'AB')).status,400);assert.equal((await setCode(teachers[0],'ABC')).status,200);assert.equal((await setCode(teachers[1],'ABC')).status,409);assert.equal((await setCode(teachers[1],'DEF')).status,200);
  const open=code=>call('appointments/teacher-calendar','POST',{code,from:'2026-10-19',to:'2026-10-26'},visitor);
  const own=await open('abc');assert.equal(own.status,200);assert.equal(own.data.teacher.name,'Kalender Code A');assert.equal(own.data.appointments.length,1);assert.equal(own.data.appointments[0].first_name,'Kalender Code A');assert.equal(own.data.appointments[0].lesson_period,3);assert.equal(own.data.appointments[0].note,undefined);assert.equal(own.data.appointments[0].code,undefined);assert.equal(JSON.stringify(own.data).includes('Kalender Code B'),false);
  assert.equal((await open('INVALID')).status,404);assert.equal((await setCode(teachers[0],'NEW')).status,200);assert.equal((await open('ABC')).status,404);assert.equal((await open('NEW')).status,200);assert.equal((await setCode(teachers[0],'',true)).status,200);assert.equal((await open('NEW')).status,404);
  await call('admin/teachers/'+teachers[1].id,'DELETE',{},staff);assert.equal((await open('DEF')).status,404);
  assert.equal((await call('admin/appointments','PATCH',{code:'NEW',id:'fake',status:'Bestätigt'},visitor)).status,403);
  let limited=false;for(let i=0;i<23;i++)limited ||= (await open('WRONG')).status===429;assert.ok(limited,'Repeated code guesses must be throttled');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/teacherCalendarAccessForm/);assert.match(html,/id="lookupForm"/);assert.match(html,/Termine mit Code öffnen/);assert.match(html,/placeholder="Code eingeben" maxlength="64"/);assert.match(html,/minlength="3"/);assert.match(html,/Code deaktivieren/);assert.match(html,/adminSchedule.*insertAdjacentHTML\('afterend'/);
});
