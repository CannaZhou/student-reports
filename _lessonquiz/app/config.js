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

  // 课堂问答智能体【问问】的策略（可以入库）。
  // 密钥单独放 app/agent.config.json（gitignore，模板见 agent.config.example.json）——
  // 这里只放「怎么用」的口径，那里只放「用哪把钥匙」。
  agent: {
    enabled: true,          // 关掉后学生端面板不消失，一律走离线提示阶梯（无网/无 key 时同一条路）
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    dailyPerStudent: 30,    // 每人每天最多问几次（存在该生进度文件里，重启不丢）
    dailyTotal: 1200,       // 全校每天总闸（存在 app/data/agent-usage.json，重启清零）
    timeoutMs: 15000,
    maxTokens: 400,         // 一次回答的上限：答得短，一来省，二来不刷屏
    temperature: 0.4,       // 低一点，别自由发挥
    historyTurns: 6,        // 带几轮上下文
    maxQuestion: 200,       // 学生一句话最多多少字（超出截断）
    logPerLesson: 30,       // 每生每课给老师留最近多少条问答
  },
};

module.exports = CONFIG;
