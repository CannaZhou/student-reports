// 一次性：合并 500题 + 2000题 → app/data/bank.json
// 含：跨库去重、章节→框架单元映射、题型推断、填空答案修复（嵌入题干/斜杠多义）、答案集构建
const fs = require('fs');
const path = require('path');
const { FRAMEWORK } = require('../framework.js');
const { buildAcceptSet } = require('../app/core/grade.js');
const { normalizeFill } = require('../app/core/normalize.js');

const ROOT = path.join(__dirname, '..');          // _ai_quiz
const APP = path.join(ROOT, 'app');
const DATA = path.join(APP, 'data');
const OUT = path.join(DATA, 'bank.json');

const d500 = require(path.join(ROOT, 'data500.json')).questions;
const d2000 = require(path.join(ROOT, 'data2000.json')).questions;

// ---------- 1) 章节 → 单元映射 ----------
const unitMap = new Map(); // key: "src:section" → {unit, chapterIdx, chapterTitle, unitTitle}
const conflicts = [];
FRAMEWORK.forEach((ch, ci) => {
  for (const u of ch.units) {
    const val = { unit: u.id, chapterIdx: ci, chapterTitle: ch.chapter, unitTitle: u.title };
    for (const s of u.sec500) put('500', s, val);
    for (const s of u.sec2000) put('2000', s, val);
  }
});
function put(src, sec, val) {
  const k = src + ':' + sec;
  if (unitMap.has(k)) conflicts.push(`${k} → ${unitMap.get(k).unit}/${val.unit}`);
  else unitMap.set(k, val);
}

// ---------- 2) 题干答案修复：提取嵌入的（答案：X) 并从题干剥离 ----------
function fixEmbeddedAnswer(q) {
  const m = q.match(/[（(]\s*答案\s*[:：]\s*(.+)$/);
  if (!m) return { q, answer: '' };
  const answer = m[1].replace(/[）)]\s*$/, '').trim(); // 剥掉一个结尾右括号
  const stem = q.slice(0, m.index);                     // 题干去掉"（答案：…）"
  return { q: stem, answer };
}

// ---------- 3) 题型推断 ----------
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

// ---------- 4) 构建单条题库记录 ----------
function buildQ(raw, src) {
  const map = unitMap.get(src + ':' + raw.section);
  let q = raw.q, answer = String(raw.answer || '').trim();
  if (!answer) {
    const fixed = fixEmbeddedAnswer(q);
    q = fixed.q;
    answer = fixed.answer;
  }
  const type = inferType({ ...raw, answer, q });
  const answers = type === 'fill' ? buildAcceptSet(answer) : [];
  const gradeable = type === 'fill' ? answers.length > 0 : /^[A-H]/i.test(answer);
  return {
    id: `${src}-${raw.no}`,
    src,
    no: raw.no,
    chapter: raw.chapter,
    section: raw.section,
    chapterIdx: map ? map.chapterIdx : -1,
    unit: map ? map.unit : '',
    unitTitle: map ? map.unitTitle : '',
    type,
    q,
    options: raw.options,
    answer,
    answers,
    expl: raw.expl || '',
    gradeable,
    deleted: false,
  };
}

// ---------- 5) 跨库去重（题干规范化文本相同） ----------
function qKey(q) {
  return q.replace(/\s+/g, '').replace(/[，。、？?！!（）()：:；;]/g, '');
}

const seen = new Set();
const dups = [];
const orphans = [];
const questions = [];

for (const raw of d500) {
  const k = qKey(raw.q);
  seen.add(k);
  questions.push(buildQ(raw, '500'));
}
for (const raw of d2000) {
  const k = qKey(raw.q);
  if (seen.has(k)) { dups.push(`${raw.no}: ${raw.q.slice(0, 30)}`); continue; }
  seen.add(k);
  questions.push(buildQ(raw, '2000'));
}

// 保留已有 bank.json 里教师自定义题（重建不丢）
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (old && Array.isArray(old.questions)) {
  for (const q of old.questions) if (q.src === 'custom') questions.push(q);
}

// ---------- 6) 统计 ----------
const byType = {};
for (const q of questions) byType[q.type] = (byType[q.type] || 0) + 1;
const orphansQ = questions.filter((q) => q.chapterIdx < 0);
const ungradeable = questions.filter((q) => !q.gradeable);
const byUnit = {};
for (const q of questions) if (q.unit) byUnit[q.unit] = (byUnit[q.unit] || 0) + 1;

// ---------- 7) 写出 ----------
fs.mkdirSync(DATA, { recursive: true });
const bank = { version: 1, builtAt: new Date().toISOString().slice(0, 10), total: questions.length, questions };
fs.writeFileSync(OUT, JSON.stringify(bank, null, 1));

console.log('=== 题库构建结果 ===');
console.log('500题:', d500.length, ' 2000题:', d2000.length);
console.log('跨库去重删除:', dups.length, dups.join('; '));
console.log('合并后总题数:', questions.length);
console.log('题型分布:', JSON.stringify(byType));
console.log('单元映射冲突:', conflicts.length ? conflicts.join('; ') : '无');
console.log('未映射到单元的题(孤儿):', orphansQ.length);
if (orphansQ.length) console.log('  样例:', orphansQ.slice(0, 5).map((q) => `${q.id}[${q.chapter}${q.section}]`).join(' '));
console.log('不可判分题:', ungradeable.length, ungradeable.map((q) => q.id).join(','));
console.log('单元覆盖数:', Object.keys(byUnit).length);
console.log('已写出 →', OUT);
