// 选题：每日 50 题（确定性种子，刷新不变）+ 分类自由练习
const crypto = require('crypto');
const CONFIG = require('../config.js');
const bank = require('./bank.js');

function hashSeed(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest().readUInt32LE(0);
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

// 抽取当日 50 题（返回 qid 数组），不修改进度
function pickDaily(progress, day) {
  const used = new Set(progress.usedSet || []);
  const fresh = bank.all().filter((q) => q.gradeable && !q.deleted && !used.has(q.id));
  const seed = hashSeed(progress.name + ':' + day + ':' + bank.version());
  shuffle(fresh, mulberry32(seed));
  const chosen = fresh.slice(0, CONFIG.daySize).map((q) => q.id);

  // 主池不足 → 从错题库按错次数补齐
  if (chosen.length < CONFIG.daySize) {
    const wrong = Object.entries(progress.wrongBank || {}).sort((a, b) => b[1] - a[1]);
    for (const [id] of wrong) {
      if (chosen.length >= CONFIG.daySize) break;
      const q = bank.getById(id);
      if (q && q.gradeable && !chosen.includes(id)) chosen.push(id);
    }
  }
  // 仍不足 → 兜底复用已做过（但未在本日）的可判分题，保证每天满 50
  if (chosen.length < CONFIG.daySize) {
    for (const q of bank.all()) {
      if (chosen.length >= CONFIG.daySize) break;
      if (q.gradeable && !chosen.includes(q.id)) chosen.push(q.id);
    }
  }
  return chosen;
}

// 分类自由练习：从单元/篇章随机抽题（不写入 usedSet）
function pickPractice(progress, { chapterIdx, unitId, limit, recent }) {
  let pool;
  if (unitId) pool = bank.getUnitQuestions(unitId);
  else if (chapterIdx != null && chapterIdx >= 0) pool = bank.getChapterQuestions(chapterIdx);
  else pool = bank.all();
  pool = pool.filter((q) => q.gradeable && !q.deleted);

  // 跳过该生近期每日做过的题
  if (recent && progress && progress.days) {
    const recentSet = new Set();
    const entries = Object.entries(progress.days).sort((a, b) => Number(a[0]) - Number(b[0]));
    for (const [, d] of entries.slice(-recent)) {
      for (const id of (d.qids || [])) recentSet.add(id);
    }
    pool = pool.filter((q) => !recentSet.has(q.id));
  }

  shuffle(pool, Math.random);
  return pool.slice(0, limit || 20).map((q) => q.id);
}

module.exports = { pickDaily, pickPractice, shuffle, hashSeed };
