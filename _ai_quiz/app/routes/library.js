// 名家绘本学生端 / 教师端 API
// 图片走 /api/library/page/...：必须登录、必须已解锁，且带一年缓存头（图片内容随构建固定）
const fs = require('fs');
const path = require('path');
const lib = require('../core/library.js');
const { gradeQuestion, displayAnswer } = require('../core/grade.js');
const {
  readBody, ok, fail, currentSession, publicQuestion,
} = require('./helpers.js');

function pad3(n) { return String(n).padStart(3, '0'); }

function metaOf(book) {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    series: book.series || '',
    author: book.author || '',
    publisher: book.publisher || '',
    isbn: book.isbn || '',
    spine: book.spine || '#3A7D44',
    intro: book.intro || '',
    chapterCount: (book.chapters || []).length,
    totalPages: (book.chapters || []).reduce((s, c) => s + (c.pageCount || 0), 0),
  };
}

function chapterMeta(book, ch, p) {
  const rec = lib.chapterRecord(p, book.id, ch.no);
  return {
    no: ch.no,
    title: ch.title,
    chapterTitle: ch.chapterTitle || ch.title,
    pageCount: ch.pageCount,
    unlocked: ch.no <= lib.unlockedNo(p, book),
    checked: !!rec.readAt,
    readAt: rec.readAt || null,
    note: rec.note || '',
    quizCount: lib.getQuiz(book.id, ch.no).length,
  };
}

function register(router, ctx) {
  const { store, config } = ctx;
  lib.init(config);

  const auth = (req, res) => {
    const s = currentSession(req, config);
    if (!s || s.role !== 'student') { fail(res, 401, '请先登录'); return null; }
    const stu = store.students.list.find((x) => x.name === s.name && x.active !== false);
    if (!stu) { fail(res, 401, '账号已停用'); return null; }
    const p = store.progress[s.name];
    if (!p) { fail(res, 401, '请先登录'); return null; }
    return { student: stu, p };
  };

  const teacher = (req, res) => {
    const s = currentSession(req, config);
    if (!s || s.role !== 'teacher') { fail(res, 401, '请以教师身份登录'); return null; }
    return s;
  };

  // ================= 学生端 =================

  // 书架：4 本书 + 每本进度
  router.add('GET', '/api/library/shelf', async (req, res) => {
    const a = auth(req, res);
    if (!a) return;
    const rev = lib.manifest().rev || '0';
    const rows = lib.books().map((book) => {
      const bp = (a.p.library && a.p.library.books && a.p.library.books[book.id]) || null;
      return Object.assign(metaOf(book), {
        cover: '/api/library/cover/' + book.id + '?v=' + rev,
        checkedCount: lib.checkedCount(a.p, book),
        unlockedNo: lib.unlockedNo(a.p, book),
        completed: lib.bookCompleted(a.p, book),
        lastReadAt: (bp && bp.lastReadAt) || null,
      });
    });
    ok(res, {
      series: lib.manifest().series || '',
      rev,
      books: rows,
      summary: {
        books: rows.length,
        booksCompleted: rows.filter((b) => b.completed).length,
        chaptersChecked: rows.reduce((s, b) => s + b.checkedCount, 0),
      },
    });
  });

  // 单本详情 + 章节列表
  router.add('GET', '/api/library/book/:id', async (req, res, c, params) => {
    const a = auth(req, res);
    if (!a) return;
    const book = lib.getBook(params.id);
    if (!book) return fail(res, 404, '没有这本书');
    const rev = lib.manifest().rev || '0';
    ok(res, {
      book: Object.assign(metaOf(book), {
        cover: '/api/library/cover/' + book.id + '?v=' + rev,
        checkedCount: lib.checkedCount(a.p, book),
        unlockedNo: lib.unlockedNo(a.p, book),
        completed: lib.bookCompleted(a.p, book),
        chapters: (book.chapters || []).map((ch) => chapterMeta(book, ch, a.p)),
      }),
    });
  });

  // 章节内容（页 URL 由服务端拼好，前端不拼路径）
  router.add('GET', '/api/library/book/:id/chapter/:no', async (req, res, c, params) => {
    const a = auth(req, res);
    if (!a) return;
    const book = lib.getBook(params.id);
    if (!book) return fail(res, 404, '没有这本书');
    const ch = lib.getChapter(book, params.no);
    if (!ch) return fail(res, 404, '没有这一章');
    if (ch.no > lib.unlockedNo(a.p, book)) {
      return fail(res, 403, '这一章还没解锁，先读完上一章吧');
    }
    const rev = lib.manifest().rev || '0';
    const pages = [];
    for (let i = 1; i <= ch.pageCount; i++) {
      pages.push({ n: i, url: '/api/library/page/' + book.id + '/' + ch.no + '/' + i + '?v=' + rev });
    }
    const rec = lib.chapterRecord(a.p, book.id, ch.no);
    ok(res, {
      book: { id: book.id, title: book.title, subtitle: book.subtitle },
      chapter: Object.assign(chapterMeta(book, ch, a.p), { dir: ch.dir }),
      pages,
      readAt: rec.readAt || null,
      note: rec.note || '',
      nextChapterNo: lib.nextChapterNo(a.p, book, ch.no),
      unlockedNo: lib.unlockedNo(a.p, book),
    });
  });

  // 单页图片
  router.add('GET', '/api/library/page/:id/:chapterNo/:pageNo', async (req, res, c, params) => {
    const a = auth(req, res);
    if (!a) return;
    const book = lib.getBook(params.id);
    const ch = lib.getChapter(book, params.chapterNo);
    if (!book || !ch) return fail(res, 404, '页面不存在');
    const n = Number(params.pageNo);
    if (!Number.isInteger(n) || n < 1 || n > ch.pageCount) return fail(res, 404, '页面不存在');
    if (ch.no > lib.unlockedNo(a.p, book)) return fail(res, 403, '这一章还没解锁');

    const file = path.join(config.mediaDir, 'books', book.id, ch.dir, pad3(n) + '.webp');
    sendImage(res, file);
  });

  // 封面
  router.add('GET', '/api/library/cover/:id', async (req, res, c, params) => {
    const a = auth(req, res);
    if (!a) return;
    const book = lib.getBook(params.id);
    if (!book) return fail(res, 404, '没有这本书');
    sendImage(res, path.join(config.mediaDir, 'books', book.id, book.cover || 'cover.webp'));
  });

  // 打卡
  router.add('POST', '/api/library/book/:id/chapter/:no/checkin', async (req, res, c, params) => {
    const a = auth(req, res);
    if (!a) return;
    const book = lib.getBook(params.id);
    if (!book) return fail(res, 404, '没有这本书');
    const ch = lib.getChapter(book, params.no);
    if (!ch) return fail(res, 404, '没有这一章');
    if (ch.no > lib.unlockedNo(a.p, book)) return fail(res, 403, '这一章还没解锁');

    const body = await readBody(req, 16 * 1024);
    if (Number(body.lastPage) < ch.pageCount) return fail(res, 400, '还没翻到最后一页哦');
    const note = String(body.note || '').trim().slice(0, 200);
    const already = lib.isChecked(a.p, book.id, ch.no);

    await store.mutate(() => {
      const bp = lib.bookProgress(a.p, book.id);
      bp.lastReadAt = new Date().toISOString();
      const rec = lib.setChapterRead(a.p, book.id, ch.no, already ? { note } : {
        readAt: new Date().toISOString(), note, lastPage: ch.pageCount,
      });
      if (already && note) rec.note = note;
      store.saveProgress(a.p.name);
    });

    const rec = lib.chapterRecord(a.p, book.id, ch.no);
    ok(res, {
      checked: true,
      replay: already,
      readAt: rec.readAt,
      note: rec.note || '',
      unlockedNo: lib.unlockedNo(a.p, book),
      nextChapterNo: lib.nextChapterNo(a.p, book, ch.no),
      bookCompleted: lib.bookCompleted(a.p, book),
    });
  });

  // 本章小测（题目，剥答案）
  router.add('GET', '/api/library/book/:id/chapter/:no/quiz', async (req, res, c, params) => {
    const a = auth(req, res);
    if (!a) return;
    const book = lib.getBook(params.id);
    const ch = lib.getChapter(book, params.no);
    if (!book || !ch) return fail(res, 404, '没有这一章');
    if (ch.no > lib.unlockedNo(a.p, book)) return fail(res, 403, '这一章还没解锁');
    const qs = lib.getQuiz(book.id, ch.no);
    ok(res, { available: qs.length > 0, quizTotal: qs.length, questions: qs.map(publicQuestion) });
  });

  // 提交小测
  router.add('POST', '/api/library/book/:id/chapter/:no/quiz/submit', async (req, res, c, params) => {
    const a = auth(req, res);
    if (!a) return;
    const book = lib.getBook(params.id);
    const ch = lib.getChapter(book, params.no);
    if (!book || !ch) return fail(res, 404, '没有这一章');
    if (ch.no > lib.unlockedNo(a.p, book)) return fail(res, 403, '这一章还没解锁');
    const qs = lib.getQuiz(book.id, ch.no);
    if (!qs.length) return fail(res, 400, '本章还没有小测题目');

    const rec = lib.chapterRecord(a.p, book.id, ch.no);
    if (rec.quiz && rec.quiz.done) {
      return ok(res, {
        replay: true, done: true, score: rec.quiz.score, total: rec.quiz.total, results: rec.quiz.results || [],
      });
    }

    const body = await readBody(req, 256 * 1024);
    const ans = body.answers || {};
    const results = qs.map((q) => {
      const g = gradeQuestion(q, ans[q.id]);
      return {
        id: q.id, correct: g.correct, gradeable: g.gradeable,
        q: q.q, options: q.options, type: q.type,
        correctAnswer: displayAnswer(q), expl: q.expl || '',
      };
    });
    const score = results.filter((r) => r.correct).length;

    await store.mutate(() => {
      const bp = lib.bookProgress(a.p, book.id);
      bp.chapters[String(ch.no)] = Object.assign(bp.chapters[String(ch.no)] || {
        readAt: null, note: '', lastPage: 0,
      }, {
        quiz: {
          done: true, score, total: qs.length, at: new Date().toISOString(),
          answers: ans, results: results.map((r) => ({ id: r.id, correct: r.correct })),
        },
      });
      store.saveProgress(a.p.name);
    });
    ok(res, { done: true, score, total: qs.length, results });
  });

  // ================= 教师端 =================

  router.add('GET', '/api/teacher/library/stats', async (req, res) => {
    if (!teacher(req, res)) return;
    const books = lib.books().map((book) => ({
      id: book.id,
      title: book.title,
      subtitle: book.subtitle,
      chapterCount: (book.chapters || []).length,
      chapters: (book.chapters || []).map((ch) => {
        let checkinCount = 0;
        for (const s of store.students.list) {
          const pr = store.progress[s.name];
          if (pr && lib.isChecked(pr, book.id, ch.no)) checkinCount++;
        }
        return { no: ch.no, title: ch.title, checkinCount };
      }),
    }));

    const rows = [];
    const notes = [];
    for (const s of store.students.list) {
      const pr = store.progress[s.name];
      const pb = pr && pr.library && pr.library.books;
      const perBook = {};
      let total = 0;
      let lastAt = null;
      for (const book of lib.books()) {
        const checked = pb && pb[book.id] ? Object.keys(pb[book.id].chapters || {}).filter((k) => {
          const r = pb[book.id].chapters[k];
          return r && r.readAt;
        }).length : 0;
        perBook[book.id] = { checked, completed: checked >= (book.chapters || []).length };
        total += checked;
        if (pb && pb[book.id]) {
          const t = pb[book.id].lastReadAt;
          if (t && (!lastAt || t > lastAt)) lastAt = t;
          for (const ch of book.chapters || []) {
            const r = pb[book.id].chapters && pb[book.id].chapters[String(ch.no)];
            if (r && r.readAt && r.note) {
              notes.push({
                name: s.name, bookId: book.id, bookTitle: book.title,
                chapterNo: ch.no, chapterTitle: ch.title, note: r.note, readAt: r.readAt,
              });
            }
          }
        }
      }
      if (total > 0) rows.push({ name: s.name, active: s.active !== false, totalChecked: total, lastAt, books: perBook });
    }
    rows.sort((x, y) => y.totalChecked - x.totalChecked);
    notes.sort((x, y) => (y.readAt || '').localeCompare(x.readAt || ''));
    ok(res, { books, students: rows, notes: notes.slice(0, 200) });
  });

  router.add('GET', '/api/teacher/library/quiz/:id/:no', async (req, res, c, params) => {
    if (!teacher(req, res)) return;
    const book = lib.getBook(params.id);
    const ch = lib.getChapter(book, params.no);
    if (!book || !ch) return fail(res, 404, '没有这一章');
    ok(res, { bookId: book.id, no: ch.no, chapterTitle: ch.chapterTitle || ch.title, questions: lib.getQuiz(book.id, ch.no) });
  });

  router.add('PUT', '/api/teacher/library/quiz/:id/:no', async (req, res, c, params) => {
    if (!teacher(req, res)) return;
    const book = lib.getBook(params.id);
    const ch = lib.getChapter(book, params.no);
    if (!book || !ch) return fail(res, 404, '没有这一章');
    const body = await readBody(req, 512 * 1024);
    const questions = Array.isArray(body.questions) ? body.questions : [];
    const clean = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i] || {};
      const type = ['single', 'judge', 'multi', 'fill'].includes(q.type) ? q.type : 'single';
      const text = String(q.q || '').trim().slice(0, 2000);
      if (!text) return fail(res, 400, '第 ' + (i + 1) + ' 题的题干不能为空');
      const options = Array.isArray(q.options) ? q.options
        .filter((o) => o && o.key && String(o.text || '').trim())
        .map((o) => ({ key: String(o.key), text: String(o.text).trim() })) : [];
      if (type !== 'fill' && options.length < 2) return fail(res, 400, '第 ' + (i + 1) + ' 题至少要两个选项');
      const answer = String(q.answer || '').trim();
      if (type !== 'fill' && !answer) return fail(res, 400, '第 ' + (i + 1) + ' 题没有填答案');
      if (type === 'fill' && !answer) return fail(res, 400, '第 ' + (i + 1) + ' 题的答案不能为空');
      clean.push({
        id: String(q.id || (book.id + '-' + ch.no + '-' + (i + 1))),
        type, q: text, options,
        answer, answers: Array.isArray(q.answers) ? q.answers.map(String) : [],
        expl: String(q.expl || '').trim().slice(0, 2000),
      });
    }
    lib.saveQuiz(book.id, ch.no, clean);
    ok(res, { saved: clean.length });
  });
}

function sendImage(res, file) {
  let stat;
  try { stat = fs.statSync(file); } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found');
  }
  res.writeHead(200, {
    'Content-Type': 'image/webp',
    'Content-Length': stat.size,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
}

module.exports = { register };
