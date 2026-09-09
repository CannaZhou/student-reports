// 静态托管：扩展名白名单 + 路径穿越防护 + 别名（/ → index.html）
const fs = require('fs');
const path = require('path');

const EXT = new Set(['.html', '.css', '.js', '.png', '.svg', '.ico', '.jpg', '.jpeg', '.gif', '.woff', '.woff2']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function serve(req, res, ctx) {
  const config = ctx.config;
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname); }
  catch (e) { res.writeHead(400); return res.end('Bad Request'); }

  if (pathname === '/') pathname = '/index.html';
  else if (pathname === '/quiz') pathname = '/quiz.html';
  else if (pathname === '/scores') pathname = '/scores.html';
  else if (pathname === '/teacher') pathname = '/teacher.html';

  if (!pathname.startsWith('/')) { res.writeHead(400); return res.end('Bad Request'); }
  const full = path.normalize(path.join(config.publicDir, pathname));
  if (!full.startsWith(config.publicDir + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  const ext = path.extname(full).toLowerCase();
  if (!EXT.has(ext)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const data = fs.readFileSync(full);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

module.exports = { serve };
