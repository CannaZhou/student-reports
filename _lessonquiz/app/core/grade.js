// 判分
// 题型: judge single multi fill flow
// 普通题：单选/判断/多选按字母集合；填空单空按 q.answer（可接受答案集）
// 多空题：fill 可带 q.blanks（多个填空），flow 在 q.flow.blanks（流程图填空）——统一走 gradeBlanks
const { normalizeText, normalizeChoice, isNumeric } = require('./normalize.js');

// 原始答案文本 → 可接受答案集（填空）
function buildAcceptSet(answer) {
  const s = String(answer || '').trim();
  if (!s) return [];
  const out = new Set();
  const whole = normalizeText(s);
  if (whole) out.add(whole);
  const m = s.match(/^(.+?)[（(]或([^）)]+)[）)]$/);
  if (m) {
    const a = normalizeText(m[1]);
    if (a) out.add(a);
    for (const part of m[2].split(/[、/]/)) {
      const p = normalizeText(part);
      if (p) out.add(p);
    }
  }
  if (s.includes('/')) {
    const sides = s.split('/').map((x) => x.trim());
    const allNum = sides.length === 2 && sides.every((x) => isNumeric(x));
    if (!allNum) {
      for (const part of sides) {
        const p = normalizeText(part);
        if (p) out.add(p);
      }
    }
  }
  return [...out];
}

function textMatches(accepts, s) {
  const n = normalizeText(s);
  if (!n) return false;
  if (accepts.includes(n)) return true;
  if (isNumeric(n)) {
    for (const a of accepts) {
      if (isNumeric(a) && parseFloat(a) === parseFloat(n)) return true;
    }
  }
  return false;
}

// 常规四题型单答判分（不含 flow / 不含多空 fill）
function gradeBasic(q, student) {
  if (q.type === 'fill') {
    const accept = q.answers && q.answers.length
      ? q.answers.map((a) => normalizeText(a)).filter(Boolean)
      : buildAcceptSet(q.answer);
    if (!accept.length) return { ok: false };
    return { ok: textMatches(accept, student) };
  }
  if (!q.answer) return { ok: false };
  const sn = normalizeChoice(student);
  const an = normalizeChoice(q.answer);
  if (!sn || !an) return { ok: false };
  return { ok: sn === an };
}

// 多空判分（fill 多空 / flow 流程图填空共用）。blanks: [{key,pts,accepts,show,expl}]
function gradeBlanks(blanks, answers) {
  const results = [];
  let gained = 0;
  for (const b of blanks || []) {
    const got = answers ? String(answers[b.key] || '') : '';
    const accept = (b.accepts || []).map((a) => normalizeText(a)).filter(Boolean);
    let ok = false;
    if (got.trim() && accept.length) ok = textMatches(accept, got);
    const pts = b.pts || 0;
    if (ok) gained += pts;
    results.push({
      key: b.key, ok, got: got.trim(),
      correct: b.show || (b.accepts && b.accepts[0]) || '',
      expl: b.expl || '', pts, gained: ok ? pts : 0,
    });
  }
  return { gained, allOk: (blanks || []).length > 0 && results.every((r) => r.ok), blanks: results };
}

// 题目里的空（fill 多空 → q.blanks；flow → q.flow.blanks）；无空返回 null
function blankListOf(q) {
  if (q.type === 'flow') return q.flow && q.flow.blanks;
  if (q.type === 'fill' && q.blanks) return q.blanks;
  return null;
}

module.exports = { buildAcceptSet, gradeBasic, gradeBlanks, blankListOf };
