// JSON 文件存储：内存优先 + 串行写队列 + 原子写 + .bak
// 数据文件都在 app/data/ 下（名单/课程/教师），成绩在 app/data/progress/<uid>.json
const fs = require('fs');
const path = require('path');

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

class Store {
  constructor(config) {
    this.config = config;
    this.dir = config.dataDir;
    this.progressDir = path.join(config.dataDir, 'progress');
    this.queue = Promise.resolve();
  }
  file(name) { return path.join(this.dir, name); }
  progressFile(uid) { return path.join(this.progressDir, encodeURIComponent(uid) + '.json'); }

  loadAll() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(this.progressDir, { recursive: true });

    // 课程（年级→册→单元→课 + 题）
    this.content = readJSON(this.file('content.json'), { version: 1, grades: [] });

    // 固定总名单（学生登录用）：{ list: [{ uid, name, className, grade, active }] }
    this.roster = readJSON(this.file('roster.json'), { version: 1, list: [] });
    this.normalizeRoster();

    // 教师口令
    this.teacher = readJSON(this.file('teacher.json'), { version: 1, passwordHash: null });

    // 【问问】全校当天提问计数：{ day:'2026-10-16', n: 12 }
    // 为什么不塞进 progress/：那样要遍历八百多份进度文件求和，这只需要一个计数器。
    // 这是内存里唯一个「重启会忘」的计数——每人配额存在各自的进度文件里，重启不丢（有意的）。
    this.agentUsage = readJSON(this.file('agent-usage.json'), { day: '', n: 0 });

    // 成绩：key=uid
    this.progress = {};
    for (const f of fs.readdirSync(this.progressDir)) {
      if (!f.endsWith('.json')) continue;
      const p = path.join(this.progressDir, f);
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        this.progress[d.uid] = d;
      } catch (e) {
        try {
          const bak = JSON.parse(fs.readFileSync(p + '.bak', 'utf8'));
          this.progress[bak.uid] = bak;
          console.log('⚠ 恢复成绩备份:', f);
        } catch (e2) { console.error('✗ 成绩文件损坏且无可用备份:', f); }
      }
    }
    return this;
  }

  writeAtomic(p, data) {
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, p); // Windows 下 rename 可原子覆盖
  }
  mutate(fn) {
    this.queue = this.queue.then(() => fn()).catch((e) => console.error('store.mutate 出错:', e));
    return this.queue;
  }

  saveContent() { this.writeAtomic(this.file('content.json'), this.content); }
  saveRoster() { this.writeAtomic(this.file('roster.json'), this.roster); }
  saveTeacher() { this.writeAtomic(this.file('teacher.json'), this.teacher); }
  saveProgress(uid) {
    if (!this.progress[uid]) return;
    const p = this.progressFile(uid);
    this.writeAtomic(p, this.progress[uid]);
    fs.copyFileSync(p, p + '.bak');
  }
  saveAgentUsage() { this.writeAtomic(this.file('agent-usage.json'), this.agentUsage); }
  deleteProgress(uid) {
    const p = this.progressFile(uid);
    try { fs.unlinkSync(p); } catch (e) {}
    // .bak 也要一起删：以前留着只是不整洁；现在进度文件里装着孩子问过的话，
    // 留着就变成「老师删了这个学生的数据，原话还躺在盘上」。
    try { fs.unlinkSync(p + '.bak'); } catch (e) {}
    delete this.progress[uid];
  }

  // 「从没交过任何东西」的学生没有进度记录 —— 恰恰是最需要问问的那批人。
  // 照 student.js 交卷/交任务单时的样子把记录补齐；调用方接着改字段、再 saveProgress。
  ensureProgress(stu) {
    let p = this.progress[stu.uid];
    if (!p) {
      p = {
        uid: stu.uid, name: stu.name, className: stu.className,
        createdAt: new Date().toISOString(), lessons: {},
      };
      this.progress[stu.uid] = p;
    }
    p.name = stu.name; p.className = stu.className;
    return p;
  }

  // ---------- 名单 ----------
  normalizeRoster() {
    const list = this.roster.list || [];
    const seen = new Set();
    for (const s of list) {
      if (!s.uid) s.uid = s.name + '｜' + (s.className || '无班级');
      s.active = s.active !== false;
      if (!s.name) continue;
      seen.add(s.uid);
    }
    this.roster.list = list;
  }
  rosterList() { return this.roster.list || []; }
  findRosterMatches(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return [];
    return this.rosterList().filter((s) => s.active && s.name && s.name.trim().toLowerCase() === n);
  }
  findRoster(uid) { return this.rosterList().find((s) => s.uid === uid) || null; }

  // ---------- 课程 ----------
  allSemesters() { return this.content.grades || []; }
  findLesson(lessonId) {
    for (const g of this.content.grades || []) {
      for (const u of g.units || []) {
        for (const l of u.lessons || []) {
          if (l.id === lessonId) return l;
        }
      }
    }
    return null;
  }
  lessonPoints(l) { return (l.questions || []).reduce((a, q) => a + (q.points || 0), 0); }

  // 某生某课成绩
  progressOf(uid) { return this.progress[uid] || null; }
  lessonStat(uid, lessonId) {
    const p = this.progress[uid];
    if (!p || !p.lessons || !p.lessons[lessonId]) return null;
    return p.lessons[lessonId];
  }
  // 某生某课「开放任务单」提交记录（无 sheets 键的老文件返回 null，零迁移）
  sheetStat(uid, lessonId) {
    const p = this.progress[uid];
    if (!p || !p.sheets || !p.sheets[lessonId]) return null;
    return p.sheets[lessonId];
  }
  lastSheetRows(uid, lessonId) {
    const s = this.sheetStat(uid, lessonId);
    if (!s || !Array.isArray(s.attempts) || !s.attempts.length) return [];
    return s.attempts[s.attempts.length - 1].rows || [];
  }
  // 某生某课「证书颁发」记录（p.certs[lessonId]={firstAt,lastAt,pct,stars}；老文件无该键 → null）
  certStat(uid, lessonId) {
    const p = this.progress[uid];
    if (!p || !p.certs || !p.certs[lessonId]) return null;
    return p.certs[lessonId];
  }
  // 某生某课「任务单教师评分」记录（一题 1 分、满分＝本课任务数，存于 p.marks；老文件无该键 → null）
  // 形状：{score, at, tasks?} —— tasks 是逐题判定 {任务号: true|false}「一题一改赋分」（2026-09-29）。
  markStat(uid, lessonId) {
    const p = this.progress[uid];
    if (!p || !p.marks || !p.marks[lessonId]) return null;
    return p.marks[lessonId];
  }
  // 某生某课的「逐题判定」，已按本课任务数过滤掉越界的任务号。
  // 为什么要过滤：任务号可能因为后来改任务单而失效（比如 6-1-4 从 6 个板块并成 3 个任务），
  // 留着这种孤儿键会让"打勾的个数"超过本课满分——证书那边钳过、期末汇总那边没钳，两边就对不上了。
  taskMarks(uid, lessonId, taskFull) {
    const m = this.markStat(uid, lessonId);
    const t = m && m.tasks;
    if (!t || typeof t !== 'object') return null;
    const out = {};
    Object.keys(t).forEach((k) => {
      const no = Number(k);
      if (!Number.isInteger(no) || no < 1 || (taskFull && no > taskFull)) return;
      out[no] = !!t[k];
    });
    return Object.keys(out).length ? out : null;
  }

  // ---------- 【问问】的配额与问答记录 ----------
  // 某生「今天问了几次」：{day, n}；老文件没这个键 → null（零迁移）
  askStat(uid) {
    const p = this.progress[uid];
    return (p && p.ask) || null;
  }
  // 某生某课的问答记录：[{q, a, ts}]；没有 → []
  askLog(uid, lessonId) {
    const p = this.progress[uid];
    const m = p && p.asks;
    return (m && m[lessonId]) || [];
  }
  // 全校当天已用次数（跨天自动归零）
  usageToday(day) {
    if (!this.agentUsage || this.agentUsage.day !== day) {
      this.agentUsage = { day, n: 0 };
    }
    return this.agentUsage.n || 0;
  }
}

module.exports = { Store, readJSON };
