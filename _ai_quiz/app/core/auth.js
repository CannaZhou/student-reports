// 密码哈希（scrypt）+ 登录失败锁定
const crypto = require('crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return { hash, salt };
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.hash) return false;
  const hash = crypto.scryptSync(String(pw), stored.salt, 64).toString('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(stored.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 登录失败锁定（内存计数，重启清零）
class FailTracker {
  constructor(attempts, lockMs) {
    this.attempts = attempts;
    this.lockMs = lockMs;
    this.map = new Map(); // key -> {count, lockedUntil}
  }
  check(key) {
    const e = this.map.get(key);
    if (e && e.lockedUntil && Date.now() < e.lockedUntil) return { locked: true, waitMin: Math.ceil((e.lockedUntil - Date.now()) / 60000) };
    return { locked: false };
  }
  fail(key) {
    const e = this.map.get(key) || { count: 0, lockedUntil: 0 };
    e.count += 1;
    if (e.count >= this.attempts) { e.lockedUntil = Date.now() + this.lockMs; e.count = 0; }
    this.map.set(key, e);
  }
  success(key) { this.map.delete(key); }
}

module.exports = { hashPassword, verifyPassword, FailTracker };
