// 答案规范化：选择题字母归一 + 填空题文本归一
// 供 判分(grade.js)、题库构建(tools/build_bank.js)、前端 共用

// 全角 → 半角
function toHalfWidth(s) {
  return String(s)
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)) // 全角字母数字符号
    .replace(/　/g, ' '); // 全角空格
}

// 填空题答案规范化：去首尾空白 → 全角转半角 → 删所有空白 → 去引号 → 小写
function normalizeFill(s) {
  if (s == null) return '';
  return toHalfWidth(String(s))
    .trim()
    .replace(/[\s​ ]+/g, '') // 含内部空格
    .replace(/['"“”‘’]/g, '') // 引号一律去除（答案与作答都不带引号再比）
    .toLowerCase();
}

// 选择题/判断题/多选题 作答规范化：只保留 A–H 字母，去重后排序
// 单选 "A" → "A"；多选 "B,A,D" / "ABD" / "A B,D" → "ABD"
// 判断题文本兜底映射：正确/对/√/是 → A；错误/错/×/否 → B
function normalizeChoice(s) {
  if (s == null) return '';
  let v = String(s).trim().toUpperCase();
  if (/^(正确|对|√|是|YES|T)$/.test(v)) return 'A';
  if (/^(错误|错|×|否|NO|F)$/.test(v)) return 'B';
  const letters = v.replace(/[^A-H]/g, '');
  const set = new Set(letters.split(''));
  return [...set].sort().join('');
}

// 是否为可数值比较的纯数字字符串（判分容错用：20 与 20.0 与 ２）
function isNumeric(s) {
  return /^-?\d+(\.\d+)?$/.test(s);
}

module.exports = { toHalfWidth, normalizeFill, normalizeChoice, isNumeric };
