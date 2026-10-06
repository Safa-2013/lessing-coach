import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import api from './lib/api.js';

const root = fileURLToPath(new URL('./', import.meta.url));
const mime = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml', '.mp4':'video/mp4', '.webp':'image/webp', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8'
};

function safeFile(pathname){
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = resolve(root, clean || 'index.html');
  const rel = relative(root, target);
  if (rel.startsWith('..') || rel.includes('..\\')) return null;
  return target;
}

createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    const pathname = u.pathname;
    if (pathname.startsWith('/api/')) {
      if (req.method !== 'GET') {
        let input = '';
        for await (const chunk of req) {
          input += chunk;
          if (input.length > 20000) { res.writeHead(413).end(); return; }
        }
        req.body = input;
      }
      return api(req, res);
    }
    const target = safeFile(pathname === '/' ? '/index.html' : pathname);
    if (!target) { res.writeHead(403).end(); return; }
    const info = await stat(target).catch(()=>null);
    if (!info?.isFile()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', mime[extname(target).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', /\.(html|css|js)$/.test(target) ? 'no-cache' : 'public, max-age=3600');
    res.end(await readFile(target));
  } catch (error) {
    res.writeHead(500, {'Content-Type':'text/plain; charset=utf-8'}).end('Serverfehler');
  }
}).listen(process.env.PORT || 3000, () => console.log('Lessing: http://localhost:' + (process.env.PORT || 3000)));
