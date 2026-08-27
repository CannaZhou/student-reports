// 阅读进度共享逻辑：学生端 routes/reading.js 与教师端 routes/teacher.js 共用
// 规则单一来源，保证统计口径一致
const books = require('../data/books.json');
const CHAPTERS = books.chapters;

function ensureReading(p) {
  if (!p.reading) {
    p.reading = { startedAt: new Date().toISOString(), points: 0, dialogCount: 0, chapters: {} };
  }
  return p.reading;
}

function chapterProgress(p, no) {
  const r = ensureReading(p);
  if (!r.chapters[no]) {
    r.chapters[no] = {
      storyRead: false, readAt: null,
      quizDone: false, quizScore: 0, quizTotal: 0, quizAt: null,
      quizAnswers: {}, quizResults: {},
    };
  }
  return r.chapters[no];
}

// 已解锁的最大章节：第1章总可读；第i章需要第i-1章闯关完成
function unlocked(p) {
  let max = 1;
  for (let i = 1; i <= CHAPTERS.length; i++) {
    if (i === 1) continue;
    const prev = ensureReading(p).chapters[i - 1];
    if (prev && prev.quizDone) max = i;
    else break;
  }
  return max;
}

function completedCount(p) {
  const r = ensureReading(p);
  return CHAPTERS.filter((c) => r.chapters[c.no] && r.chapters[c.no].quizDone).length;
}

function totalQuizPoints(p) {
  const r = ensureReading(p);
  return CHAPTERS.reduce((sum, c) => {
    const cp = r.chapters[c.no];
    return cp && cp.quizDone ? sum + cp.quizScore * 2 : sum;
  }, 0);
}

// 徽章：由状态确定性推导
function badges(p) {
  const r = ensureReading(p);
  const done = completedCount(p);
  const got = [];
  if (r.chapters[1] && r.chapters[1].quizDone) got.push({ id: 'starter', name: '启程之星', desc: '闯过第一关「云朵知识城」' });
  if (done >= 3) got.push({ id: 'reader', name: '阅读新星', desc: '完成3章冒险' });
  if (done >= CHAPTERS.length) got.push({ id: 'storyking', name: '故事大王', desc: '读完全部冒险' });
  const perfect = CHAPTERS.some((c) => {
    const cp = r.chapters[c.no];
    return cp && cp.quizDone && cp.quizTotal > 0 && cp.quizScore === cp.quizTotal;
  });
  if (perfect) got.push({ id: 'master', name: '闯关达人', desc: '某一章闯关全对' });
  if ((r.dialogCount || 0) >= 10) got.push({ id: 'asker', name: '追问小能手', desc: '问了AI 10个问题' });
  return got;
}

module.exports = {
  books, CHAPTERS,
  ensureReading, chapterProgress, unlocked, completedCount, totalQuizPoints, badges,
};
