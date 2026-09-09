// 答案规范化：选择/判断字母归一 + 填空/流程填空文本归一
function toHalfWidth(s) {
  return String(s)
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)) // 全角字母数字符号
    .replace(/　/g, ' '); // 全角空格
}

// 文本类答案归一：去首尾空白→全角转半角→删所有空白→去引号→小写
function normalizeText(s) {
  if (s == null) return '';
  return toHalfWidth(String(s))
    .trim()
    .replace(/[\s​ ]+/g, '')
    .replace(/['"“”‘’]/g, '')
    .toLowerCase();
}

// 选择题/判断/多选作答归一：只保留 A–H，去重排序。
// 判断文本兜底：正确/对/√/是→A；错误/错/×/否→B
function normalizeChoice(s) {
  if (s == null) return '';
  const v = String(s).trim().toUpperCase();
  if (/^(正确|对|√|是|YES|T)$/.test(v)) return 'A';
  if (/^(错误|错|×|否|NO|F)$/.test(v)) return 'B';
  const letters = v.replace(/[^A-H]/g, '');
  return [...new Set(letters.split(''))].sort().join('');
}

function isNumeric(s) {
  return /^-?\d+(\.\d+)?$/.test(s);
}

module.exports = { toHalfWidth, normalizeText, normalizeChoice, isNumeric };
