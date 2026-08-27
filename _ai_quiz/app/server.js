// AI知识竞赛在线答题系统 — 入口
const http = require('http');
const path = require('path');

const CONFIG = require('./config.js');
const { Store } = require('./core/store.js');
const sessions = require('./core/sessions.js');
const bank = require('./core/bank.js');
const { hashPassword } = require('./core/auth.js');
const { createRouter } = require('./routes/router.js');
const studentRoutes = require('./routes/student.js');
const teacherRoutes = require('./routes/teacher.js');
const readingRoutes = require('./routes/reading.js');
const staticServe = require('./routes/static.js').serve;
const { json } = require('./routes/helpers.js');

// 启动自检：xlsx / jszip 必须可加载（教师导入依赖）
try {
  require('./lib/xlsx.full.min.js');
  require('./lib/jszip.min.js');
  console.log('✓ 第三方库加载正常');
} catch (e) {
  console.error('✗ lib 加载失败:', e.message);
  console.error('  请先运行 node tools/copy_libs.js');
  process.exit(1);
}

const store = new Store(CONFIG).loadAll();
sessions.init(CONFIG);
bank.build(store.bank);

// 首次运行：初始化学生共享密码（默认 zqxx2025，哈希存储）
if (!store.students.studentPassword) {
  store.students.studentPassword = hashPassword(CONFIG.defaultStudentPassword);
  store.saveStudents();
  console.log('✓ 已初始化学生登录密码（' + CONFIG.defaultStudentPassword + '，哈希存储）');
}

const router = createRouter();
studentRoutes.register(router, { store, config: CONFIG });
teacherRoutes.register(router, { store, config: CONFIG });
readingRoutes.register(router, { store, config: CONFIG });

const server = http.createServer(async (req, res) => {
  try {
    const handled = await router.dispatch(req, res, { store, config: CONFIG });
    if (handled === false) staticServe(req, res, { store, config: CONFIG });
  } catch (e) {
    if (e.code === 413) return json(res, 413, { ok: false, error: { code: 'TOO_LARGE', msg: '文件过大' } });
    if (e.code === 400) return json(res, 400, { ok: false, error: { code: 'BAD_REQUEST', msg: '请求格式错误' } });
    console.error('服务器错误:', e);
    json(res, 500, { ok: false, error: { code: 'INTERNAL', msg: '服务器内部错误' } });
  }
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log('┌───────────────────────────────────────────');
  console.log('│  AI知识竞赛答题系统 已启动');
  console.log('│');
  console.log('│  本机访问:   http://localhost:' + CONFIG.port);
  console.log('│  局域网访问: http://<本机IP>:' + CONFIG.port);
  console.log('│');
  console.log('│  学生端:  打开上面的地址');
  console.log('│  教师端:  ' + 'http://localhost:' + CONFIG.port + '/teacher');
  console.log('│');
  console.log('│  题库 ' + bank.total() + ' 题 | 打卡 ' + CONFIG.totalDays + ' 天×每天 ' + CONFIG.daySize + ' 题');
  console.log('└───────────────────────────────────────────');
});
