// docx 题库文本 → 题目数组（移植自 _ai_quiz/parse.js，增强答案提取）
const { fixEmbeddedAnswer } = require('../question.js');

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
function normalizeQuotes(s) {
  let out = '', open = true;
  for (const ch of s) {
    if (ch === '"') { out += open ? '“' : '”'; open = !open; }
    else out += ch;
  }
  return out;
}

// 从任意 docx 文本（含残留 OOXML 标签）解析题目
function parseQuestionsFromText(text) {
  const lines = String(text || '').split(/\r?\n/)
    .map(decodeEntities)
    .map(normalizeQuotes)
    .map((l) => l.replace(/<[^>]*>/g, '').trim())
    .filter((l) => l && !l.includes('本题库仅供学习参考') && !l.includes('题库持续更新中'));

  let curChapter = '', curSection = '';
  const questions = [];
  let cur = null;

  for (const line of lines) {
    if (line.startsWith('【') && line.endsWith('】')) { curChapter = line; curSection = ''; continue; }
    if (line.startsWith('■')) { curSection = line.replace(/^■\s*/, '').trim(); continue; }
    if (/^共\s*\d+\s*题/.test(line)) continue;

    const qMatch = line.match(/^(\d+)[.、]\s*(.*)$/);
    if (qMatch) {
      if (cur) questions.push(cur);
      const no = parseInt(qMatch[1], 10);
      const rest = qMatch[2];
      // 提取行尾（答案：X）——兼容全/半角括号
      const ansMatch = rest.match(/[（(]\s*答案\s*[:：]\s*(.+)$/);
      let answer = '';
      let body = rest;
      if (ansMatch) {
        answer = ansMatch[1].replace(/[）)]\s*$/, '').trim();
        body = rest.slice(0, ansMatch.index).trim();
      }
      // 题干本身仍可能内嵌（答案：X）
      const fixed = fixEmbeddedAnswer(body);
      if (fixed.answer && !answer) answer = fixed.answer;
      if (fixed.q !== body) body = fixed.q;
      cur = { no, chapter: curChapter, section: curSection, q: body.trim(), options: [], answer, expl: '' };
      continue;
    }

    if (!cur) continue;
    const optMatch = line.match(/^([A-H])[.、]\s*(.*)$/);
    if (optMatch && cur.options.length < 8) { cur.options.push({ key: optMatch[1], text: optMatch[2].trim() }); continue; }
    if (line.startsWith('解析：') || line.startsWith('解析:')) { cur.expl = line.replace(/^解析[:：]/, '').trim(); continue; }
    cur.q += ' ' + line;
  }
  if (cur) questions.push(cur);
  return questions;
}

module.exports = { parseQuestionsFromText };
