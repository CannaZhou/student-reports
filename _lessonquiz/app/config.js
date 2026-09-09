// 小学信息科技 分课课堂检测系统 — 配置
const path = require('path');

const ROOT = __dirname; // app/
const CONFIG = {
  port: Number(process.env.PORT) || 7000,
  host: '0.0.0.0',
  dataDir: path.join(ROOT, 'data'),
  publicDir: path.join(ROOT, 'public'),

  // 教师端默认密码（首次启动写入 teacher.json 的哈希，登录后可改）
  defaultTeacherPassword: '123456',

  // 安全
  maxBodyMB: 1,
  sessionTtlHours: 12,
};

module.exports = CONFIG;
