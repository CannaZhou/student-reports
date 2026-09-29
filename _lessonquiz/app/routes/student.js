// 学生端 API：登录(选名)/课程目录/按课取卷/交卷判分/成绩
const {
  readBody, json, ok, fail, setSessionCookie, clearSessionCookie, readSession,
} = require('./helpers.js');
const sessions = require('../core/sessions.js');
const { lessonName, publicQuestion, publicSheet, sheetRowSpecs, buildCatalog } = require('../core/catalog.js');
const { gradeBasic, gradeBlanks, blankListOf } = require('../core/grade.js');
const { evalLesson, issueIfReady, buildCertWall, certBrief, certToast, whereOf } = require('../core/cert.js');
const { sheetTaskCount } = require('../core/lesson.js'); // 任务单满分 = 这一课有几题
const { gradeSheet, studentView } = require('../core/sheetgrade.js'); // 任务单按任务判分（做对 1 分）

function studentOf(sess, store) {
  if (!sess || sess.role !== 'student') return null;
  return store.findRoster(sess.uid);
}
// 系统按任务判分的结果（给学生看的版本，不含标准答案）。
// 没交过、或者这一课的任务单压根没写标准答案（keys）→ null，前端就不显示这一块，照旧只记录。
function autoOf(lesson, rows) {
  if (!lesson || !lesson.sheet || !rows || !rows.length) return null;
  const g = gradeSheet(lesson.sheet, rows);
  if (!g || !g.graded) return null;
  return studentView(g);
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
// 本班「这一课任务单交没交」名单：只给姓名 + 是否已交，不给分数、不给别人填的内容。
// 按名单导入顺序（＝学号顺序）排，学生自己那行标 me，前端加粗。
function classMateStatus(store, stu, lessonId) {
  const list = store.rosterList().filter((s) => s.active && s.className === stu.className);
  const rows = list.map((s) => ({
    name: s.name,
    uid: s.uid,
    done: !!store.sheetStat(s.uid, lessonId),
    me: s.uid === stu.uid,
  }));
  return {
    clsName: stu.className,
    total: rows.length,
    submitted: rows.filter((r) => r.done).length,
    list: rows,
  };
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
        id: lesson.id, title: lessonName(lesson),
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

    let certEv = null;
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
      // 小测交了：有任务单的课要等任务单也交了才发证，无任务单的课当场发（同一份内存里判，避免二次写盘）
      certEv = issueIfReady(store, stu, lesson).ev;
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

    ok(res, { score, full, perQ, detail, cert: certToast(certEv) });
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
      lessonId: lesson.id, title: lessonName(lesson),
      sheet: publicSheet(lesson.sheet),
      prev: store.lastSheetRows(stu.uid, lesson.id),
      lastAt: sh ? (sh.lastAt || null) : null,
      // 系统按任务判的结果（哪几个任务对、哪几格错）：拿存着的作答实时重算，
      // 不落盘 —— 老师改了题/改了任务划分，学生下次打开看到的就是新的，不会有陈旧分。
      auto: autoOf(lesson, store.lastSheetRows(stu.uid, lesson.id)),
      mates: classMateStatus(store, stu, lesson.id),
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
    // 一「视觉行」一套 key（多板块任务单按板块依次展开）；行自带 _i 指明自己是第几行，
    // 这样中间空着的行不会让后面的行错位。
    const specs = sheetRowSpecs(lesson.sheet);
    const rows = [];
    let auto = 0;
    for (const r of (body.rows || []).slice(0, specs.length)) {
      if (!r || typeof r !== 'object') continue;
      const i = Number.isInteger(r._i) ? r._i : auto++;
      const keys = specs[i];
      if (!keys) continue;
      const row = { _i: i };
      for (const k of keys) row[k] = clean(r[k]);
      if (keys.some((k) => row[k])) rows.push(row);
    }
    rows.sort((a, b) => a._i - b._i);
    if (!rows.length) return fail(res, 400, '请至少填一行再保存');
    let savedAt = null;
    let certEv = null;
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
      // 任务单交了：若本课小测也交过，这一刻就达成「做完一课的任务」→ 发证
      certEv = issueIfReady(store, stu, lesson).ev;
      store.saveProgress(stu.uid);
    });
    ok(res, { savedAt, rows, auto: autoOf(lesson, rows), cert: certToast(certEv) });
  });

  // 证书墙：本年级全部课（+本人有记录的其它课），未发证的也返回，前端标「还差什么」
  router.add('GET', '/api/student/certs', (req, res) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    ok(res, buildCertWall(store, stu));
  });

  // 单课证书（未达成也返回，证书页显示"还差哪一步"）
  router.add('GET', '/api/student/certs/:id', (req, res, ctx, params) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这一课');
    const item = evalLesson(store, stu, lesson);
    const where = whereOf(store, lesson.id);
    item.grade = where.grade; item.semester = where.semester; item.unitTitle = where.unitTitle;
    ok(res, {
      student: { name: stu.name, className: stu.className, grade: stu.grade },
      item,
    });
  });

  // 本人成绩：按本年级课序一行一课，各含 小测积分 与 任务单老师评分（0–任务数）
  router.add('GET', '/api/student/scores', (req, res) => {
    const stu = studentOf(readSession(req, config), store);
    if (!stu) return fail(res, 401, '未登录');
    const p = store.progress[stu.uid];

    // 该生年级的全部课（内容顺序）
    const gradeObj = store.allSemesters().find((x) => x.grade === stu.grade);
    const lessons = [];
    if (gradeObj) {
      for (const u of gradeObj.units || []) for (const l of u.lessons || []) lessons.push(l);
    }
    // 兜底：年级取不到（如未分班）→ 按本人有记录的课来
    if (!lessons.length && p) {
      const seen = {};
      for (const lid of Object.keys(p.lessons || {})) { const l = store.findLesson(lid); if (l && !seen[lid]) { seen[lid] = 1; lessons.push(l); } }
      for (const lid of Object.keys(p.marks || {})) { const l = store.findLesson(lid); if (l && !seen[lid]) { seen[lid] = 1; lessons.push(l); } }
    }

    const rows = [];
    for (const l of lessons) {
      const lid = l.id;
      const st = p && p.lessons && p.lessons[lid];
      const m = p && p.marks && p.marks[lid];
      const sh = p && p.sheets && p.sheets[lid];
      const marked = m && typeof m.score === 'number';           // 老师评过分（0 也算评过）
      const submitted = !!(sh && (sh.attempts || []).length);    // 交过任务单
      if (!st && !marked && !submitted) continue;                // 没答没评 → 不占行
      rows.push({
        lessonId: lid,
        title: lessonName(l),
        hasSheet: !!l.sheet,
        best: st && typeof st.best === 'number' ? st.best : null,
        lastScore: st && typeof st.lastScore === 'number' ? st.lastScore : null,
        attempts: st ? (st.attempts || []).length : 0,
        recent: st ? st.attempts.slice(-8).reverse().map((a) => ({ at: a.at, score: a.score, full: a.full })) : [],
        task: marked ? m.score : null,                           // 未评为 null（与给了 0 区分）
        taskFull: l.sheet ? sheetTaskCount(l.sheet) : 0,         // 任务单满分 = 这一课有几题
        taskAt: marked ? (m.at || null) : null,
        sheetSubmitted: submitted,
        cert: certBrief(store, stu.uid, l), // {issued, pending, pct, stars, issuedAt, missing}
      });
    }
    ok(res, { rows, name: stu.name, className: stu.className });
  });
}
