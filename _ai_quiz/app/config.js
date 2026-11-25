// 应用配置
const path = require('path');

const ROOT = __dirname; // app/
const CONFIG = {
  port: Number(process.env.PORT) || 8080,
  host: '0.0.0.0',
  // 环境变量仅用于起隔离测试实例（不影响正常启动）
  dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data'),
  publicDir: path.join(ROOT, 'public'),
  // 名家绘本：清单在 content/，图片在 media/（故意不放 public/，取图要过登录校验）
  contentDir: path.join(ROOT, 'content'),
  mediaDir: process.env.MEDIA_DIR ? path.resolve(process.env.MEDIA_DIR) : path.join(ROOT, 'media'),

  // 打卡规则
  totalDays: 50,
  daySize: 50,
  baseSize: 10,          // 基础关题数（做完成即算当天打卡达标，照顾不同能力的学生）
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
