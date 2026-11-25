// 名家绘本（未来侦探团）隔离冒烟测试（不动线上数据、不改真实题目文件）
// 用法：node tools/smoke_library.js
// 在 127.0.0.1:8082 起独立实例：临时数据目录 + 临时 content 目录（真图片只读）
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'libquiz-'));
function copyFile(src) {
  const dest = path.join(tmp, path.basename(src));
  fs.copyFileSync(src, dest);
  return dest;
}
copyFile(path.join(APP, 'data', 'bank.json'));
copyFile(path.join(APP, 'data', 'books.json'));
copyFile(path.join(APP, 'content', 'library.json'));
copyFile(path.join(APP, 'content', 'library-quizzes.json'));

const { Store } = require(path.join(APP, 'core', 'store.js'));
const sessions = require(path.join(APP, 'core', 'sessions.js'));
const bank = require(path.join(APP, 'core', 'bank.js'));
const { hashPassword } = require(path.join(APP, 'core', 'auth.js'));
const { createRouter } = require(path.join(APP, 'routes', 'router.js'));
const studentRoutes = require(path.join(APP, 'routes', 'student.js'));
const teacherRoutes = require(path.join(APP, 'routes', 'teacher.js'));
const readingRoutes = require(path.join(APP, 'routes', 'reading.js'));
const libraryRoutes = require(path.join(APP, 'routes', 'library.js'));
const { json } = require(path.join(APP, 'routes', 'helpers.js'));

const CONFIG = {
  port: 8082, host: '127.0.0.1',
  dataDir: tmp,
  contentDir: tmp,                       // 题目保存落在临时目录，绝不碰真实文件
  mediaDir: path.join(APP, 'media'),     // 图片只读
  publicDir: path.join(APP, 'public'),
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

const router = createRouter();
studentRoutes.register(router, { store, config: CONFIG });
teacherRoutes.register(router, { store, config: CONFIG });
readingRoutes.register(router, { store, config: CONFIG });
libraryRoutes.register(router, { store, config: CONFIG });

const server = http.createServer(async (req, res) => {
  try {
    const handled = await router.dispatch(req, res, { store, config: CONFIG });
    if (handled === false) json(res, 404, { ok: false, error: { msg: 'not found' } });
  } catch (e) {
    console.error('SERVER ERR:', e);
    json(res, 500, { ok: false, error: { msg: String(e && e.message) } });
  }
});

function request(method, pathname, body, cookie, raw) {
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
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let j = {};
        if (!raw) { try { j = JSON.parse(buf.toString('utf8')); } catch (e) {} }
        const setCookie = res.headers['set-cookie'];
        const cookieOut = setCookie && setCookie.length ? setCookie[0].split(';')[0] : cookie;
        resolve({ status: res.statusCode, j, cookie: cookieOut, headers: res.headers, buf });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let pass = 0, failCount = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { failCount++; console.error('  ✗', name, extra != null ? JSON.stringify(extra) : ''); }
}

(async () => {
  await new Promise((r) => server.listen(8082, '127.0.0.1', r));
  console.log('测试服务器已启动 127.0.0.1:8082（临时目录 ' + tmp + '）\n');

  let cookie = null;
  let book, ch1, ch2;

  // 1. 未登录
  let r = await request('GET', '/api/library/shelf');
  check('未登录书架返回401', r.status === 401);
  r = await request('GET', '/api/library/page/fd-ai/1/1', null, null, true);
  check('未登录取图返回401', r.status === 401);

  // 2. 登录
  r = await request('POST', '/api/student/login', { name: '测试小明', password: 'test2026' });
  check('学生登录成功', r.status === 200 && r.j.ok);
  cookie = r.cookie;

  // 3. 书架
  r = await request('GET', '/api/library/shelf', null, cookie);
  check('书架返回4本书', r.status === 200 && r.j.books.length === 4, r.j && r.j.books && r.j.books.length);
  book = r.j.books.find((b) => b.id === 'fd-ai');
  check('人工智能篇在架', !!book);
  check('新学生只解锁第1章', book.unlockedNo === 1 && book.checkedCount === 0, book);

  // 4. 封面
  r = await request('GET', '/api/library/cover/fd-ai', null, cookie, true);
  check('封面返回WebP', r.status === 200 && r.headers['content-type'] === 'image/webp' && r.buf.length > 1000);
  check('封面带私有长缓存', /max-age=31536000/.test(r.headers['cache-control'] || ''));

  // 5. 书详情
  r = await request('GET', '/api/library/book/fd-ai', null, cookie);
  check('书详情8章', r.status === 200 && r.j.book.chapters.length === 8);
  check('第1章可读、第2章锁', r.j.book.chapters[0].unlocked === true && r.j.book.chapters[1].unlocked === false);

  // 6. 章节内容与图片
  r = await request('GET', '/api/library/book/fd-ai/chapter/1', null, cookie);
  check('第1章返回页列表', r.status === 200 && r.j.pages.length === r.j.chapter.pageCount, r.j && r.j.chapter);
  ch1 = r.j;
  const firstUrl = r.j.pages[0].url;
  check('页URL走鉴权接口', firstUrl.startsWith('/api/library/page/fd-ai/1/1'));
  r = await request('GET', firstUrl, null, cookie, true);
  check('第1页返回WebP', r.status === 200 && r.headers['content-type'] === 'image/webp' && r.buf.length > 5000, r.buf.length);
  check('图片是WebP魔数', r.buf.slice(0, 4).toString('ascii') === 'RIFF' && r.buf.slice(8, 12).toString('ascii') === 'WEBP');

  // 7. 第2章未解锁
  r = await request('GET', '/api/library/book/fd-ai/chapter/2', null, cookie);
  check('第2章未解锁返回403', r.status === 403);
  r = await request('GET', '/api/library/page/fd-ai/2/1', null, cookie, true);
  check('未解锁章节取图403', r.status === 403);
  ch2 = null;

  // 8. 页参数越界
  r = await request('GET', '/api/library/page/fd-ai/1/999', null, cookie, true);
  check('页码越界404', r.status === 404);
  r = await request('GET', '/api/library/page/fd-ai/1/1/../../config.js', null, cookie, true);
  check('路径穿越不生效', r.status === 404 || r.status === 403);

  // 9. 没翻到底不能打卡
  r = await request('POST', '/api/library/book/fd-ai/chapter/1/checkin', { lastPage: 1 }, cookie);
  check('没翻到最后一页不能打卡', r.status === 400);

  // 10. 正常打卡
  r = await request('POST', '/api/library/book/fd-ai/chapter/1/checkin',
    { lastPage: ch1.chapter.pageCount, note: '小海真聪明' }, cookie);
  check('打卡成功', r.status === 200 && r.j.checked === true, r.j);
  check('打卡后第2章解锁', r.j.unlockedNo === 2, r.j);
  check('返回下一章号', r.j.nextChapterNo === 2);

  // 11. 幂等打卡（改感想）
  r = await request('POST', '/api/library/book/fd-ai/chapter/1/checkin',
    { lastPage: ch1.chapter.pageCount, note: '改一下：小洛最厉害' }, cookie);
  check('重复打卡不报错', r.status === 200 && r.j.replay === true);
  check('重复打卡更新感想', r.j.note === '改一下：小洛最厉害', r.j);
  check('重复打卡不解锁乱跳', r.j.unlockedNo === 2);

  // 12. 第2章现在可读
  r = await request('GET', '/api/library/book/fd-ai/chapter/2', null, cookie);
  check('第2章已可读', r.status === 200 && r.j.pages.length > 0);
  r = await request('GET', '/api/library/page/fd-ai/2/1', null, cookie, true);
  check('第2章图片可读', r.status === 200 && r.buf.length > 5000);
  check('第3章仍是锁', (await request('GET', '/api/library/book/fd-ai/chapter/3', null, cookie)).status === 403);

  // 13. 书详情反映进度
  r = await request('GET', '/api/library/book/fd-ai', null, cookie);
  check('详情：第1章已打卡', r.j.book.chapters[0].checked === true && !!r.j.book.chapters[0].readAt);
  check('详情：已读1/8', r.j.book.checkedCount === 1);
  check('详情：感想已保存', r.j.book.chapters[0].note.indexOf('小洛') >= 0);

  // 14. 进度确实落盘
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'progress', encodeURIComponent('测试小明') + '.json'), 'utf8'));
  check('进度文件含 library 字段', !!(saved.library && saved.library.books && saved.library.books['fd-ai']));
  check('原答题进度未被破坏', saved.days !== undefined || saved.createdAt !== undefined, Object.keys(saved).slice(0, 8));

  // 15. 小测：教师建题 → 学生做
  r = await request('POST', '/api/teacher/login', { password: 'admin' });
  check('教师登录成功', r.status === 200 && r.j.ok);
  const tcookie = r.cookie;
  r = await request('PUT', '/api/teacher/library/quiz/fd-ai/1', {
    questions: [{
      id: 'fd-ai-1-1', type: 'single', q: '第一章主要讲了什么？',
      options: [{ key: 'A', text: '认识人工智能' }, { key: 'B', text: '修卫星' }],
      answer: 'A', expl: '第一章 了解人工智能',
    }],
  }, tcookie);
  check('教师保存题目', r.status === 200 && r.j.saved === 1, r.j);
  const quizFile = JSON.parse(fs.readFileSync(path.join(tmp, 'library-quizzes.json'), 'utf8'));
  check('题目落盘到临时 content', !!(quizFile.quizzes['fd-ai'] && quizFile.quizzes['fd-ai']['1']));

  r = await request('GET', '/api/library/book/fd-ai/chapter/1/quiz', null, cookie);
  check('学生拿到1道题', r.status === 200 && r.j.available === true && r.j.questions.length === 1);
  check('学生看不到答案', r.j.questions[0].answer === undefined && r.j.questions[0].expl === undefined, r.j.questions[0]);

  r = await request('POST', '/api/library/book/fd-ai/chapter/1/quiz/submit', { answers: { 'fd-ai-1-1': 'A' } }, cookie);
  check('小测判对', r.status === 200 && r.j.score === 1 && r.j.total === 1, r.j);
  check('小测回复带解析', r.j.results[0].correctAnswer && r.j.results[0].expl);
  r = await request('POST', '/api/library/book/fd-ai/chapter/1/quiz/submit', { answers: { 'fd-ai-1-1': 'B' } }, cookie);
  check('小测不能刷分（幂等）', r.status === 200 && r.j.replay === true && r.j.score === 1);

  // 16. 教师统计
  r = await request('GET', '/api/teacher/library/stats', null, tcookie);
  check('教师统计OK', r.status === 200 && r.j.books.length === 4);
  const aiBook = r.j.books.find((b) => b.id === 'fd-ai');
  check('统计第1章有1人打卡', aiBook.chapters[0].checkinCount === 1, aiBook.chapters[0]);
  check('统计学生行有数据', r.j.students.length === 1 && r.j.students[0].totalChecked === 1, r.j.students);
  check('统计含学生感想', r.j.notes.length === 1 && r.j.notes[0].note.indexOf('小洛') >= 0, r.j.notes);

  // 17. 分数口径
  r = await request('GET', '/api/library/book/fd-ai', null, cookie);
  check('章节显示小测题数', r.j.book.chapters[0].quizCount === 1);
  r = await request('GET', '/api/library/shelf', null, cookie);
  check('书架汇总已读章数', r.j.summary.chaptersChecked === 1);

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
