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
  deleteProgress(uid) {
    try { fs.unlinkSync(this.progressFile(uid)); } catch (e) {}
    delete this.progress[uid];
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
  // 某生某课「任务单教师评分」记录（教师评 0–10 整数，存于 p.marks；老文件无该键 → null）
  markStat(uid, lessonId) {
    const p = this.progress[uid];
    if (!p || !p.marks || !p.marks[lessonId]) return null;
    return p.marks[lessonId];
  }
}

module.exports = { Store, readJSON };
