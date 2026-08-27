// 扫描 bank.json：找 解析与标答明显冲突 的疑似笔误（高置信信号，精准优先）
// 信号A：解析明确写"故选X/答案是X/正确答案是X"，且声明的字母与标答完全无交集
// 信号B：单选正面题，解析完整包含某选项原文(≥4字)，该选项≠标答，
//        且 标答选项原文不在解析中、关键词与解析无重叠（排除"换说法支持标答"的干扰）
const fs = require('fs');
const path = require('path');

const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/data/bank.json'), 'utf8'));
const arr = Array.isArray(bank) ? bank : (bank.questions || bank.list || []);

const norm = s => (s || '').replace(/\s+/g, '');
const exclusionRe = /不包括|不属于|不是|错误的是|不能|不具备|不包含|无需|不用|哪些不是|以下哪[项个]?不是|无关|不可取|不适合|不擅长|不一样/;
const letterDeclRe = /(?:故选|答案选|答案是|答案为|正确答案[是为]|正确选项[是为]|应选|应选择|选择|选)([A-D])/g;

function getMarked(it) {
  if (Array.isArray(it.answers) && it.answers.length) return it.answers;
  if (it.answer) return String(it.answer).split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// 两个文本是否有 ≥len 的公共连续子串（粗略关键词重叠）
function shareKeyword(a, b, len) {
  const set = new Set();
  for (let i = 0; i + len <= a.length; i++) set.add(a.slice(i, i + len));
  for (let i = 0; i + len <= b.length; i++) if (set.has(b.slice(i, i + len))) return true;
  return false;
}

const flags = [];
for (const it of arr) {
  if (!it || it.deleted || !it.q) continue;
  const opts = (it.options || []).filter(o => o && o.key && o.text);
  const expl = norm(it.expl);
  if (!expl || opts.length === 0) continue;
  const marked = getMarked(it);
  if (!marked.length) continue;
  const isSingle = marked.length === 1;
  const isExclusion = exclusionRe.test(it.q);

  // 信号A：解析明确声明的字母
  const declared = [];
  let m;
  letterDeclRe.lastIndex = 0;
  while ((m = letterDeclRe.exec(expl)) !== null) declared.push(m[1]);
  const declUnique = [...new Set(declared)];
  const Aconflict = declUnique.length > 0 && !declUnique.some(l => marked.includes(l));

  // 信号B：单选正面题，解析完整包含唯一选项原文
  let Bconflict = false, implied = null;
  if (isSingle && !isExclusion) {
    const matched = opts.filter(o => {
      const t = norm(o.text);
      return t.length >= 4 && expl.includes(t);
    }).map(o => o.key);
    if (matched.length === 1) {
      const k = matched[0];
      if (!marked.includes(k)) {
        const markOpt = opts.find(o => o.key === marked[0]);
        const mt = markOpt ? norm(markOpt.text) : '';
        const markTextInExpl = mt.length >= 2 && expl.includes(mt);
        // 关键词重叠 → 解析可能在换说法支持标答 → 不判为冲突
        if (!markTextInExpl && !shareKeyword(mt, expl, 2)) {
          Bconflict = true;
          implied = k;
        }
      }
    }
  }

  if (Aconflict || Bconflict) {
    flags.push({
      id: it.id, q: it.q, chapter: it.chapter, unit: it.unit,
      marked: marked.join(','),
      reason: Aconflict ? `解析明确说选${declUnique.join('/')}` : `解析指向选项${implied}(选项原文完整出现)`,
      opts: opts.map(o => `${o.key}.${o.text}`).join(' | '),
      expl: it.expl
    });
  }
}

console.log(`共扫描 ${arr.length} 题，发现 ${flags.length} 条疑似笔误：\n`);
for (const f of flags) {
  console.log(`【${f.id}】${f.chapter} ${f.unit}   (${f.reason})`);
  console.log(`  题干: ${f.q}`);
  console.log(`  选项: ${f.opts}`);
  console.log(`  标答: ${f.marked}`);
  console.log(`  解析: ${f.expl}`);
  console.log('');
}
