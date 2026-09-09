// 小学信息科技 分课课堂检测系统 — 入口（零依赖，Node ≥18）
const http = require('http');
const CONFIG = require('./config.js');
const { Store } = require('./core/store.js');
const sessions = require('./core/sessions.js');
const { hashPassword } = require('./core/passwd.js');
const { createRouter } = require('./routes/router.js');
const studentRoutes = require('./routes/student.js');
const teacherRoutes = require('./routes/teacher.js');
const staticServe = require('./routes/static.js').serve;
const { json } = require('./routes/helpers.js');

const store = new Store(CONFIG).loadAll();
sessions.init(CONFIG);

// 首次运行：初始化教师默认密码
if (!store.teacher.passwordHash) {
  store.mutate(() => {
    store.teacher.passwordHash = hashPassword(CONFIG.defaultTeacherPassword);
    store.teacher.createdAt = new Date().toISOString();
    store.saveTeacher();
  });
  console.log('✓ 已初始化教师密码（默认 ' + CONFIG.defaultTeacherPassword + '，可在教师端修改）');
}

// 自检：没有内容时提示先运行 seed
const hasLesson = store.allSemesters().some((g) => (g.units || []).some((u) => (u.lessons || []).length));
if (!hasLesson) console.log('ℹ 尚无课程内容，请先运行：node tools/seed.js');

const router = createRouter();
studentRoutes.register(router, { store, config: CONFIG });
teacherRoutes.register(router, { store, config: CONFIG });

const server = http.createServer(async (req, res) => {
  try {
    const handled = await router.dispatch(req, res, { store, config: CONFIG });
    if (handled === false) staticServe(req, res, { store, config: CONFIG });
  } catch (e) {
    if (e.code === 413) return json(res, 413, { ok: false, error: { code: 'TOO_LARGE', msg: '内容过大' } });
    if (e.code === 400) return json(res, 400, { ok: false, error: { code: 'BAD_REQUEST', msg: '请求格式错误' } });
    console.error('服务器错误:', e);
    json(res, 500, { ok: false, error: { code: 'INTERNAL', msg: '服务器内部错误' } });
  }
});

server.listen(CONFIG.port, CONFIG.host, () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let lan = '';
  outer: for (const name of Object.keys(nets)) {
    for (const n of nets[name] || []) {
      if (n.family === 'IPv4' && !n.internal) { lan = n.address; break outer; }
    }
  }
  const ln = lan ? 'http://' + lan + ':' + CONFIG.port : '（未检测到局域网IP，请用 ipconfig 查看本机IP）';
  console.log('┌───────────────────────────────────────────────');
  console.log('│  信息科技 分课课堂检测系统 已启动');
  console.log('│');
  console.log('│  学生端/本机:  http://localhost:' + CONFIG.port);
  console.log('│  学生端/平板:  ' + ln);
  console.log('│  教师端:       http://localhost:' + CONFIG.port + '/teacher');
  console.log('│');
  console.log('└───────────────────────────────────────────────');
});
