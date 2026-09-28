import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import api from './lib/api.js';

createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    if (req.method !== 'GET') {
      let input = '';
      for await (const chunk of req) { input += chunk; if (input.length > 20000) { res.writeHead(413).end(); return; } }
      req.body = input;
    }
    return api(req, res);
  }
  if (req.url === '/visual.css') {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.end(await readFile(new URL('./visual.css', import.meta.url)));
  } else if (['/assets/feature-strip.png','/assets/hero-books.png','/assets/ai-cap.png'].includes(req.url)) {
    res.setHeader('Content-Type', 'image/png');
    res.end(await readFile(new URL('.' + req.url, import.meta.url)));
  } else if (req.url === '/app.js') {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.end(await readFile(new URL('./app.js', import.meta.url)));
  } else if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(await readFile(new URL('./index.html', import.meta.url)));
  } else res.writeHead(404).end();
}).listen(process.env.PORT || 3000, () => console.log('Lessing: http://localhost:' + (process.env.PORT || 3000)));
