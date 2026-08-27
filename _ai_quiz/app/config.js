// 应用配置
const path = require('path');

const ROOT = __dirname; // app/
const CONFIG = {
  port: Number(process.env.PORT) || 8080,
  host: '0.0.0.0',
  dataDir: path.join(ROOT, 'data'),
  publicDir: path.join(ROOT, 'public'),

  // 打卡规则
  totalDays: 50,
  daySize: 50,
  scorePerQuestion: 2,

  // 学生统一登录密码
  defaultStudentPassword: 'zqxx2025',

  // 安全
  maxUploadMB: 20,
  loginFail: { attempts: 5, lockMinutes: 15 },
  sessionTtlHours: 12,
  maxQuestionLength: 2000,
};

module.exports = CONFIG;
