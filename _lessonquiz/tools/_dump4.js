// 把第4课的 docx / pptx 摊成纯文本（表格按行输出、图片位置标出来），只为备课看内容用。
// 用法：node tools/_dump4.js "f:/桌面/第4课 算法的程序体验.docx"
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function unzip(z, member) {
  return execFileSync('unzip', ['-p', z, member], { maxBuffer: 1 << 28 }).toString('utf8');
}
function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// 一个 <w:p> → 一行文本；<w:drawing>/<w:pict> → [图]
function paraText(p) {
  let t = '';
  for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:drawing[\s/>]|<w:pict[\s/>]|<w:br\s*\/>|<w:tab\s*\/>/g)) {
    if (m[1] != null) t += decode(m[1]);
    else if (m[0].startsWith('<w:drawing') || m[0].startsWith('<w:pict')) t += '[图]';
    else if (m[0].startsWith('<w:br')) t += ' / ';
    else t += '\t';
  }
  return t.trim();
}

// 表格：按行格子用 | 分隔
function tableText(tbl) {
  const out = [];
  for (const tr of tbl.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)) {
    const cells = [];
    for (const tc of tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)) {
      const ps = [...tc[0].matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)].map((x) => paraText(x[0])).filter(Boolean);
      cells.push(ps.join(' ¶ '));
    }
    out.push('| ' + cells.join(' | ') + ' |');
  }
  return out.join('\n');
}

function docx(z) {
  const xml = unzip(z, 'word/document.xml');
  const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [, xml])[1];
  const lines = [];
  // 按顶层顺序扫 p / tbl
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g;
  for (const m of body.matchAll(re)) {
    if (m[0].startsWith('<w:tbl')) lines.push('\n--- 表格 ---\n' + tableText(m[0]) + '\n--- 表格完 ---\n');
    else { const t = paraText(m[0]); if (t) lines.push(t); }
  }
  return lines.join('\n');
}

function pptx(z) {
  const names = execFileSync('unzip', ['-Z1', z], { maxBuffer: 1 << 26 }).toString('utf8').split('\n')
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => (+a.match(/(\d+)/)[1]) - (+b.match(/(\d+)/)[1]));
  const out = [];
  names.forEach((nm, i) => {
    const xml = unzip(z, nm);
    const texts = [];
    for (const sp of xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)) texts.push(decode(sp[1]));
    // 形状顺序大致就是阅读顺序；把同一段的拼接起来
    out.push('\n=========== 第 ' + (i + 1) + ' 页 ===========\n' + texts.join('\n'));
  });
  return out.join('\n');
}

const f = process.argv[2];
const ext = path.extname(f).toLowerCase();
const txt = ext === '.docx' ? docx(f) : pptx(f);
fs.writeFileSync(path.join(__dirname, '_dump4_' + ext.slice(1) + '.txt'), txt, 'utf8');
console.log(txt);
