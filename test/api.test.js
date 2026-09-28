import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import api from '../lib/api.js';

process.chdir(mkdtempSync(join(tmpdir(), 'lessing-test-')));
delete process.env.DATABASE_URL;
process.env.INITIAL_ADMIN_PASSWORD = 'Test-Admin-Passwort-2026';
process.env.INITIAL_BIG_ADMIN_PASSWORD = 'Test-Hauptadmin-Passwort-2026';

async function call(path, method='GET', data, cookie='') {
  const response = { headers:{}, setHeader(k,v) { this.headers[k.toLowerCase()]=v; }, end(text) { this.data=JSON.parse(text); }, get headersSent() { return false; } };
  await api({url:'/api/'+path, method, body:data ? JSON.stringify(data) : undefined, headers:{cookie,host:'localhost'}},response);
  return {status:response.statusCode, data:response.data, cookie: response.headers['set-cookie']?.split(';')[0] || cookie};
}

test('student requests, private contact chats, admin roles and AI setup', async () => {
  const first = await call('bootstrap');
  const second = await call('bootstrap');
  assert.notEqual(first.cookie, second.cookie);
  const future = new Date(Date.now()+4*86400000).toISOString().slice(0,10);
  const month = future.slice(0,7);
  const form = {first_name:'A',last_name:'B',class_name:'9a',subject:'Mathematik',topic:'Brüche',requested_at:future,school_end:'15:50'};
  assert.equal((await call('appointments','POST',{...form,requested_at:future+'T14:00'},first.cookie)).status,400);
  assert.equal((await call('appointments','POST',{...form,school_end:''},first.cookie)).status,400);
  const created = await call('appointments','POST',form,first.cookie);
  assert.equal(created.status,201);
  const lookup = await call('appointments?code='+created.data.code,'GET',null,second.cookie);
  assert.equal(lookup.data.appointment.status,'Anfrage eingegangen');
  assert.equal(lookup.data.appointment.school_end,'15:50');
  const anonymousCalendar=await call('appointments/calendar?month='+month,'GET',null,second.cookie);
  assert.deepEqual(anonymousCalendar.data.days,[{date:future,hasAppointments:false,hasRequests:true}]);
  assert.doesNotMatch(JSON.stringify(anonymousCalendar.data),/Brüche|LS-/);
  await call('messages','POST',{message:'Privat'},first.cookie);
  assert.equal((await call('messages','GET',null,second.cookie)).data.messages.length,0);
  const normal = await call('login','POST',{username:'Lessing',password:process.env.INITIAL_ADMIN_PASSWORD},second.cookie);
  assert.equal(normal.data.session.role,'admin');
  assert.equal((await call('admin/accounts','GET',null,normal.cookie)).status,403);
  const staffAppointments = await call('admin/appointments','GET',null,normal.cookie);
  assert.equal(staffAppointments.data.appointments.length,1);
  assert.equal((await call('admin/appointments','PATCH',{id:staffAppointments.data.appointments[0].id,status:'Bestätigt',note:'Donnerstag um 14 Uhr'},normal.cookie)).status,200);
  assert.equal((await call('appointments?code='+created.data.code,'GET',null,second.cookie)).data.appointment.note,'Donnerstag um 14 Uhr');
  assert.deepEqual((await call('appointments/calendar?month='+month,'GET',null,second.cookie)).data.days,[{date:future,hasAppointments:true,hasRequests:false}]);
  const staffChats = await call('admin/chats','GET',null,normal.cookie);
  assert.equal(staffChats.data.chats.length,1);
  const visitorId = staffChats.data.chats[0].visitor_id;
  await call('admin/chats/'+visitorId,'POST',{message:'Wir haben deine Nachricht erhalten.'},normal.cookie);
  assert.equal((await call('messages','GET',null,first.cookie)).data.messages.length,2);
  assert.equal((await call('admin/content','PATCH',{key:'about',value:'Unser Coaching-Konzept'},normal.cookie)).status,200);
  assert.equal((await call('bootstrap','GET',null,normal.cookie)).data.content.about,'Unser Coaching-Konzept');
  const big = await call('login','POST',{username:'admin',password:process.env.INITIAL_BIG_ADMIN_PASSWORD},first.cookie);
  assert.equal(big.data.session.role,'big');
  assert.equal((await call('admin/accounts','GET',null,big.cookie)).data.accounts.length,1);
  assert.equal((await call('admin/accounts','POST',{username:'KursAdmin',password:'sicheresPasswort123',permissions:['appointments']},big.cookie)).status,201);
  const limited = await call('login','POST',{username:'KursAdmin',password:'sicheresPasswort123'});
  assert.equal((await call('admin/appointments','GET',null,limited.cookie)).status,200);
  assert.equal((await call('admin/chats','GET',null,limited.cookie)).status,403);
  assert.equal((await call('admin/accounts','GET',null,limited.cookie)).status,403);
  const learner = await call('bootstrap');
  const threads = await call('ai/threads','POST',{title:'Mathe'},learner.cookie);
  assert.equal(threads.status,201);
  assert.equal((await call('ai/threads/'+threads.data.thread.id,'GET',null,second.cookie)).status,404);
  const ai = await call('ai/ask','POST',{thread_id:threads.data.thread.id,message:'Hallo'},learner.cookie);
  assert.equal(ai.status,503);
  assert.match(ai.data.error,/OPENAI_API_KEY/);
  process.env.OPENAI_API_KEY='test-key';
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async (_url,options) => {
    const request=JSON.parse(options.body);
    assert.equal(request.store,false);
    assert.equal(request.input.at(-1).content,'Brüche erklären');
    return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Ein Bruch ist ein Teil eines Ganzen.'}]}]})};
  };
  try {
    const answered=await call('ai/ask','POST',{thread_id:threads.data.thread.id,message:'Brüche erklären'},learner.cookie);
    assert.equal(answered.status,200);
    const history=await call('ai/threads/'+threads.data.thread.id,'GET',null,learner.cookie);
    assert.equal(history.data.messages.length,2);
    assert.equal((await call('ai/progress','GET',null,learner.cookie)).data.questions,1);
    process.env.GEMINI_API_KEY='test-gemini-key';
    globalThis.fetch=async (url,options) => {
      assert.match(url,/generativelanguage\.googleapis\.com/);
      assert.equal(options.headers['x-goog-api-key'],'test-gemini-key');
      const data=JSON.parse(options.body);
      assert.equal(data.contents.at(-1).parts[0].text,'Nächster Lernschritt');
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Übe zuerst die Grundlagen.'}]}}]})};
    };
    const gemini=await call('ai/ask','POST',{thread_id:threads.data.thread.id,message:'Nächster Lernschritt'},learner.cookie);
    assert.equal(gemini.status,200);
    assert.equal(gemini.data.answer,'Übe zuerst die Grundlagen.');
  } finally { globalThis.fetch=oldFetch; delete process.env.OPENAI_API_KEY; delete process.env.GEMINI_API_KEY; }
});
