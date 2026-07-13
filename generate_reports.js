const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// ============================================================
// 配置
// ============================================================
const CONFIG = {
  excelPath: 'F:\\桌面\\桌面所有图标\\Ai+信息科技应用\\积分兑换明细\\2025.9claude名使用具体明细.xlsx',
  awardPath: 'F:\\桌面\\桌面所有图标\\Ai+信息科技应用\\积分兑换明细\\站前小学学生获奖统计(2017至2026年）具体明细.xlsx',
  templatePath: 'F:\\桌面\\桌面所有图标\\Ai+信息科技应用\\积分兑换明细\\2025.9claude名使用积分管理.docx',
  outputDir: path.join(__dirname, 'output'),
  outputFile: '信息科技成长记录单_v2.docx',
  className: '2021级4班',
  sheetName: '2025.9claude名使用',
};

// ============================================================
// 列索引
// ============================================================
const COL = {
  ID: 0, NAME: 1,
  GRADE_5S: 8,       // 等级五年级上
  JF_QM_5S: 3,       // 期末积分五年级上
  JF_PS_5S: 4,       // 平时积分五年级上
  YH_5S: 5,          // 已兑换五年级上
  TOTAL_5S: 6,       // 积分五年级上（总剩余）
  BZ_5S: 7,          // 备注五年级上
  GRADE_5X: 15,      // 等级五年级下
  JF_QM_5X: 10,      // 期末积分五年级下
  JF_PS_5X: 11,      // 平时积分五年级下
  YH_5X: 12,         // 已兑换五年级下
  TOTAL_5X: 13,      // 积分五年级下（总剩余）
  BZ_5X: 14,         // 备注五年级下
};

// 学期配置: label + 6个数据字段对应Excel列 [平时积分, 期末积分, 已兑换, 总积分, 等级, 备注]
const SEMESTERS = [
  { label: '三年级上', data: ['/', '/', '/', '/', '/', '/'] },
  { label: '三年级下', data: ['/', '/', '/', '/', '/', '/'] },
  { label: '四年级上', data: ['/', '/', '/', '/', '/', '/'] },
  { label: '四年级下', data: ['/', '/', '/', '/', '/', '/'] },
  { label: '五年级上', data: [COL.JF_PS_5S, COL.JF_QM_5S, COL.YH_5S, COL.TOTAL_5S, COL.GRADE_5S, COL.BZ_5S] },
  { label: '五年级下', data: [COL.JF_PS_5X, COL.JF_QM_5X, COL.YH_5X, COL.TOTAL_5X, COL.GRADE_5X, COL.BZ_5X] },
  { label: '六年级上', data: ['', '', '', '', '', ''] },
  { label: '六年级下', data: ['', '', '', '', '', ''] },
];

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

// 根据学期和字段索引获取实际值
function getSemesterValue(sem, row) {
  const d = sem.data;
  if (typeof d[0] === 'string') {
    // '/', '' → 直接返回
    return d;
  }
  // 数字索引 → 从Excel行读取
  return d.map(idx => safeStr(row[idx]));
}

// ============================================================
// 读取学生
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

// ============================================================
// 读取获奖
// ============================================================
function readAwards(filePath) {
  const wb = XLSX.readFile(filePath);
  const awardMap = {};
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    if (rows.length < 2) continue;
    const is2026 = sheetName === '2026年';
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = rows[i];
      if (!r) continue;
      const s = JSON.stringify(r);
      if ((s.includes('学生姓名') || s.includes('"姓名"')) && r.length >= 4) { headerIdx = i; break; }
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
      const hRow = rows[headerIdx];
      const cm = {};
      for (let j = 0; j < hRow.length; j++) {
        const h = safeStr(hRow[j]);
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
        const txt = cn + (gp ? ' ' + gp : '') + (lv ? ' ' + lv : '');
        if (!awardMap[sn]) awardMap[sn] = [];
        awardMap[sn].push(txt);
      }
    }
  }
  return awardMap;
}

// ============================================================
// 构建带文本的单元格XML（用于填充空单元格）
// ============================================================
function makeCellXML(text) {
  if (!text) text = '';
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<w:r><w:rPr><w:rFonts w:hint="eastAsia"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:vertAlign w:val="baseline"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
}

// ============================================================
// 为一个学生填充数据
// ============================================================
function fillStudentBody(body, student, awards) {
  const row = student.data;
  let result = body;

  // 1. 替换姓名
  result = result.replace('姓名：　　班级：', `姓名：${student.name}　　班级：${CONFIG.className}`);

  // 2. 填充学期数据
  for (const sem of SEMESTERS) {
    const values = getSemesterValue(sem, row);
    // 在XML中找到该学期行，填充6个数据单元格
    const semStart = result.indexOf(sem.label);
    if (semStart === -1) continue;

    // 找到该行结束
    const rowEnd = result.indexOf('</w:tr>', semStart);
    if (rowEnd === -1) continue;

    // 找到该行的行头
    const rowStart = result.lastIndexOf('<w:tr', semStart);
    const rowXml = result.substring(rowStart, rowEnd + 7);

    // 在该行中，找到6个空单元格（</w:pPr></w:p></w:tc>），依次填入数据
    let filledRow = rowXml;
    for (let vi = 0; vi < values.length; vi++) {
      const val = values[vi];
      const cellXml = makeCellXML(val);
      // 替换第一个 </w:pPr></w:p></w:tc>
      filledRow = filledRow.replace('</w:pPr></w:p></w:tc>', `</w:pPr>${cellXml}</w:p></w:tc>`);
    }

    result = result.substring(0, rowStart) + filledRow + result.substring(rowEnd + 7);
  }

  // 3. 填充信息科技成果（11个编号项）
  for (let ai = 0; ai < 11; ai++) {
    const tplText = `${ai + 1}.`;
    const awardText = ai < awards.length ? `${ai + 1}. ${awards[ai]}` : tplText;

    // 找到该编号项位置（每个学生body中只找第一次出现的）
    // 技巧：从后面往前找最后一次出现的 "信息科技成果" 之后的内容
    // 但更简单：使用一个计数器
    const pos = result.indexOf(tplText);
    if (pos === -1) continue;

    // 找到对应的 <w:t> 标签
    const tagStart = result.lastIndexOf('<w:t', pos);
    const tagEnd = result.indexOf('</w:t>', tagStart);
    // w:t 标签内容
    const tagContentStart = result.indexOf('>', tagStart) + 1;

    if (tagContentStart > 0 && tagEnd > tagContentStart) {
      const escaped = awardText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      result = result.substring(0, tagContentStart) + escaped + result.substring(tagEnd);
    }
  }

  return result;
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  if (!fs.existsSync(CONFIG.outputDir)) fs.mkdirSync(CONFIG.outputDir, { recursive: true });

  // 读取数据
  const students = readStudents(CONFIG.excelPath);
  console.log(`📋 读取到 ${students.length} 名学生`);
  if (students.length === 0) { console.error('无学生数据'); process.exit(1); }

  console.log('🏆 读取获奖数据...');
  const awardMap = readAwards(CONFIG.awardPath);
  let withAwards = 0;
  for (const s of students) { if (awardMap[s.name]?.length) withAwards++; }
  console.log(`   本班 ${withAwards} 人有匹配的获奖数据`);

  // 读取模板
  console.log('\n📄 基于模板生成...');
  const templateZip = await JSZip.loadAsync(fs.readFileSync(CONFIG.templatePath));
  const docXml = await templateZip.files['word/document.xml'].async('string');

  // 提取body内容（不含 <w:body> 标签本身）
  const bodyMatch = docXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) { console.error('无法解析模板body'); process.exit(1); }
  const singleBody = bodyMatch[1];

  // 为每个学生填充数据
  const allBodies = [];
  for (let si = 0; si < students.length; si++) {
    const student = students[si];
    const awards = awardMap[student.name] || [];
    const filledBody = fillStudentBody(singleBody, student, awards);
    allBodies.push(filledBody);
  }

  // 合并（加分页符）
  const pageBreakXml = '<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
  const combinedBody = allBodies.join(pageBreakXml);

  // 注入回 document.xml
  const newDocXml = docXml.replace(/<w:body[^>]*>[\s\S]*?<\/w:body>/, `<w:body>${combinedBody}</w:body>`);

  // 替换回 zip
  templateZip.file('word/document.xml', newDocXml);

  // 生成输出
  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  const buffer = await templateZip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(outputPath, buffer);

  console.log(`\n✅ 生成完成！`);
  console.log(`   文件: ${outputPath}`);
  console.log(`   学生数: ${students.length} 人`);
  console.log(`   大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   📌 模板中的背景图片已保留`);
}

main().catch(err => { console.error('运行出错:', err); process.exit(1); });
