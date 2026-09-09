// 口令哈希（scrypt），用于教师端登录
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, stored) {
  if (!stored || !stored.hash || !stored.salt) return false;
  const hash = crypto.scryptSync(String(password), stored.salt, 64).toString('hex');
  const a = Buffer.from(hash);
  const b = Buffer.from(stored.hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { hashPassword, verifyPassword };
