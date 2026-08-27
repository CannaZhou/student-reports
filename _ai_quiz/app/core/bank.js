// 题库内存索引：启动时由 store.bank 构建；教师导入后需 rebuild
const { FRAMEWORK } = require('./framework.js');

let bank = null;
const byId = new Map();
const byUnit = new Map();      // unitId -> q[]
const byChapter = new Map();   // chapterIdx -> q[]
const byType = new Map();      // type -> q[]

function build(bankData) {
  bank = bankData;
  byId.clear(); byUnit.clear(); byChapter.clear(); byType.clear();
  for (const q of bankData.questions) {
    byId.set(q.id, q);
    if (q.deleted) continue;
    if (q.unit) { if (!byUnit.has(q.unit)) byUnit.set(q.unit, []); byUnit.get(q.unit).push(q); }
    if (q.chapterIdx >= 0) { if (!byChapter.has(q.chapterIdx)) byChapter.set(q.chapterIdx, []); byChapter.get(q.chapterIdx).push(q); }
    if (q.type) { if (!byType.has(q.type)) byType.set(q.type, []); byType.get(q.type).push(q); }
  }
}

function getById(id) { return byId.get(id) || null; }
function all() { return bank.questions; }
function version() { return bank.version; }
function total() { return bank.questions.filter((q) => !q.deleted).length; }

function getUnitQuestions(unitId) { return byUnit.get(unitId) || []; }
function getChapterQuestions(chapterIdx) { return byChapter.get(chapterIdx) || []; }
function getTypeQuestions(type) { return byType.get(type) || []; }

// 前端分类树：6篇章 × 单元（含题量）
function categories() {
  return FRAMEWORK.map((ch, ci) => ({
    chapterIdx: ci,
    title: ch.chapter,
    intro: ch.intro,
    units: ch.units.map((u) => ({
      id: u.id,
      title: u.title,
      count: (byUnit.get(u.id) || []).length,
    })),
  }));
}

function typeCounts() {
  const o = {};
  for (const q of all()) if (!q.deleted) o[q.type] = (o[q.type] || 0) + 1;
  return o;
}

module.exports = {
  build, getById, all, version, total,
  getUnitQuestions, getChapterQuestions, getTypeQuestions,
  categories, typeCounts, FRAMEWORK,
};
