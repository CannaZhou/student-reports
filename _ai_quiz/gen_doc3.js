// 生成《小AI探险队：AI知识大冒险》讲故事复习材料（文档3）
const path = require('path');
const {
  Document, Paragraph, AlignmentType, PageBreak,
  tr, para, body, h1, h2, h3, h4, makeTable, saveDoc,
} = require('./docx_helpers.js');
const { STORY } = require('./story_data.js');
const { Q500, Q2000 } = require('./mapping.js');

const byNo500 = {};
Q500.forEach(q => byNo500[q.no] = q);
const byNo2000 = {};
Q2000.forEach(q => byNo2000[q.no] = q);

function getQ(item) {
  return item.bank === '2000' ? byNo2000[item.no] : byNo500[item.no];
}

function qStem(q) { return q.q; }
function qOptions(q) { return q.options.length ? q.options.map(o => `${o.key}. ${o.text}`).join('　　') : ''; }

const children = [];

// ============ 封面 ============
children.push(new Paragraph({ children: [tr('', { size: 90 })], spacing: { before: 200 } }));
children.push(new Paragraph({
  children: [tr('★ 小AI探险队 ★', { bold: true, size: 40, font: '黑体', color: 'C00000' })],
  alignment: AlignmentType.CENTER, spacing: { after: 60 },
}));
children.push(new Paragraph({
  children: [tr('AI知识大冒险', { bold: true, size: 60, font: '黑体', color: '1F4E79' })],
  alignment: AlignmentType.CENTER, spacing: { after: 60 },
}));
children.push(new Paragraph({
  children: [tr(STORY.subtitle, { size: 26, color: '595959' })],
  alignment: AlignmentType.CENTER, spacing: { after: 280 },
}));
children.push(new Paragraph({
  children: [tr('读故事 · 记知识 · 闯关卡', { size: 28, color: '2E74B5' })],
  alignment: AlignmentType.CENTER, spacing: { after: 40 },
}));
children.push(new Paragraph({
  children: [tr('给小学生的人工智能趣味复习手册', { size: 24, color: '7F7F7F' })],
  alignment: AlignmentType.CENTER, spacing: { after: 40 },
}));
children.push(new Paragraph({
  children: [tr('（内容对应：AI知识竞赛·小学组 500题 + 2000题）', { size: 20, color: 'A6A6A6' })],
  alignment: AlignmentType.CENTER, spacing: { after: 0 },
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ============ 给探险家的一封信 ============
children.push(h1('给小小探险家的一封信'));
STORY.intro.forEach(p => {
  if (p.endsWith('：')) {
    children.push(new Paragraph({
      children: [tr(p, { bold: true, size: 22, color: '1F4E79' })],
      spacing: { after: 40 },
    }));
  } else {
    children.push(body(p));
  }
});
children.push(new Paragraph({ children: [tr('', { size: 8 })], spacing: { after: 0 } }));
children.push(new Paragraph({
  children: [tr('★ 冒险地图：', { bold: true, color: 'C00000' }), tr(STORY.map, { size: 20, color: '1F4E79' })],
  spacing: { after: 40 },
}));
children.push(new Paragraph({
  children: [tr('★ 小队员档案 ★', { bold: true, color: 'C00000' })],
  spacing: { after: 40 },
}));
children.push(makeTable(
  ['队员', '本领', '特点'],
  [
    ['小灵', '爱提问', '队长，好奇心最强，总问“为什么”'],
    ['小慧', '爱钻研', '知识小博士，懂好多AI原理'],
    ['天天', '爱动手', '动手小达人，喜欢算数和做实验'],
    ['小安', '爱安全', '安全员，最会保护大家的隐私'],
  ],
  { colWidths: [1100, 1600, 5300], bodySize: 20, centerCols: [0] }
));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ============ 各章 ============
STORY.chapters.forEach((ch, idx) => {
  // 章标题
  children.push(new Paragraph({
    children: [tr(ch.chapterTitle, { bold: true, size: 30, font: '黑体', color: 'FFFFFF' })],
    spacing: { before: 120, after: 120 },
    shading: { fill: '1F4E79', type: 'clear', color: 'auto' },
    indent: { left: 120 },
  }));

  // 故事正文
  ch.story.forEach((p, pi) => {
    if (pi === 0) children.push(body(p, { spacing: { line: 360, after: 100 } }));
    else children.push(body(p, { spacing: { line: 360, after: 100 } }));
  });

  // 知识加油站
  children.push(h3('🧠 知识加油站'));
  ch.knowledge.forEach(k => {
    children.push(new Paragraph({
      children: [tr('· ', { bold: true, color: 'C00000' }), tr(k, { size: 20 })],
      indent: { left: 160 },
      spacing: { line: 300, after: 30 },
    }));
  });

  // 记忆口诀
  children.push(new Paragraph({
    children: [tr('🎵 记忆口诀：', { bold: true, color: 'C00000' }), tr(ch.mnemonic, { size: 22, bold: true, color: '1F4E79' })],
    spacing: { before: 60, after: 80 },
  }));

  // 闯关答题
  children.push(h3('🏆 闯关答题'));
  children.push(body('答对越多，得到越多能量星！每一题都附有“通关秘籍”，先自己想一想，再悄悄对照哦。'));

  const quizNos = ch.quiz.map((item, qi) => {
    const q = getQ(item);
    if (!q) return null;
    children.push(new Paragraph({
      children: [tr(`闯关${qi + 1}（${item.bank === '2000' ? '2000题' : '500题'}·第${q.no}题）：`, { bold: true, color: '2E74B5' }), tr(qStem(q))],
      spacing: { before: 80, after: 20 },
    }));
    if (qOptions(q)) {
      children.push(new Paragraph({
        children: [tr(qOptions(q), { size: 19, color: '404040' })],
        spacing: { after: 20 },
      }));
    }
    children.push(new Paragraph({
      children: [tr(`【正确答案】${q.answer}　`, { bold: true, color: '1F6E1F' }), tr(`【通关秘籍】${q.expl}`, { size: 19, color: '1F6E1F' })],
      spacing: { after: 60 },
    }));
    return q.no;
  }).filter(Boolean);

  // 本关之星
  const star = '★'.repeat(Math.min(quizNos.length, 6)) + '☆'.repeat(Math.max(0, 6 - Math.min(quizNos.length, 6)));
  children.push(new Paragraph({
    children: [tr(`第${ch.no}关能量星：`, { bold: true }), tr(star, { size: 24, color: 'FFA500' }), tr('　闯关成功！继续前进！', { color: '595959', size: 20 })],
    spacing: { before: 60, after: 40 },
  }));

  // 页脚注
  if (idx < STORY.chapters.length - 1) {
    children.push(new Paragraph({ children: [tr('', { size: 8 })], spacing: { after: 0 } }));
    children.push(new Paragraph({
      children: [tr(`→ 下一站：${STORY.chapters[idx + 1].title}`, { color: '7F7F7F', size: 20 })],
      alignment: AlignmentType.RIGHT, spacing: { after: 0 },
    }));
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));
});

// ============ 结局 ============
children.push(h1('🎉 恭喜通关！'));
STORY.ending.forEach(p => {
  if (p.endsWith('！') && p.length < 15) {
    children.push(new Paragraph({
      children: [tr(p, { bold: true, size: 24, color: 'C00000' })],
      alignment: AlignmentType.CENTER, spacing: { after: 60 },
    }));
  } else {
    children.push(body(p));
  }
});

// ============ 通关路线图（总复习） ============
children.push(h2('📖 通关路线图（考前复习目录）'));
children.push(makeTable(
  ['关卡', '秘境名称', '学到什么', '记忆口诀'],
  STORY.chapters.map(ch => [
    `第${ch.no}关`,
    ch.title,
    ch.knowledge[0] + '；…（详见对应章节）',
    ch.mnemonic,
  ]),
  { colWidths: [1000, 1700, 2800, 2500], bodySize: 18 }
));
children.push(new Paragraph({ children: [tr('', { size: 6 })], spacing: { after: 0 } }));
children.push(body('使用方法：先完整读一遍故事，记住“知识加油站”；再用“记忆口诀”回忆；最后挑战“闯关答题”。多读几遍、多闯几关，比赛时你也能像小灵他们一样机智！'));

const doc = new Document({
  styles: { default: { document: { run: { font: '宋体', size: 21 } } } },
  sections: [{ children }],
});
saveDoc(doc, path.join('F:/cursor20260624/output', '03-小AI探险队-AI知识大冒险(讲故事版).docx'));
