import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import api from '../lib/api.js';
import {database} from '../lib/db.js';
const root = new URL('../',import.meta.url);
process.chdir(mkdtempSync(join(tmpdir(),'lessing-load-')));
process.env.INITIAL_BIG_ADMIN_PASSWORD='owner-load-test';
async function call(){const res={setHeader(){},end(body){this.data=JSON.parse(body)}};await api({url:'/api/bootstrap',method:'GET',headers:{host:'localhost'}},res);return res;}
test('repeated requests preserve password hashes; changed environment credentials still apply',async()=>{
 await call();const db=await database();const first=(await db.query("SELECT password_hash FROM accounts WHERE username='admin'"))[0].password_hash;
 await Promise.all([call(),call(),call()]);
 assert.equal((await db.query("SELECT password_hash FROM accounts WHERE username='admin'"))[0].password_hash,first);
 process.env.INITIAL_BIG_ADMIN_PASSWORD='updated-owner-test';await call();
 assert.notEqual((await db.query("SELECT password_hash FROM accounts WHERE username='admin'"))[0].password_hash,first);
});
test('maintenance polling pauses hidden/offline, backs off failures, and prevents overlap',async()=>{
 const source=readFileSync(new URL('app.js',root),'utf8');
 const start=source.indexOf('// Only one request at a time.');
 const end=source.indexOf('queueMicrotask(',start);
 let count=0,fail=false,pending,delay;const listeners={};
 const document={hidden:false,addEventListener(name,fn){listeners[name]=fn},querySelector(){return null}};
 const context=vm.createContext({document,navigator:{onLine:true},window:{addEventListener(name,fn){listeners[name]=fn}},setTimeout(fn,ms){delay=ms;return 1},clearTimeout(){},request:async()=>{count++;if(fail)throw Error('offline');if(pending)await pending;return {maintenance:{}}},state:{session:{role:'visitor'}},maintenance:{},maintenanceBlocked:()=>false});
 vm.runInContext(source.slice(start,end),context);
 assert.equal(delay,60000);
 document.hidden=true;await vm.runInContext('pollMaintenance()',context);assert.equal(count,0);
 document.hidden=false;context.navigator.onLine=false;await vm.runInContext('pollMaintenance()',context);assert.equal(count,0);
 context.navigator.onLine=true;fail=true;await vm.runInContext('pollMaintenance()',context);assert.equal(delay,120000);
 fail=false;await vm.runInContext('pollMaintenance()',context);assert.equal(delay,60000);
 let release;pending=new Promise(resolve=>release=resolve);
 const first=vm.runInContext('pollMaintenance()',context);const before=count;await vm.runInContext('pollMaintenance()',context);assert.equal(count,before);release();await first;
});
