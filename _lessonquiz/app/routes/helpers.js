// HTTP 公共工具：读 JSON 请求体、JSON 响应、会话读取
const sessions = require('../core/sessions.js');

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { reject(Object.assign(new Error('请求过大'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(Object.assign(new Error('请求体不是合法JSON'), { code: 400 })); }
    });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function ok(res, data) { json(res, 200, Object.assign({ ok: true }, data)); }
function fail(res, code, msg, extra) { json(res, code, Object.assign({ ok: false, error: { code, msg } }, extra)); }

function setSessionCookie(res, token, ttlSec) {
  res.setHeader('Set-Cookie',
    'session=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + ttlSec);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function readSession(req, config) {
  return sessions.readSession(sessions.cookieToken(req), config.sessionTtlHours * 3600 * 1000);
}

module.exports = { readBody, json, ok, fail, setSessionCookie, clearSessionCookie, readSession };
