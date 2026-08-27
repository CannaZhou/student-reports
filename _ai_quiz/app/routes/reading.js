// 阅读智能体学生端 API：《小AI探险队》书架 / 阅读 / AI伴读 / 闯关 / 存折 / 排行
// 复用：sessions 会话、students 名单、bank 题库、grade 判分、store 存储
// 阅读进度存于 progress[name].reading（独立字段，不影响原答题进度）
const { books, CHAPTERS, ensureReading, chapterProgress, unlocked, completedCount, totalQuizPoints, badges } = require('../core/readprogress.js');
const bank = require('../core/bank.js');
const llm = require('../core/llm.js');
const { gradeQuestion, displayAnswer } = require('../core/grade.js');
const {
  readBody, ok, fail, currentSession, publicQuestion,
} = require('./helpers.js');

function shelfInfo(p) {
  const r = ensureReading(p);
  return {
    points: totalQuizPoints(p),
    dialogCount: r.dialogCount || 0,
    doneChapters: completedCount(p),
    totalChapters: CHAPTERS.length,
    unlocked: unlocked(p),
    badges: badges(p),
    chapters: CHAPTERS.map((c) => {
      const cp = chapterProgress(p, c.no);
      return {
        no: c.no, title: c.title, chapterTitle: c.chapterTitle,
        quizCount: c.quizIds.length, knowledgeCount: c.knowledgeCards.length,
        storyRead: cp.storyRead, quizDone: cp.quizDone,
        quizScore: cp.quizScore, quizTotal: cp.quizTotal,
      };
    }),
  };
}

function register(router, ctx) {
  const { store, config } = ctx;

  // 学生会话校验（复用同一套名单/会话）
  const auth = (req, res) => {
    const s = currentSession(req, config);
    if (!s || s.role !== 'student') { fail(res, 401, '请先登录'); return null; }
    const stu = store.students.list.find((x) => x.name === s.name && x.active !== false);
    if (!stu) { fail(res, 401, '账号已停用'); return null; }
    const p = store.progress[s.name];
    if (!p) { fail(res, 401, '请先登录'); return null; }
    return { student: stu, p };
  };

  // ---------- 书架 ----------
  router.add('GET', '/api/reading/shelf', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    ok(res, {
      name: a.student.name,
      title: books.title, subtitle: books.subtitle, intro: books.intro, map: books.map,
      shelf: shelfInfo(a.p),
    });
  });

  // ---------- 章节阅读内容 ----------
  router.add('GET', '/api/reading/chapter/:no', async (req, res, ctx, params) => {
    const a = auth(req, res);
    if (!a) return;
    const no = Number(params.no);
    const ch = CHAPTERS.find((c) => c.no === no);
    if (!ch) return fail(res, 400, '章节不存在');
    if (no > unlocked(a.p)) return fail(res, 403, '请先完成前面的冒险关卡');

    const cp = chapterProgress(a.p, no);
    ok(res, {
      no: ch.no, title: ch.title, chapterTitle: ch.chapterTitle,
      story: ch.story, knowledge: ch.knowledge, mnemonic: ch.mnemonic,
      knowledgeCards: ch.knowledgeCards,
      storyRead: cp.storyRead, quizDone: cp.quizDone,
      quizScore: cp.quizScore, quizTotal: cp.quizTotal,
    });
  });

  // ---------- 读完本章（盖章） ----------
  router.add('POST', '/api/reading/chapter/:no/read', async (req, res, ctx, params) => {
    const a = auth(req, res);
    if (!a) return;
    const no = Number(params.no);
    if (!CHAPTERS.find((c) => c.no === no)) return fail(res, 400, '章节不存在');
    if (no > unlocked(a.p)) return fail(res, 403, '请先完成前面的冒险关卡');

    await store.mutate(() => {
      const cp = chapterProgress(a.p, no);
      if (!cp.storyRead) { cp.storyRead = true; cp.readAt = new Date().toISOString(); }
      store.saveProgress(a.p.name);
    });
    ok(res, { storyRead: true });
  });

  // ---------- 闯关题目（不含答案） ----------
  router.add('GET', '/api/reading/quiz/:no', async (req, res, ctx, params) => {
    const a = auth(req, res);
    if (!a) return;
    const no = Number(params.no);
    const ch = CHAPTERS.find((c) => c.no === no);
    if (!ch) return fail(res, 400, '章节不存在');
    if (no > unlocked(a.p)) return fail(res, 403, '请先完成前面的冒险关卡');

    const questions = ch.quizIds.map((id) => {
      const q = bank.getById(id);
      return q ? publicQuestion(q) : null;
    }).filter(Boolean);
    ok(res, { no, quizTotal: questions.length, questions });
  });

  // ---------- 闯关提交 ----------
  router.add('POST', '/api/reading/quiz/:no/submit', async (req, res, ctx, params) => {
    const a = auth(req, res);
    if (!a) return;
    const no = Number(params.no);
    const ch = CHAPTERS.find((c) => c.no === no);
    if (!ch) return fail(res, 400, '章节不存在');
    if (no > unlocked(a.p)) return fail(res, 403, '请先完成前面的冒险关卡');
    const cp = chapterProgress(a.p, no);
    if (!cp.storyRead) return fail(res, 403, '请先读完本章故事，再来闯关');

    // 幂等：已完成的关卡直接返回既有记录
    if (cp.quizDone) {
      return ok(res, {
        replay: true, done: true, quizScore: cp.quizScore, quizTotal: cp.quizTotal,
        results: cp.resultsList || [], points: cp.quizScore * 2,
      });
    }

    const body = await readBody(req, 512 * 1024);
    const bankQs = ch.quizIds.map((id) => bank.getById(id)).filter(Boolean);
    const ansMap = new Map();
    for (const aItem of (body.answers || [])) ansMap.set(aItem.id, aItem.answer);

    const results = bankQs.map((q) => {
      const g = gradeQuestion(q, ansMap.get(q.id));
      return { id: q.id, correct: g.correct, gradeable: g.gradeable };
    });
    const correct = results.filter((r) => r.correct).length;
    const total = results.length;
    const resultsList = results.map((r) => {
      const q = bank.getById(r.id);
      return {
        id: r.id, q: q.q, options: q.options, type: q.type,
        correct: r.correct, correctAnswer: displayAnswer(q), expl: q.expl || '',
      };
    });

    await store.mutate(() => {
      cp.quizDone = true; cp.quizScore = correct; cp.quizTotal = total; cp.quizAt = new Date().toISOString();
      cp.quizAnswers = {};
      for (const x of (body.answers || [])) cp.quizAnswers[x.id] = x.answer;
      cp.quizResults = {};
      for (const r of results) cp.quizResults[r.id] = r.correct;
      cp.resultsList = resultsList;
      store.saveProgress(a.p.name);
    });

    ok(res, { done: true, quizScore: correct, quizTotal: total, points: correct * 2, results: resultsList });
  });

  // ---------- AI伴读对话 ----------
  router.add('POST', '/api/reading/chat', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const body = await readBody(req, 64 * 1024);
    const no = Number(body.chapterNo);
    const question = String(body.question || '').trim().slice(0, 500);
    const ch = CHAPTERS.find((c) => c.no === no);
    if (!ch) return fail(res, 400, '章节不存在');
    if (no > unlocked(a.p)) return fail(res, 403, '请先完成前面的冒险关卡');
    if (!question) return fail(res, 400, '请先输入你的问题');

    const r = ensureReading(a.p);
    const cp = chapterProgress(a.p, no);
    const history = (r.dialog || []).slice(-4).map((d) => ({ role: d.role, text: d.text }));

    const messages = llm.buildCompanionMessages({
      chapter: ch, question, history,
      studentName: a.student.name, storyRead: !!cp.storyRead,
    });
    const fallbackText = llm.fallbackReply(ch, question);
    const result = await llm.chat({ messages, fallbackText });

    await store.mutate(() => {
      r.dialogCount = (r.dialogCount || 0) + 1;
      if (!r.dialog) r.dialog = [];
      r.dialog.push({ role: 'user', text: question, ts: new Date().toISOString() });
      r.dialog.push({ role: 'assistant', text: result.reply, ts: new Date().toISOString() });
      if (r.dialog.length > 16) r.dialog = r.dialog.slice(-16);
      store.saveProgress(a.p.name);
    });

    ok(res, {
      reply: result.reply, source: result.source,
      chapterNo: ch.no, chapterTitle: ch.chapterTitle,
      dialogCount: r.dialogCount,
    });
  });

  // ---------- 阅读存折 ----------
  router.add('GET', '/api/reading/passbook', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const r = ensureReading(a.p);
    const chapterRows = CHAPTERS.map((c) => {
      const cp = chapterProgress(a.p, c.no);
      return {
        no: c.no, title: c.title,
        storyRead: cp.storyRead, quizDone: cp.quizDone,
        quizScore: cp.quizScore, quizTotal: cp.quizTotal,
        quizAt: cp.quizAt,
      };
    });
    ok(res, {
      name: a.student.name,
      points: totalQuizPoints(a.p),
      dialogCount: r.dialogCount || 0,
      doneChapters: completedCount(a.p),
      totalChapters: CHAPTERS.length,
      badges: badges(a.p),
      chapters: chapterRows,
      startedAt: r.startedAt,
    });
  });

  // ---------- 阅读之星（排行榜） ----------
  router.add('GET', '/api/reading/leaderboard', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const rows = [];
    for (const s of store.students.list) {
      if (s.active === false) continue;
      const pr = store.progress[s.name];
      if (!pr) continue;
      rows.push({
        name: s.name,
        doneChapters: completedCount(pr),
        points: totalQuizPoints(pr),
      });
    }
    rows.sort((x, y) => y.doneChapters - x.doneChapters || y.points - x.points);
    const list = rows.map((r, i) => ({ rank: i + 1, ...r }));
    const meIdx = list.findIndex((r) => r.name === a.student.name);
    ok(res, { list, me: meIdx >= 0 ? { rank: meIdx + 1, name: a.student.name } : null });
  });
}

module.exports = { register };
