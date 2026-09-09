// 数据初始化/更新：
//  1) content.json：写入「六年级上册 · 第一单元 算法实现 · 第1课 算法与问题解决」检测卷（5 题）
//  2) roster.json：名单为空时写入 4 个年级示例账号（老师可用教师端导入真实名单覆盖）
// 运行：node tools/seed.js   （可重复运行：仅覆盖第1课，名单不重复添加）
const fs = require('fs');
const path = require('path');
const DATA = path.resolve(__dirname, '..', 'app', 'data');
const R = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const W = (f, o) => fs.writeFileSync(path.join(DATA, f), JSON.stringify(o, null, 1));

// ---------- 题目数据 ----------
const Q1 = {
  id: '6-1-1-q1', type: 'judge', points: 10, level: 1,
  q: '妈妈让小华煮饭，他记下步骤：①淘米 ②加水到刻度 ③插电源按下“煮饭” ④等指示灯跳闸。小华说：“我照着这个顺序一步步做，这就是一个算法。”小华说得对吗？',
  answer: 'A', expl: '对。做一件事所安排的一系列明确、有序的步骤就是算法。煮饭按步骤进行就是算法，算法就存在于我们的日常生活中。',
};

const Q2 = {
  id: '6-1-1-q2', type: 'single', points: 15, level: 1,
  q: '操场上常有同学拿错校服，老师想请程序员用计算机帮忙：每个学生刷一下校牌就能找到自己的校服。在用计算机实现“找校服”算法时，正确的先后顺序是（　）。',
  options: [
    { key: 'A', text: '设计算法 → 抽象与建模 → 问题分析 → 验证算法' },
    { key: 'B', text: '抽象与建模 → 问题分析 → 设计算法 → 验证算法' },
    { key: 'C', text: '问题分析 → 抽象与建模 → 设计算法 → 验证算法' },
    { key: 'D', text: '验证算法 → 设计算法 → 问题分析 → 抽象与建模' },
  ],
  answer: 'C',
  expl: '用计算机实现算法的一般步骤是：问题分析 → 抽象与建模 → 设计算法 → 验证算法。要先分析问题，而不是一上来就写程序。',
};

const q3b1 = blank('q3b1', '（1）', 6, '变量', '变量', ['变量', '一个变量'],
  '“确定变量”里给要统计的数据起的名字，就叫变量。');
const q3b2 = blank('q3b2', '（2）', 7, '抽象与建模', '抽象与建模', ['抽象与建模', '抽象建模'],
  '确定变量、抽象规则、建立模型，属于“抽象与建模”这一环节。');
const q3b3 = blank('q3b3', '（3）', 7, '验证算法', '验证算法', ['验证算法'],
  '最后一步是“验证算法”：可以在流程图中代入数据检查，也可以运行程序来验证。');

// 填空按“每空几个候选词”设计：各自给贴合语境、可读性强的少量词（首项=正确项）
// 不用 blank() 默认的流程图全局干扰池，避免把“A 的得票数加 1”等不相干词混进填空选项。
q3b1.words = ['变量', '常量', '数组'];
q3b2.words = ['抽象与建模', '设计算法', '问题分析'];
q3b3.words = ['验证算法', '抽象与建模', '编写程序'];

const Q3 = {
  id: '6-1-1-q3', type: 'fill', points: 20, level: 2,
  q: '学校要统计六年级各班近视人数，用于调整课桌椅。小林先想清楚要记录“每个班的近视人数”，给它取个名字 X；再定规则：按学号一个个问，是近视的就把 X 加 1。请补全：把“每个班的近视人数”记为 X，属于【抽象与建模】环节中的“确定　　（1）　　”；小林从提出问题到得到结果，要经历的完整环节依次是：问题分析 →　　（2）　　→ 设计算法 →　　（3）　　。',
  blanks: [q3b1, q3b2, q3b3],
  expl: '“确定变量”给数据取名；“抽象与建模”的任务是确定变量、抽象规则、建立模型；完整环节是 问题分析→抽象与建模→设计算法→验证算法。',
};

const Q4 = {
  id: '6-1-1-q4', type: 'multi', points: 25, level: 2,
  q: '班级要办“旧书义卖”，小红用流程图设计好了统计每本书卖出数量的算法。她在电脑上验证这个算法是否正确，下列做法中可取的有（　　）。',
  options: [
    { key: 'A', text: '在流程图中代入具体的卖出数据，一步一步检查结果对不对' },
    { key: 'B', text: '把算法编成程序，输入几组不同的样例数据运行，观察输出' },
    { key: 'C', text: '故意输入一些“没有卖出的书”等特殊数据，看程序如何处理' },
    { key: 'D', text: '只要画流程图时大家觉得合理，就算验证完成了' },
  ],
  answer: 'A,B,C',
  expl: '验证算法可以“在流程图中代入具体数据人工检查”，也可以“编成程序用几组数据运行检验”，特殊数据还能测出算法没考虑周全的地方；仅凭感觉觉得合理不算验证。',
};

const Q5 = buildFlowQuestion();

function buildFlowQuestion() {
  const bInit = blank('q5b1', '', 5, 'A、B、C 的得票数都从 0 开始', 'A、B、C 的得票数都从 0 开始',
    ['A、B、C 的得票数都从 0 开始', '三个计数器都归零', '三个计数器都从 0 开始'],
    '先用一个“初始化”步骤，把三个项目的得票数都清零，才能开始统计。');
  const bA = blank('q5b2', '', 5, '是 A 吗？', '是 A 吗？',
    ['是 A 吗？', '是 a 吗？', 'x 是 A 吗？'],
    '第一个判断：读入的投票字符是不是 A。');
  const bB = blank('q5b3', '', 5, '是 B 吗？', '是 B 吗？',
    ['是 B 吗？', '是 b 吗？', 'x 是 B 吗？'],
    '不是 A，再判断是不是 B。');
  const bC = blank('q5b4', '', 5, '是 C 吗？', '是 C 吗？',
    ['是 C 吗？', '是 c 吗？', 'x 是 C 吗？'],
    '本课只学过 A、B 两个选项，现在多了 C，所以要再补一个“是 C 吗？”的判断。');
  const bCountC = blank('q5b5', '', 5, 'C 的得票数加 1', 'C 的得票数加 1',
    ['C 的得票数加 1', 'C 票数加 1', 'C 的得票数 +1'],
    '投给 C 的票，就把 C 的得票数加 1（对照上面 A、B 的做法）。');
  const bInvalid = blank('q5b6', '', 5, '提示“输入有误”，这次不计票', '提示“输入有误”，这次不计票',
    ['提示“输入有误”，这次不计票', '提示输入有误不计票', '报错，这次不算票'],
    '如果输入的既不是 A 也不是 B 也不是 C（比如按成了数字 9），不能让乱输入影响统计——要提示“输入有误”，并且这次不计票。');

  // 菱形高度 96（原来 150 偏高占地）；整列纵向间距收紧，画布整体变矮
  const nodes = [
    n('nStart', 'term', 150, 55, 160, 46, '开始'),
    n('nInit', 'proc', 150, 150, 270, 58, '{q5b1}'),
    n('nRead', 'io', 150, 240, 210, 52, '读入一个投票字符 x'),
    n('nCondA', 'diamond', 150, 340, 200, 96, '{q5b2}'),
    n('nCountA', 'proc', 540, 340, 210, 56, 'A 的得票数加 1'),
    n('nCondB', 'diamond', 150, 460, 200, 96, '{q5b3}'),
    n('nCountB', 'proc', 540, 460, 210, 56, 'B 的得票数加 1'),
    n('nCondC', 'diamond', 150, 580, 200, 96, '{q5b4}'),
    n('nCountC', 'proc', 540, 580, 210, 56, '{q5b5}'),
    n('nInvalid', 'io', 150, 680, 260, 56, '{q5b6}'),
    n('nEnd', 'term', 150, 810, 170, 46, '结束（本票处理完）'),
  ];
  const edges = [
    e('nStart', 'nInit', [[150, 78], [150, 121]]),
    e('nInit', 'nRead', [[150, 179], [150, 214]]),
    e('nRead', 'nCondA', [[150, 266], [150, 292]]),
    e('nCondA', 'nCountA', [[250, 340], [435, 340]], '是'),
    e('nCondA', 'nCondB', [[150, 388], [150, 412]], '否'),
    e('nCondB', 'nCountB', [[250, 460], [435, 460]], '是'),
    e('nCondB', 'nCondC', [[150, 508], [150, 532]], '否'),
    e('nCondC', 'nCountC', [[250, 580], [435, 580]], '是'),
    e('nCondC', 'nInvalid', [[150, 628], [150, 652]], '否'),
    e('nCountA', 'nEnd', [[645, 340], [700, 340], [700, 724], [170, 724], [170, 787]]),
    e('nCountB', 'nEnd', [[645, 460], [740, 460], [740, 742], [170, 742], [170, 787]]),
    e('nCountC', 'nEnd', [[645, 580], [780, 580], [780, 760], [170, 760], [170, 787]]),
    e('nInvalid', 'nEnd', [[150, 708], [150, 787]]),
  ];
  return {
    id: '6-1-1-q5', type: 'flow', points: 30, level: 3,
    q: '学校要办“课间游戏节”，从 A 跳绳、B 踢毽子、C 跳房子三项中选一项，全校同学投票，想用计算机统计并正确处理每一个同学的投票。本课投票题只有 A、B 两个选项，这次变成三个，还要能发现乱输入的字母/数字。下面的流程图已经画好，请你从“提示词”里选词填空（选对顺序和判断条件），把算法补完整。',
    flow: { canvas: { w: 860, h: 870 }, nodes, edges, blanks: [bInit, bA, bB, bC, bCountC, bInvalid] },
    expl: '先初始化三个计数器（都从 0 开始）；读入一个投票字符 x；依次判断“是 A/B/C 吗？”，是哪项就给哪项加 1；若 A、B、C 都不是，则提示“输入有误”且不计票。这样就能正确统计三选一投票，还能把乱输入挡在外面。',
  };
}

function n(id, shape, x, y, w, h, text) {
  return { id, shape, x, y, w, h, text };
}
function e(from, to, pts, label) {
  return { from, to, pts, label: label || '' };
}
function blank(key, label, pts, show, first, accepts, expl) {
  // words：正确项 + 干扰项（自动去重，首项=正确 show）
  const set = [];
  const push = (s) => { if (!set.includes(s)) set.push(s); };
  push(show);
  ['A 的得票数加 1', 'B 的得票数加 1', 'C 的得票数加 1',
    '是 A 吗？', '是 B 吗？', '是 C 吗？',
    'A、B、C 的得票数都从 0 开始', '只统计 C 的票数',
    '提示“输入有误”，这次不计票', '把票记到 C 头上'].forEach(push);
  return { key, label, mode: 'pick', pts, show, words: set, accepts: accepts || [show], expl };
}

const LESSON1 = {
  id: '6-1-1', title: '算法与问题解决', full: 5, // 满分=题数（每题整题答对得 1 积分）
  brief: '请独立完成下面 5 题。每题都来自生活中的真实问题，并标注了难度：★ 简单、★★ 中等、★★★ 偏难。第 5 题是“流程图填空”，看清题意再选词。加油！',
  questions: [Q1, Q2, Q3, Q4, Q5],
};

// =====================================================================
// 四年级上册 · 第一单元 泛在的数据 · 第1课 身边的数据（5 题，2026-09 课堂随堂检测）
// 依据：第1课教学设计 + 学习任务单「任务三 · 探秘身边的数据」。题型覆盖 判断/单选/多选/填空(带候选词)。
// 判分：每题整题全对得 1 积分，一课满分 = 题数 = 5。
// =====================================================================
function pickBlank(key, label, pts, show, words, accepts) {
  return { key, label, mode: 'pick', pts, words, show, accepts: accepts || [show] };
}

const G4_JUDGE = {
  id: '4-1-1-q1', type: 'judge', points: 10, level: 1,
  q: '小明说：“数据就是数字。像公交站牌上的 301、体温计上的 38.5 才是数据；站名汉字、红绿灯的图形、广播里的声音都不能算数据。”小明说得对吗？',
  answer: 'B', // 错
  expl: '小明说得不对。数据不只是数字，数字、字母、有意义的符号组合，以及文字、图形、图像、音频、视频等，都可以是数据。公交站牌上的汉字站名、信号灯的图形、广播里的声音，也都是数据。',
};

const G4_SINGLE = {
  id: '4-1-1-q2', type: 'single', points: 15, level: 1,
  q: '候车大厅的屏幕上显示：“G1228 次列车 · 3 号检票口 · 正点到达”。小林看了一眼就知道该去哪里检票。下列说法正确的是（　　）。',
  options: [
    { key: 'A', text: '屏幕上的“1228、3”这些数字是数据，而“检票口”等汉字不是数据' },
    { key: 'B', text: '车次、检票口号、到达情况这些信息都是数据，能帮小林顺利乘车' },
    { key: 'C', text: '这些内容只是显示在屏幕上的，没有记下来，所以不算数据' },
    { key: 'D', text: '只有写在本子上的才算数据，屏幕和广播里的都不算' },
  ],
  answer: 'B',
  expl: '屏幕上显示的车次、检票口编号、“正点到达”等，都是有意义的数字和文字信息，都属于数据。学会观察、利用这些数据，能帮我们快速找到检票口、准时上车——这就是数据在影响生活。',
};

const G4_MULTI = {
  id: '4-1-1-q3', type: 'multi', points: 25, level: 2,
  q: '“数据就在我们身边，也影响着我们的生活。”下列做法中，属于“借助身边的数据把事情做得更好”的有（　　）。（多选）',
  options: [
    { key: 'A', text: '过马路前，先看红绿灯上倒计时的数字和图形，再决定能不能走' },
    { key: 'B', text: '想坐公交车，先看站牌上的站名文字，判断坐哪一路、在哪站下' },
    { key: 'C', text: '发烧了，医生看着体温和化验单上的数据，判断病情、再开药' },
    { key: 'D', text: '把不再用的旧手机直接扔进垃圾桶，不在意里面的信息' },
  ],
  answer: 'A,B,C',
  expl: '红绿灯倒计时、公交站牌站名、体温和化验数据……人们借助这些数据做判断、解决生活中的问题，生活更便利。而旧手机里存着很多个人信息，随意丢弃有信息被盗用的风险，这样做不妥当。',
};

// —— 课后小测 q4/q5（概念题填空，下拉候选词）：数据形式多样、隐形数据→大数据。
//    任务三「探秘身边的数据」已搬到课内开放任务单 G4_SHEET，不再出现在自动判分卷里。
const G4_FILL_FORM = {
  id: '4-1-1-q4', type: 'fill', points: 25, level: 2,
  q: '【数据的形式】明天要下雨，天气预报里有表示温度的“25℃”、汉字“小雨”、还有下雨的图标，它们都在告诉人们“明天的天气”这个事物，只是数据的（1）　　不同——数字、文字、图形、声音等都可以是数据。其中“25℃”是用（2）　　记录的。',
  blanks: [
    pickBlank('q4b1', '（1）', 12, '形式',
      ['形式', '大小', '颜色'], undefined),
    pickBlank('q4b2', '（2）', 13, '数字',
      ['数字', '拼音', '图形'], undefined),
  ],
  expl: '数据不只是数字。同一个事物（比如明天的天气）既可以用数字“25℃”表示，也可以用汉字“小雨”、图形图标来表示——数据有多种多样的形式。',
};

const G4_FILL_CLOUD = {
  id: '4-1-1-q5', type: 'fill', points: 25, level: 2,
  q: '【隐形数据与大数据】回到家里，把手指放到智能锁上，“嘀”一声门就开了——门锁认出的指纹是数据；一天下来，手机悄悄记下了你今天走了多少步，这也是数据。像这样不用我们开口、由设备自动采集到的数据，常被称为（1）　　的数据；当它们数量巨大、种类又多，达到一定的规模和复杂性时，就汇成了（2）　　。',
  blanks: [
    pickBlank('q5b1', '（1）', 12, '隐形',
      ['隐形', '无用', '多余'], undefined),
    pickBlank('q5b2', '（2）', 13, '大数据',
      ['大数据', '小数据', '乱数据'], undefined),
  ],
  expl: '指纹、步数、体温这些不用我们亲口说出、就被设备悄悄采集到的数据，是“隐形的数据”；当它们数量巨大、种类繁多，达到一定规模时，就形成了大数据。',
};

// —— 课内开放任务单（不判分、不计小测积分，只记录学生所填；教师端可查看）——
//    内容照《第1课 身边的数据任务单.docx》任务三 原文，一字不改。
const G4_SHEET = {
  title: '课内任务单',
  heading: '【学习任务三】探秘身边的数据',
  intro: '请同学们选择2-3处场景，探秘身边的数据。请思考并填写任务单。',
  caption: '“探秘身边的数据”任务单',
  cols: [
    { key: 'scene', label: '场景' },
    { key: 'data', label: '数据' },
    { key: 'impact', label: '影响' },
  ],
  rows: 3,
  example: {
    scene: '上学途中',
    data: '交通信号灯上的数字，禁止通行的形状',
    impact: '帮助行人或司机判断是否通行，维护交通秩序',
  },
  remind: '校园中的数据、上学途中的数据、图书馆中的数据、教室里的数据、家里的数据、网络上的数据、医院里的数据等。',
};

const G4_LESSON = {
  id: '4-1-1', title: '身边的数据', full: 5, // 满分=题数（课后小测每题整题全对得 1 积分）
  brief: '《身边的数据》分两部分：点【课内任务单】打开“探秘身边的数据”任务单，选 2-3 处场景填写（可反复修改，写错不怕）；点【课后小测】完成 5 道自动判分题（判断/单选/多选直接点选，填空题用“下拉候选词”点选），每题整题全对得 1 积分，一课满分 5 分。加油！',
  questions: [G4_JUDGE, G4_SINGLE, G4_MULTI, G4_FILL_FORM, G4_FILL_CLOUD],
  sheet: G4_SHEET,
};

// ---------- 写 content.json ----------
function ensureDir() { fs.mkdirSync(DATA, { recursive: true }); fs.mkdirSync(path.join(DATA, 'progress'), { recursive: true }); }

function upsertLesson(c, grade, semester, unitId, unitTitle, lesson) {
  let g = c.grades.find((x) => x.grade === grade && x.semester === semester);
  if (!g) { g = { grade, semester, units: [] }; c.grades.push(g); }
  let u = g.units.find((x) => x.id === unitId);
  if (!u) { u = { id: unitId, title: unitTitle, lessons: [] }; g.units.push(u); }
  const i = u.lessons.findIndex((l) => l.id === lesson.id);
  if (i >= 0) u.lessons[i] = lesson; else u.lessons.push(lesson);
}

function writeContent() {
  let c = { version: 1, grades: [] };
  try { c = R('content.json'); } catch (e) { /* 首次 */ }
  if (!Array.isArray(c.grades)) c.grades = [];
  upsertLesson(c, 6, '上', '6-1', '算法实现', LESSON1);
  upsertLesson(c, 4, '上', '4-1', '泛在的数据', G4_LESSON);
  W('content.json', c);
  console.log('✓ content.json：六年级·算法实现·第1课 与 四年级·泛在的数据·第1课《身边的数据》均已就绪');
}

function writeRoster() {
  let r = { version: 1, list: [] };
  try { r = R('roster.json'); } catch (e) { /* 首次 */ }
  if (Array.isArray(r.list) && r.list.length) {
    console.log('• roster.json 已有名单，跳过示例账号（如需示例请清空该文件后重跑）');
    return;
  }
  const demos = [
    ['示例·六年级', '示例班级（六）', 6],
    ['示例·五年级', '示例班级（五）', 5],
    ['示例·四年级', '示例班级（四）', 4],
    ['示例·三年级', '示例班级（三）', 3],
  ].map(([name, className, grade]) => ({
    uid: name + '｜' + className, name, className, grade,
    active: true, createdAt: new Date().toISOString(),
  }));
  r.list = demos;
  W('roster.json', r);
  console.log('✓ roster.json：已写入 4 个“示例·X年级”账号（可用教师端导入真实名单替换）');
}

ensureDir();
writeContent();
writeRoster();
console.log('完成。启动：cd app && node server.js ，或双击 启动课堂检测.bat');
