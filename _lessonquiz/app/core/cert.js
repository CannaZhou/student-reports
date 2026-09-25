// 一课一证书：做完一课的任务就颁发本课「学业证书」，带综合评价
// 综合评价口径（2026-09-25 与老师确认）：
//   满分 = 小测题数 + 任务单题数   得分 = 小测最高分（自动批改的客观题） + 老师评分
//   ⚠️ 任务单不是 0–10 分制，而是「一题 1 分、做对几题得几分」，满分 = 这一课的任务数
//      （第2课 1 题 → 满分 1；第3课 2 题 → 满分 2；第4课 6 题 → 满分 6）。老师给 1 分就是做对 1 题。
//      这分最后还要并进学生积分，所以不能改成 10 分制。
//   任务单交了但老师还没批 → 先发证，星级暂按客观题单独算（pending=true），老师批完下次打开自动重算
// 发证条件：小测已交；有任务单的课还要任务单已交
// 评价语分档：100% / ≥60% / >0% / 未完成（原话见 BANDS 与 UNDONE）
const { lessonName, sheetTaskCount } = require('./lesson.js'); // 课名/任务数走叶子模块：catalog.js 顶层要本模块，反向 require 会成环

// 综合评价分档（pct 从高到低命中第一条）
const BANDS = [
  {
    min: 100, level: 'perfect',
    comment: '作业做得很棒，希望你继续保持',
    praise: '太棒了！你对本课内容掌握得非常扎实！',
  },
  {
    min: 60, level: 'good',
    comment: '作业完成较好，细节仍需改善',
    praise: '不错！本课要点已基本掌握，细节上再打磨一下。',
  },
  {
    min: 0, level: 'poor',
    comment: '作业错误较多，老师期待你的进步',
    praise: '本课还有不少地方没掌握，对照讲解再练一次吧。',
  },
];
const UNDONE = {
  level: 'none',
  comment: '作业未完成，良好习惯从小事做起！',
  praise: '把这一课的任务补齐，就能拿到你的证书啦。',
};

const lessonTitle = lessonName; // 证书上的课名与课程地图一致

// 证书编号：LXQ-课号-6位派生码（由 uid 与课号推出，学生看到的编号稳定不变）
function serialOf(uid, lessonId) {
  const s = String(uid || '') + '|' + String(lessonId || '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  return 'LXQ-' + lessonId + '-' + h.toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
}

function round1(n) { return Math.round(n * 10) / 10; }

// 某生某课的综合评价（纯计算，不改数据）
function evalLesson(store, stu, lesson) {
  const uid = stu.uid;
  const lid = lesson.id;
  const p = store.progress[uid] || null;
  const st = (p && p.lessons && p.lessons[lid]) || null;
  const sh = (p && p.sheets && p.sheets[lid]) || null;
  const mk = (p && p.marks && p.marks[lid]) || null;
  const cert = (p && p.certs && p.certs[lid]) || null;

  // 最后一次交小测 / 交任务单的时刻：老进度文件没有 certs 记录时，用它俩里较晚的那个当发证时间
  const lastQuizAt = st && (st.attempts || []).length ? (st.attempts[st.attempts.length - 1].at || null) : null;
  const lastSheetAt = sh && (sh.attempts || []).length
    ? (sh.lastAt || sh.attempts[sh.attempts.length - 1].at || null) : null;
  const derivedAt = [lastQuizAt, lastSheetAt].filter(Boolean).sort().pop() || null;

  const quizFull = (lesson.questions || []).length;
  const quizDone = !!(st && (st.attempts || []).length);
  const quizScore = st && typeof st.best === 'number' ? st.best : 0; // 取最高一次，与「最高积分」口径一致

  const hasSheet = !!lesson.sheet;
  const sheetDone = !!(sh && (sh.attempts || []).length);
  const taskMarked = !!(mk && typeof mk.score === 'number');         // 老师批过（0 分也算批过）
  const taskFull = hasSheet ? sheetTaskCount(lesson.sheet) : 0;      // 任务单满分 = 这一课有几题
  // 历史脏数据兜底：早期按 0–10 打分时出现过超出任务数的分（如四上第1课 1 题却打了 3 分），
  // 计算时封顶到任务数，别让 pct 冲过 100%
  const taskScore = taskMarked ? Math.max(0, Math.min(mk.score, taskFull)) : null;
  const pending = hasSheet && sheetDone && !taskMarked;              // 先发证：主观题待老师批阅

  const missing = [];
  if (!quizDone) missing.push('quiz');
  if (hasSheet && !sheetDone) missing.push('sheet');
  // 题数为 0 的脏课不发证（否则分母为 0、证书上全是 NaN）
  const issued = missing.length === 0 && quizFull > 0;

  // 综合得分：待批阅时只按客观题算（分母不含任务单那几题）
  let earned, total;
  if (pending) { earned = quizScore; total = quizFull; }
  else { earned = quizScore + (taskMarked ? taskScore : 0); total = quizFull + taskFull; }
  // 封顶 100：历史脏数据里 best 可能大于当前题数（题被删过）
  const pct = total > 0 ? Math.min(100, round1(earned / total * 100)) : 0;
  const stars = round1(pct / 20); // 5 星制

  const band = issued ? (BANDS.find((b) => pct >= b.min) || BANDS[BANDS.length - 1]) : UNDONE;

  return {
    lessonId: lid, title: lessonTitle(lesson), no: lesson.no || null,
    hasSheet, quizFull, quizScore, quizDone,
    taskFull, taskScore, taskMarked, sheetDone, pending,
    missing, issued,
    issuedAt: cert ? (cert.firstAt || derivedAt) : (issued ? derivedAt : null),
    serial: serialOf(uid, lid),
    earned, total, pct, stars,
    level: band.level, comment: band.comment, praise: band.praise,
  };
}

// 发证：达成条件就写 p.certs[lid]（已有记录不覆盖 firstAt，只刷新 pct/stars 快照）。
// 只改内存，调用方负责包在 store.mutate() 里并 saveProgress()。
function issueIfReady(store, stu, lesson) {
  const ev = evalLesson(store, stu, lesson);
  if (!ev.issued) return { ev, changed: false };
  const p = store.progress[stu.uid];
  if (!p) return { ev, changed: false }; // 没有成绩文件就不可能达成，兜底
  if (!p.certs) p.certs = {};
  const prev = p.certs[lesson.id];
  const now = new Date().toISOString();
  const firstAt = prev && prev.firstAt ? prev.firstAt : now;
  p.certs[lesson.id] = { firstAt, lastAt: now, pct: ev.pct, stars: ev.stars };
  ev.issuedAt = firstAt;
  const changed = !prev || prev.pct !== ev.pct || prev.stars !== ev.stars;
  return { ev, changed };
}

// 证书墙：本年级全部课（顺序同课程地图），再兜底补上本人有记录、但不属于本年级的课
// （兜底逻辑与 /api/student/scores 一致：老师把课挂到别的年级时也不至于看不到证书）
function buildCertWall(store, stu) {
  const items = [];
  const seen = {};
  const push = (l, unitTitle, grade, semester) => {
    if (seen[l.id]) return;
    seen[l.id] = 1;
    const ev = evalLesson(store, stu, l);
    ev.unitTitle = unitTitle || '';
    ev.grade = grade;
    ev.semester = semester || '';
    items.push(ev);
  };
  for (const g of store.allSemesters()) {
    if (g.grade !== stu.grade) continue;
    for (const u of g.units || []) {
      for (const l of u.lessons || []) push(l, u.title, g.grade, g.semester);
    }
  }
  const p = store.progress[stu.uid];
  if (p) {
    const extra = [];
    for (const lid of Object.keys(p.lessons || {})) extra.push(lid);
    for (const lid of Object.keys(p.sheets || {})) extra.push(lid); // 只交了任务单的学生也要出现在墙上
    for (const lid of Object.keys(p.marks || {})) extra.push(lid);
    for (const lid of Object.keys(p.certs || {})) extra.push(lid);
    for (const lid of extra) {
      const l = store.findLesson(lid);
      if (l) push(l, '', stu.grade, '');
    }
  }
  return { student: { name: stu.name, className: stu.className, grade: stu.grade }, items };
}

// 某课在课程树里的位置：{grade, semester, unitTitle}（单课证书页要显示「六年级上册 · 第一单元」）
function whereOf(store, lessonId) {
  for (const g of store.allSemesters()) {
    for (const u of g.units || []) {
      for (const l of u.lessons || []) {
        if (l.id === lessonId) return { grade: g.grade, semester: g.semester || '', unitTitle: u.title || '' };
      }
    }
  }
  return { grade: 0, semester: '', unitTitle: '' };
}

// 课程地图课卡上的证书小标：{issued, pending, pct, stars}
function certBrief(store, uid, lesson) {
  const ev = evalLesson(store, { uid }, lesson);
  return {
    issued: ev.issued, pending: ev.pending, pct: ev.pct, stars: ev.stars,
    issuedAt: ev.issuedAt, missing: ev.missing,
  };
}

// 交卷/交任务单响应里带的证书状态（只在已发证时才带完整评价，否则给"还差什么"）
function certToast(ev) {
  return {
    issued: ev.issued, pending: ev.pending, missing: ev.missing,
    pct: ev.pct, stars: ev.stars, level: ev.level,
    comment: ev.comment, praise: ev.praise, serial: ev.serial, issuedAt: ev.issuedAt,
  };
}

module.exports = {
  BANDS, UNDONE,
  evalLesson, issueIfReady, buildCertWall, certBrief, certToast, serialOf, lessonTitle, whereOf,
};
