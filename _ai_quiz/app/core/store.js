// JSON 文件存储：内存优先 + 串行写队列 + 原子写 + .bak 崩溃恢复
const fs = require('fs');
const path = require('path');

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; }
}

class Store {
  constructor(config) {
    this.dir = config.dataDir;
    this.progressDir = path.join(config.dataDir, 'progress');
    this.queue = Promise.resolve();
  }
  file(name) { return path.join(this.dir, name); }
  progressFile(name) { return path.join(this.progressDir, encodeURIComponent(name) + '.json'); }

  // 启动时把所有数据读入内存
  loadAll() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(this.progressDir, { recursive: true });
    this.bank = readJSON(this.file('bank.json'), { version: 1, builtAt: '', total: 0, questions: [] });
    this.students = readJSON(this.file('students.json'), { version: 1, studentPasswordHash: null, list: [] });
    this.teacher = readJSON(this.file('teacher.json'), {
      version: 1, passwordHash: null, mustChangePassword: true, sessionTtlHours: 12,
    });
    this.progress = {};
    for (const f of fs.readdirSync(this.progressDir)) {
      if (!f.endsWith('.json')) continue;
      const p = path.join(this.progressDir, f);
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        this.progress[data.name] = data;
      } catch (e) {
        try {
          const bak = JSON.parse(fs.readFileSync(p + '.bak', 'utf8'));
          this.progress[bak.name] = bak;
          console.log('⚠ 恢复进度备份:', f);
        } catch (e2) {
          console.error('✗ 进度文件损坏且无可用备份:', f);
        }
      }
    }
    return this;
  }

  writeAtomic(p, data) {
    const tmp = p + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, p); // rename 原子覆盖（Windows 下可覆盖）
  }

  // 串行执行会改动内存并落盘的函数（全局单队列，30人并发安全）
  mutate(fn) {
    this.queue = this.queue.then(() => fn()).catch((e) => console.error('store.mutate 出错:', e));
    return this.queue;
  }

  saveBank() { this.writeAtomic(this.file('bank.json'), this.bank); }
  saveStudents() { this.writeAtomic(this.file('students.json'), this.students); }
  saveTeacher() { this.writeAtomic(this.file('teacher.json'), this.teacher); }
  saveProgress(name) {
    const p = this.progressFile(name);
    this.writeAtomic(p, this.progress[name]);
    fs.copyFileSync(p, p + '.bak');
  }
  deleteProgressFile(name) {
    try { fs.unlinkSync(this.progressFile(name)); } catch (e) {}
  }
}

module.exports = { Store, readJSON };
