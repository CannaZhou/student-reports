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

  // 无扩展名的请求走不到下面的白名单（extname='' 会被判 403），所以页面路径必须在这里列全。
  // /index、/index.html 也一起放行：老页面里「首页」写的是相对链接 href="index"（会被浏览器解成
  // /index），书签里也可能留着这个地址，别让它撞上 403。
  if (pathname === '/') pathname = '/index.html';
  else if (pathname === '/index') pathname = '/index.html';
  else if (pathname === '/quiz') pathname = '/quiz.html';
  else if (pathname === '/scores') pathname = '/scores.html';
  else if (pathname === '/cert') pathname = '/cert.html';
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
