const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const docx = require('docx');
const JSZip = require('jszip');

const {
  Document, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle,
} = docx;

// ============================================================
// 配置
// ============================================================
const CONFIG = {
  excelPath: 'F:\\桌面\\桌面所有图标\\Ai+信息科技应用\\积分兑换明细\\2025.9claude名使用具体明细.xlsx',
  awardPath: 'F:\\桌面\\桌面所有图标\\Ai+信息科技应用\\积分兑换明细\\站前小学学生获奖统计(2017至2026年）具体明细.xlsx',
  outputDir: path.join(__dirname, 'output'),
  outputFile: '信息科技成长记录单（含获奖）.docx',
  previousOutput: path.join(__dirname, 'output', '信息科技成长记录单（含获奖）.docx'),
  className: '2021级4班',
  sheetName: '2025.9claude名使用',
};

// ============================================================
// 列索引
// ============================================================
const COL = {
  ID: 0, NAME: 1,
  JF_PS_5S: 4, JF_QM_5S: 3, YH_5S: 5, TOTAL_5S: 6, BZ_5S: 7,
  JF_PS_5X: 11, JF_QM_5X: 10, YH_5X: 12, TOTAL_5X: 13, BZ_5X: 14,
};

// ============================================================
// 学期
// ============================================================
const SEMESTERS = [
  { label: '三年级上', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
  { label: '三年级下', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
  { label: '四年级上', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
  { label: '四年级下', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
  { label: '五年级上', ps: COL.JF_PS_5S, qm: COL.JF_QM_5S, yh: COL.YH_5S, total: COL.TOTAL_5S, bz: COL.BZ_5S },
  { label: '五年级下', ps: COL.JF_PS_5X, qm: COL.JF_QM_5X, yh: COL.YH_5X, total: COL.TOTAL_5X, bz: COL.BZ_5X },
  { label: '六年级上', ps: null, qm: null, yh: null, total: null, bz: null },
  { label: '六年级下', ps: null, qm: null, yh: null, total: null, bz: null },
];

// ============================================================
// 样式
// ============================================================
const FONT = '等线';
const FONT_SIZE_TITLE = 44;
const FONT_SIZE_SUBTITLE = 22;
const FONT_SIZE_NAME = 20;
const FONT_SIZE_TABLE = 18;
const FONT_SIZE_TABLE_HEADER = 18;
const FONT_SIZE_SECTION = 18;
const FONT_SIZE_HONOR = 16;

const PAGE_WIDTH = 11906;
const PAGE_MARGIN_LEFT = 1800;
const PAGE_MARGIN_RIGHT = 1800;
const TABLE_AVAIL = PAGE_WIDTH - PAGE_MARGIN_LEFT - PAGE_MARGIN_RIGHT;
const COL_WIDTHS = [
  Math.round(TABLE_AVAIL * 0.167), Math.round(TABLE_AVAIL * 0.167),
  Math.round(TABLE_AVAIL * 0.167), Math.round(TABLE_AVAIL * 0.167),
  Math.round(TABLE_AVAIL * 0.166), Math.round(TABLE_AVAIL * 0.166),
];
const TABLE_HEADERS = ['学期', '平时积分', '期末积分', '已兑换', '总积分', '备注'];

// ============================================================
// 辅助
// ============================================================
function safeStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function cleanName(raw) {
  return safeStr(raw).replace(/^\d+班/, '').trim();
}

function createTextRun(text, opts = {}) {
  const { bold, size = FONT_SIZE_TABLE, font = FONT } = opts;
  return new TextRun({ text: safeStr(text), bold: bold || false, size: size, font: font });
}

function createCell(text, opts = {}) {
  const { bold = false, size = FONT_SIZE_TABLE, alignment = AlignmentType.CENTER, columnSpan, width } = opts;
  const cellOpts = {
    children: [new Paragraph({ children: [createTextRun(text, { bold, size })], alignment })],
    verticalAlign: 'center',
    width: width ? { size: width, type: WidthType.DXA } : undefined,
  };
  if (columnSpan) cellOpts.columnSpan = columnSpan;
  return new TableCell(cellOpts);
}

function createHonorCell(text) {
  return new TableCell({
    columnSpan: 6,
    children: [new Paragraph({
      children: [createTextRun(text, { size: FONT_SIZE_HONOR })],
      alignment: AlignmentType.LEFT,
      spacing: { line: 240, lineRule: 'auto' },
    })],
  });
}

// ============================================================
// 读取数据
// ============================================================
function readStudents(filePath) {
  const wb = XLSX.readFile(filePath);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[CONFIG.sheetName], { header: 1 });
  const students = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[COL.NAME];
    if (!name) continue;
    students.push({ id: row[COL.ID], name: safeStr(name), data: row });
  }
  return students;
}

function readAwards(filePath) {
  const wb = XLSX.readFile(filePath);
  const awardMap = {};

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    if (rows.length < 2) continue;
    const is2026 = sheetName === '2026年';

    // 找表头行
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = rows[i];
      if (!r) continue;
      const s = JSON.stringify(r);
      if ((s.includes('学生姓名') || s.includes('"姓名"')) && r.length >= 4) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) continue;

    if (is2026) {
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0] || isNaN(Number(row[0]))) continue;
        const rawName = safeStr(row[4] || '');
        const honorName = safeStr(row[6] || '');
        if (!rawName || !honorName) continue;
        const name = cleanName(rawName);
        if (!awardMap[name]) awardMap[name] = [];
        awardMap[name].push(honorName);
      }
    } else {
      const headerRow = rows[headerIdx];
      const cm = {};
      for (let j = 0; j < headerRow.length; j++) {
        const h = safeStr(headerRow[j]);
        if (h === '学生姓名' || h === '姓名') cm.name = j;
        if (h === '比赛名称') cm.comp = j;
        if (h === '等次') cm.level = j;
        if (h === '组别' || h === '项目') cm.group = j;
      }
      if (cm.name === undefined || cm.comp === undefined) continue;

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0] || isNaN(Number(row[0]))) continue;
        const sn = safeStr(row[cm.name] || '');
        const cn = safeStr(row[cm.comp] || '');
        if (!sn || !cn) continue;
        const lv = cm.level !== undefined ? safeStr(row[cm.level] || '') : '';
        const gp = cm.group !== undefined ? safeStr(row[cm.group] || '') : '';
        const txt = `${cn}${gp ? ' ' + gp : ''}${lv ? ' ' + lv : ''}`;
        if (!awardMap[sn]) awardMap[sn] = [];
        awardMap[sn].push(txt);
      }
    }
  }
  return awardMap;
}

// ============================================================
// 构建学生表格
// ============================================================
function buildStudentTable(student, awards) {
  const row = student.data;
  const rows = [];

  // Row 1: 姓名 + 班级
  rows.push(new TableRow({
    tableHeader: true,
    children: [new TableCell({
      columnSpan: 6,
      children: [new Paragraph({
        children: [createTextRun(`姓名：${student.name}　　班级：${CONFIG.className}`, { size: FONT_SIZE_NAME })],
        alignment: AlignmentType.CENTER,
      })],
      verticalAlign: 'center',
    })],
  }));

  // Row 2: 表头
  rows.push(new TableRow({
    tableHeader: true,
    children: TABLE_HEADERS.map((h, i) => createCell(h, { bold: true, size: FONT_SIZE_TABLE_HEADER, width: COL_WIDTHS[i] })),
  }));

  // Rows 3-10: 学期
  for (const sem of SEMESTERS) {
    const cells = [createCell(sem.label, { size: FONT_SIZE_TABLE, width: COL_WIDTHS[0] })];
    const fields = ['ps', 'qm', 'yh', 'total', 'bz'];
    for (const f of fields) {
      let val;
      if (sem[f] === '/') val = '/';
      else if (sem[f] === null) val = '';  // 六年级留空
      else val = safeStr(row[sem[f]]);
      cells.push(createCell(val, { size: FONT_SIZE_TABLE, width: COL_WIDTHS[fields.indexOf(f) + 1] }));
    }
    rows.push(new TableRow({ children: cells }));
  }

  // 荣誉
  rows.push(new TableRow({
    children: [new TableCell({
      columnSpan: 6,
      children: [new Paragraph({ children: [createTextRun('荣誉', { size: FONT_SIZE_SECTION })], alignment: AlignmentType.CENTER })],
    })],
  }));
  for (let i = 0; i < 8; i++) {
    const text = i < awards.length ? `${i + 1}. ${awards[i]}` : `${i + 1}.`;
    rows.push(new TableRow({ children: [createHonorCell(text)] }));
  }

  // 其他
  rows.push(new TableRow({
    children: [new TableCell({
      columnSpan: 6,
      children: [new Paragraph({ children: [createTextRun('其他', { size: FONT_SIZE_SECTION })], alignment: AlignmentType.CENTER })],
    })],
  }));
  for (let i = 1; i <= 8; i++) {
    rows.push(new TableRow({
      children: [new TableCell({
        columnSpan: 6,
        children: [new Paragraph({ children: [createTextRun(`${i}.`, { size: FONT_SIZE_SECTION })], alignment: AlignmentType.LEFT })],
      })],
    }));
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    },
  });
}

function buildStudentPage(student, awardMap, isFirst) {
  const children = [];
  if (!isFirst) children.push(new docx.PageBreak());
  children.push(new Paragraph({
    children: [createTextRun('信息科技成长记录单', { bold: true, size: FONT_SIZE_TITLE })],
    alignment: AlignmentType.CENTER, spacing: { after: 80 },
  }));
  children.push(new Paragraph({
    children: [createTextRun('成长藏在每一次的"努力+习惯+爱心"里', { size: FONT_SIZE_SUBTITLE })],
    alignment: AlignmentType.CENTER, spacing: { after: 100 },
  }));
  const awards = awardMap[student.name] || [];
  children.push(buildStudentTable(student, awards));
  return children;
}

// ============================================================
// 复制背景从旧文件到新文件
// ============================================================
async function copyBackground(prevPath, newBuffer) {
  if (!fs.existsSync(prevPath)) {
    console.log('⚠ 未找到旧文件，背景图片未复制');
    return newBuffer;
  }

  try {
    const prevZip = await JSZip.loadAsync(fs.readFileSync(prevPath));
    const newZip = await JSZip.loadAsync(newBuffer);

    // 需要复制的文件
    const toCopy = [];
    for (const name of Object.keys(prevZip.files).sort()) {
      if (name.startsWith('word/media/') ||
          name === 'word/header1.xml' ||
          name === 'word/_rels/header1.xml.rels' ||
          name.startsWith('word/theme/')) {
        toCopy.push(name);
      }
    }

    // 也需要复制 document.xml.rels 中的 header 关联
    if (prevZip.files['word/_rels/document.xml.rels']) {
      toCopy.push('word/_rels/document.xml.rels');
    }
    // 以及 header 相关的 Content_Types
    const prevCt = await prevZip.files['[Content_Types].xml'].async('string');
    if (prevCt.includes('header')) {
      toCopy.push('[Content_Types].xml');
    }

    // 复制文件
    for (const name of [...new Set(toCopy)]) {
      if (prevZip.files[name]) {
        const content = await prevZip.files[name].async('nodebuffer');
        newZip.file(name, content);
      }
    }

    const newBuf = await newZip.generateAsync({ type: 'nodebuffer' });
    console.log('   ✅ 背景图片已从旧文件复制');
    return newBuf;
  } catch (e) {
    console.log('   ⚠ 复制背景失败:', e.message);
    return newBuffer;
  }
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  if (!fs.existsSync(CONFIG.outputDir)) fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  const students = readStudents(CONFIG.excelPath);
  console.log(`📋 读取到 ${students.length} 名学生`);
  if (students.length === 0) { console.error('无学生数据'); process.exit(1); }

  console.log('🏆 读取获奖数据...');
  const awardMap = readAwards(CONFIG.awardPath);
  let withAwards = 0;
  for (const s of students) {
    if (awardMap[s.name]?.length) withAwards++;
  }
  console.log(`   本班 ${withAwards} 人有匹配的获奖数据`);

  // 生成文档
  const sections = students.map((student, i) => ({
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, bottom: 1440, left: PAGE_MARGIN_LEFT, right: PAGE_MARGIN_RIGHT },
      },
    },
    children: buildStudentPage(student, awardMap, i === 0),
  }));

  const doc = new Document({ sections });
  let buffer = await docx.Packer.toBuffer(doc);

  // 从旧文件复制背景图片
  console.log('\n🎨 保留背景图片...');
  buffer = await copyBackground(CONFIG.previousOutput, buffer);

  // 保存
  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  fs.writeFileSync(outputPath, buffer);

  console.log(`\n✅ 生成完成！`);
  console.log(`   文件: ${outputPath}`);
  console.log(`   学生数: ${students.length} 人`);
  console.log(`   大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(err => { console.error('运行出错:', err); process.exit(1); });
