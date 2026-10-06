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
  await api({url:'/api/'+path,method,body:data?JSON.stringify(data):undefined,headers:{cookie,host:'localhost'}},response);
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
  const parentBase={requester_type:'parent',first_name:'Mara',last_name:'Eltern',child_name:'Nela Eltern',class_name:'8a',topic:'Beratung',school_end:'15:50',category_id:category.id,teacher_id:teacher.id,requested_at:parentDay,requested_time:'15:00'};
  assert.equal((await call('appointments','POST',{...parentBase,child_name:''},parent.cookie)).status,400);
  assert.equal((await call('appointments','POST',{...parentBase,requested_time:'17:00'},parent.cookie)).status,400);
  const parentCreated=await call('appointments','POST',parentBase,parent.cookie);
  assert.equal(parentCreated.status,201);
  const parentLookup=await call('appointments?code='+parentCreated.data.code,'GET',null,parent.cookie);
  assert.equal(parentLookup.data.appointment.child_name,'Nela Eltern');
  assert.equal(parentLookup.data.appointment.requested_at,parentDay);
  assert.equal(parentLookup.data.appointment.appointment_time,'15:00');
});

test('critical mobile UI is immediately usable and role controller is actually shipped in index.html',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../visual.css',import.meta.url),'utf8');
  assert.match(html,/data-requester-role="student"/);
  assert.match(html,/data-requester-role="parent"/);
  assert.match(html,/function setRequesterRole\(role\)/);
  assert.match(html,/const dayLabel = value => value \?/);
  assert.match(html,/class="mobile-quick-nav"/);
  assert.doesNotMatch(html,/html\[data-loading="true"\] \.shell\{visibility:hidden;pointer-events:none\}/);
  assert.match(css,/MOBILE-FIRST APPOINTMENTS/);
  assert.match(css,/#appointmentSubmit\{width:100%/);
});
