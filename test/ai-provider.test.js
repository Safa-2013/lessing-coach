import {test} from 'node:test';
import assert from 'node:assert/strict';
import {askAI} from '../lib/ai-provider.js';
import {generateStarsDraft} from '../lib/stars-ai.js';

test('shared provider forwards images and PDFs and discovers a usable Gemini model',async()=>{
 const original=globalThis.fetch;process.env.GEMINI_API_KEY='test-key';delete process.env.GEMINI_MODEL;delete process.env.OPENAI_API_KEY;const bodies=[];
 globalThis.fetch=async(url,options)=>{if(url.includes('pageSize'))return {ok:true,json:async()=>({models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']} ]})};bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Antwort'}]}}]})}};
 try{const answer=await askAI({instructions:'Lerncoach',input:[{role:'user',content:'Erkläre',attachments:[{name:'blatt.pdf',mimeType:'application/pdf',data:'data:application/pdf;base64,JVBERg=='}]}]});assert.equal(answer,'Antwort');assert.equal(bodies[0].contents[0].parts[1].inlineData.mimeType,'application/pdf');assert.equal(bodies[0].contents[0].parts[1].inlineData.data,'JVBERg==');}
 finally{globalThis.fetch=original;delete process.env.GEMINI_API_KEY}
});
test('AI brawler drafts are bounded and never publish automatically',async()=>{
 const original=globalThis.fetch;process.env.OPENAI_API_KEY='test-key';
 globalThis.fetch=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({name:'KI-Entwurf',hp:999999,damage:999999,projectiles:100,design:{outfit:'#aabbcc'}})}]}]})});
 try{const {draft}=await generateStarsDraft({kind:'brawler',prompt:'Ein neuer Blitz-Brawler'});assert.equal(draft.published,false);assert.equal(draft.hp,20000);assert.equal(draft.damage,5000);assert.equal(draft.projectiles,5);assert.equal(draft.design.outfit,'#aabbcc')}
 finally{globalThis.fetch=original;delete process.env.OPENAI_API_KEY}
});
