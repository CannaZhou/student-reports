// docx 导入：解压 → 提取文本 → 解析题目
const JSZip = require('../../lib/jszip.min.js');
const { parseQuestionsFromText } = require('./parse_lines.js');

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

async function docxToText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('不是有效的 docx 文件（缺少 word/document.xml）');
  const xml = await entry.async('string');
  // 按段落拆分，提取各段内 <w:t> 文本
  const paras = xml.split('</w:p>');
  const lines = [];
  for (const p of paras) {
    const texts = [];
    const re = /<w:t(?=[\s>])[\s\S]*?>([\s\S]*?)<\/w:t>/g;
    let m;
    while ((m = re.exec(p))) texts.push(m[1]);
    lines.push(texts.join(''));
  }
  return lines.map(decodeEntities).join('\n');
}

async function importDocx(buffer) {
  const text = await docxToText(buffer);
  return parseQuestionsFromText(text);
}

module.exports = { importDocx, docxToText };
