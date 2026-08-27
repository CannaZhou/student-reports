// Excel 导入：学生名单 或 题目（xlsx/xls）
const XLSX = require('../../lib/xlsx.full.min.js');

function sheetToRows(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const name = wb.SheetNames[0];
  const ws = wb.Sheets[name];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
}

// 学生名单：找到含"姓名"的列，收集该列非空值
function importStudentNames(buffer) {
  return importStudents(buffer).map((s) => s.name);
}

// 学生名单（带班级）：返回 [{name, className}]，班级列可选（找不到则班级留空）
function importStudents(buffer) {
  const rows = sheetToRows(buffer);
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h).trim());
  let nameCol = header.findIndex((h) => /姓名|名字|name/i.test(h));
  if (nameCol < 0) nameCol = 0; // 默认第一列
  const clsCol = header.findIndex((h) => /班级|班别|class/i.test(h));
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const v = String(rows[i][nameCol] || '').trim();
    if (!v) continue;
    const cls = clsCol >= 0 ? String(rows[i][clsCol] || '').trim() : '';
    out.push({ name: v, className: cls });
  }
  return out;
}

// 题目表：题干/题目、选项A..H、答案、解析、章节、小节
const OPT_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
function importQuestions(buffer) {
  const rows = sheetToRows(buffer);
  if (!rows.length) return [];
  const header = rows[0].map((h) => String(h).trim());
  const idx = (keys) => {
    for (const k of keys) {
      const i = header.findIndex((h) => h === k || h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };
  const qCol = idx(['题干', '题目', 'question']);
  const aCol = idx(['答案', 'answer']);
  const eCol = idx(['解析', 'explain', '解释']);
  const chCol = idx(['章节', '篇']);
  const seCol = idx(['小节', '知识点', 'section']);
  const optCols = OPT_COLS.map((k) => idx(['选项' + k, k + '选项', k])).map((v, i) => ({ key: OPT_COLS[i], col: v }))
    .filter((x) => x.col >= 0);

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const q = qCol >= 0 ? String(row[qCol] || '').trim() : '';
    if (!q) continue;
    const options = optCols
      .map((o) => ({ key: o.key, text: String(row[o.col] || '').trim() }))
      .filter((o) => o.text !== '');
    const expl = eCol >= 0 ? String(row[eCol] || '').trim() : '';
    const answer = aCol >= 0 ? String(row[aCol] || '').trim() : '';
    out.push({
      index: i,
      q,
      options,
      answer,
      expl,
      chapter: chCol >= 0 ? String(row[chCol] || '').trim() : '',
      section: seCol >= 0 ? String(row[seCol] || '').trim() : '',
    });
  }
  return out;
}

module.exports = { importStudentNames, importQuestions };
