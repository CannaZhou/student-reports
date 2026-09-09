// 学生端 API：登录(选名)/课程目录/按课取卷/交卷判分/成绩
const {
  readBody, json, ok, fail, setSessionCookie, clearSessionCookie, readSession,
} = require('./helpers.js');
const sessions = require('../core/sessions.js');
const { publicQuestion, publicSheet, buildCatalog } = require('../core/catalog.js');
const { gradeBasic, gradeBlanks, blankListOf } = require('../core/grade.js');

function studentOf(sess, store) {
  if (!sess || sess.role !== 'student') return null;
  return store.findRoster(sess.uid);
}
function displayChoice(q) {
  if (q.type === 'judge') {
    return (q.answer && q.answer.toUpperCase() === 'A') ? '√ 正确' : '× 错误';
  }
  const text = (q.options || []).filter((o) => q.answer && q.answer.toUpperCase().includes(o.key))
    .map((o) => `${o.key}.${o.text}`).join('　');
  return text ? `${q.answer}　${text}` : (q.answer || '');
}
function fillAnswerText(q) {
  if (q.answers && q.answers.length) return q.answers.join(' / ');
  return q.answer || '';
}

module.exports = { register };

function register(router, { store, config }) {
  // 登录：学生选自己的名字（无密码）。重名时需带班级。
  router.add('POST', '/api/student/login', async (req, res) => {
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const name = String(body.name || '').trim();
    const className = String(body.className || '').trim();
    if (!name) return fail(res, 400, '请输入姓名');

    let matches = store.findRosterMatches(name);
    if (!matches.length) return fail(res, 404, '名单里没有找到这个名字，请让老师先把你加入名单');
    if (className) matches = matches.filter((s) => s.className === className);
    if (matches.length > 1) {
      return json(res, 409, {
        ok: false, error: { code: 'AMBIGUOUS', msg: '名单里有多个同名同学，请选择你的班级' },
        candidates: matches.map((s) => ({ uid: s.uid, name: s.name, className: s.className, grade: s.grade })),
      });
    }
    const stu = matches[0];
    const token = sessions.createSession({ role: 'student', uid: stu.uid, iat: Date.now() });
    setSessionCookie(res, token, config.sessionTtlHours * 3600);
    ok(res, { name: stu.name, className: stu.className, grade: stu.grade, uid: stu.uid });
  });

  router.add('GET', '/api/student/me', (req, res) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    ok(res, { name: stu.name, className: stu.className, grade: stu.grade, uid: stu.uid });
  });

  router.add('POST', '/api/student/logout', (req, res) => {
    clearSessionCookie(res);
    ok(res, {});
  });

  // 课程目录（带个人成绩徽标）
  router.add('GET', '/api/catalog', (req, res) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    ok(res, { catalog: buildCatalog(store, stu.uid), grade: stu.grade, name: stu.name, className: stu.className });
  });

  // 取一份检测卷（题目脱敏）
  router.add('GET', '/api/lesson/:id', (req, res, ctx, params) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    ok(res, {
      lesson: {
        id: lesson.id, title: lesson.title,
        full: (lesson.questions || []).length, // 满分=题数（每题1积分）
        questions: (lesson.questions || []).map((q) => publicQuestion(q)),
      },
    });
  });

  // 交卷：自动批改 + 记录成绩
  router.add('POST', '/api/lesson/:id/submit', async (req, res, ctx, params) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const answers = body.answers || {};

    // 计分规则：答对一题得 1 积分；多空/流程需整题全对才算答对（满分=题数）
    const perQ = [];
    let score = 0;
    for (const q of lesson.questions || []) {
      const got = answers[q.id] || {};
      const blanks = blankListOf(q);
      let okQ = false;
      if (blanks) {
        const r = gradeBlanks(blanks, got.blanks);
        okQ = r.allOk;
        perQ.push({
          id: q.id, type: q.type, ok: okQ, pts: 1, gained: okQ ? 1 : 0,
          blanks: r.blanks.map((b) => ({ key: b.key, ok: b.ok })),
        });
      } else {
        const g = gradeBasic(q, got.ans);
        okQ = g.ok;
        perQ.push({ id: q.id, type: q.type, ok: okQ, pts: 1, gained: okQ ? 1 : 0 });
      }
      if (okQ) score += 1;
    }

    const full = (lesson.questions || []).length;
    const record = { at: new Date().toISOString(), lessonId: lesson.id, score, full, perQ };

    await store.mutate(() => {
      let p = store.progress[stu.uid] || {
        uid: stu.uid, name: stu.name, className: stu.className,
        createdAt: new Date().toISOString(), lessons: {},
      };
      p.name = stu.name; p.className = stu.className;
      const ls = p.lessons[lesson.id] || { best: 0, attempts: [] };
      ls.attempts.push(record);
      ls.lastScore = score;
      if (score > ls.best) ls.best = score;
      p.lessons[lesson.id] = ls;
      store.progress[stu.uid] = p;
      store.saveProgress(stu.uid);
    });

    // 交卷后逐题/逐空结果 + 解析（含标准答案）
    const detail = (lesson.questions || []).map((q) => {
      const r = perQ.find((x) => x.id === q.id);
      const base = { id: q.id, type: q.type, ok: r.ok, pts: r.pts, gained: r.gained, expl: q.expl || '' };
      const blanks = blankListOf(q);
      if (blanks) {
        base.blanks = gradeBlanks(blanks, (answers[q.id] || {}).blanks).blanks
          .map((b) => ({ key: b.key, ok: b.ok, got: b.got, correct: b.correct, expl: b.expl }));
      } else if (q.type === 'fill') {
        base.correct = fillAnswerText(q);
      } else {
        base.correct = displayChoice(q);
      }
      return base;
    });

    ok(res, { score, full, perQ, detail });
  });

  // 课内任务单（开放表）：取任务单内容 + 该生上次所填（可续写）
  router.add('GET', '/api/lesson/:id/sheet', (req, res, ctx, params) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    if (!lesson.sheet) return fail(res, 404, '本课没有课内任务单');
    const sh = store.sheetStat(stu.uid, lesson.id);
    ok(res, {
      lessonId: lesson.id, title: lesson.title,
      sheet: publicSheet(lesson.sheet),
      prev: store.lastSheetRows(stu.uid, lesson.id),
      lastAt: sh ? (sh.lastAt || null) : null,
    });
  });

  // 保存课内任务单（不判分、不计分，只记录所填；可反复保存修改）
  router.add('POST', '/api/lesson/:id/sheet/submit', async (req, res, ctx, params) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    if (!lesson.sheet) return fail(res, 404, '本课没有课内任务单');
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const CELL = 200; // 单格长度上限（字符）
    const clean = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, CELL);
    const keys = (lesson.sheet.cols || []).map((c) => c.key);
    const rows = [];
    for (const r of (body.rows || []).slice(0, lesson.sheet.rows || 9)) {
      if (!r || typeof r !== 'object') continue;
      const row = {};
      for (const k of keys) row[k] = clean(r[k]);
      if (keys.some((k) => row[k])) rows.push(row);
    }
    if (!rows.length) return fail(res, 400, '请至少填一行再保存');
    let savedAt = null;
    await store.mutate(() => {
      let p = store.progress[stu.uid] || {
        uid: stu.uid, name: stu.name, className: stu.className,
        createdAt: new Date().toISOString(), lessons: {}, sheets: {},
      };
      p.name = stu.name; p.className = stu.className;
      if (!p.sheets) p.sheets = {};
      const e = p.sheets[lesson.id] || { attempts: [] };
      savedAt = new Date().toISOString();
      e.attempts.push({ at: savedAt, rows });
      e.attempts = e.attempts.slice(-20); // 保留最近 20 版
      e.lastAt = savedAt;
      p.sheets[lesson.id] = e;
      store.progress[stu.uid] = p;
      store.saveProgress(stu.uid);
    });
    ok(res, { savedAt, rows });
  });

  // 本人成绩（各课历次）
  router.add('GET', '/api/student/scores', (req, res) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    const p = store.progress[stu.uid];
    const rows = [];
    if (p && p.lessons) {
      for (const lid of Object.keys(p.lessons)) {
        const lesson = store.findLesson(lid);
        const st = p.lessons[lid];
        rows.push({
          lessonId: lid,
          title: lesson ? lesson.title : lid,
          best: st.best, lastScore: st.lastScore, attempts: st.attempts.length,
          recent: st.attempts.slice(-8).reverse().map((a) => ({ at: a.at, score: a.score, full: a.full })),
        });
      }
    }
    ok(res, { rows, name: stu.name, className: stu.className });
  });
}
