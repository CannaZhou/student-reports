const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const docx = require('docx');

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
  className: '2021级4班',
  sheetName: '2025.9claude名使用',
};

// ============================================================
// 列索引 (0-based)
// ============================================================
const COL = {
  ID: 0,
  NAME: 1,
  // 五年级上
  JF_PS_5S: 4,        // 平时积分五年级上
  JF_QM_5S: 3,        // 期末积分五年级上
  YH_5S: 5,           // 已兑换五年级上
  TOTAL_5S: 6,        // 积分五年级上（总剩余）
  BZ_5S: 7,           // 备注五年级上
  // 五年级下
  JF_PS_5X: 11,       // 平时积分五年级下
  JF_QM_5X: 10,       // 期末积分五年级下
  YH_5X: 12,          // 已兑换五年级下
  TOTAL_5X: 13,       // 积分五年级下（总剩余）
  BZ_5X: 14,          // 备注五年级下
};

// ============================================================
// 学期列表（无数据的学期填 "/"）
// ============================================================
const SEMESTERS = [
  { label: '三年级上', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
  { label: '三年级下', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
  { label: '四年级上', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
  { label: '四年级下', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
  { label: '五年级上', ps: COL.JF_PS_5S, qm: COL.JF_QM_5S, yh: COL.YH_5S, total: COL.TOTAL_5S, bz: COL.BZ_5S },
  { label: '五年级下', ps: COL.JF_PS_5X, qm: COL.JF_QM_5X, yh: COL.YH_5X, total: COL.TOTAL_5X, bz: COL.BZ_5X },
  { label: '六年级上', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
  { label: '六年级下', ps: '/',   qm: '/',   yh: '/',   total: '/',   bz: '/' },
];

// ============================================================
// 样式常量（half-points）
// ============================================================
const FONT = '等线';
const FONT_SIZE_TITLE = 44;        // 22pt
const FONT_SIZE_SUBTITLE = 22;     // 11pt
const FONT_SIZE_NAME = 20;         // 10pt
const FONT_SIZE_TABLE = 18;        // 9pt
const FONT_SIZE_TABLE_HEADER = 18; // 9pt
const FONT_SIZE_SECTION = 18;      // 9pt
const FONT_SIZE_HONOR = 16;        // 8pt（荣誉栏字体小一点，一行能显示更多）

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
// 辅助函数
// ============================================================
function safeStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function cleanName(raw) {
  // 去除班级前缀如 "54班方家蔚" → "方家蔚"
  return safeStr(raw).replace(/^\d+班/, '').trim();
}

function createTextRun(text, opts = {}) {
  const { bold, size = FONT_SIZE_TABLE, font = FONT } = opts;
  return new TextRun({
    text: safeStr(text),
    bold: bold || false,
    size: size,
    font: font,
  });
}

function createCell(text, opts = {}) {
  const { bold = false, size = FONT_SIZE_TABLE, alignment = AlignmentType.CENTER, columnSpan, width } = opts;
  const cellOpts = {
    children: [
      new Paragraph({
        children: [createTextRun(text, { bold, size })],
        alignment,
      }),
    ],
    verticalAlign: 'center',
    width: width ? { size: width, type: WidthType.DXA } : undefined,
  };
  if (columnSpan) cellOpts.columnSpan = columnSpan;
  return new TableCell(cellOpts);
}

function createHonorCell(text) {
  return new TableCell({
    columnSpan: 6,
    children: [
      new Paragraph({
        children: [createTextRun(text, { size: FONT_SIZE_HONOR })],
        alignment: AlignmentType.LEFT,
        spacing: { line: 240, lineRule: 'auto' },
      }),
    ],
  });
}

// ============================================================
// 读取学生数据
// ============================================================
function readStudents(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[CONFIG.sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const students = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = row[COL.NAME];
    if (!name) continue;
    students.push({ id: row[COL.ID], name: safeStr(name), data: row });
  }
  return students;
}

// ============================================================
// 读取获奖数据 → 构建 name → awards[] 映射
// ============================================================
function readAwards(filePath) {
  const wb = XLSX.readFile(filePath);
  const awardMap = {};

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    const is2026 = sheetName === '2026年';

    // 找到表头行（包含 "学生姓名" 或 "姓名" 关键词的行）
    let headerRowIdx = -1;
    let headerRow = null;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = rows[i];
      if (!r) continue;
      const rowStr = JSON.stringify(r);
      if ((rowStr.includes('学生姓名') || rowStr.includes('"姓名"')) && r.length >= 4) {
        headerRowIdx = i;
        headerRow = r;
        break;
      }
    }
    if (headerRowIdx === -1) continue;

    if (is2026) {
      // 2026年: 固定列
      const nameCol = 4;
      const honorCol = 6;
      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        if (isNaN(Number(row[0]))) continue;
        const rawName = safeStr(row[nameCol] || '');
        const honorName = safeStr(row[honorCol] || '');
        if (!rawName || !honorName) continue;
        const name = cleanName(rawName);
        if (!awardMap[name]) awardMap[name] = [];
        awardMap[name].push(honorName);
      }
    } else {
      // 2017-2025年: 动态检测列索引
      const colMap = {};
      for (let j = 0; j < headerRow.length; j++) {
        const h = safeStr(headerRow[j]);
        if (h === '学生姓名' || h === '姓名')  colMap.name = j;
        if (h === '班级')                       colMap.class = j;
        if (h === '比赛名称')                   colMap.comp = j;
        if (h === '等次')                       colMap.level = j;
        if (h === '组别' || h === '项目')       colMap.group = j;
      }

      // 必须要有姓名和比赛名称
      if (colMap.name === undefined || colMap.comp === undefined) continue;

      for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        if (isNaN(Number(row[0]))) continue;

        const studentName = safeStr(row[colMap.name] || '');
        const compName = safeStr(row[colMap.comp] || '');
        if (!studentName || !compName) continue;

        const level = colMap.level !== undefined ? safeStr(row[colMap.level] || '') : '';
        const group = colMap.group !== undefined ? safeStr(row[colMap.group] || '') : '';

        const awardText = `${compName}${group ? ' ' + group : ''}${level ? ' ' + level : ''}`;
        if (!awardMap[studentName]) awardMap[studentName] = [];
        awardMap[studentName].push(awardText);
      }
    }
  }

  return awardMap;
}

// ============================================================
// 构建一个学生的表格
// ============================================================
function buildStudentTable(student, awards) {
  const row = student.data;
  const rows = [];

  // ---- Row 1: 姓名 + 班级 ----
  rows.push(new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        columnSpan: 6,
        children: [
          new Paragraph({
            children: [createTextRun(`姓名：${student.name}　　班级：${CONFIG.className}`, { size: FONT_SIZE_NAME })],
            alignment: AlignmentType.CENTER,
          }),
        ],
        verticalAlign: 'center',
      }),
    ],
  }));

  // ---- Row 2: 表头 ----
  rows.push(new TableRow({
    tableHeader: true,
    children: TABLE_HEADERS.map((h, i) =>
      createCell(h, { bold: true, size: FONT_SIZE_TABLE_HEADER, width: COL_WIDTHS[i] })
    ),
  }));

  // ---- Rows 3-10: 学期行 ----
  for (const sem of SEMESTERS) {
    const cells = [createCell(sem.label, { size: FONT_SIZE_TABLE, width: COL_WIDTHS[0] })];
    const fields = ['ps', 'qm', 'yh', 'total', 'bz'];
    for (const f of fields) {
      const val = sem[f] === '/' ? '/' : (sem[f] !== null ? safeStr(row[sem[f]]) : '');
      cells.push(createCell(val, { size: FONT_SIZE_TABLE, width: COL_WIDTHS[fields.indexOf(f) + 1] }));
    }
    rows.push(new TableRow({ children: cells }));
  }

  // ---- 荣誉 section ----
  rows.push(new TableRow({
    children: [
      new TableCell({
        columnSpan: 6,
        children: [
          new Paragraph({
            children: [createTextRun('荣誉', { size: FONT_SIZE_SECTION })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
    ],
  }));

  // 填充荣誉条目
  const maxHonors = 8;
  for (let i = 0; i < maxHonors; i++) {
    const text = i < awards.length ? `${i + 1}. ${awards[i]}` : `${i + 1}.`;
    rows.push(new TableRow({ children: [createHonorCell(text)] }));
  }

  // ---- 其他 section ----
  rows.push(new TableRow({
    children: [
      new TableCell({
        columnSpan: 6,
        children: [
          new Paragraph({
            children: [createTextRun('其他', { size: FONT_SIZE_SECTION })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
    ],
  }));

  for (let i = 1; i <= 8; i++) {
    rows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 6,
          children: [
            new Paragraph({
              children: [createTextRun(`${i}.`, { size: FONT_SIZE_SECTION })],
              alignment: AlignmentType.LEFT,
            }),
          ],
        }),
      ],
    }));
  }

  // ---- 表格 ----
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

// ============================================================
// 构建一个学生的一页内容
// ============================================================
function buildStudentPage(student, awardMap, isFirst) {
  const children = [];

  // 非第一页先加分页符
  if (!isFirst) children.push(new docx.PageBreak());

  // 标题
  children.push(
    new Paragraph({
      children: [createTextRun('信息科技成长记录单', { bold: true, size: FONT_SIZE_TITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    })
  );

  // 副标题
  children.push(
    new Paragraph({
      children: [createTextRun('成长藏在每一次的"努力+习惯+爱心"里', { size: FONT_SIZE_SUBTITLE })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    })
  );

  // 表格（传入学生获奖列表）
  const awards = awardMap[student.name] || [];
  children.push(buildStudentTable(student, awards));

  return children;
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // 读取学生数据
  const students = readStudents(CONFIG.excelPath);
  console.log(`📋 读取到 ${students.length} 名学生`);

  if (students.length === 0) {
    console.error('错误：未读取到任何学生数据，请检查 Excel 文件');
    process.exit(1);
  }

  // 读取获奖数据
  console.log('🏆 读取获奖数据...');
  const awardMap = readAwards(CONFIG.awardPath);

  // 统计有多少学生有获奖记录
  let withAwards = 0;
  for (const s of students) {
    if (awardMap[s.name] && awardMap[s.name].length > 0) {
      withAwards++;
    }
  }
  console.log(`   找到 ${Object.keys(awardMap).length} 个获奖学生记录`);
  console.log(`   本班 ${withAwards} 人有匹配的获奖数据`);

  // 构建 sections
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

  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  const buffer = await docx.Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`\n✅ 生成完成！`);
  console.log(`   文件: ${outputPath}`);
  console.log(`   学生数: ${students.length} 人`);
  console.log(`   大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(err => {
  console.error('运行出错:', err);
  process.exit(1);
});
