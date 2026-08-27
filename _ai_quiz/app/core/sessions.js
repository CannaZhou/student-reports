// HMAC 无状态 Cookie 会话：重启不掉线，无需内存存储
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let secret = '';

// 首次运行生成随机密钥（勿提交 git）
function init(config) {
  const p = path.join(config.dataDir, 'secret');
  try { secret = fs.readFileSync(p, 'utf8').trim(); } catch (e) { secret = ''; }
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(p, secret, { mode: 0o600 });
  }
}

function createSession(role, name) {
  const payload = Buffer.from(JSON.stringify({ role, name, iat: Date.now() })).toString('base64url');
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
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
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

// 用于刷新过期时间：重新签发
function refresh(session) {
  return createSession(session.role, session.name);
}

module.exports = { init, createSession, readSession, cookieToken, refresh };
