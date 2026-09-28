import { test } from 'node:test';
import assert from 'node:assert/strict';

test('production without a database returns an actionable error', async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  delete process.env.DATABASE_URL;
  try {
    const { default: api } = await import('../lib/api.js');
    const response = { headers:{}, setHeader(name,value){this.headers[name]=value;}, end(text){this.data=JSON.parse(text);}, get headersSent(){return false;} };
    await api({url:'/api/bootstrap',method:'GET',headers:{host:'localhost'}}, response);
    assert.equal(response.statusCode, 503);
    assert.match(response.data.error, /DATABASE_URL/);
  } finally {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  }
});
