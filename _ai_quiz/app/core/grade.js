// 判分：四种题型（单选/判断/多选/填空）
const { normalizeFill, normalizeChoice, isNumeric } = require('./normalize.js');

// 根据原始答案文本构建"可接受答案集"（填空用）
// 处理：纯答案、斜杠多义（标注/标签、4/四）、真分数守卫（3/4 不拆）、X（或Y）模式
function buildAcceptSet(answer) {
  const s = String(answer || '').trim();
  if (!s) return [];
  const out = new Set();

  // 1) 整体作为一个候选（"3/4" 走这里）
  const whole = normalizeFill(s);
  if (whole) out.add(whole);

  // 2) X（或Y） 或 X(或Y) 模式 → 拆成 X、Y（以及顿号分隔的多个Y）
  const m = s.match(/^(.+?)[（(]或([^）)]+)[）)]$/);
  if (m) {
    const a = normalizeFill(m[1]);
    if (a) out.add(a);
    for (const part of m[2].split(/[、/]/)) {
      const p = normalizeFill(part);
      if (p) out.add(p);
    }
  }

  // 3) 斜杠拆分（真分数守卫：两侧都是纯数字则视为整体，如 3/4）
  if (s.includes('/')) {
    const sides = s.split('/').map((x) => x.trim());
    const allNumeric = sides.length === 2 && sides.every((x) => isNumeric(x));
    if (!allNumeric) {
      for (const part of sides) {
        const p = normalizeFill(part);
        if (p) out.add(p);
      }
    }
  }

  return [...out];
}

// 显示用的"标准答案"
function displayAnswer(q) {
  if (q.type === 'fill') return q.answer || (q.answers || []).join(' / ');
  const text = (q.options || []).filter((o) => q.answer && q.answer.includes(o.key)).map((o) => `${o.key}.${o.text}`).join('　');
  return text ? `${q.answer} ${text}` : q.answer;
}

// 判分一道题。student: 学生作答（选择为选项键字符串，填空为文本）
// 返回 { correct, gradeable, expected }
function gradeQuestion(q, student) {
  if (!q) return { correct: false, gradeable: false, expected: '' };
  const expected = displayAnswer(q);

  if (q.type === 'fill') {
    const accept = (q.answers && q.answers.length) ? q.answers : buildAcceptSet(q.answer);
    if (!accept.length) return { correct: false, gradeable: false, expected };
    const s = normalizeFill(student);
    if (!s) return { correct: false, gradeable: true, expected };
    // 数值容错：双方都是纯数字则按数值比（20 与 20.0 与 ２０）
    if (isNumeric(s)) {
      for (const a of accept) {
        if (isNumeric(a) && parseFloat(a) === parseFloat(s)) {
          return { correct: true, gradeable: true, expected };
        }
      }
    }
    return { correct: accept.includes(s), gradeable: true, expected };
  }

  // 单选 / 判断 / 多选：字母集合匹配（norm 统一了乱序/分隔符）
  if (!q.answer) return { correct: false, gradeable: false, expected };
  const studentNorm = normalizeChoice(student);
  const answerNorm = normalizeChoice(q.answer);
  if (!studentNorm || !answerNorm) return { correct: false, gradeable: true, expected };
  return { correct: studentNorm === answerNorm, gradeable: true, expected };
}

module.exports = { buildAcceptSet, gradeQuestion, displayAnswer };
