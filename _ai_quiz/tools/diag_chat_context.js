// 诊断：AI伴读是否在第二轮带上第一轮的上下文
// 隔离环境 + 拦截 llm.chat，打印每轮实际发送的 messages
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'diagchat-'));
function copyFile(src) { const d = path.join(tmp, path.basename(src)); fs.copyFileSync(src, d); return d; }
copyFile(path.join(APP, 'data', 'bank.json'));
copyFile(path.join(APP, 'data', 'books.json'));

const { Store } = require(path.join(APP, 'core', 'store.js'));
const sessions = require(path.join(APP, 'core', 'sessions.js'));
const bank = require(path.join(APP, 'core', 'bank.js'));
const { hashPassword } = require(path.join(APP, 'core', 'auth.js'));
const llm = require(path.join(APP, 'core', 'llm.js'));
const { createRouter } = require(path.join(APP, 'routes', 'router.js'));
const studentRoutes = require(path.join(APP, 'routes', 'student.js'));
const teacherRoutes = require(path.join(APP, 'routes', 'teacher.js'));
const readingRoutes = require(path.join(APP, 'routes', 'reading.js'));
const { json } = require(path.join(APP, 'routes', 'helpers.js'));

const CONFIG = {
  port: 8082, host: '127.0.0.1', dataDir: tmp, publicDir: path.join(APP, 'public'),
  totalDays: 50, daySize: 50, scorePerQuestion: 2,
  defaultStudentPassword: 'test2026',
  maxUploadMB: 20, loginFail: { attempts: 5, lockMinutes: 15 },
  sessionTtlHours: 12, maxQuestionLength: 2000,
};

fs.writeFileSync(path.join(tmp, 'students.json'), JSON.stringify({
  version: 1, studentPassword: hashPassword('test2026'), list: [{ name: '测试小明', active: true }],
}));
fs.writeFileSync(path.join(tmp, 'teacher.json'), JSON.stringify({
  version: 1, passwordHash: hashPassword('admin'), mustChangePassword: false, sessionTtlHours: 12,
}));

const store = new Store(CONFIG).loadAll();
sessions.init(CONFIG);
bank.build(store.bank);

// 拦截 llm.chat，记录每轮收到的 messages
const sentBatches = [];
llm.chat = function ({ messages, fallbackText }) {
  sentBatches.push(messages);
  return Promise.resolve({ reply: '【模拟回复】我收到了你的问题～', source: 'llm' });
};

const router = createRouter();
studentRoutes.register(router, { store, config: CONFIG });
teacherRoutes.register(router, { store, config: CONFIG });
readingRoutes.register(router, { store, config: CONFIG });

const server = http.createServer(async (req, res) => {
  try {
    const handled = await router.dispatch(req, res, { store, config: CONFIG });
    if (handled === false) json(res, 404, { ok: false, error: { msg: 'not found' } });
  } catch (e) {
    json(res, 500, { ok: false, error: { msg: String(e && e.message) } });
  }
});

function request(method, pathname, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1', port: 8082, method, path: pathname,
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
        const sc = res.headers['set-cookie'];
        resolve({ status: res.statusCode, j, cookie: sc && sc.length ? sc[0].split(';')[0] : cookie });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function summarize(msgs) {
  return msgs.map(m => `${m.role}: ${String(m.content || m.text || '').slice(0, 40)}`);
}

(async () => {
  await new Promise((r) => server.listen(8082, '127.0.0.1', r));
  let r = await request('POST', '/api/student/login', { name: '测试小明', password: 'test2026' });
  const cookie = r.cookie;

  // 先标记读完第一章，再发两轮对话
  await request('POST', '/api/reading/chapter/1/read', {}, cookie);

  r = await request('POST', '/api/reading/chat', { chapterNo: 1, question: '什么是数据？' }, cookie);
  console.log('第1轮返回:', r.j && r.j.reply, '| source:', r.j && r.j.source);

  r = await request('POST', '/api/reading/chat', { chapterNo: 1, question: '那为什么说数据像粮食？' }, cookie);
  console.log('第2轮返回:', r.j && r.j.reply, '| source:', r.j && r.j.source);

  console.log('\n========== 每轮实际发送给大模型的 messages ==========');
  sentBatches.forEach((msgs, i) => {
    console.log(`\n--- 第${i + 1}轮 (共${msgs.length}条消息) ---`);
    console.log(summarize(msgs).join('\n'));
  });

  // 判断：第2轮是否包含第1轮的问答
  const b2 = sentBatches[1] || [];
  const hasPrevUser = b2.some(m => m.role === 'user' && /什么是数据/.test(m.content || ''));
  const hasPrevAsst = b2.some(m => m.role === 'assistant' && /模拟回复/.test(m.content || ''));
  console.log('\n[诊断] 第2轮是否带上了第1轮的问题:', hasPrevUser);
  console.log('[诊断] 第2轮是否带上了第1轮的回复:', hasPrevAsst);

  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(0);
})().catch((e) => {
  console.error('诊断异常:', e);
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
});
