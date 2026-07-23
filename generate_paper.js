const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageNumber, PageBreak
} = require('docx');
const fs = require('fs');
const path = require('path');

// ============================================================
// 论文内容
// ============================================================

const TITLE = '成长被看见：一位信息科技教师"习惯+努力+爱心"三维数字化育人实践';
const ABSTRACT = `　　信息科技课堂因其机房环境特殊、学生操作自由度高等特点，课堂管理长期面临"管不住人手、看不见个体"的困境。该文基于作者八年的信息科技教学实践，构建了"习惯+努力+爱心"三维数字化管理体系：以习惯规则建立课堂秩序，以星级评价激励学生努力，以同伴互助培育爱心品格。该体系融合信息科技学科平台、问卷星测评工具和AI辅助积分兑换系统，实现课前、课中、课后的全流程数据采集与反馈，最终形成贯穿小学阶段的数字成长画像。实践覆盖2021级、2023级共9个班级约400名学生，积累了跨学期、跨年级的纵向数据。结果表明，三维管理体系有效实现了从"约束式管理"向"赋能式成长"的转变，让每一个孩子的努力被看见、被记录、被激励。`;
const KEYWORDS = '教育数字化；三维评价体系；积分制管理；人工智能；信息科技课堂';

// ============================================================
// 辅助函数
// ============================================================

function createParagraph(text, options = {}) {
  const { bold, size, font, alignment, spacing, indent, heading, children, numbering } = options;
  const runs = [];

  if (children) {
    // 如果有children，直接用（支持富文本）
    return new Paragraph({
      children,
      alignment: alignment || AlignmentType.LEFT,
      spacing: spacing || { line: 360, after: 60 },
      indent: indent,
      heading: heading,
      numbering: numbering,
    });
  }

  if (typeof text === 'string') {
    runs.push(new TextRun({
      text: text,
      bold: bold || false,
      size: size || 21, // 五号=10.5pt=21 half-point
      font: font || '宋体',
    }));
  }

  return new Paragraph({
    children: runs,
    alignment: alignment || AlignmentType.LEFT,
    spacing: spacing || { line: 360, after: 60 },
    indent: indent,
    heading: heading,
  });
}

function createSectionTitle(text, level) {
  const fontSizeMap = {
    1: 24, // 小四号
    2: 21, // 五号
    3: 21,
  };
  const fontMap = {
    1: '黑体',
    2: '宋体',
    3: '宋体',
  };

  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        bold: true,
        size: fontSizeMap[level] || 21,
        font: fontMap[level] || '宋体',
      }),
    ],
    alignment: AlignmentType.LEFT,
    spacing: { before: 120, after: 60 },
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
  });
}

function createBodyText(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        size: 21,
        font: '宋体',
      }),
    ],
    alignment: AlignmentType.LEFT,
    spacing: { line: 360, after: 60 },
    indent: { firstLine: 480 }, // 首行缩进2字符
  });
}

function createTable(headers, rows, caption) {
  const totalCols = headers.length;

  // 创建表头行
  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, size: 18, font: '宋体' })],
        alignment: AlignmentType.CENTER,
      })],
      shading: { type: ShadingType.CLEAR, color: 'D9E2F3' },
    })),
  });

  // 创建数据行
  const dataRows = rows.map(row => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: String(cell), size: 18, font: '宋体' })],
        alignment: AlignmentType.CENTER,
      })],
    })),
  }));

  // 表格标题和表格
  return [
    new Paragraph({
      children: [new TextRun({
        text: caption,
        bold: true,
        size: 18,
        font: '黑体',
      })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
    }),
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }),
    new Paragraph({ spacing: { after: 120 } }),
  ];
}

function createCaption(text, type) {
  const label = type === 'figure' ? '图' : '表';
  return new Paragraph({
    children: [new TextRun({
      text: `${label}  ${text}`,
      bold: true,
      size: 18,
      font: '黑体',
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 120 },
  });
}

// ============================================================
// 正文内容构建
// ============================================================

const sections = [];

// === 标题 ===
sections.push(new Paragraph({
  children: [new TextRun({
    text: TITLE,
    bold: true,
    size: 32, // 小二
    font: '宋体',
  })],
  alignment: AlignmentType.LEFT,
  spacing: { after: 200 },
}));

// === 摘要 ===
sections.push(new Paragraph({
  children: [
    new TextRun({ text: '摘要：', bold: true, size: 18, font: '宋体' }),
    new TextRun({ text: ABSTRACT, size: 18, font: '楷体' }),
  ],
  alignment: AlignmentType.LEFT,
  spacing: { line: 300, after: 60 },
  indent: { firstLine: 480 },
}));

// === 关键词 ===
sections.push(new Paragraph({
  children: [
    new TextRun({ text: '关键词：', bold: true, size: 18, font: '宋体' }),
    new TextRun({ text: KEYWORDS, size: 18, font: '楷体' }),
  ],
  alignment: AlignmentType.LEFT,
  spacing: { after: 200 },
}));

// ============================================================
// 一、为什么
// ============================================================
sections.push(createSectionTitle('一、为什么', 1));

sections.push(createBodyText('2017年，我初登信息科技讲台。机房里的画面至今记忆犹新：提早到校的学生浏览视频、偷偷玩游戏，晚到的学生匆匆入座却心不在焉，铃声响起后教室里仍是一片嘈杂。键盘敲击声此起彼伏，却鲜有敲在"正道"上的。一节40分钟的信息课，往往有近一半的时间耗费在维持课堂秩序上。我深知，信息科技课的魅力在于动手实践，但前提是——学生得"在场"，不仅身体在场，思维更要在场。'));

sections.push(createBodyText('传统的课堂管理手段在机房环境中显得力不从心。纪律扣分只能管住表面，无法激发内在；口头表扬虽好，却难以形成持续激励。最让我困惑的是：我如何知道自己教到了每个孩子？孩子又如何看见自己的成长？'));

sections.push(createBodyText('与此同时，《教育强国建设规划纲要（2024—2035年）》明确提出实施"国家教育数字化战略"，坚持应用导向、治理为基，推动集成化、智能化、国际化，建强用好国家智慧教育公共服务平台，建立横纵贯通、协同服务的数字教育体系[1]。这给了我一个重要的启发：数字化不是用机器取代教师，而是用技术让每个孩子的努力都能被看见。'));

sections.push(createBodyText('经过八年的探索与实践，我逐步构建了"习惯+努力+爱心"三维数字化管理体系，借助信息科技学科平台、问卷星测评工具和AI辅助积分兑换系统，让课堂管理从"约束"走向"赋能"。'));

// ============================================================
// 二、怎么做（详细展开）
// ============================================================
sections.push(createSectionTitle('二、怎么做', 1));

// --- (一) 三维框架的设计 ---
sections.push(createSectionTitle('（一）"习惯+努力+爱心"三维框架的设计', 2));

// 1. 习惯维度
sections.push(createSectionTitle('1. 习惯维度：建立可执行的课堂秩序', 3));
sections.push(createBodyText('习惯维度的核心是"让规则可见、可执行、可检查"，覆盖课前、课中、课后三个时段。'));
sections.push(createBodyText('课前习惯——"三分钟准备"：每节课前，学生提前三分钟排队进入机房，对号入座。我制定了12条刚性规则作为课堂底线：禁大声喧哗、禁饮料零食、禁霸占座位、禁拍打屏幕、禁抠鼠标滚轮和键盘按键、设备破损照价赔偿（故意损坏7倍赔偿）、禁乱扔垃圾、禁强制按电源键关机、禁在桌子上乱涂乱画、禁抠红色电脑序号、未经允许禁玩游戏视频、禁发表不良言论。这12条"禁"不是贴在墙上的摆设，而是开学第一课逐条解读、每个学生签字确认的契约。违反规则扣除相应习惯积分，良好的行为习惯则获得习惯星。'));
sections.push(createBodyText('课后习惯——"三件必做之事"：下课前五分钟，学生必须完成三件事——文件保存并正确关机，鼠标键盘凳子归位带回个人物品，检查座位周围卫生。这三件事看似简单，却是培养责任意识和规则意识的关键抓手。我将编成口诀，每节课下课前由组长检查组员完成情况，完成者获得当天的习惯星。习惯维度的设计理念是：将一个学期40节信息课转化为40次规则训练，让学生在重复中内化行为规范。'));

// 2. 努力维度
sections.push(createSectionTitle('2. 努力维度：构建分层可见的激励阶梯', 3));
sections.push(createBodyText('努力维度是三维体系中最核心的激励引擎，我将其设计为"课中即时激励—作业星级评价—测试积分量化"三级递进结构。'));

sections.push(createBodyText('第一级：课堂即时激励。积极举手回答问题、主动上台演示操作、提出有深度的问题——只要学生付出了"可见的努力"，就能当场获得一颗努力星。努力星采用纸质积分卡即时发放，学生可以立刻看到自己的积分增长。对于人数较多的班级（50人左右），纸质积分卡比电子系统更加灵活便捷，教师可以走到学生身边亲手发放，这个"被看见"的仪式感本身就有极强的激励效应。'));

sections.push(createBodyText('第二级：五级作业评语体系。这是最用心设计的环节。每个学生配有一本信息科技学习手册，每节课大约3到6个练习题。批改时坚持每本都写评语，而不是简单地打个"√"或"×"。根据学生完成情况，评语分为五个层次，如表1所示。'));

// 表1：五级评语体系
const table1Headers = ['完成情况', '教师评语'];
const table1Rows = [
  ['全部答对', '"作业做得很棒，请你继续保持"'],
  ['仅错一题', '"作业完成较好，细节仍需改进"'],
  ['仅对一题', '"老师期待你的进步，加油"'],
  ['全部答错', '"作业错误太多，请及时订正"'],
  ['未完成', '"作业未完成，良好习惯从小事做起"'],
];
sections.push(...createTable(table1Headers, table1Rows, '表1  五级作业评语体系'));

sections.push(createBodyText('评语不是终点。学生订正后，我会进行二次批改，在订正正确的地方盖上"已订正"印章。这样一来，学习手册成为一本不断更新的"成长日志"，每一页都记录着学生努力的痕迹。'));

sections.push(createBodyText('第三级：测试积分量化。学期末采用问卷星进行在线测评，积分与等级对应如下：未交/不及格[0,60)为一星☆，及格[60,70）为二星☆☆，良好[70,85）为三星☆☆☆，优秀[85,100]为四星☆☆☆☆。问卷星自动批改，系统实时生成每道题的正确率统计——哪些孩子对"算法思维"还没开窍，哪些孩子在"信息安全"模块掌握得特别好，数据一目了然。'));

// 3. 爱心维度
sections.push(createSectionTitle('3. 爱心维度：培育同伴互助的课堂文化', 3));
sections.push(createBodyText('爱心维度的操作路径有三条。一是课堂互帮互助：操作遇到困难时，同桌之间可以互相指导；先完成任务的同学自动成为"小老师"，帮助进度落后的同学，每一次帮助他人都能获得一颗爱心星。二是组长负责制：每小组设一名组长，负责收发小组的书本和作业本，检查课后三件事的完成情况，组长每周轮换，让每个孩子都有服务他人的机会。三是作品互评机制：在三年级《数字作品面面观》一课中，学生上传自己设计的数字作品——校园食谱、特色足球、劳动项目，主题丰富多彩。作品不再是交给老师的"作业"，而是可以被同学浏览、点赞、评论的"作品"。'));
sections.push(createBodyText('最能说明爱心维度效果的是小轩的故事。他在信息科技平台上发布了自己的作品，陆续收到五位同学的"催更"留言。他红着脸说："老师，等一下，我要回去改版！"——同伴互评激发的内驱力，远超一次打分。'));

// --- (二) 多平台融合 ---
sections.push(createSectionTitle('（二）多平台融合的数据采集与管理体系', 2));
sections.push(createBodyText('"习惯+努力+爱心"三维框架的落地，离不开多平台的数据支撑。我构建了一个"信息科技平台+问卷星+纸质积分+Excel数据库"四层数据采集体系。'));

sections.push(createSectionTitle('1. 信息科技学科平台：教学管理的主阵地', 3));
sections.push(createBodyText('信息科技平台承载了课前、课中、课后三个场景的数据采集。'));
sections.push(createBodyText('课前——分层打字训练。键盘打字是信息科技的基本功。从金山打字通到阿珊打字通，再到如今的信息科技学科平台，我一直在寻找让枯燥练习变成自驱闯关的方法。答案是：分层可见的成长路径。在平台上，我根据不同年级设置了阶梯式打字任务：三年级上册需要熟练掌握26个字母输入，达到五星通关，摘得一颗"努力星"；三年级下册的拼音练习，三星即可通关；五年级则从拼音一级开始，两星即可通关。每个学期的任务难度递进，但目标清晰可见——学生打开平台就能看到自己的当前位置，也能看到下一步的方向。当一个平时沉默寡言的男孩第一次在课堂上兴奋地喊出"老师，我通关了！"时，我意识到：让努力被看见，就是最好的内驱力。'));
sections.push(createBodyText('课中——在线作品分享与多元评价。平台的价值远不止于打字练习。在线作品分享功能，让评价从"师生单向"走向"生生互动"。学生在平台上上传数字作品，同学可以点赞、评论，教师则给予星级评价。平台自动汇总每件作品的浏览量和点赞数，生成学生个人的创作热度曲线。'));
sections.push(createBodyText('课后——校园精灵智能体。2026年，信息科技平台推出了"校园精灵智能体"，助力主题教学活动创作。《向世界介绍我的学校》《制作市花数字名片》等项目陆续上线。课堂上，完成任务早的孩子不再无所事事，而是可以自主观看项目视频，拓展认知边界。技术实现了"大规模"与"个性化"的统一——同一个课堂里，有的孩子在夯实基本功，有的在完成既定任务，有的已经在AI助手的引导下探索更广阔的世界。'));

sections.push(createSectionTitle('2. 问卷星：期末测评的数字化', 3));
sections.push(createBodyText('每学期末的测评，我全部采用问卷星在线测试。问卷星的优势在于：自动批改，客观题系统自动评分；即时反馈，提交后立即看到成绩和错题解析；学情分析，系统自动统计每道题的正确率，生成班级知识点掌握度报告；数据导出，期末积分可以直接导出到Excel数据库，与平时积分合并计算。'));
sections.push(createBodyText('例如，三年级期末测评中，系统自动统计出"算法与编程"模块班级正确率为72%，"信息安全与道德"模块为88%。这个数据告诉我"信息安全"部分掌握得不错，但"算法思维"还需要加强——下一学期的教学设计就有了精准的方向。'));

sections.push(createSectionTitle('3. 纸质积分卡：日常激励的"最后一公里"', 3));
sections.push(createBodyText('虽然数字化已经覆盖了教学的绝大部分环节，但在日常积分发放上，我坚持使用纸质积分卡。原因有两点：第一，电子加分在人数多的班级操作不便。我任教的班级多在45-50人之间，课堂上每发放一次积分都要打开手机、找到学生名字、点击加分——流程繁琐，会打断教学节奏。纸质积分卡则可以做到"看到即奖励"：走到学生身边，递上一张积分卡，说一句"你今天回答得很好"——这个仪式感是电子加分无法替代的。第二，纸质积分卡是"被看见"的具象化。学生可以把积分卡贴在文具盒上、夹在书里、带回家给父母看。积分的"可触摸性"让努力变得看得见、摸得着。'));

sections.push(createSectionTitle('4. Excel数据库：跨学期的积分总台账', 3));
sections.push(createBodyText('Excel数据库是整个数据体系的"大脑"。数据覆盖2021级1班至5班、2023级4班至7班共9个班级约400名学生。每个学生一条记录，包含学号、姓名、平时积分、期末积分、已兑换、总剩余、等级、备注等核心字段。数据库采用纵向结构，一个学生在Excel中占据8行（三年级上至六年级下），方便跨学期追踪。'));

// 表2：积分数据示例
const table2Headers = ['学期', '平时积分', '期末积分', '已兑换', '总积分'];
const table2Rows = [
  ['三年级上', '/', '/', '/', '/'],
  ['三年级下', '/', '/', '/', '/'],
  ['四年级上', '/', '/', '/', '/'],
  ['四年级下', '/', '/', '/', '/'],
  ['五年级上', '58', '35', '93', '0'],
  ['五年级下', '45', '30', '未兑换', '75'],
  ['六年级上', '—', '—', '—', '—'],
  ['六年级下', '—', '—', '—', '—'],
];
sections.push(...createTable(table2Headers, table2Rows, '表2  2021级4班方家蔚同学积分数据（五年级）'));

sections.push(createBodyText('从三年级的"无数据"（信息科技课从三年级起始），到五年级上学期平时积分58分、期末积分35分、总积分93分全部兑换，再到五年级下学期未兑换、总积分75分——一个孩子的成长轨迹清晰地呈现在数据中。'));

// --- (三) AI赋能积分兑换系统 ---
sections.push(createSectionTitle('（三）AI赋能积分兑换系统——激励闭环的最后一环', 2));
sections.push(createBodyText('积分只记录不消耗，学生会逐渐失去积累的动力。为了让积分"活"起来，我设计了一套积分兑换系统，利用Claude AI辅助实现了从积分记录到积分兑换的完整闭环。'));
sections.push(createBodyText('系统架构为Web应用，采用双端设计。教师端（http://localhost:3000/teacher/）功能包括积分管理（班级学生积分总览，支持手动加减分、批量导入导出）、兑换审核（学生提交兑换申请后，教师端收到通知，审核通过扣除相应积分）、兑换项目设置（设置可兑换的奖品、所需积分、库存数量）和数据统计（班级积分排行榜、兑换热力图）。学生端（http://10.10.100.105:3000/student）功能包括个人积分查询（实时查看自己的总积分、已兑换和剩余积分）、兑换申请（浏览可兑换项目，提交兑换申请）和兑换记录（查看历史兑换明细）。'));
sections.push(createBodyText('Claude AI在整个系统中扮演了"智能规则引擎"的角色。一是智能积分核算：系统自动从Excel数据库和问卷星中同步数据，AI负责识别数据异常，确保积分计算的准确性。二是兑换规则引擎：借助Claude AI的自然语言理解能力，只需用自然语言描述兑换规则（如"当月积分增长排名前三的学生可以兑换额外奖励"），AI即可自动解析并执行。三是数据可视化：AI自动生成班级积分分布图、个人积分变化趋势图，教师和学生都能直观地看到成长轨迹。'));

// --- (四) 成长记录单 ---
sections.push(createSectionTitle('（四）成长记录单——贯穿小学阶段的系统闭环', 2));
sections.push(createBodyText('积分兑换系统解决了"即时激励"的问题，但学生的成长需要一个更长周期、更完整的呈现方式——这就是成长记录单。'));
sections.push(createBodyText('成长记录单的核心设计理念是"成长藏在每一次的努力+习惯+爱心里"。它不是一张普通的成绩单，而是一份贯穿小学阶段（三年级上至六年级下，共8个学期）的数字化成长档案。每一份成长记录单的顶部都有学生的姓名和班级，以2021级4班的数据为基础，呈现从三年级到六年级每学期的积分变化。'));
sections.push(createBodyText('成长记录单的另一大亮点是"荣誉"板块。从全校获奖统计表中自动匹配每个学生的获奖记录，填充到成长记录单中。例如2021级4班方家蔚同学的荣誉记录：第十六届蓝桥杯全国软件和信息技术专业人才大赛青少年省赛浙江赛区Scratch二等奖、2025年婺城区师生信创技术应用创新大赛三等奖（AI创意编程项目Kitten专项，小学5-6年级组高阶）。此外，2021级4班兰容正同学获得了第十六届蓝桥杯全国软件和信息技术专业人才大赛青少年省赛浙江赛区Scratch优秀奖。这些荣誉不是教师手动输入的，而是通过脚本自动从全校获奖统计表中匹配到每个学生名下，实现了"荣誉赋能"的增值评价。'));
sections.push(createBodyText('在可视化呈现上，成长记录单设计了"收集瓶"模块：习惯瓶、努力瓶、爱心瓶三个瓶子并排排列，每个瓶子有16个格子（对应一个学期大约16次信息课），每获得一次积分就点亮一个格子，将抽象的数据转化为直观的视觉呈现。'));

// ============================================================
// 三、效果怎么样
// ============================================================
sections.push(createSectionTitle('三、效果怎么样', 1));

sections.push(createSectionTitle('（一）学生层面的变化', 2));
sections.push(createBodyText('课堂氛围实现了根本转变。八年前，我的课堂充斥着"别讲话了""坐好""关机了还在动"的提醒；八年后，这些催促声已经很少听到了，取而代之的是"老师，我通关了！""老师，我来帮她！""老师，我们今天提前到教室了！"——课堂从"约束"走向了"赋能"。'));
sections.push(createBodyText('内驱力得到了显著提升。打字练习从被动完成变成了主动闯关。以前学生练打字是为了"完成老师布置的任务"，现在他们打开平台先看自己离下一颗星还差多少分。分层任务设计让每个层次的学生都能找到自己的目标：基础好的冲击五星通关，基础弱的也能通过三星获得成就感。那个在课堂上第一次喊出"老师，我通关了！"的沉默寡言的男孩，让我确信：让努力被看见，就是最好的内驱力。'));

// 表3：积分对比
const table3Headers = ['姓名', '五年级上总积分', '五年级下总积分', '增长'];
const table3Rows = [
  ['方家蔚', 93, 75, '持续积累'],
  ['吴诣宁', 40, 76, '+36'],
  ['邓荟芝', 32, 70, '+38'],
  ['张欣楠', 75, 59, '稳定保持'],
  ['郑悠宜', 49, 52, '+3'],
  ['郑钰菡', 59, 51, '稳定保持'],
  ['方福瑞', 0, 48, '+48'],
];
sections.push(...createTable(table3Headers, table3Rows, '表3  2021级4班部分学生积分跨学期对比'));

sections.push(createBodyText('积分数据表明，多数学生从五年级上到五年级下的总积分呈上升或稳定趋势。特别值得关注的是方福瑞同学，从五年级上的0分到五年级下的48分，实现了从"零参与"到"积极参与"的突破；吴诣宁从40分增长到76分，邓荟芝从32分增长到70分，进步显著。积分上升不仅意味着行为习惯的持续向好，更说明学生已经内化了"努力—收获—再努力"的正向循环。'));

sections.push(createSectionTitle('（二）教师层面的变化', 2));
sections.push(createBodyText('从经验判断到数据驱动。以前我判断教学效果靠的是"感觉"——感觉这节课孩子们听懂了，感觉那个知识点讲透了。现在，问卷星的错题分布、平台的打字通关率、积分数据库的成长曲线——数据会说话。我不再问"我教得怎么样"，而是问"数据告诉我什么"。'));
sections.push(createBodyText('课堂管理的数字化转型。一套数据管理体系的建立，让教师从繁琐的统计工作中解放出来。纸质积分卡实现了"即时激励"，Excel数据库完成了"长期积累"，AI兑换系统打通了"激励闭环"——教师可以投入更多精力关注每个孩子的个性化需求。'));

sections.push(createSectionTitle('（三）系统闭环的长期价值', 2));
sections.push(createBodyText('数据贯通，告别信息孤岛。信息科技平台（日常学习数据）→纸质积分卡（课堂表现数据）→问卷星（期末测评数据）→Excel数据库（积分总台账）→AI兑换系统（激励闭环数据）→成长记录单（数字画像输出）——六层体系环环相扣，形成了完整的数据流转闭环。'));
sections.push(createBodyText('持续追踪，看见成长全貌。一个学生从三年级到六年级，8个学期、300余节课、数千条数据记录——这份数字画像不只是分数，更是一个孩子在"习惯培养、努力付出、爱心品格"三个维度的全面成长记录。'));
sections.push(createBodyText('普适推广，框架可迁移。该体系基于信息科技学科建立，但"习惯+努力+爱心"的三维框架和各层级的数据采集方法，完全可以迁移至其他学科。目前已有语文、数学等学科的教师开始借鉴这一模式。'));

sections.push(createSectionTitle('（四）反思与展望', 2));
sections.push(createBodyText('实践中也暴露出一些需要改进的问题。一是纸质积分卡向完全数字化转型的过渡仍需探索——当前双轨并行的模式增加了教师的工作负担。二是积分兑换系统的学生使用频率存在个体差异，需要进一步优化兑换项目的吸引力。三是"校园精灵智能体"目前仅少数学生参与，下一步将设计分层任务卡，让更多孩子按兴趣和能力选择闯关深度，让拓展不流于形式。未来，将继续完善这一体系：利用AI技术实现个性化学习路径的自动推荐，拓展校园智能体的覆盖范围，探索跨学科的数字化评价模式。'));

// ============================================================
// 四、结语
// ============================================================
sections.push(createSectionTitle('四、结语', 1));
sections.push(createBodyText('八年，足够一个孩子从懵懂稚童成长为即将毕业的少年，也足够一位教师从课堂管理的迷茫中找到方向。从"管不住"到"被看见"，从"约束式管理"到"赋能式成长"，信息科技平台、问卷星、Claude AI等工具共同搭建了"习惯+努力+爱心"三维数字化管理体系，让每一个孩子的努力被记录、被量化、被激励、被看见。'));
sections.push(createBodyText('我始终坚信：一个孩子的成长，藏在每一次被看见的努力里、每一个被养成的习惯里、每一份帮助他人的爱心里。技术赋能，不是让机器取代人，而是让每一个孩子的努力都能被看见，让每一个孩子都能在数字时代，做闪闪发光的自己。'));

// ============================================================
// 参考文献
// ============================================================
sections.push(createSectionTitle('参考文献', 1));

const refs = [
  '[1] 祝智庭,杜若.道器相济:教育数字化智慧治理的系统框架与事理研究[J].中国电化教育,2026,(1):1-12.',
  '[2] 教育部.教育强国建设规划纲要(2024—2035年)[Z].2025.',
  '[3] 中华人民共和国教育部.义务教育信息科技课程标准(2022年版)[S].北京:北京师范大学出版社,2022.',
  '[4] 余胜泉.人工智能赋能教育变革：路径与策略[J].开放教育研究,2024,30(2):12-24.',
  '[5] 黄荣怀,刘德建,刘晓琳等.人工智能教育的发展态势与未来展望[J].中国电化教育,2023,(9):1-12.',
  '[6] 顾明远.教育评价改革的几个关键问题[J].人民教育,2022,(8):13-16.',
];

refs.forEach(ref => {
  sections.push(new Paragraph({
    children: [new TextRun({ text: ref, size: 18, font: '宋体' })],
    spacing: { line: 300, after: 40 },
  }));
});

// AI声明
sections.push(new Paragraph({ spacing: { before: 200 } }));
sections.push(createBodyText('AI使用声明：本文中涉及的积分兑换系统的开发使用了Claude AI辅助编程。积分数据的处理与分析部分使用了AI工具进行辅助统计分析。文中所有案例、数据及教学实践均为作者真实经历，观点和结论由作者独立形成。'));

// ============================================================
// 生成文档
// ============================================================

async function main() {
  const doc = new Document({
    creator: '周灿娜',
    title: TITLE,
    description: '教育技术论文',
    styles: {
      default: {
        document: {
          run: { font: '宋体', size: 21 },
          paragraph: { spacing: { line: 360 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1英寸
        },
      },
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, 'output', '教育技术论文_成长被看见.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ 论文生成完成！文件: ${outputPath}`);
  console.log(`   大小: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => { console.error('生成出错:', err); process.exit(1); });
