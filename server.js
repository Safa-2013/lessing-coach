import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import api from './lib/api.js';

createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    if (req.method !== 'GET') {
      let input = '';
      for await (const chunk of req) { input += chunk; if (input.length > 300000) { res.writeHead(413).end(); return; } }
      req.body = input;
    }
    return api(req, res);
  }
  if(['/lessing-stars/release.js','/lessing-stars/release.css'].includes(req.url.split('?')[0])) {const p=req.url.split('?')[0];res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile(new URL('.'+p,import.meta.url)));}
  else if (/^\/lessing-stars\/assets\/[a-f0-9]{16}\.(png|jpg|webp)$/.test(req.url.split('?')[0])) {const path=req.url.split('?')[0];res.setHeader('Content-Type',path.endsWith('.png')?'image/png':path.endsWith('.webp')?'image/webp':'image/jpeg');res.end(await readFile(new URL('.'+path,import.meta.url)));}
  else if (['/lessing-stars/','/lessing-stars/index.html'].includes(req.url.split('?')[0])) {res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(new URL('./lessing-stars/index.html',import.meta.url)));}
  else if (['/assets/maintenance-loop.mp4','/assets/maintenance-loop-violet.mp4','/assets/maintenance-loop-teal.mp4','/assets/maintenance-poster.jpg','/assets/dvd-screensaver.mp4','/assets/dvd-poster.jpg'].includes(req.url)) {
    res.setHeader('Content-Type',req.url.endsWith('.mp4')?'video/mp4':'image/jpeg');
    res.end(await readFile(new URL('.'+req.url,import.meta.url)));
  } else if (req.url.split('?')[0] === '/waiting-games.js') {
    res.setHeader('Content-Type','text/javascript; charset=utf-8');
    res.end(await readFile(new URL('./waiting-games.js',import.meta.url)));
  } else if (req.url.split('?')[0] === '/visual.css') {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.end(await readFile(new URL('./visual.css', import.meta.url)));
  } else if (['/assets/feature-strip.png','/assets/hero-books.png','/assets/ai-cap.png'].includes(req.url)) {
    res.setHeader('Content-Type', 'image/png');
    res.end(await readFile(new URL('.' + req.url, import.meta.url)));
  } else if (['/app.js','/holidays.js','/calendar-ui.js'].includes(req.url.split('?')[0])) {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.end(await readFile(new URL('.' + req.url.split('?')[0], import.meta.url)));
  } else if (req.url === '/' || req.url === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(await readFile(new URL('./index.html', import.meta.url)));
  } else res.writeHead(404).end();
}).listen(process.env.PORT || 3000, () => console.log('Lessing: http://localhost:' + (process.env.PORT || 3000)));
