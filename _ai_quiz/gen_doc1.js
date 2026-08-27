// 生成《教学知识框架》Word文档（文档1）
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, AlignmentType, PageBreak,
  tr, para, body, h1, h2, h3, h4, makeTable, saveDoc,
} = require('./docx_helpers.js');
const { FRAMEWORK } = require('./framework.js');
const { buildMapping } = require('./mapping.js');

const MAPPING = buildMapping();
const M = {};
MAPPING.forEach(m => { M[m.id] = m; });

// 题库小节结构（用于概览）
function bankStructure(label, file) {
  const d = JSON.parse(fs.readFileSync('F:/cursor20260624/_ai_quiz/' + file, 'utf8'));
  const sec = {};
  for (const q of d.questions) {
    if (!sec[q.section]) sec[q.section] = { cnt: 0, chapter: q.chapter.replace(/[【】]/g, '') };
    sec[q.section].cnt++;
  }
  // 按章节分组
  const chapters = {};
  for (const [name, v] of Object.entries(sec)) {
    if (!chapters[v.chapter]) chapters[v.chapter] = [];
    chapters[v.chapter].push([name, v.cnt]);
  }
  console.log('=== ' + label + ' ===');
  for (const [ch, list] of Object.entries(chapters)) {
    console.log('【' + ch + '】 ' + list.map(([n, c]) => n + '(' + c + ')').join('、'));
  }
}
bankStructure('500题库', 'data500.json');
bankStructure('2000题库', 'data2000.json');

// ============ 文档构建 ============
const children = [];

// 封面
children.push(new Paragraph({ children: [tr('', { size: 80 })], spacing: { before: 300 } }));
children.push(new Paragraph({
  children: [tr('中小学生人工智能知识竞赛', { bold: true, size: 48, font: '黑体', color: '1F4E79' })],
  alignment: AlignmentType.CENTER, spacing: { after: 80 },
}));
children.push(new Paragraph({
  children: [tr('教学知识框架', { bold: true, size: 56, font: '黑体', color: '2E74B5' })],
  alignment: AlignmentType.CENTER, spacing: { after: 300 },
}));
children.push(new Paragraph({
  children: [tr('—— 依据《小学组·500题》《小学组·2000题》两套题库整理', { size: 24, color: '595959' })],
  alignment: AlignmentType.CENTER, spacing: { after: 80 },
}));
children.push(new Paragraph({
  children: [tr('适用于：AI知识竞赛备赛教学、课堂讲练、复习指导', { size: 24, color: '595959' })],
  alignment: AlignmentType.CENTER, spacing: { after: 60 },
}));
children.push(new Paragraph({
  children: [tr('整理时间：2026年8月', { size: 24, color: '595959' })],
  alignment: AlignmentType.CENTER, spacing: { after: 120 },
}));

// 目录说明
children.push(h2('使用说明'));
children.push(body('本框架把两套竞赛题库（500题、2000题）的全部试题，按“AI知识体系”重新归类为六大篇章、24个教学单元。每个单元标注了“核心知识点”和“对应题目序号”，教师可按单元组织教学与讲练，学生可对照序号自主刷题。'));
children.push(body('标注说明：表中“500题”指《中小学生AI知识竞赛_小学组_500题.docx》中的题号；“2000题”指《…_2000题.docx》中的题号。题号区间含首尾（如“1–27”表示第1至第27题）。某库无对应题目时以“——”表示。'));
children.push(new Paragraph({ children: [tr('', { size: 10 })], spacing: { after: 0 } }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ============ 一、题库概览 ============
children.push(h1('一、题库概览'));
children.push(h2('1. 两套题库基本情况'));
children.push(makeTable(
  ['题库', '总题数', '判断题', '单选题', '填空题', '多选题', '知识板块'],
  [
    ['小学组·500题', '500', '135', '346', '12', '7', 'AI通识知识、数学逻辑、逻辑推理'],
    ['小学组·2000题', '2000', '594', '1023', '226', '157', 'AI通识知识（上/下两卷）、数学逻辑、逻辑推理'],
    ['合计', '2500', '729', '1369', '238', '164', '覆盖6大篇章、24个单元'],
  ],
  { centerCols: [1, 2, 3, 4, 5], colWidths: [1800, 1100, 1200, 1200, 1100, 1100, 2500] }
));
children.push(new Paragraph({ children: [tr('', { size: 10 })], spacing: { after: 0 } }));

children.push(h2('2. 2000题题库结构说明'));
children.push(body('2000题分为上、下两卷：上卷（第1—1000题）按“AI发展简史、机器学习基础、计算机视觉、自然语言处理、语音识别技术、AI与智慧交通、AI与医疗健康、AI与环境保护、AI与教育、AI与艺术创作、AI工具与应用”等专题组织；下卷（第1001—2000题）与500题的章节体系一致，进一步扩充题量。两卷共同构成完整的知识覆盖。'));

children.push(h2('3. 两套题库的章节与题量分布'));
children.push(h3('（1）500题（AI通识知识部分）'));
children.push(makeTable(
  ['章节', '题量', '题号', '章节', '题量', '题号'],
  [
    ['AI三要素', '27', '1–27', 'AI文本与推理', '27', '244–270'],
    ['AI与人类', '27', '28–54', 'AI视觉与图像', '27', '271–297'],
    ['AI与智慧社会', '28', '55–82', 'AI语音技术', '28', '298–325'],
    ['AI伦理与安全', '27', '83–109', '人工智能启蒙', '27', '326–352'],
    ['AI前沿技术', '26', '110–135', '大语言模型', '26', '353–378'],
    ['AI发展史', '27', '136–162', '机器学习', '26', '379–404'],
    ['AI在各行业', '27', '163–189', '深度学习', '26', '405–430'],
    ['AI在校园', '27', '190–216', 'AI在生活', '27', '217–243'],
  ],
  { centerCols: [1, 2, 4, 5], colWidths: [1650, 700, 1100, 1650, 700, 1300] }
));
children.push(h3('（2）500题（数学逻辑、逻辑推理部分）'));
children.push(makeTable(
  ['章节', '题量', '题号', '章节', '题量', '题号'],
  [
    ['几何基础', '9', '431–439', '数列推理', '12', '466–477'],
    ['四则运算', '10', '440–449', '逻辑思维', '12', '478–489'],
    ['应用题', '9', '450–458', '集合推理', '11', '490–500'],
    ['数论基础', '7', '459–465', '', '', ''],
  ],
  { centerCols: [1, 2, 4, 5], colWidths: [1650, 700, 1100, 1650, 700, 1300] }
));
children.push(new Paragraph({ children: [tr('', { size: 10 })], spacing: { after: 0 } }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ============ 二、知识框架总览 ============
children.push(h1('二、教学知识框架总览'));
children.push(body('两套题库的全部考点可归纳为六大篇章：'));

const overviewRows = FRAMEWORK.map((ch, ci) => [
  ['第' + ['一', '二', '三', '四', '五', '六'][ci] + '篇　' + ch.chapter],
  [ch.units.map(u => {
    const m = M[u.id];
    return u.id + ' ' + u.title + '（500:' + m.count500 + '题 / 2000:' + m.count2000 + '题）';
  }).join('；')],
  [ch.intro],
]);
children.push(makeTable(['篇章', '所含单元（题量）', '篇内容简介'], overviewRows, {
  colWidths: [2300, 3200, 3500], bodySize: 19,
}));
children.push(new Paragraph({ children: [tr('', { size: 10 })], spacing: { after: 0 } }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ============ 三、各单元详细框架 ============
children.push(h1('三、各单元详细知识框架'));
children.push(body('以下按篇章列出每个单元的知识要点与对应题目序号，可直接用于教学计划与讲练安排。'));

FRAMEWORK.forEach((ch, ci) => {
  children.push(h2(ch.chapter));
  children.push(body(ch.intro));
  ch.units.forEach(u => {
    const m = M[u.id];
    children.push(h3(u.id + '　' + u.title));
    children.push(para([tr('知识点概述：', { bold: true }), tr(u.summary)], { spacing: { after: 40 } }));
    children.push(para([tr('核心知识点：', { bold: true })], { spacing: { after: 20 } }));
    u.points.forEach(p => {
      children.push(new Paragraph({
        children: [tr('● ', { bold: true, color: '2E74B5' }), tr(p, { size: 20 })],
        indent: { left: 200 },
        spacing: { line: 300, after: 20 },
      }));
    });
    children.push(makeTable(
      ['题库', '覆盖小节', '题量', '对应题目序号'],
      [
        ['500题', u.sec500.length ? u.sec500.join('、') : '——', m.count500 ? String(m.count500) : '——', m.count500 ? m.range500 : '——'],
        ['2000题', u.sec2000.length ? u.sec2000.join('、') : '——', m.count2000 ? String(m.count2000) : '——', m.count2000 ? m.range2000 : '——'],
      ],
      { centerCols: [0, 2], colWidths: [1100, 3200, 800, 2900], bodySize: 19 }
    ));
    children.push(new Paragraph({ children: [tr('', { size: 8 })], spacing: { after: 0 } }));
  });
});
children.push(new Paragraph({ children: [new PageBreak()] }));

// ============ 四、教学与备考建议 ============
children.push(h1('四、教学与备考建议'));
const advices = [
  ['①', '按篇章顺序推进', '先学第一篇“AI基础认知”（AI是什么、三要素、机器学习、深度学习）建立概念框架，再学第二篇“核心技术”，第三篇“应用与社会”联系生活，第四篇“历史·前沿·伦理”提升素养，最后以第五、六篇“数学逻辑与逻辑推理”训练思维。'],
  ['②', '单元对应刷题', '每讲完一个单元，即让学生完成该单元对应题号的练习（见第三部分表格）。500题适合课堂精讲精练，2000题适合拓展巩固与模拟冲刺。'],
  ['③', '抓高频考点', '重点单元为：AI三要素、AI与人类、AI伦理与安全、AI前沿技术、大语言模型、机器学习、AI在生活、AI在各行业——这些单元在两套题库中题量最大、出现频率最高。'],
  ['④', '数学逻辑与逻辑推理', '这两部分（第五、六篇）虽题量占比不大，但考查方法与计算基本功，易拉开差距，建议每周安排固定时间专项训练。'],
  ['⑤', '学以致用', '结合生活中真实的AI应用（语音助手、人脸识别、智能推荐、无人驾驶）进行体验式教学，加深理解，同时渗透AI伦理与安全、信息保护意识。'],
];
advices.forEach(([no, title, text]) => {
  children.push(new Paragraph({
    children: [tr(no + '　', { bold: true, color: 'C00000' }), tr(title + '：', { bold: true, color: '1F4E79' }), tr(text)],
    indent: { firstLine: 0, left: 0 },
    spacing: { line: 320, after: 100 },
  }));
});
children.push(body('说明：本题库整理仅用于教育教学与备赛参考。题库持续更新中，正式比赛以主办方公布内容为准。'));

// ============ 导出 ============
const doc = new Document({
  styles: { default: { document: { run: { font: '宋体', size: 21 } } } },
  sections: [{ children }],
});
const outPath = path.join('F:/cursor20260624/output', '01-AI知识竞赛教学知识框架.docx');
saveDoc(doc, outPath);
