// 解析题库 docx 提取的纯文本，生成结构化 JSON
const fs = require('fs');
const base = 'F:/cursor20260624/_ai_quiz/';

// 解码 XML/HTML 实体（注意 &amp; 最后解码，避免二次解码）
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// 把英文直引号 " " 规范为中文引号 “ ”（逐行交替配对，题库引号均成对）
function normalizeQuotes(s) {
  let out = '', open = true;
  for (const ch of s) {
    if (ch === '"') {
      out += open ? '“' : '”';
      open = !open;
    } else {
      out += ch;
    }
  }
  return out;
}

// 剥离行内残留的 OOXML 标签（如 <w:autoSpaceDE/>、<w:rPr>…</w:rPr>）
// 只保留 <w:t>…</w:t> 内的可见文本（如文末"本题库仅供学习参考…"）
function stripXmlTags(line) {
  if (!line.includes('<w:')) return line;
  const texts = [];
  const re = /<w:t(?=[\s>])[\s\S]*?>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = re.exec(line))) texts.push(m[1]);
  if (texts.length) return texts.join('');
  return line.replace(/<[^>]*>/g, '').trim();
}

function parseFile(txtPath, label) {
  const lines = fs.readFileSync(txtPath, 'utf8').split('\n').map(decodeEntities).map(stripXmlTags).map(normalizeQuotes);
  let curChapter = '';   // 【AI通识知识】 等
  let curSection = '';   // ■ AI三要素 等
  const questions = [];
  let cur = null;

  for (let raw of lines) {
    let line = raw.replace(/\uFEFF/, '').trim();
    if (!line) continue;
    // \u8DF3\u8FC7\u6E90\u6587\u6863\u6587\u672B\u7684\u7248\u6743\u8BF4\u660E\uFF08\u4E0D\u5C5E\u4E8E\u4EFB\u4F55\u9898\u76EE\uFF09
    if (line.includes('\u672C\u9898\u5E93\u4EC5\u4F9B\u5B66\u4E60\u53C2\u8003') || line.includes('\u9898\u5E93\u6301\u7EED\u66F4\u65B0\u4E2D')) continue;

    if (line.startsWith('【') && line.endsWith('】')) { curChapter = line; curSection = ''; continue; }
    if (line.startsWith('■')) { curSection = line.replace(/^■\s*/, '').trim(); continue; }
    if (/^共\s*\d+\s*题/.test(line)) continue;

    // 题目行: "N. 题干（答案：X）" 可能选项也同行? 一般题干一行
    const qMatch = line.match(/^(\d+)\.\s*(.*)$/);
    if (qMatch) {
      if (cur) questions.push(cur);
      const qn = parseInt(qMatch[1], 10);
      const rest = qMatch[2];
      const ansMatch = rest.match(/（答案：([^）]+)）\s*$/);
      const ans = ansMatch ? ansMatch[1] : '';
      let body = rest;
      if (ansMatch) body = rest.slice(0, ansMatch.index);
      cur = {
        no: qn, chapter: curChapter, section: curSection,
        q: body.trim(), options: [], answer: ans, expl: ''
      };
      continue;
    }

    if (!cur) continue;

    // 选项行
    const optMatch = line.match(/^([A-H])\.\s*(.*)$/);
    if (optMatch && cur.options.length < 8) {
      cur.options.push({ key: optMatch[1], text: optMatch[2].trim() });
      continue;
    }
    // 解析行
    if (line.startsWith('解析：')) { cur.expl = line.replace(/^解析：/, '').trim(); continue; }

    // 题目描述折行等，追加到题干
    cur.q += ' ' + line;
  }
  if (cur) questions.push(cur);

  // 类型推断
  const byType = { judge: [], single: [], multi: [], fill: [] };
  for (const q of questions) {
    const ans = q.answer;
    const nOpts = q.options.length;
    if (nOpts === 0) byType.fill.push(q);
    else if (nOpts === 2 && /^(正确|对|√|是|对\s)/.test(ans) || (ans === '正确') || (ans === '错误')) byType.judge.push(q);
    else if (/^[A-H]{2,}$/.test(ans)) byType.multi.push(q);
    else if (ans.length >= 1 && /^[A-H]$/.test(ans)) byType.single.push(q);
    else byType.fill.push(q);
  }
  return { label, questions, byType };
}

const r500 = parseFile(base + 'p500.txt', '500题');
const r2000 = parseFile(base + 'p2000.txt', '2000题');

fs.writeFileSync(base + 'data500.json', JSON.stringify(r500, null, 1));
fs.writeFileSync(base + 'data2000.json', JSON.stringify(r2000, null, 1));

console.log('=== 500题 ===');
console.log('总题数:', r500.questions.length);
console.log('判断题:', r500.byType.judge.length, '单选:', r500.byType.single.length, '多选:', r500.byType.multi.length, '填空:', r500.byType.fill.length);
console.log('章节:', [...new Set(r500.questions.map(q => q.chapter))].join(' | '));
const secCount = {};
r500.questions.forEach(q => secCount[q.section] = (secCount[q.section]||0)+1);
console.log('小节题数:', JSON.stringify(secCount, null, 0));

console.log('\n=== 2000题 ===');
console.log('总题数:', r2000.questions.length);
console.log('判断题:', r2000.byType.judge.length, '单选:', r2000.byType.single.length, '多选:', r2000.byType.multi.length, '填空:', r2000.byType.fill.length);
const secCount2 = {};
r2000.questions.forEach(q => secCount2[q.section] = (secCount2[q.section]||0)+1);
console.log('小节题数:', JSON.stringify(secCount2, null, 0));

// 未归类题目排查
const untyped500 = r500.questions.filter(q => !q.answer);
console.log('\n500题无答案的题数:', untyped500.length);
if (untyped500.length) console.log('样例:', untyped500.slice(0,3).map(q => q.no + ':' + q.q.slice(0,30)));
