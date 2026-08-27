// 共享的 docx 生成辅助函数
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageNumber, PageBreak
} = require('docx');

// 中文常用字体配置：正文宋体、标题黑体/微软雅黑
const FONT = '宋体';
const FONT_HEAD = '黑体';

function tr(text, opts = {}) {
  return new TextRun({
    text: String(text),
    bold: opts.bold || false,
    size: opts.size || 21, // 半磅，21 = 10.5pt
    font: opts.font || FONT,
    italics: opts.italics || false,
    ...(opts.color ? { color: opts.color } : {}),
  });
}

// 段落：支持字符串、多段 runs（用数组）、多个参数
function para(text, opts = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(tr(text, opts));
  } else if (Array.isArray(text)) {
    text.forEach(t => {
      if (typeof t === 'string') runs.push(tr(t));
      else runs.push(t); // 已是 TextRun 实例，直接使用
    });
  }
  return new Paragraph({
    children: runs,
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: opts.spacing || { line: 320, after: 60 },
    ...(opts.indent ? { indent: opts.indent } : {}),
    ...(opts.heading ? { heading: opts.heading } : {}),
  });
}

// 正文段落（首行缩进）
function body(text, opts = {}) {
  return para(text, {
    indent: { firstLine: 420, firstLineChars: 200 },
    spacing: { line: 320, after: 80 },
    ...opts,
  });
}

// 各级标题
function h1(text) {
  return new Paragraph({
    children: [tr(text, { bold: true, size: 30, font: FONT_HEAD, color: '1F4E79' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 200 },
  });
}
function h2(text) {
  return new Paragraph({
    children: [tr(text, { bold: true, size: 26, font: FONT_HEAD, color: '2E74B5' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 240, after: 120 },
  });
}
function h3(text) {
  return new Paragraph({
    children: [tr(text, { bold: true, size: 24, font: FONT_HEAD, color: '404040' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 160, after: 80 },
  });
}
function h4(text) {
  return new Paragraph({
    children: [tr(text, { bold: true, size: 22, font: FONT, color: '333333' })],
    spacing: { before: 120, after: 60 },
  });
}

// 单元格文本
function cellText(text, opts = {}) {
  return new Paragraph({
    children: [tr(text, {
      bold: opts.bold || false,
      size: opts.size || 20,
      font: opts.font || FONT,
      ...(opts.color ? { color: opts.color } : {}),
    })],
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: { line: 260, after: 0 },
  });
}

// 创建表格：headerRow + rows，每格内容可为字符串或数组（多行）
function makeTable(headers, rows, opts = {}) {
  const colWidths = opts.colWidths || Array(headers.length).fill(2500);
  const headerCells = headers.map((h, i) =>
    new TableCell({
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: { fill: '2E74B5', type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [cellText(h, { bold: true, color: 'FFFFFF', alignment: AlignmentType.CENTER, size: opts.headerSize || 20 })],
    })
  );
  const dataCells = rows.map((row, ri) =>
    new TableRow({
      children: row.map((c, ci) => {
        const content = Array.isArray(c) ? c : [c];
        return new TableCell({
          width: { size: colWidths[ci], type: WidthType.DXA },
          shading: opts.striped && ri % 2 === 1 ? { fill: 'EDF3FA', type: ShadingType.CLEAR, color: 'auto' } : undefined,
          margins: { top: 50, bottom: 50, left: 80, right: 80 },
          children: content.map(line =>
            cellText(line, {
              alignment: opts.centerCols && opts.centerCols.includes(ci) ? AlignmentType.CENTER : AlignmentType.LEFT,
              size: opts.bodySize || 20,
              bold: (opts.boldCols && opts.boldCols.includes(ci)) || false,
            })
          ),
        });
      }),
    })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'C8C8C8' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'C8C8C8' },
    },
    rows: [new TableRow({ children: headerCells }), ...dataCells],
  });
}

// 颜色块标题（用于单元标题）
function unitTitle(text) {
  return new Paragraph({
    children: [tr(text, { bold: true, size: 25, font: FONT_HEAD, color: 'FFFFFF' })],
    spacing: { before: 160, after: 100 },
    shading: { fill: '2E74B5', type: ShadingType.CLEAR, color: 'auto' },
    indent: { left: 120 },
  });
}

async function saveDoc(doc, filePath) {
  const buffer = await Packer.toBuffer(doc);
  require('fs').writeFileSync(filePath, buffer);
  console.log('已生成:', filePath);
}

module.exports = {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, Header, Footer, PageNumber, PageBreak,
  tr, para, body, h1, h2, h3, h4, makeTable, unitTitle, saveDoc,
};
