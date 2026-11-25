// 生成《婺城区中小学音乐叶惠名师工作室活动统计表（2026.2—2026.10）》
// 数据来源：公众号"叶惠名师工作坊"（gh_5db04a1963e3）合集"艺韵成长"公开推文 5 篇
// 输出：F:/cursor20260624/output/
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, TableLayoutType,
  Footer, PageNumber,
} = require('docx');

const FONT = '宋体';
const FONT_HEAD = '黑体';
const ACCENT = '1F4E79';   // 深蓝（标题）
const ACCENT2 = '2E74B5';  // 表头蓝
const TOTAL_W = 9412;      // A4 纵向 210mm - 左右各 22mm ≈ 9412 DXA

// ---------- 基础构件 ----------
const run = (text, o = {}) => new TextRun({
  text: String(text),
  bold: !!o.bold,
  size: o.size || 21,                 // 半磅：21 = 10.5pt
  font: o.font || FONT,
  ...(o.color ? { color: o.color } : {}),
});

function docTitle(text) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 32, font: FONT_HEAD, color: ACCENT })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
  });
}
function docSub(text) {
  return new Paragraph({
    children: [run(text, { size: 22, font: FONT_HEAD, color: '595959' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 260 },
  });
}
function h2(text) {
  return new Paragraph({
    children: [run(text, { bold: true, size: 26, font: FONT_HEAD, color: ACCENT })],
    spacing: { before: 300, after: 140 },
  });
}
function body(text, o = {}) {
  return new Paragraph({
    children: [run(text, { size: 21 })],
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 420, firstLineChars: 200 },
    spacing: { line: 340, after: 100 },
    ...(o.alignment ? { alignment: o.alignment } : {}),
  });
}
function note(text) {
  return new Paragraph({
    children: [run(text, { size: 19, color: '404040' })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 300, after: 80 },
  });
}

// ---------- 表格 ----------
function cell(content, {
  width, bold = false, center = false, size = 18, fill, color,
} = {}) {
  const lines = Array.isArray(content) ? content : [content];
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    ...(fill ? { shading: { fill, type: ShadingType.CLEAR, color: 'auto' } } : {}),
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    verticalAlign: 'center',
    children: lines.map((t) => new Paragraph({
      children: [run(t, { bold, size, ...(color ? { color } : {}) })],
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { line: 280, after: 0 },
    })),
  });
}

const BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 6, color: '7F7F7F' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '7F7F7F' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '7F7F7F' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '7F7F7F' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
};

function buildTable(headers, widths, rows, centerCols = []) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, {
      width: widths[i], bold: true, center: true, size: 19, fill: ACCENT2, color: 'FFFFFF',
    })),
  });
  const dataRows = rows.map((r, ri) => new TableRow({
    children: r.map((c, ci) => cell(c, {
      width: widths[ci],
      center: centerCols.includes(ci),
      size: 18,
      ...(ri % 2 === 1 ? { fill: 'F2F6FB' } : {}),
    })),
  }));
  return new Table({
    width: { size: TOTAL_W, type: WidthType.DXA },
    columnWidths: widths,          // 必须显式给出，否则 tblGrid 全是默认 100，固定布局下列宽会塌
    layout: TableLayoutType.FIXED,
    borders: BORDERS,
    rows: [headerRow, ...dataRows],
  });
}

// ---------- 数据 ----------
const ACTIVITIES = [
  [
    '1',
    ['2026.2.9', '（周一）'],
    '工作室开班仪式暨第一次研修活动',
    ['金华市站前小学；', '金华市教育教学研究中心教研员李思慧、婺城区教研室教研员方秀娟莅临指导；', '主持人叶惠、导师梅映及全体成员'],
    '宣读工作室班委（班长项益莲、组织委员陈玲、学习委员施灿、宣传委员张可歆）；阐述三年发展规划与2026年度活动计划，确立"思行并进，逐梦前行"团队愿景；宣布"童声合唱教学""教、学、评一体化""跨学科项目化学习""一、三、五模式教学"四个专题研究小组分工；成员代表项益莲、金玘晗、潘莹发言；举行揭牌仪式；李思慧作微讲座《素养视域下的音乐项目化学习》',
  ],
  [
    '2',
    ['2026.3.27', '（周五）'],
    '工作室课题研究指导会',
    ['金华市站前小学；', '特邀婺城区教科所所长夏胜华；', '导师叶惠、梅映，全体成员及站前小学音乐组教师'],
    '五位成员依次汇报课题成果：项益莲《文化能量站：AI赋能小学班级合唱的内生路径研究》、陈玲《初中生音乐社会情感能力"原境涵养"策略研究》、傅毅君《从"阿婺剧社"到校本课程：文化自信视域下小学婺剧艺术体系的构建研究》、刘笑笑《灵音合鸣：小学音乐课堂多声部演唱教学的实践探索》、潘莹《"趣"与"规"的平衡：基于OPEN理念的小学音乐课堂常规阶梯式养成研究》；夏胜华、叶惠、梅映三位专家逐一作"一对一"点评并优化课题题目；叶惠提出音乐教师"讲台、舞台、案台"三轨列车理念',
  ],
  [
    '3',
    ['2026.4.29', '（周三）'],
    '工作室第三次研训活动暨婺城区音乐骨干教师"周三之约"',
    ['金华市站前小学名师报告厅；', '婺城区音乐教研员方秀娟、婺城区音乐骨干教师、站前小学音乐组全体教师及工作室全体成员；', '刘笑笑主持'],
    '叶惠作专题讲座《磨文之道：中小学音乐教学论文写作与修改》，从选题策略、结构搭建、写作技巧、论文修改、论文发表六个方面系统指导，提出选题"实践性、小切口、学科性、创新性"四原则；方秀娟作活动总结，分析区域论文评审现状；会后叶惠针对教师带来的论文草稿开展一对多深度指导',
  ],
  [
    '4',
    ['2026.5.12', '—5.14'],
    '2026年金华市中小学生艺术节观摩（艺术节观摩札记）',
    ['金华市艺术节赛场；', '工作室成员陈玲、刘笑笑、李艳丹、金梅、周思忆、夏筱弈等'],
    '观摩小学甲组舞蹈专场（30个参赛节目）与戏剧专场（11个节目）；六位成员撰写观摩札记并在公众号推送，从选题智慧、编导手法、细节打磨等角度反思日常教学；婺城区节目《龙文》获第一名、《夺锦》获第二名',
  ],
  [
    '5',
    ['2026.9.24', '（周四）'],
    '工作室第七次活动暨金师附小教共体梅映名师工作室第四次活动',
    ['金华市婺城区白龙桥实验小学；', '工作室全体成员及教共体学校骨干教师；', '白龙桥实验小学金湛主持'],
    '围绕"乡村美育浸润——立足乡土资源，深耕音乐课堂，赋能乡村学校美育实践"主题，项益莲作《行走的美育：用童声合唱照亮童心》、陈玲作《核心素养下中学音乐课堂的美育浸润实践》、梅映作《深耕美育 研有所悟》三场专题讲座；叶惠作总结发言，强调"以研促教、以教立研"；全体人员实地考察乡村美育浸润基地',
  ],
];

const STATS = [
  ['活动场次', '5 场', '2026年2月9日—9月24日，均为有公开报道的活动；统计截止2026年10月8日'],
  ['校内举办', '4 场', '金华市站前小学3场（2月、3月、4月），婺城区白龙桥实验小学1场（9月）'],
  ['校外观摩', '1 次', '2026年金华市中小学生艺术节（小学甲组舞蹈专场、戏剧专场）'],
  ['特邀指导专家', '3 人', '李思慧（金华市教育教学研究中心教研员）、方秀娟（婺城区音乐教研员）、夏胜华（婺城区教科所所长）'],
  ['专题讲座', '5 场次', '李思慧1场（开班微讲座）、叶惠1场（论文写作）、项益莲/陈玲/梅映各1场（乡村美育）'],
  ['成员课题汇报', '5 项', '项益莲、陈玲、傅毅君、刘笑笑、潘莹，涵盖AI赋能合唱、音乐疗愈、婺剧课程、多声部教学、课堂常规等方向'],
  ['观摩札记撰稿', '6 人', '陈玲、刘笑笑、李艳丹、金梅、周思忆、夏筱弈'],
  ['专题研究小组', '4 个', '童声合唱教学、"教、学、评"一体化、跨学科项目化学习、"一、三、五"模式教学'],
  ['省级科研成果', '1 项', '导师梅映《儿童婺剧：乡村小学美育浸润在地化实践》获浙江省基础教育教学成果二等奖（9月24日活动现场介绍）'],
  ['公众号推文', '5 篇', '公众号"叶惠名师工作坊"（gh_5db04a1963e3），合集"艺韵成长"'],
];

const POSTS = [
  ['1', '2026-02-09', '聚力启新程，共绘美育图——婺城区中小学音乐叶惠名师工作室开班仪式暨第一次研修活动圆满举行'],
  ['2', '2026-03-30', '专家引领明方向 乐研结合促成长——叶惠名师工作室课题研究指导会'],
  ['3', '2026-04-30', '从实践困惑到学术表达——叶惠名师工作室第三次研训活动暨婺城区音乐骨干教师"周三之约"'],
  ['4', '2026-05-16', '戏舞流光 向美而生——叶惠名师工作室艺术节观摩札记'],
  ['5', '2026-09-24', '美育浸润，携手同行——叶惠名师工作室第七次活动暨金师附小教共体梅映名师工作室第四次活动圆满举行'],
];

const NOTES = [
  '一、本表依据公众号"叶惠名师工作坊"（微信号 gh_5db04a1963e3）公开推送的活动报道整理，统计区间为2026年2月至2026年10月，截止日期为2026年10月8日。',
  '二、已公开报道的活动在推文中明确编号的为：第一次（2月9日）、第三次（4月29日）、第七次（9月24日）。第二次、第四次、第五次、第六次活动暂未见公开报道。其中3月27日课题研究指导会、5月12—14日艺术节观摩按时间顺序可能分别对应第二次、第四次活动，有待工作室确认。',
  '三、本表"活动场次"仅统计有公开报道的活动；未见报道的活动未计入，实际活动场次可能多于本表统计。',
  '四、表中涉及的课题名称、讲座题目、人员姓名均依据推文原文著录。',
];

// ---------- 组装 ----------
const children = [
  docTitle('婺城区中小学音乐叶惠名师工作室活动统计表'),
  docSub('（2026年2月—2026年10月）'),

  h2('一、基本情况'),
  body('婺城区中小学音乐叶惠名师工作室于2026年2月9日正式开班，周期三年（2026—2029年），主持人为浙江省特级教师、正高级教师叶惠，导师为叶惠、梅映（正高级教师），团队愿景为"思行并进，逐梦前行"。工作室下设"童声合唱教学""教、学、评一体化""跨学科项目化学习""一、三、五模式教学"四个专题研究小组。'),
  body('2026年2月9日至2026年10月8日期间，工作室通过公众号"叶惠名师工作坊"（合集"艺韵成长"）公开发布活动报道5篇，活动形式涵盖开班建制、课题指导、论文写作培训、艺术观摩和乡村美育浸润等，累计邀请市、区级指导专家3人，开设专题讲座5场次。'),

  h2('二、活动明细表'),
  buildTable(
    ['序号', '时间', '活动名称', '地点及参与对象', '主要内容与成果'],
    [520, 1100, 2300, 2300, 3192],
    ACTIVITIES,
    [0, 1],
  ),

  h2('三、统计汇总'),
  buildTable(
    ['统计项目', '数量', '具体说明'],
    [1900, 1100, 6412],
    STATS,
    [1],
  ),

  h2('四、公众号推文清单'),
  buildTable(
    ['序号', '发布日期', '推文标题'],
    [520, 1300, 7592],
    POSTS,
    [0, 1],
  ),

  h2('五、说明'),
  ...NOTES.map((t) => note(t)),
  new Paragraph({
    children: [run('统计截止日期：2026年10月8日', { size: 20, color: '595959' })],
    alignment: AlignmentType.RIGHT,
    spacing: { before: 300 },
  }),
];

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: FONT, size: 21 } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },               // A4 纵向
        margin: { top: 1134, right: 1247, bottom: 1134, left: 1247 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            run('', { size: 18 }),
            new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页'], font: FONT, size: 18, color: '808080' }),
          ],
          alignment: AlignmentType.CENTER,
        })],
      }),
    },
    children,
  }],
});

const outDir = 'F:/cursor20260624/output';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, '叶惠名师工作室活动统计表(2026.2-2026.10).docx');

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outFile, buf);
  console.log('已生成:', outFile);
  console.log('大小:', (buf.length / 1024).toFixed(1), 'KB');
});
