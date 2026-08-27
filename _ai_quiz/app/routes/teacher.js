// 教师端 API
const rp = require('../core/readprogress.js');
const bank = require('../core/bank.js');
const { hashPassword, verifyPassword, FailTracker } = require('../core/auth.js');
const { toBankQuestion, buildSectionUnitMap, newCustomId } = require('../core/question.js');
const { displayAnswer } = require('../core/grade.js');
const xlsxImport = require('../core/importer/xlsx_import.js');
const docxImport = require('../core/importer/docx_import.js');
const {
  readBody, ok, fail, setSessionCookie, clearSessionCookie,
  currentSession, decodeUpload,
} = require('./helpers.js');

const loginTracker = new FailTracker(5, 15 * 60 * 1000);

// 解析学生名单文本：一行一个"班级，姓名"（支持 逗号/顿号 分隔多个姓名）；
// 纯姓名行按空格拆多个名字（兼容旧格式），班级留空
function parseStudentLines(text) {
  const out = [];
  for (const line of String(text).split(/[\r\n]+/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(/[，,、]/).map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const cls = parts[0];
      for (const nm of parts.slice(1)) out.push({ className: cls, name: nm });
    } else {
      for (const nm of t.split(/\s+/).map((x) => x.trim()).filter(Boolean)) out.push({ className: '', name: nm });
    }
  }
  return out;
}

function register(router, ctx) {
  const { store, config } = ctx;
  const sectionUnitMap = buildSectionUnitMap();

  // ---------- 教师登录 / 首次设置密码 ----------
  router.add('POST', '/api/teacher/login', async (req, res) => {
    const body = await readBody(req, 64 * 1024);
    const password = String(body.password || '');
    const ip = req.socket.remoteAddress || '';
    const key = 't:' + ip;
    const lock = loginTracker.check(key);
    if (lock.locked) return fail(res, 429, `尝试次数过多，请 ${lock.waitMin} 分钟后再试`);
    if (!store.teacher.passwordHash) return fail(res, 200, '首次使用请先设置教师密码', { needsSetup: true });

    if (!verifyPassword(password, store.teacher.passwordHash)) {
      loginTracker.fail(key);
      return fail(res, 401, '教师密码不正确');
    }
    loginTracker.success(key);
    const token = require('../core/sessions.js').createSession('teacher', 'teacher');
    setSessionCookie(res, token, config.sessionTtlHours * 3600);
    ok(res);
  });

  router.add('POST', '/api/teacher/setup', async (req, res) => {
    const body = await readBody(req, 64 * 1024);
    if (store.teacher.passwordHash) return fail(res, 403, '教师密码已设置');
    const password = String(body.password || '');
    if (password.length < 4) return fail(res, 400, '密码至少 4 位');
    await store.mutate(() => {
      store.teacher.passwordHash = hashPassword(password);
      store.teacher.mustChangePassword = false;
      store.saveTeacher();
    });
    const token = require('../core/sessions.js').createSession('teacher', 'teacher');
    setSessionCookie(res, token, config.sessionTtlHours * 3600);
    ok(res);
  });

  router.add('POST', '/api/teacher/logout', async (req, res) => { clearSessionCookie(res); ok(res); });

  const auth = (req, res) => {
    const s = currentSession(req, config);
    if (!s || s.role !== 'teacher') { fail(res, 401, '请以教师身份登录'); return null; }
    return s;
  };

  // ---------- 概览 ----------
  router.add('GET', '/api/teacher/overview', async (req, res) => {
    if (!auth(req, res)) return;
    const rows = [];
    for (const s of store.students.list) {
      const pr = store.progress[s.name];
      if (!pr) continue;
      let answered = 0, correct = 0, last = '';
      for (const d of Object.values(pr.days)) {
        if (d.done) { answered += d.total || 0; correct += d.correct || 0; if (d.submittedAt > last) last = d.submittedAt; }
      }
      rows.push({
        name: s.name, active: s.active !== false,
        doneDays: pr.stats.doneDays || 0,
        totalScore: pr.stats.totalScore || 0,
        avg: pr.stats.doneDays ? Math.round((pr.stats.totalScore || 0) / pr.stats.doneDays) : 0,
        correctRate: answered ? Math.round((correct / answered) * 100) : 0,
        totalWrong: pr.stats.totalWrong || 0,
        lastActive: last,
      });
    }
    rows.sort((a, b) => b.doneDays - a.doneDays || b.totalScore - a.totalScore);
    ok(res, {
      students: rows,
      bank: { total: bank.total(), byType: bank.typeCounts() },
      config: { totalDays: config.totalDays, daySize: config.daySize, scorePerQuestion: config.scorePerQuestion },
    });
  });

  // ---------- 阅读统计 ----------
  router.add('GET', '/api/teacher/reading/stats', async (req, res) => {
    if (!auth(req, res)) return;
    const chapterAgg = rp.CHAPTERS.map((c) => {
      let storyCount = 0, quizCount = 0, scoreSum = 0, totalSum = 0;
      for (const s of store.students.list) {
        const pr = store.progress[s.name];
        if (!pr || !pr.reading) continue;
        const cp = pr.reading.chapters[c.no];
        if (cp && cp.storyRead) storyCount++;
        if (cp && cp.quizDone) { quizCount++; scoreSum += cp.quizScore || 0; totalSum += cp.quizTotal || 0; }
      }
      return {
        no: c.no, title: c.title,
        storyCount, quizCount,
        avgScore: quizCount ? Math.round((scoreSum / quizCount) * 10) / 10 : 0,
      };
    });

    const rows = [];
    let totalPoints = 0, totalDialogs = 0;
    for (const s of store.students.list) {
      const pr = store.progress[s.name];
      if (!pr || !pr.reading) continue;
      totalPoints += rp.totalQuizPoints(pr);
      totalDialogs += pr.reading.dialogCount || 0;
      rows.push({
        name: s.name, active: s.active !== false,
        doneChapters: rp.completedCount(pr),
        points: rp.totalQuizPoints(pr),
        dialogCount: pr.reading.dialogCount || 0,
        badgeCount: rp.badges(pr).length,
        unlocked: rp.unlocked(pr),
        startedAt: pr.reading.startedAt,
      });
    }
    rows.sort((a, b) => b.doneChapters - a.doneChapters || b.points - a.points);
    ok(res, {
      book: { title: rp.books.title },
      chapterAgg,
      students: rows,
      summary: {
        studentCount: store.students.list.length,
        readerCount: rows.length,
        totalPoints, totalDialogs,
        avgDone: rows.length ? Math.round((rows.reduce((s, r) => s + r.doneChapters, 0) / rows.length) * 10) / 10 : 0,
      },
    });
  });

  router.add('GET', '/api/teacher/student/:name', async (req, res, ctx, params) => {
    if (!auth(req, res)) return;
    const name = params.name;
    const pr = store.progress[name];
    if (!pr) return fail(res, 404, '该学生还没有答题记录');
    const days = Object.entries(pr.days).map(([day, d]) => ({
      day: Number(day), done: !!d.done, score: d.score || 0, correct: d.correct || 0, total: d.total || 0,
      submittedAt: d.submittedAt || null,
    })).sort((a, b) => a.day - b.day);
    const wrong = Object.entries(pr.wrongBank || {})
      .map(([id, count]) => {
        const q = bank.getById(id);
        if (!q) return null;
        return { id, count, q: q.q, type: q.type, answer: displayAnswer(q), expl: q.expl || '', unit: q.unit || '' };
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count);
    ok(res, { name, stats: pr.stats, days, wrong });
  });

  // ---------- 学生名单管理 ----------
  router.add('GET', '/api/teacher/students', async (req, res) => {
    if (!auth(req, res)) return;
    ok(res, { list: store.students.list });
  });

  router.add('POST', '/api/teacher/students', async (req, res) => {
    if (!auth(req, res)) return;
    const body = await readBody(req, 128 * 1024);
    const text = String(body.nameText != null ? body.nameText : (body.names || []).join('\n'));
    const parsed = parseStudentLines(text);
    if (!parsed.length) return fail(res, 400, '请输入学生名字（格式：班级，姓名）');
    const seen = new Set();
    const added = [];
    const existed = [];
    await store.mutate(() => {
      for (const it of parsed) {
        if (seen.has(it.name)) continue; // 同次录入内去重
        seen.add(it.name);
        if (store.students.list.some((s) => s.name === it.name)) { existed.push(it.name); continue; }
        store.students.list.push({ name: it.name, className: it.className || '', createdAt: new Date().toISOString(), active: true });
        added.push({ name: it.name, className: it.className || '' });
      }
      store.saveStudents();
    });
    ok(res, { added, existed });
  });

  router.add('POST', '/api/teacher/students/upload', async (req, res) => {
    if (!auth(req, res)) return;
    const body = await readBody(req, (config.maxUploadMB + 1) * 1024 * 1024);
    const buf = decodeUpload(body.dataBase64, config.maxUploadMB * 1024 * 1024);
    const stuList = xlsxImport.importStudents(buf);
    if (!stuList.length) return fail(res, 400, '没有从表格里读到名字（请包含“姓名”列）');
    const added = [], existed = [];
    const seen = new Set();
    await store.mutate(() => {
      for (const it of stuList) {
        if (seen.has(it.name)) continue;
        seen.add(it.name);
        if (store.students.list.some((s) => s.name === it.name)) { existed.push(it.name); continue; }
        store.students.list.push({ name: it.name, className: it.className || '', createdAt: new Date().toISOString(), active: true });
        added.push({ name: it.name, className: it.className || '' });
      }
      store.saveStudents();
    });
    ok(res, { total: stuList.length, added, existed });
  });

  router.add('DELETE', '/api/teacher/students/:name', async (req, res, ctx, params) => {
    if (!auth(req, res)) return;
    const name = params.name;
    await store.mutate(() => {
      const s = store.students.list.find((x) => x.name === name);
      if (s) s.active = false;
      store.saveStudents();
    });
    ok(res, { name });
  });

  // ---------- 题目导入 ----------
  function toPreview(raw, index) {
    const mapped = raw.section ? sectionUnitMap.get(raw.section) : null;
    const bq = toBankQuestion({
      ...raw,
      unit: raw.unit || (mapped && mapped.unit) || '',
      chapterIdx: raw.chapterIdx != null ? raw.chapterIdx : (mapped && mapped.chapterIdx) || -1,
      unitTitle: raw.unitTitle || (mapped && mapped.unitTitle) || '',
    }, 'custom', 'preview-' + index);
    return {
      index, q: bq.q, options: bq.options, answer: bq.answer, expl: bq.expl,
      chapter: raw.chapter || '', section: raw.section || '',
      type: bq.type, unit: bq.unit, unitTitle: bq.unitTitle, chapterIdx: bq.chapterIdx,
      gradeable: bq.gradeable, answers: bq.answers,
    };
  }

  router.add('POST', '/api/teacher/import/excel', async (req, res) => {
    if (!auth(req, res)) return;
    const body = await readBody(req, (config.maxUploadMB + 1) * 1024 * 1024);
    const buf = decodeUpload(body.dataBase64, config.maxUploadMB * 1024 * 1024);
    const rawList = xlsxImport.importQuestions(buf).slice(0, 500);
    ok(res, { preview: rawList.map((r, i) => toPreview(r, i + 1)), total: rawList.length });
  });

  router.add('POST', '/api/teacher/import/docx', async (req, res) => {
    if (!auth(req, res)) return;
    const body = await readBody(req, (config.maxUploadMB + 1) * 1024 * 1024);
    const buf = decodeUpload(body.dataBase64, config.maxUploadMB * 1024 * 1024);
    const rawList = await docxImport.importDocx(buf);
    if (!rawList.length) return fail(res, 400, '没有从文档里解析出题目');
    ok(res, { preview: rawList.slice(0, 500).map((r, i) => toPreview(r, i + 1)), total: rawList.length });
  });

  router.add('POST', '/api/teacher/import/commit', async (req, res) => {
    if (!auth(req, res)) return;
    const body = await readBody(req, 8 * 1024 * 1024);
    const items = Array.isArray(body.questions) ? body.questions : [];
    if (!items.length) return fail(res, 400, '没有要入库的题目');
    let added = 0, skipped = 0;
    await store.mutate(() => {
      for (const it of items) {
        const raw = {
          q: it.q, options: it.options, answer: it.answer, expl: it.expl,
          chapter: it.chapter, section: it.section, no: 0,
          unit: it.unit || '', chapterIdx: it.chapterIdx != null ? it.chapterIdx : -1,
          unitTitle: it.unitTitle || '',
        };
        const bq = toBankQuestion(raw, 'custom', newCustomId());
        if (!bq.q) { skipped++; continue; }
        store.bank.questions.push(bq);
        added++;
      }
      store.saveBank();
    });
    bank.build(store.bank);
    ok(res, { added, skipped, total: bank.total() });
  });

  // ---------- 题目维护（网页直接新增 / 编辑 / 删除 / 检索） ----------
  router.add('GET', '/api/teacher/questions', async (req, res, ctx, params, url) => {
    if (!auth(req, res)) return;
    const qs = url.searchParams;
    const type = qs.get('type') || '';
    const kw = (qs.get('q') || '').trim();
    const includeDeleted = qs.get('includeDeleted') === '1';
    let list = bank.all().filter((q) => (includeDeleted ? true : !q.deleted));
    if (type) list = list.filter((q) => q.type === type);
    if (kw) list = list.filter((q) => q.q.includes(kw) || (q.section || '').includes(kw) || (q.unit || '').includes(kw));
    const page = Math.max(1, Number(qs.get('page') || 1));
    const pageSize = Math.min(100, Math.max(5, Number(qs.get('pageSize') || 20)));
    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    ok(res, { total, page, pageSize, list: list.map((q) => ({ ...q, answer: displayAnswer(q) })) });
  });

  router.add('POST', '/api/teacher/question', async (req, res) => {
    if (!auth(req, res)) return;
    const body = await readBody(req, 128 * 1024);
    const raw = {
      q: body.q, options: body.options || [], answer: body.answer, expl: body.expl || '',
      chapter: body.chapter || '', section: body.section || '',
      unit: body.unit || '', chapterIdx: body.chapterIdx != null ? body.chapterIdx : -1,
      unitTitle: body.unitTitle || '', no: 0,
    };
    const bq = toBankQuestion(raw, 'custom', newCustomId());
    if (!bq.q) return fail(res, 400, '题干不能为空');
    if (!bq.gradeable) return fail(res, 400, '答案不能为空或无法判分');
    await store.mutate(() => { store.bank.questions.push(bq); store.saveBank(); });
    bank.build(store.bank);
    ok(res, { id: bq.id });
  });

  router.add('PUT', '/api/teacher/question/:id', async (req, res, ctx, params) => {
    if (!auth(req, res)) return;
    const id = params.id;
    const body = await readBody(req, 128 * 1024);
    const existing = store.bank.questions.find((q) => q.id === id);
    if (!existing) return fail(res, 404, '题目不存在');
    await store.mutate(() => {
      Object.assign(existing, {
        q: body.q != null ? body.q : existing.q,
        options: body.options != null ? body.options : existing.options,
        answer: body.answer != null ? body.answer : existing.answer,
        expl: body.expl != null ? body.expl : existing.expl,
        unit: body.unit != null ? body.unit : existing.unit,
        chapterIdx: body.chapterIdx != null ? body.chapterIdx : existing.chapterIdx,
        unitTitle: body.unitTitle != null ? body.unitTitle : existing.unitTitle,
        deleted: body.deleted != null ? !!body.deleted : existing.deleted,
      });
      store.saveBank();
    });
    bank.build(store.bank);
    ok(res, { id });
  });

  router.add('DELETE', '/api/teacher/question/:id', async (req, res, ctx, params) => {
    if (!auth(req, res)) return;
    const id = params.id;
    const existing = store.bank.questions.find((q) => q.id === id);
    if (!existing) return fail(res, 404, '题目不存在');
    await store.mutate(() => { existing.deleted = true; store.saveBank(); });
    bank.build(store.bank);
    ok(res, { id });
  });

  // ---------- 修改教师密码 ----------
  router.add('POST', '/api/teacher/password', async (req, res) => {
    if (!auth(req, res)) return;
    const body = await readBody(req, 64 * 1024);
    const oldPw = String(body.oldPassword || '');
    const newPw = String(body.newPassword || '');
    if (newPw.length < 4) return fail(res, 400, '新密码至少 4 位');
    if (store.teacher.passwordHash && !verifyPassword(oldPw, store.teacher.passwordHash)) {
      return fail(res, 401, '原密码不正确');
    }
    await store.mutate(() => {
      store.teacher.passwordHash = hashPassword(newPw);
      store.teacher.mustChangePassword = false;
      store.saveTeacher();
    });
    ok(res);
  });

  // ---------- 题库统计（设置页） ----------
  router.add('GET', '/api/teacher/stats', async (req, res) => {
    if (!auth(req, res)) return;
    ok(res, {
      total: bank.total(),
      byType: bank.typeCounts(),
      categories: bank.categories(),
      students: store.students.list.length,
    });
  });
}

module.exports = { register };
