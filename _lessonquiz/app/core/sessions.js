// HMAC 无状态 Cookie 会话（学生/教师共用 cookie 名 session，靠 role 区分）
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let secret = '';

function init(config) {
  const p = path.join(config.dataDir, 'secret');
  try { secret = fs.readFileSync(p, 'utf8').trim(); } catch (e) { secret = ''; }
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(p, secret, { mode: 0o600 });
  }
}

function createSession(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
  return payload + '.' + sig;
}

function readSession(token, ttlMs) {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (Date.now() - s.iat > ttlMs) return null;
    return s;
  } catch (e) { return null; }
}

function cookieToken(req) {
  const c = req.headers.cookie || '';
  const m = c.match(/(?:^|;\s*)session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

module.exports = { init, createSession, readSession, cookieToken };
