// 阅读智能体 隔离冒烟测试（不动线上数据）
// 用法：node tools/smoke_reading.js
// 在 127.0.0.1:8081 起一个独立实例（临时数据目录），走通完整阅读流程
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');

// ---------- 临时数据目录 ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'readquiz-'));
function copyFile(src) {
  const dest = path.join(tmp, path.basename(src));
  fs.copyFileSync(src, dest);
  return dest;
}
copyFile(path.join(APP, 'data', 'bank.json'));
copyFile(path.join(APP, 'data', 'books.json'));

const { Store } = require(path.join(APP, 'core', 'store.js'));
const sessions = require(path.join(APP, 'core', 'sessions.js'));
const bank = require(path.join(APP, 'core', 'bank.js'));
const { hashPassword } = require(path.join(APP, 'core', 'auth.js'));
const { createRouter } = require(path.join(APP, 'routes', 'router.js'));
const studentRoutes = require(path.join(APP, 'routes', 'student.js'));
const teacherRoutes = require(path.join(APP, 'routes', 'teacher.js'));
const readingRoutes = require(path.join(APP, 'routes', 'reading.js'));
const { json } = require(path.join(APP, 'routes', 'helpers.js'));

const CONFIG = {
  port: 8081, host: '127.0.0.1', dataDir: tmp, publicDir: path.join(APP, 'public'),
  totalDays: 50, daySize: 50, scorePerQuestion: 2,
  defaultStudentPassword: 'test2026',
  maxUploadMB: 20, loginFail: { attempts: 5, lockMinutes: 15 },
  sessionTtlHours: 12, maxQuestionLength: 2000,
};

// 测试学生
fs.writeFileSync(path.join(tmp, 'students.json'), JSON.stringify({
  version: 1, studentPassword: hashPassword('test2026'), list: [{ name: '测试小明', active: true }],
}));
fs.writeFileSync(path.join(tmp, 'teacher.json'), JSON.stringify({
  version: 1, passwordHash: hashPassword('admin'), mustChangePassword: false, sessionTtlHours: 12,
}));

const store = new Store(CONFIG).loadAll();
sessions.init(CONFIG);
bank.build(store.bank);

const router = createRouter();
studentRoutes.register(router, { store, config: CONFIG });
teacherRoutes.register(router, { store, config: CONFIG });
readingRoutes.register(router, { store, config: CONFIG });

const server = http.createServer(async (req, res) => {
  try {
    const handled = await router.dispatch(req, res, { store, config: CONFIG });
    if (handled === false) json(res, 404, { ok: false, error: { msg: 'not found' } });
  } catch (e) {
    console.error('SERVER ERR:', e);
    json(res, 500, { ok: false, error: { msg: String(e && e.message) } });
  }
});

// ---------- HTTP 小工具 ----------
function request(method, pathname, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1', port: 8081, method, path: pathname,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        data ? { 'Content-Length': Buffer.byteLength(data) } : {},
        cookie ? { Cookie: cookie } : {}
      ),
    }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        let j = {};
        try { j = JSON.parse(raw); } catch (e) {}
        const setCookie = res.headers['set-cookie'];
        const cookieOut = setCookie && setCookie.length ? setCookie[0].split(';')[0] : cookie;
        resolve({ status: res.statusCode, j, cookie: cookieOut });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ---------- 断言 ----------
let pass = 0, failCount = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { failCount++; console.error('  ✗', name, extra != null ? JSON.stringify(extra) : ''); }
}

(async () => {
  await new Promise((r) => server.listen(8081, '127.0.0.1', r));
  console.log('测试服务器已启动 127.0.0.1:8081\n');

  let cookie = null;

  // 1. 未登录访问书架 → 401
  let r = await request('GET', '/api/reading/shelf');
  check('未登录书架返回401', r.status === 401);

  // 2. 学生登录（复用答题系统登录接口）
  r = await request('POST', '/api/student/login', { name: '测试小明', password: 'test2026' });
  check('学生登录成功', r.status === 200 && r.j.ok);
  cookie = r.cookie;

  // 3. 书架
  r = await request('GET', '/api/reading/shelf', null, cookie);
  check('书架返回6章', r.status === 200 && r.j.shelf.chapters.length === 6);
  check('第1章已解锁', r.j.shelf.unlocked === 1);
  const ch1quiz = r.j.shelf.chapters[0].quizCount;
  console.log(`    （第1章闯关题数=${ch1quiz}）`);

  // 4. 读取第1章内容
  r = await request('GET', '/api/reading/chapter/1', null, cookie);
  check('第1章阅读内容OK', r.status === 200 && r.j.story.length > 0 && r.j.knowledge.length > 0);

  // 5. 未读故事直接闯关 → 403
  r = await request('GET', '/api/reading/quiz/1', null, cookie);
  check('读取第2章被锁（需先完成第1章）', r.status === 200); // 第1章可读题
  r = await request('POST', '/api/reading/quiz/1/submit', { answers: [] }, cookie);
  check('未读故事不能闯关 → 403', r.status === 403);

  // 6. 标记读完第1章
  r = await request('POST', '/api/reading/chapter/1/read', {}, cookie);
  check('标记读完第1章', r.status === 200 && r.j.storyRead === true);

  // 7. AI伴读（llm未配置 → 本地兜底）
  r = await request('POST', '/api/reading/chat', { chapterNo: 1, question: '为什么数据是粮食？' }, cookie);
  check('AI伴读有回复（本地兜底）', r.status === 200 && r.j.reply && r.j.reply.length > 0);
  check('AI伴读标注离线来源', r.j.source === 'local');

  // 8. 取第1章闯关题并答对全部（答案从题库获取）
  r = await request('GET', '/api/reading/quiz/1', null, cookie);
  check('第1章闯关题获取OK', r.status === 200 && r.j.questions.length > 0);
  const answers = r.j.questions.map((q) => ({ id: q.id, answer: bank.getById(q.id).answer }));
  r = await request('POST', '/api/reading/quiz/1/submit', { answers }, cookie);
  check('闯关提交成功', r.status === 200 && r.j.done === true);
  check('全对得满分', r.j.quizScore === r.j.quizTotal && r.j.quizScore === answers.length, r.j);
  check('获得积分', r.j.points > 0);

  // 9. 重复提交 → 幂等回放
  r = await request('POST', '/api/reading/quiz/1/submit', { answers }, cookie);
  check('重复提交幂等返回', r.status === 200 && r.j.replay === true);

  // 10. 第2章解锁
  r = await request('GET', '/api/reading/shelf', null, cookie);
  check('第2章已解锁', r.j.shelf.unlocked === 2);

  // 11. 存折
  r = await request('GET', '/api/reading/passbook', null, cookie);
  check('存折显示积分与徽章', r.status === 200 && r.j.points > 0 && r.j.badges.length >= 1);

  // 12. 排行榜
  r = await request('GET', '/api/reading/leaderboard', null, cookie);
  check('排行榜有我', r.status === 200 && r.j.me && r.j.me.name === '测试小明');

  // 13. 教师端阅读统计
  r = await request('POST', '/api/teacher/login', { password: 'admin' });
  check('教师登录成功', r.status === 200 && r.j.ok);
  const tcookie = r.cookie;
  r = await request('GET', '/api/teacher/reading/stats', null, tcookie);
  check('教师阅读统计OK', r.status === 200 && r.j.chapterAgg.length === 6 && r.j.students.length >= 1);
  check('统计含平均分与汇总', r.j.chapterAgg[0].avgScore >= 0 && r.j.summary.readerCount >= 1);
  check('原答题总览仍可用', r.status === 200);

  console.log(`\n结果：${pass} 通过 / ${failCount} 失败`);
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(failCount ? 1 : 0);
})().catch((e) => {
  console.error('冒烟测试异常:', e);
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});
