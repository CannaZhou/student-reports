// 学生端 API
const bank = require('../core/bank.js');
const select = require('../core/select.js');
const { gradeQuestion } = require('../core/grade.js');
const { verifyPassword, FailTracker } = require('../core/auth.js');
const {
  readBody, ok, fail, setSessionCookie, clearSessionCookie,
  currentSession, publicQuestion,
} = require('./helpers.js');

const loginTracker = new FailTracker(5, 15 * 60 * 1000);

function ensureProgress(store, name) {
  if (!store.progress[name]) {
    store.progress[name] = {
      name, createdAt: new Date().toISOString(),
      usedSet: [], wrongBank: {}, days: {}, nextDay: 1,
      stats: { doneDays: 0, totalScore: 0, totalWrong: 0 },
    };
    store.saveProgress(name);
  }
  return store.progress[name];
}

function recomputeStats(p) {
  let doneDays = 0, totalScore = 0;
  for (const d of Object.values(p.days)) {
    if (d.done) { doneDays++; totalScore += d.score || 0; }
  }
  p.stats = {
    doneDays,
    totalScore,
    totalWrong: Object.values(p.wrongBank || {}).reduce((a, b) => a + b, 0),
  };
}

// 更新错题库：答对 → 计数减一（归零移除）；答错 → 加一
function updateWrongBank(p, results) {
  if (!p.wrongBank) p.wrongBank = {};
  for (const r of results) {
    if (!r.gradeable) continue;
    if (r.correct) {
      if (p.wrongBank[r.id] > 1) p.wrongBank[r.id]--;
      else delete p.wrongBank[r.id];
    } else {
      p.wrongBank[r.id] = (p.wrongBank[r.id] || 0) + 1;
    }
  }
}

function gradeList(bankQuestions, answers) {
  const ansMap = new Map();
  for (const a of (answers || [])) ansMap.set(a.id, a.answer);
  return bankQuestions.map((q) => {
    const g = gradeQuestion(q, ansMap.get(q.id));
    return {
      id: q.id, type: q.type, q: q.q, options: q.options,
      correct: g.correct, gradeable: g.gradeable,
      correctAnswer: g.expected, expl: q.expl || '',
    };
  });
}

function register(router, ctx) {
  const { store, config } = ctx;

  // ---------- 学生登录 ----------
  router.add('POST', '/api/student/login', async (req, res) => {
    const body = await readBody(req, 64 * 1024);
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    if (!name || !password) return fail(res, 400, '请填写姓名和密码');

    const ip = req.socket.remoteAddress || '';
    const lockKey = 's:' + name + ':' + ip;
    const lock = loginTracker.check(lockKey);
    if (lock.locked) return fail(res, 429, `尝试次数过多，请 ${lock.waitMin} 分钟后再试`);

    const stu = store.students.list.find((s) => s.name === name && s.active !== false);
    if (!stu) return fail(res, 404, '名单中没有这个名字，请先请老师把名字加入名单');
    if (!verifyPassword(password, store.students.studentPassword)) {
      loginTracker.fail(lockKey);
      return fail(res, 401, '密码不正确');
    }
    loginTracker.success(lockKey);

    await store.mutate(() => ensureProgress(store, name));
    const p = store.progress[name];
    const token = require('../core/sessions.js').createSession('student', name);
    setSessionCookie(res, token, config.sessionTtlHours * 3600);
    ok(res, {
      name, nextDay: p.nextDay,
      totalDays: config.totalDays, daySize: config.daySize, scorePerQuestion: config.scorePerQuestion,
    });
  });

  router.add('POST', '/api/student/logout', async (req, res) => {
    clearSessionCookie(res);
    ok(res);
  });

  // ---------- 会话校验 ----------
  const auth = (req, res) => {
    const s = currentSession(req, config);
    if (!s || s.role !== 'student') { fail(res, 401, '请先登录'); return null; }
    const stu = store.students.list.find((x) => x.name === s.name && x.active !== false);
    if (!stu) { fail(res, 401, '账号已停用'); return null; }
    const p = store.progress[s.name];
    if (!p) { fail(res, 401, '请先登录'); return null; }
    return p;
  };

  router.add('GET', '/api/student/me', async (req, res) => {
    const p = auth(req, res);
    if (!p) return;
    const currentDay = Math.min(p.nextDay, config.totalDays);
    ok(res, {
      name: p.name,
      nextDay: p.nextDay,
      todayDone: !!(p.days[currentDay] && p.days[currentDay].done),
      stats: p.stats,
      totalDays: config.totalDays, daySize: config.daySize, scorePerQuestion: config.scorePerQuestion,
    });
  });

  router.add('GET', '/api/student/categories', async (req, res) => {
    const p = auth(req, res);
    if (!p) return;
    ok(res, { categories: bank.categories() });
  });

  // ---------- 分类自由练习 ----------
  router.add('GET', '/api/student/practice', async (req, res, ctx, params, url) => {
    const p = auth(req, res);
    if (!p) return;
    const qs = url.searchParams;
    const chapterIdx = qs.get('chapterIdx') != null ? Number(qs.get('chapterIdx')) : -1;
    const unit = qs.get('unit') || '';
    const recent = Math.max(0, Number(qs.get('recent') || 0));
    // all=1 或 limit<=0 → 返回该分类下全部题目（不做随机抽题/数量截断）
    const all = qs.get('all') === '1' || Number(qs.get('limit') || 0) <= 0;
    const limit = all ? Number.MAX_SAFE_INTEGER : Math.min(50, Math.max(1, Number(qs.get('limit') || 20)));
    let ids;
    if (qs.get('wrong') === '1') {
      // 错题重练
      const wrongIds = Object.keys(p.wrongBank || {});
      const { shuffle } = select;
      shuffle(wrongIds, Math.random);
      ids = wrongIds.slice(0, limit);
    } else {
      ids = select.pickPractice(p, { chapterIdx, unitId: unit, limit, recent });
    }
    ok(res, { questions: ids.map((id) => publicQuestion(bank.getById(id))).filter(Boolean) });
  });

  router.add('POST', '/api/student/practice/submit', async (req, res) => {
    const p = auth(req, res);
    if (!p) return;
    const body = await readBody(req, 512 * 1024);
    const qs = (body.questions || []).map((x) => bank.getById(x.id)).filter(Boolean);
    const results = gradeList(qs, body.answers);
    await store.mutate(() => {
      updateWrongBank(p, results);
      recomputeStats(p);
      store.saveProgress(p.name);
    });
    const correct = results.filter((r) => r.correct).length;
    ok(res, {
      score: correct * config.scorePerQuestion, correct, total: results.length,
      results: results.map(({ q, options, ...rest }) => rest),
    });
  });

  // ---------- 每日打卡 ----------
  router.add('GET', '/api/student/daily/status', async (req, res) => {
    const p = auth(req, res);
    if (!p) return;
    ok(res, {
      totalDays: config.totalDays, daySize: config.daySize, scorePerQuestion: config.scorePerQuestion,
      nextDay: p.nextDay,
      days: Object.entries(p.days).map(([day, d]) => ({
        day: Number(day), done: !!d.done, score: d.score || 0, submittedAt: d.submittedAt || null,
      })),
    });
  });

  router.add('GET', '/api/student/daily/:day', async (req, res, ctx, params) => {
    const p = auth(req, res);
    if (!p) return;
    const day = Number(params.day);
    if (!(day >= 1 && day <= config.totalDays)) return fail(res, 400, '关卡不存在');
    if (day > p.nextDay) return fail(res, 403, '请先完成前面的关卡');

    const existing = p.days[day];
    if (existing) {
      const questions = existing.qids.map((id) => {
        const q = bank.getById(id);
        if (!q) return null;
        return existing.done
          ? {
              ...publicQuestion(q),
              correct: !!existing.results[id],
              studentAnswer: existing.answers[id] != null ? existing.answers[id] : '',
              correctAnswer: displayOf(q),
              expl: q.expl || '',
            }
          : publicQuestion(q);
      }).filter(Boolean);
      return ok(res, { done: !!existing.done, score: existing.score || 0, questions });
    }

    // 首次打开 → 冻结当天题目（确定性，刷新不变）
    let frozen = null;
    await store.mutate(() => {
      const ids = select.pickDaily(p, day);
      p.days[day] = { startedAt: new Date().toISOString(), qids: ids, answers: {}, results: {}, done: false, correct: 0, total: 0, score: 0 };
      store.saveProgress(p.name);
      frozen = ids;
    });
    ok(res, { done: false, questions: frozen.map((id) => publicQuestion(bank.getById(id))).filter(Boolean) });
  });

  router.add('POST', '/api/student/daily/:day/submit', async (req, res, ctx, params) => {
    const p = auth(req, res);
    if (!p) return;
    const day = Number(params.day);
    if (!(day >= 1 && day <= config.totalDays)) return fail(res, 400, '关卡不存在');
    if (day > p.nextDay) return fail(res, 403, '请先完成前面的关卡');

    if (p.days[day] && p.days[day].done) {
      // 幂等：重复提交返回既有记录
      const d = p.days[day];
      return ok(res, {
        replay: true, done: true, score: d.score, correct: d.correct, total: d.total,
        nextDay: p.nextDay, results: d.resultsList || [],
      });
    }

    const body = await readBody(req, 512 * 1024);
    const d = p.days[day];
    if (!d || !d.qids) return fail(res, 400, '请先打开今日练习');

    const bankQs = d.qids.map((id) => bank.getById(id)).filter(Boolean);
    const results = gradeList(bankQs, body.answers);
    const correct = results.filter((r) => r.correct).length;
    const total = results.length;
    const score = total >= config.daySize
      ? correct * config.scorePerQuestion
      : Math.round((correct / total) * 100);

    const resultsList = results.map(({ q, options, ...rest }) => rest);
    await store.mutate(() => {
      d.answers = {};
      for (const a of (body.answers || [])) d.answers[a.id] = a.answer;
      d.results = {};
      for (const r of results) d.results[r.id] = r.correct;
      d.correct = correct; d.total = total; d.score = score;
      d.done = true; d.submittedAt = new Date().toISOString();
      d.resultsList = resultsList;
      updateWrongBank(p, results);
      for (const id of d.qids) { if (!p.usedSet.includes(id)) p.usedSet.push(id); }
      p.nextDay = Math.min(config.totalDays + 1, Math.max(p.nextDay, day + 1));
      recomputeStats(p);
      store.saveProgress(p.name);
    });

    ok(res, {
      done: true, score, correct, total,
      nextDay: p.nextDay,
      allDone: p.nextDay > config.totalDays,
      results: resultsList,
    });
  });

  // ---------- 错题本 ----------
  router.add('GET', '/api/student/wrong', async (req, res) => {
    const p = auth(req, res);
    if (!p) return;
    const list = Object.entries(p.wrongBank || {})
      .map(([id, count]) => {
        const q = bank.getById(id);
        if (!q) return null;
        return {
          id, count, q: q.q, options: q.options, type: q.type,
          answer: require('../core/grade.js').displayAnswer(q), expl: q.expl || '',
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count);
    ok(res, { list, total: list.length });
  });

  // ---------- 排行榜（学生可见） ----------
  router.add('GET', '/api/student/leaderboard', async (req, res) => {
    const p = auth(req, res);
    if (!p) return;
    const rows = [];
    for (const s of store.students.list) {
      if (s.active === false) continue;
      const pr = store.progress[s.name];
      if (!pr) continue;
      rows.push({
        name: s.name,
        doneDays: pr.stats.doneDays || 0,
        totalScore: pr.stats.totalScore || 0,
        avg: pr.stats.doneDays ? Math.round((pr.stats.totalScore || 0) / pr.stats.doneDays) : 0,
      });
    }
    rows.sort((a, b) => b.doneDays - a.doneDays || b.totalScore - a.totalScore);
    const list = rows.map((r, i) => ({ rank: i + 1, ...r }));
    const meIdx = list.findIndex((r) => r.name === p.name);
    ok(res, { list, me: meIdx >= 0 ? { rank: meIdx + 1, name: p.name } : null });
  });
}

function displayOf(q) {
  return require('../core/grade.js').displayAnswer(q);
}

module.exports = { register };
