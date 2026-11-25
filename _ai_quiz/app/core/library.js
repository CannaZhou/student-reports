// 名家绘本：清单、阅读进度（打卡/解锁）、章节小测存取
// 与原有 readprogress.js（原创绘本）完全独立，互不引用
const fs = require('fs');
const path = require('path');

let MANIFEST = { version: 1, rev: '0', series: '', books: [] };
let BY_ID = new Map();
let QUIZZES = { version: 1, quizzes: {} };
let quizFile = '';

function init(config) {
  // 清单：启动时读一次（与 books.json 同一约定，改书名/章节后重启）
  try {
    const file = path.join(config.contentDir, 'library.json');
    MANIFEST = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.warn('⚠ 名家绘本清单读取失败：' + e.message + '（书架将只显示原创绘本）');
    MANIFEST = { version: 1, rev: '0', series: '', books: [] };
  }
  BY_ID = new Map((MANIFEST.books || []).map((b) => [b.id, b]));

  // 题目：文件很小，直接常驻内存；教师端保存时同步落盘
  quizFile = path.join(config.contentDir, 'library-quizzes.json');
  try {
    QUIZZES = JSON.parse(fs.readFileSync(quizFile, 'utf8'));
  } catch (e) {
    QUIZZES = { version: 1, quizzes: {} };
  }
  if (!QUIZZES.quizzes) QUIZZES.quizzes = {};
  return MANIFEST;
}

function manifest() { return MANIFEST; }
function books() { return MANIFEST.books || []; }
function getBook(id) { return BY_ID.get(id) || null; }
function getChapter(book, no) {
  if (!book) return null;
  return (book.chapters || []).find((c) => c.no === Number(no)) || null;
}

// ---------------- 进度（存在学生进度文件的 p.library 字段里） ----------------

function ensureLibrary(p) {
  if (!p.library || typeof p.library !== 'object') {
    p.library = { version: 1, startedAt: new Date().toISOString(), books: {} };
  }
  if (!p.library.books) p.library.books = {};
  return p.library;
}

function bookProgress(p, bookId) {
  const lib = ensureLibrary(p);
  if (!lib.books[bookId]) {
    lib.books[bookId] = { startedAt: new Date().toISOString(), chapters: {} };
  }
  if (!lib.books[bookId].chapters) lib.books[bookId].chapters = {};
  return lib.books[bookId];
}

// 只读：不创建记录（GET 接口不应改数据）
function chapterRecord(p, bookId, no) {
  const lib = p.library && p.library.books && p.library.books[bookId];
  const rec = lib && lib.chapters && lib.chapters[String(no)];
  return rec || { readAt: null, note: '', lastPage: 0 };
}

function isChecked(p, bookId, no) {
  return !!chapterRecord(p, bookId, no).readAt;
}

function setChapterRead(p, bookId, no, patch) {
  const bp = bookProgress(p, bookId);
  const key = String(no);
  const cur = bp.chapters[key] || { readAt: null, note: '', lastPage: 0 };
  bp.chapters[key] = Object.assign(cur, patch);
  return bp.chapters[key];
}

function unlockedNo(p, book) {
  const list = (book.chapters || []).slice().sort((a, b) => a.no - b.no);
  if (!list.length) return 0;
  let max = list[0].no;
  for (let i = 1; i < list.length; i++) {
    if (isChecked(p, book.id, list[i - 1].no)) max = list[i].no;
    else break;
  }
  return max;
}

function checkedCount(p, book) {
  return (book.chapters || []).filter((c) => isChecked(p, book.id, c.no)).length;
}

function nextChapterNo(p, book, no) {
  const max = unlockedNo(p, book);
  const list = (book.chapters || []).slice().sort((a, b) => a.no - b.no);
  const cur = list.find((c) => c.no === Number(no));
  if (!cur) return null;
  const idx = list.indexOf(cur);
  if (idx < 0 || idx + 1 >= list.length) return null;
  const next = list[idx + 1];
  // 只提示「已解锁的下一章」
  return (next.no <= Math.max(max, cur.no) || isChecked(p, book.id, cur.no)) ? next.no : null;
}

function bookCompleted(p, book) {
  return checkedCount(p, book) >= (book.chapters || []).length;
}

// ---------------- 章节小测 ----------------

function getQuiz(bookId, no) {
  const b = QUIZZES.quizzes && QUIZZES.quizzes[bookId];
  const q = b && b[String(no)];
  return (q && q.questions) || [];
}

function saveQuiz(bookId, no, questions) {
  if (!QUIZZES.quizzes[bookId]) QUIZZES.quizzes[bookId] = {};
  QUIZZES.quizzes[bookId][String(no)] = {
    updatedAt: new Date().toISOString(),
    questions,
  };
  const tmp = quizFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(QUIZZES, null, 2), 'utf8');
  fs.renameSync(tmp, quizFile);
  return QUIZZES.quizzes[bookId][String(no)];
}

module.exports = {
  init, manifest, books, getBook, getChapter,
  ensureLibrary, bookProgress, chapterRecord, isChecked, setChapterRead,
  unlockedNo, checkedCount, nextChapterNo, bookCompleted,
  getQuiz, saveQuiz,
};
