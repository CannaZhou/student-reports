// 教师端 API：登录/名单管理/按课成绩/重置
const {
  readBody, json, ok, fail, setSessionCookie, clearSessionCookie, readSession,
} = require('./helpers.js');
const sessions = require('../core/sessions.js');
const { verifyPassword, hashPassword } = require('../core/passwd.js');
const { lessonName, publicSheet } = require('../core/catalog.js');
const { gradeSheet, taskTitles } = require('../core/sheetgrade.js'); // 任务单按任务判分（给老师端看学生错在哪）
const { sheetTaskCount } = require('../core/lesson.js'); // 任务单满分 = 这一课有几题（老师按"做对几题得几分"打）

function isTeacher(sess) { return !!(sess && sess.role === 'teacher'); }
function requireTeacher(req, res, config) {
  if (!isTeacher(readSession(req, config))) { fail(res, 401, '请先以教师身份登录'); return false; }
  return true;
}

// 从班级名推断年级：优先年份级（2023级→3），其次中文年级
function inferGrade(className) {
  const c = String(className || '');
  const ym = c.match(/20(\d{2})级/);
  if (ym) {
    const n = Number(ym[1]);
    if (n >= 19 && n <= 27) return 2026 - (2000 + n) + 1; // 入学年级→当前学年对应年级的映射基数
  }
  if (/三年级|3年级/.test(c)) return 3;
  if (/四年级|4年级/.test(c)) return 4;
  if (/五年级|5年级/.test(c)) return 5;
  if (/六年级|6年级/.test(c)) return 6;
  return 0;
}

// 某课属于哪个年级（content.grades[].grade）
function gradeOfLesson(store, lessonId) {
  for (const g of store.allSemesters()) {
    for (const u of g.units || []) {
      for (const l of u.lessons || []) if (l.id === lessonId) return g.grade;
    }
  }
  return 0;
}
// 全部班级（去重、计数、年级），按班名排序（未分班殿后）
function classListOf(store) {
  const map = {};
  for (const s of store.rosterList()) {
    if (!map[s.className]) map[s.className] = { name: s.className, count: 0, grade: s.grade || 0 };
    map[s.className].count++;
  }
  const keys = Object.keys(map).sort(
    (a, b) => ((a.includes('未分班') ? 1 : 0) - (b.includes('未分班') ? 1 : 0)) || a.localeCompare(b, 'zh'));
  return keys.map((k) => map[k]);
}
// 某年级全部课（内容顺序）
function lessonsOfGrade(store, grade) {
  const g = store.allSemesters().find((x) => x.grade === grade);
  const out = [];
  for (const u of (g && g.units) || []) for (const l of u.lessons || []) out.push(l);
  return out;
}
// 该生全学期：小测积分合计 + 任务单评分合计（各课两格 + 三合计）
function termOf(store, uid, grade) {
  const lessons = lessonsOfGrade(store, grade);
  const p = store.progress[uid];
  const per = [];
  let quizSum = 0, taskSum = 0;
  for (const l of lessons) {
    const st = p && p.lessons && p.lessons[l.id];
    const m = p && p.marks && p.marks[l.id];
    const quiz = st && typeof st.best === 'number' ? st.best : null;
    // ⚠️ 要钳到本课满分：证书那边早就钳过了（core/cert.js），这里不钳两边就会打架——
    //    期末汇总显示 3 分、证书却按 2 分算。历史上按 0–10 打过脏分，加了逐题标记更容易超。
    const cap = l.sheet ? sheetTaskCount(l.sheet) : null;
    const task = (m && typeof m.score === 'number')
      ? (cap == null ? m.score : Math.max(0, Math.min(m.score, cap)))
      : null;
    per.push({ id: l.id, quiz, task });
    if (quiz != null) quizSum += quiz;
    if (task != null) taskSum += task;
  }
  return { per, quizSum, taskSum, total: quizSum + taskSum };
}

module.exports = { register };

function register(router, { store, config }) {
  router.add('POST', '/api/teacher/login', async (req, res) => {
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const pw = String(body.password || '');
    if (!store.teacher.passwordHash || !verifyPassword(pw, store.teacher.passwordHash)) {
      return fail(res, 401, '教师密码错误');
    }
    const token = sessions.createSession({ role: 'teacher', uid: 'teacher', iat: Date.now() });
    setSessionCookie(res, token, config.sessionTtlHours * 3600);
    ok(res, { name: 'teacher' });
  });

  router.add('POST', '/api/teacher/logout', (req, res) => { clearSessionCookie(res); ok(res, {}); });

  router.add('GET', '/api/teacher/me', (req, res) => {
    if (!requireTeacher(req, res, config)) return;
    ok(res, { name: 'teacher' });
  });

  router.add('POST', '/api/teacher/password', async (req, res) => {
    if (!requireTeacher(req, res, config)) return;
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    if (!verifyPassword(String(body.old || ''), store.teacher.passwordHash)) return fail(res, 403, '原密码不对');
    const np = String(body.password || '');
    if (np.length < 4) return fail(res, 400, '新密码至少4位');
    store.mutate(() => {
      store.teacher.passwordHash = hashPassword(np);
      store.saveTeacher();
    });
    ok(res, {});
  });

  // 名单查看
  router.add('GET', '/api/teacher/roster', (req, res) => {
    if (!requireTeacher(req, res, config)) return;
    ok(res, { list: store.rosterList().slice().sort((a, b) => (a.className + a.name).localeCompare(b.className + b.name, 'zh')) });
  });

  // 名单导入：text 每行 "班级，姓名"（或仅姓名）；mode: append | replace
  router.add('POST', '/api/teacher/roster', async (req, res) => {
    if (!requireTeacher(req, res, config)) return;
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const text = String(body.text || '');
    const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!lines.length) return fail(res, 400, '没有可导入的行');

    const parsed = [];
    for (const line of lines) {
      const parts = line.split(/[,，、]/).map((s) => s.trim());
      let className = '未分班', name = '';
      if (parts.length >= 2) { className = parts[0]; name = parts.slice(1).join(''); }
      else name = parts[0];
      if (!name) continue;
      parsed.push({ name, className, grade: inferGrade(className) });
    }
    if (!parsed.length) return fail(res, 400, '没有解析到有效姓名');

    let added = 0;
    await store.mutate(() => {
      if (body.replace) store.roster.list = [];
      const out = store.roster.list.slice();
      for (const r of parsed) {
        const uid = r.name + '｜' + r.className;
        const ex = out.find((s) => s.uid === uid);
        if (ex) { ex.name = r.name; ex.className = r.className; if (r.grade) ex.grade = r.grade; ex.active = true; }
        else {
          out.push({ uid, name: r.name, className: r.className, grade: r.grade, active: true, createdAt: new Date().toISOString() });
          added++;
        }
      }
      store.roster.list = out;
      store.normalizeRoster();
      store.saveRoster();
    });
    ok(res, { added, total: store.rosterList().length });
  });

  // 删除名单一人（成绩保留，可在成绩总览删除）
  router.add('POST', '/api/teacher/roster/delete', async (req, res) => {
    if (!requireTeacher(req, res, config)) return;
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    await store.mutate(() => {
      store.roster.list = store.rosterList().filter((s) => s.uid !== body.uid);
      store.normalizeRoster();
      store.saveRoster();
    });
    ok(res, { total: store.rosterList().length });
  });

  // 课程总览（哪些课做了/正确率）
  router.add('GET', '/api/teacher/overview', (req, res) => {
    if (!requireTeacher(req, res, config)) return;
    const list = [];
    for (const g of store.allSemesters()) {
      for (const u of g.units || []) {
        for (const l of u.lessons || []) {
          let doneCount = 0, attempts = 0, sumBest = 0, any = false, sheetDone = 0;
          for (const s of store.rosterList()) {
            const st = store.lessonStat(s.uid, l.id);
            if (st) { doneCount++; attempts += (st.attempts || []).length; sumBest += (st.best || 0); any = true; }
            const sh = store.sheetStat(s.uid, l.id);
            if (sh && (sh.attempts || []).length) sheetDone++;
          }
          const num = (l.questions || []).length; // 满分=题数（每题1积分）
          list.push({
            lessonId: l.id, title: lessonName(l), grade: g.grade, semester: g.semester, full: num, num,
            hasSheet: !!l.sheet,
            doneCount, attempts, avgBest: any ? Math.round((sumBest / doneCount) * 10) / 10 : null,
            sheetDone,
          });
        }
      }
    }
    ok(res, { lessons: list });
  });

  // 某课每个学生的成绩
  router.add('GET', '/api/teacher/lesson-scores/:id', (req, res, ctx, params) => {
    if (!requireTeacher(req, res, config)) return;
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    const rows = store.rosterList().map((s) => {
      const st = store.lessonStat(s.uid, params.id);
      return {
        uid: s.uid, name: s.name, className: s.className, grade: s.grade,
        best: st ? st.best : null, lastScore: st ? st.lastScore : null,
        attempts: st ? (st.attempts || []).length : 0,
      };
    });
    ok(res, { lesson: { id: lesson.id, title: lessonName(lesson), full: (lesson.questions || []).length, grade: gradeOfLesson(store, params.id) }, rows });
  });

  // 某课「课内任务单」赋分台：按班看整班学生（含未交），每人带【本课小测分】【全学期累计分】，
  // 可评 0–任务数（一题 1 分，做对几题得几分）
  router.add('GET', '/api/teacher/sheet-board/:id', (req, res, ctx, params, url) => {
    if (!requireTeacher(req, res, config)) return;
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    if (!lesson.sheet) return fail(res, 404, '本课没有课内任务单');
    const lessonGrade = gradeOfLesson(store, lesson.id);
    const full = (lesson.questions || []).length;
    const taskFull = sheetTaskCount(lesson.sheet); // 本课任务单共几题，满分就是几
    // 本课有几个任务、各叫什么 —— 赋分台那排「逐题打勾/打叉」按钮按它渲染。
    // ⚠️ 不能拿学生的 auto.tasks 当数据源：没交作业的学生 auto 是 null，而没交的也要能赋分；
    //    而且没有 keys 的课（四上1课、六上2课）auto.graded 是 0，整条判定条压根不渲染。
    //    所以任务清单只看任务单定义本身，一个班算一次。
    const tasks = taskTitles(lesson.sheet);
    const classes = classListOf(store).filter((c) => c.grade === lessonGrade);

    // 选定班级：优先 ?class= 且年级匹配；否则取该年级第一个班
    let want = url ? String(url.searchParams.get('class') || '') : '';
    let cls = classes.find((c) => c.name === want);
    if (!cls) cls = classes[0];
    const clsName = cls ? cls.name : '';

    const students = store.rosterList()
      .filter((s) => s.className === clsName)
      .map((s) => {
        const p = store.progress[s.uid];
        const sh = store.sheetStat(s.uid, lesson.id);
        const last = sh && (sh.attempts || []).length ? sh.attempts[sh.attempts.length - 1] : null;
        const m = store.markStat(s.uid, lesson.id);
        const st = p && p.lessons && p.lessons[lesson.id];
        return {
          uid: s.uid, name: s.name, className: s.className,
          submitted: !!last, lastAt: last ? last.at : null, rows: last ? last.rows : [],
          // 系统按任务判的分（老师端带标准答案 want，方便当场看出学生错在哪一格）
          auto: last ? gradeSheet(lesson.sheet, last.rows) : null,
          score: m && typeof m.score === 'number' ? m.score : null,
          scoredAt: m ? (m.at || null) : null,
          // 老师逐题打的勾/叉（{任务号: true|false}；老数据只有总分、没有这个键 → null）
          taskMarks: store.taskMarks(s.uid, lesson.id, taskFull),
          lessonQuiz: st && typeof st.best === 'number' ? st.best : null,
          lessonFull: full,
          termScore: termOf(store, s.uid, s.grade || lessonGrade).total,
        };
      });
    const sub = students.filter((r) => r.submitted).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
    const nsub = students.filter((r) => !r.submitted).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    ok(res, {
      lesson: { id: lesson.id, title: lessonName(lesson), grade: lessonGrade, full, taskFull, tasks },
      sheet: publicSheet(lesson.sheet),
      classes: classes.map((c) => ({ name: c.name, count: c.count })),
      clsName,
      students: sub.concat(nsub),
    });
  });

  // 给某生某课「任务单」评分：score 为 0–任务数 的整数（含 0；一题 1 分，做对几题得几分）；传 '' 清除该条评分
  router.add('POST', '/api/teacher/sheet-board/:id/score', async (req, res, ctx, params) => {
    if (!requireTeacher(req, res, config)) return;
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    if (!lesson.sheet) return fail(res, 404, '本课没有课内任务单');
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const uid = String(body.uid || '');
    const stu = store.findRoster(uid);
    if (!stu) return fail(res, 404, '名单里没有这位学生');

    const clear = body.score === '' || body.score === null || body.score === undefined;
    const taskFull = sheetTaskCount(lesson.sheet); // 本课任务单共几题，满分就是几
    let score = null;
    if (!clear) {
      score = Number(body.score);
      if (!Number.isInteger(score) || score < 0 || score > taskFull) {
        return fail(res, 400, '本课任务单共 ' + taskFull + ' 题，赋分需为 0–' + taskFull + ' 的整数（留空则清除评分）');
      }
    }

    await store.mutate(() => {
      let p = store.progress[uid];
      if (!p) {
        p = {
          uid, name: stu.name, className: stu.className,
          createdAt: new Date().toISOString(), lessons: {}, sheets: {}, marks: {},
        };
        store.progress[uid] = p;
      }
      if (!p.marks) p.marks = {};
      if (clear) { delete p.marks[lesson.id]; }
      else { p.marks[lesson.id] = { score, at: new Date().toISOString() }; }
      p.name = stu.name; p.className = stu.className;
      store.saveProgress(uid);
    });

    const saved = store.markStat(uid, lesson.id);
    ok(res, {
      score: saved ? saved.score : null,
      scoredAt: saved ? (saved.at || null) : null,
      // 直接填总分＝老师自己给的数，逐题标记随之作废。这里必须回一个 tasks:null，
      // 否则前端那一排勾还留在新填的数字底下，同一格里自己跟自己打架。
      tasks: null,
      termScore: termOf(store, uid, stu.grade || gradeOfLesson(store, lesson.id)).total,
    });
  });

  // 逐题赋分（2026-09-29 老师要求「一题一改」）：给某生的某一个任务打勾/打叉/取消。
  // body: {uid, task: 任务号, ok: true=对 / false=错 / null=取消}
  //   或：{uid, tasks: {1:true,2:false}} —— 整张「逐题判定」一次覆盖（前端点按钮就走这条：
  //       把系统判得出的题和老师改的题一起落下来，避免「点一下变成 0 分」）。
  // 本课总分 = 打勾的个数，仍然存在同一个 p.marks[lid].score 里 —— 证书、积分、期末汇总
  // 全都只认 score，所以这条链路一行不用改。
  router.add('POST', '/api/teacher/sheet-board/:id/task', async (req, res, ctx, params) => {
    if (!requireTeacher(req, res, config)) return;
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    if (!lesson.sheet) return fail(res, 404, '本课没有课内任务单');
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const uid = String(body.uid || '');
    const stu = store.findRoster(uid);
    if (!stu) return fail(res, 404, '名单里没有这位学生');

    const taskFull = sheetTaskCount(lesson.sheet);
    const whole = (body.tasks && typeof body.tasks === 'object') ? body.tasks : null;
    if (whole) {
      const bad = Object.keys(whole).filter((k) => {
        const n = Number(k);
        return !Number.isInteger(n) || n < 1 || n > taskFull || typeof whole[k] !== 'boolean';
      });
      if (bad.length) return fail(res, 400, '逐题判定的题号/取值不合法：' + bad.join(','));
    }
    const no = Number(body.task);
    if (!whole && (!Number.isInteger(no) || no < 1 || no > taskFull)) {
      return fail(res, 400, '本课任务单共 ' + taskFull + ' 题，题号需为 1–' + taskFull);
    }
    const ok3 = body.ok === true ? true : (body.ok === false ? false : null);

    await store.mutate(() => {
      let p = store.progress[uid];
      if (!p) {
        p = {
          uid, name: stu.name, className: stu.className,
          createdAt: new Date().toISOString(), lessons: {}, sheets: {}, marks: {},
        };
        store.progress[uid] = p;
      }
      if (!p.marks) p.marks = {};
      const cur = p.marks[lesson.id] || {};
      const tasks = whole ? Object.assign({}, whole) : Object.assign({}, cur.tasks || {});
      if (!whole) { if (ok3 === null) delete tasks[no]; else tasks[no] = ok3; }
      const score = Object.keys(tasks).filter((k) => tasks[k]).length;
      // 逐题标记被清空（老师把每一题都点回了「未标」）→ 整条评分删掉，那一行退回「未赋分」（橙）。
      // 注意和「三题都打✗」的区别：那种情况 tasks 里有三条 false，是一条货真价实的 0 分记录。
      if (!Object.keys(tasks).length) delete p.marks[lesson.id];
      else p.marks[lesson.id] = { score, at: new Date().toISOString(), tasks };
      p.name = stu.name; p.className = stu.className;
      store.saveProgress(uid);
    });

    const saved = store.markStat(uid, lesson.id);
    ok(res, {
      score: saved ? saved.score : null,
      scoredAt: saved ? (saved.at || null) : null,
      tasks: store.taskMarks(uid, lesson.id, taskFull),
      termScore: termOf(store, uid, stu.grade || gradeOfLesson(store, lesson.id)).total,
    });
  });

  // 批量赋分：一次给多位学生记同一个分（score 传 '' 则清除这些人的评分）。
  // 用于「一屏勾一批人 → 统一记 X 分」，以及「没交的一律记 0 分」。
  // 分数范围与单人赋分完全一致；传进来的 uid 不在名单里就跳过（不报错，返回 skipped）。
  router.add('POST', '/api/teacher/sheet-board/:id/score-batch', async (req, res, ctx, params) => {
    if (!requireTeacher(req, res, config)) return;
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    if (!lesson.sheet) return fail(res, 404, '本课没有课内任务单');
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const uids = (Array.isArray(body.uids) ? body.uids : []).map((x) => String(x == null ? '' : x)).filter(Boolean);
    if (!uids.length) return fail(res, 400, '没有选中学生');
    if (uids.length > 500) return fail(res, 400, '一次最多 500 人');

    const clear = body.score === '' || body.score === null || body.score === undefined;
    const taskFull = sheetTaskCount(lesson.sheet); // 本课任务单共几题，满分就是几
    let score = null;
    if (!clear) {
      score = Number(body.score);
      if (!Number.isInteger(score) || score < 0 || score > taskFull) {
        return fail(res, 400, '本课任务单共 ' + taskFull + ' 题，赋分需为 0–' + taskFull + ' 的整数（留空则清除评分）');
      }
    }

    const rows = [];
    let skipped = 0;
    await store.mutate(() => {
      const at = new Date().toISOString();
      for (const uid of uids) {
        const stu = store.findRoster(uid);
        if (!stu) { skipped++; continue; }
        let p = store.progress[uid];
        if (!p) {
          p = {
            uid, name: stu.name, className: stu.className,
            createdAt: at, lessons: {}, sheets: {}, marks: {},
          };
          store.progress[uid] = p;
        }
        if (!p.marks) p.marks = {};
        // 批量记分/清除都会把逐题标记一起作废（整条重写，不带 tasks），
        // 免得出现「总分 2、底下三个任务只有一个打勾」这种自相矛盾。
        if (clear) { delete p.marks[lesson.id]; }
        else { p.marks[lesson.id] = { score, at }; }
        p.name = stu.name; p.className = stu.className;
        store.saveProgress(uid);
        const saved = store.markStat(uid, lesson.id);
        rows.push({
          uid, name: stu.name,
          score: saved ? saved.score : null,
          scoredAt: saved ? (saved.at || null) : null,
          tasks: null, // 同上：让前端把那一排勾清掉
          termScore: termOf(store, uid, stu.grade || gradeOfLesson(store, lesson.id)).total,
        });
      }
    });
    ok(res, { updated: rows.length, skipped, score: clear ? null : score, rows });
  });

  // 期末汇总：按班每人一行（各课两格 + 小测小计 / 任务单小计 / 总分），含班级统计
  router.add('GET', '/api/teacher/term', (req, res, ctx, params, url) => {
    if (!requireTeacher(req, res, config)) return;
    const classes = classListOf(store);
    let want = url ? String(url.searchParams.get('class') || '') : '';
    let cls = classes.find((c) => c.name === want);
    if (!cls) cls = classes[0];
    const clsName = cls ? cls.name : '';
    const grade = cls ? cls.grade : 0;
    const lessons = lessonsOfGrade(store, grade);
    const students = store.rosterList()
      .filter((s) => s.className === clsName)
      .map((s) => {
        const t = termOf(store, s.uid, s.grade || grade);
        return { uid: s.uid, name: s.name, className: s.className, per: t.per, quizSum: t.quizSum, taskSum: t.taskSum, total: t.total };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    const scored = students.filter((s) => s.total > 0 || s.taskSum > 0 || s.quizSum > 0);
    let avg = null, maxT = null;
    if (students.length) {
      avg = Math.round((students.reduce((a, s) => a + s.total, 0) / students.length) * 10) / 10;
      maxT = Math.max.apply(null, students.map((s) => s.total));
    }
    ok(res, {
      clsName,
      classes: classes.map((c) => ({ name: c.name, count: c.count, grade: c.grade })),
      grade,
      lessons: lessons.map((l) => ({ id: l.id, title: lessonName(l), hasSheet: !!l.sheet, full: (l.questions || []).length })),
      students,
      stats: { count: students.length, avg, maxT, hasAny: scored.length > 0 },
    });
  });

  // 某课「课内任务单」已收上来的填写（谁交了、填了什么；只读记录，不判分）
  router.add('GET', '/api/teacher/lesson-sheets/:id', (req, res, ctx, params) => {
    if (!requireTeacher(req, res, config)) return;
    const lesson = store.findLesson(params.id);
    if (!lesson) return fail(res, 404, '没有这份检测卷');
    if (!lesson.sheet) return fail(res, 404, '本课没有课内任务单');
    const rows = store.rosterList().map((s) => {
      const sh = store.sheetStat(s.uid, params.id);
      if (!sh || !(sh.attempts || []).length) return null;
      const last = sh.attempts[sh.attempts.length - 1];
      return {
        uid: s.uid, name: s.name, className: s.className, grade: s.grade,
        lastAt: last.at, saves: (sh.attempts || []).length, rows: last.rows,
      };
    }).filter(Boolean)
      .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
    ok(res, {
      lesson: { id: lesson.id, title: lessonName(lesson) },
      sheet: publicSheet(lesson.sheet),
      rows,
    });
  });

  // 重置某生全部成绩（或某课/某课的任务单）
  router.add('POST', '/api/teacher/progress/delete', async (req, res) => {
    if (!requireTeacher(req, res, config)) return;
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const uid = String(body.uid || '');
    await store.mutate(() => {
      if (body.lessonId) {
        const p = store.progress[uid];
        if (!p) return;
        if (body.kind === 'sheet') {
          if (p.sheets && p.sheets[body.lessonId]) { delete p.sheets[body.lessonId]; store.saveProgress(uid); }
        } else if (p.lessons) {
          delete p.lessons[body.lessonId]; store.saveProgress(uid);
        }
        // 重置掉这一课后不再满足发证条件 → 证书一并收回（补做后重新发证、重新计时）
        if (p.certs && p.certs[body.lessonId]) { delete p.certs[body.lessonId]; store.saveProgress(uid); }
      } else if (uid) {
        store.deleteProgress(uid); // 清全部（含任务单记录）
      }
    });
    ok(res, {});
  });
}
