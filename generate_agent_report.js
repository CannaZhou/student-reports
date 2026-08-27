// 生成竞赛附件1《智能体设计和使用说明》Word
// 作品：《小AI探险队·知识阅读馆——人工智能知识阅读智能体》
// 用法：node generate_agent_report.js  →  output/附件1-智能体设计和使用说明.docx
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalMergeType,
} = require('docx');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = '附件1-智能体设计和使用说明-小AI探险队知识阅读馆.docx';

// ============================================================
// 辅助函数
// ============================================================
function textRun(text, opts = {}) {
  return new TextRun({
    text,
    bold: opts.bold || false,
    size: opts.size || 21,
    font: opts.font || '宋体',
    ...(opts.color ? { color: opts.color } : {}),
  });
}

function para(text, opts = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(textRun(text, opts));
  } else if (Array.isArray(text)) {
    text.forEach(t => {
      if (typeof t === 'string') runs.push(textRun(t));
      else runs.push(textRun(t.text, t));
    });
  }
  return new Paragraph({
    children: runs,
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: opts.spacing || { line: 340, after: 60 },
    ...(opts.firstLineIndent ? { indent: { firstLine: opts.firstLineIndent } } : {}),
  });
}

function heading1(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 36, font: '黑体' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
  });
}

function heading2(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 28, font: '黑体' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 120 },
  });
}

// 正文段落（首行缩进2字符）
function bodyPara(text, opts = {}) {
  return para(text, { firstLineIndent: 420, ...opts });
}

// 单元格：内容段
function cellPara(text, opts = {}) {
  return new Paragraph({
    children: Array.isArray(text)
      ? text.map(t => (typeof t === 'string' ? textRun(t) : textRun(t.text, t)))
      : [textRun(text, opts)],
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: { line: 320, after: 40 },
    ...(opts.firstLineIndent ? { indent: { firstLine: opts.firstLineIndent } } : {}),
  });
}

const BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4 },
  bottom: { style: BorderStyle.SINGLE, size: 4 },
  left: { style: BorderStyle.SINGLE, size: 4 },
  right: { style: BorderStyle.SINGLE, size: 4 },
};

// 标签单元格（加粗、居中、浅灰底）
function lblCell(text, width, opts = {}) {
  return new TableCell({
    children: [cellPara(text, { alignment: AlignmentType.CENTER, bold: true, font: '黑体' })],
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: '#EFEFEF' },
    borders: BORDER,
    verticalAlign: 'center',
    ...(opts.columnSpan ? { columnSpan: opts.columnSpan } : {}),
    ...(opts.verticalMerge ? { verticalMerge: opts.verticalMerge } : {}),
  });
}

// 内容单元格（左对齐）
function valCell(paras, width, opts = {}) {
  const arr = Array.isArray(paras) ? paras : [paras];
  return new TableCell({
    children: arr.map(p => (p instanceof Paragraph ? p : cellPara(p))),
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: BORDER,
    verticalAlign: opts.verticalAlign || 'center',
    ...(opts.columnSpan ? { columnSpan: opts.columnSpan } : {}),
  });
}

// 空行占位
function blankLine() {
  return new Paragraph({ children: [new TextRun({ text: ' ' })], spacing: { after: 0 } });
}

// ============================================================
// 文档内容
// ============================================================
const CASE = {
  unit: '（与公章一致）',
  address: '（填写学校通讯地址）',
  subject: '□幼儿园  ■小学  □初中  □高中  □特教  □中等职业教育',
  direction: '□以智助教  ■以智助学  □以智助研  □以智助管  □以智助评  □其他',
  course: '三年级 至 六年级；学科：信息科技；单元：人工智能初步；课程（若有）：人工智能知识阅读',
  name: '小AI探险队·知识阅读馆——人工智能知识阅读智能体',
};

function buildFormTable() {
  const R = (cells) => new TableRow({ children: cells });
  const rows = [];

  // 申报单位 / 通讯地址 / 学段 / 作品方向 / 适用课程 / 作品名称
  for (const [l, v] of [
    ['申报单位', CASE.unit],
    ['通讯地址', CASE.address],
    ['学段', CASE.subject],
    ['作品方向', CASE.direction],
    ['适用课程', CASE.course],
    ['作品名称', CASE.name],
  ]) {
    rows.push(R([
      lblCell(l, 20),
      valCell(v, 80, { columnSpan: 3 }),
    ]));
  }

  // 第一作者（标签纵向合并4行）
  rows.push(R([
    lblCell('第一作者', 20, { verticalMerge: VerticalMergeType.RESTART }),
    lblCell('姓名', 27),
    lblCell('职务', 27),
    lblCell('职称', 26),
  ]));
  rows.push(R([
    lblCell('', 20, { verticalMerge: VerticalMergeType.CONTINUE }),
    valCell('', 27),
    valCell('', 27),
    valCell('', 26),
  ]));
  rows.push(R([
    lblCell('', 20, { verticalMerge: VerticalMergeType.CONTINUE }),
    lblCell('办公电话', 27),
    lblCell('手机', 27),
    lblCell('电子邮箱', 26),
  ]));
  rows.push(R([
    lblCell('', 20, { verticalMerge: VerticalMergeType.CONTINUE }),
    valCell('', 27),
    valCell('', 27),
    valCell('', 26),
  ]));

  // 团队成员
  rows.push(R([
    lblCell('团队成员', 20),
    valCell('（含第一作者不超过 5 人，姓名、单位、职务/职称）', 80, { columnSpan: 3 }),
  ]));
  for (let i = 0; i < 3; i++) {
    rows.push(R([
      valCell('', 20, { columnSpan: 4 }),
    ]));
  }

  return new Table({ rows });
}

// ---------- 设计与使用说明 ----------
const DEV_BG = [
  '小学信息科技课程《人工智能初步》单元，学生对AI充满好奇，但AI科普阅读普遍存在"买书容易、读不懂、读不深、读不久"的突出问题。具体痛点有四：其一，班级人数多，教师难以逐一追踪每位学生的课外阅读进度与理解情况，阅读处于"读了没有、懂没懂"的盲区；其二，机器学习、数据、算法等概念抽象，学生独自阅读遇到不懂之处无人可问，容易半途而废；其三，传统阅读缺少即时反馈与激励，学生难以坚持；其四，家长对人工智能知识普遍不熟悉，难以在家庭场景中辅导孩子阅读。',
  '可行性分析：借助生成式人工智能自主创作，可以把"书本"低成本升级为"会对话的智能体"——只要有一个能上网的浏览器地址，学生就能打开"读故事→问AI→闯关→攒存折"的阅读学习闭环；AI伙伴随时答疑解惑，游戏化机制激励持续阅读，教师端可实时查看全班阅读数据。作者此前已自主开发并真实运行一个AI知识答题系统（30余名学生、2483道题长期使用），验证了"自建网页应用＋真实数据积累"的完整可行路径。本次直接复用该系统的账号、题库、判分与部署，把答题网页升级为真正的人工智能阅读智能体。',
];

const DESIGN_THINK = [
  '（一）平台/技术选择',
  '开发平台：自建Web应用，纯Node.js＋JSON文件存储，无第三方框架依赖，复用已稳定运行半年的AI知识答题系统底层（账号体系、题库、判分、部署），零改造成本。',
  'AI能力：接入DeepSeek大模型API（deepseek-chat文本对话），按token计费，全班一学期使用成本约1～8元，100元预算绰绰有余；教室断网或接口异常时自动切换为本地知识卡回答，保证课堂不中断。',
  '部署方式：机房本地服务器运行＋cloudflared隧道提供公网地址，学生用浏览器访问即可，无需安装任何软件，电脑、平板、手机均可用。',
  '（二）开发过程（突出"可复现"）',
  '1.构建知识库：将原创《小AI探险队：AI知识大冒险》六章连载故事与AI知识框架整理为结构化JSON知识库（每章含故事正文、知识加油站、记忆口诀、知识卡、闯关题号），并编写一键重建脚本build_books.js——他人下载代码后运行一条命令即可从原始素材重新生成知识库，做到"数据可复现"。',
  '2.编写提示词：为AI伙伴"点点"设计系统提示词，含四部分：①角色设定（守护精灵点点，采用3—6年级儿童话术）；②"助读不代读"原则（只启发引导，不直接透露答案）；③当前章节知识库注入（作为回答依据，且不注入闯关答案，防止泄题）；④结尾追问，把"告诉"变成"对话"。',
  '3.设计交互逻辑：采用"章节解锁制"——读完本章故事才能闯关，闯关通过才解锁下一章；每章设"和点点聊聊"入口，AI对话次数计入阅读存折。',
  '4.编写代码：新增阅读端API（书架/章节/闯关/AI伴读/存折/排行）、大模型适配层llm.js（超时熔断＋离线兜底）、学生端页面与教师端阅读统计，模块化、注释完整。',
  '5.自测与文档：编写隔离冒烟测试（22项用例全部通过，不影响线上数据），提供配置模板llm.config.example.json、部署使用手册和本申报书，确保他人可复现。',
];

const FUNC_ARCH = [
  '六大功能模块：',
  '1.📚 我的书架——六章AI历险故事阅读，附知识加油站、记忆口诀、知识卡；',
  '2.💬 AI伴读——与AI伙伴"点点"对话，基于本章知识库答疑解惑，支持多轮上下文，离线自动兜底；',
  '3.🎯 阅读闯关——每章6题，复用2483道题库自动判分并即时给出解析，答对得积分；',
  '4.📕 阅读存折——积分、进度与五枚徽章（启程之星、阅读新星、故事大王、闯关达人、追问小能手），游戏化激励；',
  '5.🏆 阅读之星——全班阅读排行榜，激发竞争与坚持；',
  '6.👩‍💻 教师端阅读统计——每章完成人数、平均分、对话次数、每位学生进度明细，支撑精准辅导。',
];

const APPLY = [
  '真实落地：依托已运行半年的答题系统真实数据（30余名学生、2483道题长期使用），本次为阅读馆新增试用，形成"答题＋阅读"双场景真实使用闭环，均产生真实学生数据。',
  '应用过程：学生在机房或家庭用浏览器打开链接→登录→书架选章→读故事→与"点点"对话提问→闯关→攒积分换徽章；教师随时查看阅读统计并据此辅导。',
  '教学效益：AI伴读实现"一对一"个性化答疑，替代教师逐人讲解；即时反馈＋徽章排行显著提升阅读坚持度；教师端数据可视化，阅读追踪效率大幅提升。',
  '数据展示：试用期阅读进度、闯关成绩、对话记录、教师统计截图等数据，见随附演示视频与后续应用反馈。',
];

const INNOVATION = [
  '交互模式创新：首创"读—问—测—励"四环联动的阅读智能体交互模式；AI角色"点点"融入故事IP，儿童化话术降低使用门槛；"助读不代读"的设计将AI伦理教育融入日常学习；章节解锁式游戏化闯关激发持续阅读。',
  '场景挖掘：同时覆盖课堂共读与课外自主阅读双场景，把已有的"答题网页"升级为"会对话的智能体"，真实解决小学AI阅读"无人可问、无人追踪、难以坚持"的痛点。',
  '技术特色：大模型对话（DeepSeek）与确定性题库判分协同，既聪明又严谨；断网自动兜底，保障课堂不中断；采用结构化知识库注入式构建，不依赖向量数据库也能做到回答有据可依，便于其他教师快速复现。',
];

const OTHER = '作者愿意共享全部代码与提示词，并同意配合主办方将作品上架AI会学平台，供更多师生使用。';

const RES_CODE = [
  '完整源码（学生端、教师端、服务端、数据存储模块，均为纯Node.js，无外部框架）；',
  'build_books.js 知识库一键重建脚本（可复现数据生成）；',
  'llm.config.example.json 大模型配置模板（含申请API密钥指引）；',
  'smoke_reading.js 隔离冒烟测试脚本（22项用例，不影响线上数据）；',
  '启动与发布脚本（含cloudflared隧道发布）。',
];

const RES_DOC = [
  '本申报书（智能体设计和使用说明）；',
  '部署使用手册（含配置API密钥、启动服务、隧道发布、学生端与教师端操作说明）；',
  '开发记录（含提示词模板、知识库结构、交互逻辑说明）。',
];

// 设计说明表格（外栏"设计与使用说明"纵向合并）
function buildDesignTable() {
  const rows = [];
  const R = (cells) => new TableRow({ children: cells });
  const mk = (label, content) => [
    lblCell('设计与使用说明', 16, { verticalMerge: VerticalMergeType.CONTINUE }),
    lblCell(label, 18),
    valCell(content, 66, { verticalAlign: 'top' }),
  ];
  rows.push(R([
    lblCell('设计与使用说明', 16, { verticalMerge: VerticalMergeType.RESTART }),
    lblCell('开发背景', 18),
    valCell(DEV_BG, 66, { verticalAlign: 'top' }),
  ]));
  rows.push(R(mk('设计思路', DESIGN_THINK)));
  rows.push(R(mk('功能架构', FUNC_ARCH)));
  rows.push(R(mk('应用效果\n（若有）', APPLY)));
  rows.push(R(mk('特色与创新', INNOVATION)));
  rows.push(R(mk('其他', OTHER)));
  return new Table({ rows });
}

// 配套资源表格
function buildResourceTable() {
  return new Table({ rows: [
    new TableRow({ children: [
      lblCell('配套资源', 16, { verticalMerge: VerticalMergeType.RESTART }),
      lblCell('代码\n（可选）', 18),
      valCell(RES_CODE, 66, { verticalAlign: 'top' }),
    ] }),
    new TableRow({ children: [
      lblCell('', 16, { verticalMerge: VerticalMergeType.CONTINUE }),
      lblCell('文档', 18),
      valCell(RES_DOC, 66, { verticalAlign: 'top' }),
    ] }),
  ] });
}

// 作者声明表
function buildDeclareTable() {
  const sig = [
    '我在此声明：该案例为本人原创，不涉及抄袭或侵犯他人著作权等问题。',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '作者签名：__________________',
    '年　　月　　日',
  ];
  return new Table({ rows: [
    new TableRow({ children: [
      lblCell('作者声明', 20),
      valCell(sig, 80, { verticalAlign: 'top' }),
    ] }),
  ] });
}

// 单位意见表
function buildUnitTable() {
  const rows = [];
  rows.push(new TableRow({ children: [
    lblCell('作者所在单位意见', 20),
    valCell('同意/不同意上报', 80, { verticalAlign: 'center' }),
  ] }));
  rows.push(new TableRow({ children: [
    lblCell('', 20),
    valCell(['', '', '', '', '', '单位（盖章）', '年　　月　　日'], 80, { verticalAlign: 'top' }),
  ] }));
  return new Table({ rows });
}

function generateDoc() {
  const children = [];

  // 标题
  children.push(heading1('附件1'));
  children.push(heading2('智能体设计和使用说明'));

  // 申报信息表
  children.push(buildFormTable());
  children.push(blankLine());

  // 设计与使用说明
  children.push(buildDesignTable());
  children.push(blankLine());

  // 配套资源
  children.push(buildResourceTable());
  children.push(blankLine());

  // 作者声明 / 单位意见
  children.push(buildDeclareTable());
  children.push(blankLine());
  children.push(buildUnitTable());
  children.push(blankLine());

  // 共享提示
  children.push(para([
    { text: '共享提示：', bold: true },
    '同意将智能体作品上架到 AI 会学平台（网址：https://edu.zjicpc.com），并在主办单位活动网站共享。',
  ], { spacing: { line: 340, after: 60 } }));

  return new Document({
    creator: '小学信息科技教师',
    title: '智能体设计和使用说明',
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children,
    }],
  });
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('📄 正在生成《智能体设计和使用说明》...');
  const doc = generateDoc();
  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
  fs.writeFileSync(outputPath, buffer);
  console.log('✅ 生成完成！');
  console.log('   文件:', outputPath);
  console.log('   大小:', (buffer.length / 1024).toFixed(1), 'KB');
}

main().catch(err => { console.error('❌ 运行出错:', err); process.exit(1); });
