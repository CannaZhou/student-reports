// HTTP 公共工具：读 JSON 请求体、JSON 响应、上传解码、会话读取、题目脱敏
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
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function ok(res, data) { json(res, 200, Object.assign({ ok: true }, data)); }
function fail(res, code, msg, extra) { json(res, code, Object.assign({ ok: false, error: { code, msg } }, extra)); }

// 解析前端 dataURL 上传 → Buffer；同时返回文件名
function decodeUpload(raw, maxBytes) {
  const m = /^data:([^;,]+)(;[^,]*)?,([\s\S]*)$/.exec(String(raw || ''));
  const b64 = m ? m[3] : String(raw || '');
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > maxBytes) throw Object.assign(new Error('文件超过大小限制'), { code: 413 });
  return buf;
}

function setSessionCookie(res, token, ttlSec) {
  res.setHeader('Set-Cookie',
    'session=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + ttlSec);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function currentSession(req, config) {
  return sessions.readSession(sessions.cookieToken(req), config.sessionTtlHours * 3600 * 1000);
}

// 学生可见的题目（不含答案/解析）
function publicQuestion(q) {
  return {
    id: q.id, type: q.type, q: q.q, options: q.options,
    section: q.section || '', unit: q.unit || '', unitTitle: q.unitTitle || '',
    src: q.src || 'custom',
  };
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

module.exports = {
  readBody, json, ok, fail, decodeUpload,
  setSessionCookie, clearSessionCookie, currentSession,
  publicQuestion, todayStr,
};
