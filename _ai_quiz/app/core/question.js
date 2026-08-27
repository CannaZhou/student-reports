// 题目加工公共函数：教师导入 / 网页新增共用
const { FRAMEWORK } = require('./framework.js');
const { buildAcceptSet } = require('./grade.js');

// 提取题干末尾嵌入的（答案：X）并剥离（兼容半角/全角括号、: ：）
function fixEmbeddedAnswer(q) {
  const m = q.match(/[（(]\s*答案\s*[:：]\s*(.+)$/);
  if (!m) return { q, answer: '' };
  const answer = m[1].replace(/[）)]\s*$/, '').trim();
  return { q: q.slice(0, m.index), answer };
}

function inferType(q) {
  const nOpts = q.options.length;
  const ans = String(q.answer || '').trim();
  if (nOpts === 0) return 'fill';
  if (nOpts === 2 && q.options.map((o) => o.text).join('') === '正确错误') return 'judge';
  if (/^[A-H](,[A-H])*$/.test(ans) && ans.includes(',')) return 'multi';
  if (/^[A-H]{2,}$/.test(ans)) return 'multi';
  if (/^[A-H]$/.test(ans)) return 'single';
  return 'fill';
}

// 原始题目 → 题库记录（src: '500'|'2000'|'custom'）
function toBankQuestion(raw, src, id) {
  let q = String(raw.q || '').trim();
  let answer = String(raw.answer || '').trim();
  if (!answer) {
    const f = fixEmbeddedAnswer(q);
    q = f.q; answer = f.answer;
  }
  const options = (raw.options || []).filter((o) => o && o.key && (o.text !== '' && o.text != null));
  const type = inferType({ ...raw, answer, q, options });
  const answers = type === 'fill' ? buildAcceptSet(answer) : [];
  const gradeable = type === 'fill' ? answers.length > 0 : /^[A-H]/i.test(answer);
  return {
    id: id || `${src}-${raw.no || Date.now()}`,
    src, no: raw.no || 0,
    chapter: raw.chapter || '',
    section: raw.section || '',
    chapterIdx: raw.chapterIdx != null ? raw.chapterIdx : -1,
    unit: raw.unit || '',
    unitTitle: raw.unitTitle || '',
    type, q, options, answer, answers, expl: raw.expl || '',
    gradeable, deleted: false,
  };
}

// 章节名 → 单元 映射（供导入题自动归类；500/2000 小节名合并，无冲突）
function buildSectionUnitMap() {
  const map = new Map();
  for (let ci = 0; ci < FRAMEWORK.length; ci++) {
    const ch = FRAMEWORK[ci];
    for (const u of ch.units) {
      const val = { unit: u.id, chapterIdx: ci, chapterTitle: ch.chapter, unitTitle: u.title };
      for (const s of u.sec500) if (!map.has(s)) map.set(s, val);
      for (const s of u.sec2000) if (!map.has(s)) map.set(s, val);
    }
  }
  return map;
}

function newCustomId() {
  return 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

module.exports = { fixEmbeddedAnswer, inferType, toBankQuestion, buildSectionUnitMap, newCustomId };
