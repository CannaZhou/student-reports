// 六上第7课《猜数字算法验证》：课内任务单上线（2026-10-28）
// 素材：f:\桌面\...\六年级上册\第7课 猜数字算法验证\ 的 pptx + 教学设计 + 官方任务单
// 官方任务单三道：① 完善流程图（加 ci 计数器）② 调整目标数、运行程序 ③ 比谁用的次数少
// 这里照这三道做，但都改成「下拉里选」——老师口径：能选就别打字，也免得差一个字被判错。
// 课后小测 5 题是老师 2026-10-28 追加的（跟第6课一个款式），证书分母＝5 + 3 = 8。
// 用法：node tools/_migrate-6-1-7.js        （只报告）
//       node tools/_migrate-6-1-7.js --apply（写进 content.json，写之前自动备份）
// 注意：7000 在跑时课程内容是常驻内存的，写完要重启 7000 才看得到（kill 掉进程，看门狗会自己拉起来）。
const fs = require('fs');
const path = require('path');

const DATA = path.resolve(__dirname, '..', 'app', 'data');
const CONTENT = path.join(DATA, 'content.json');
const APPLY = process.argv.includes('--apply');

// ---------- 任务一：流程图（照课件第17页那张图标配，缺的三个格子就是课本要学生加的） ----------
// 课件上的空：① da 后面那句初始化 ② 猜对之后输出的那句 ③ 循环里「次数 +1」那句
const G6L7_FLOW = {
  canvas: { w: 900, h: 880 },
  nodes: [
    { id: 'nStart', shape: 'term', x: 230, y: 60, w: 160, h: 48, text: '开始' },
    { id: 'nInitDa', shape: 'proc', x: 230, y: 150, w: 340, h: 56, text: 'da ← 1~100 之间某个具体数字' },
    { id: 'nInitCi', shape: 'proc', x: 230, y: 245, w: 340, h: 56, text: '{f1}' },
    { id: 'nInput', shape: 'io', x: 230, y: 340, w: 300, h: 56, text: 'cai ← 用户输入数字' },
    { id: 'nNe', shape: 'diamond', x: 230, y: 455, w: 220, h: 100, text: 'cai ≠ da ？' },
    { id: 'nOut', shape: 'io', x: 230, y: 580, w: 300, h: 56, text: '{f2}' },
    { id: 'nEnd', shape: 'term', x: 230, y: 680, w: 160, h: 48, text: '结束' },
    { id: 'nLt', shape: 'diamond', x: 600, y: 520, w: 230, h: 100, text: 'cai < da ？' },
    { id: 'nSmall', shape: 'io', x: 485, y: 640, w: 170, h: 56, text: '输出提示“小了”' },
    { id: 'nBig', shape: 'io', x: 715, y: 640, w: 170, h: 56, text: '输出提示“大了”' },
    { id: 'nInput2', shape: 'io', x: 600, y: 735, w: 260, h: 56, text: 'cai ← 用户输入数字' },
    { id: 'nInc', shape: 'proc', x: 600, y: 810, w: 260, h: 56, text: '{f3}' },
  ],
  edges: [
    { from: 'nStart', to: 'nInitDa', pts: [[230, 84], [230, 122]], label: '' },
    { from: 'nInitDa', to: 'nInitCi', pts: [[230, 178], [230, 217]], label: '' },
    { from: 'nInitCi', to: 'nInput', pts: [[230, 273], [230, 312]], label: '' },
    { from: 'nInput', to: 'nNe', pts: [[230, 368], [230, 405]], label: '' },
    { from: 'nNe', to: 'nLt', pts: [[340, 455], [600, 455], [600, 470]], label: '是' },
    { from: 'nNe', to: 'nOut', pts: [[230, 505], [230, 552]], label: '否' },
    { from: 'nOut', to: 'nEnd', pts: [[230, 608], [230, 656]], label: '' },
    { from: 'nLt', to: 'nSmall', pts: [[485, 520], [485, 612]], label: '是' },
    { from: 'nLt', to: 'nBig', pts: [[715, 520], [715, 612]], label: '否' },
    { from: 'nSmall', to: 'nInput2', pts: [[485, 668], [485, 695], [715, 695], [715, 707]], label: '' },
    { from: 'nBig', to: 'nInput2', pts: [[715, 668], [715, 695]], label: '', arrow: false },
    { from: 'nInput2', to: 'nInc', pts: [[600, 763], [600, 782]], label: '' },
    // 回到“输入”的那条线：再猜一次（同时也是「次数 +1」之后回头）
    { from: 'nInc', to: 'nInput', pts: [[600, 838], [860, 838], [860, 340], [380, 340]], label: '' },
  ],
  blanks: [
    { key: 'f1', label: '', mode: 'pick', words: ['ci ← 1', 'ci ← 0', 'da ← 1', 'ci ← ci + 1'] },
    { key: 'f2', label: '', mode: 'pick', words: ['输出“对了”和 ci 的值', '输出“对了”和 da 的值', '输出提示“小了”', '输出提示“大了”'] },
    { key: 'f3', label: '', mode: 'pick', words: ['ci ← ci + 1', 'ci ← 1', 'da ← da + 1', 'ci ← ci - 1'] },
  ],
};
const G6L7_T1 = {
  task: 1,
  heading: '【学习任务一】完善流程图：给猜数字游戏加上“记录猜测次数”的功能',
  intro: '第6课我们已经画出了“猜数字游戏”的流程图。这一课要给它加一个记录次数的变量 ci：游戏开始时先给 ci 定一个初值；用户每多猜一次，ci 就加 1；猜对的时候，把 ci 一起输出出来。流程图里框和箭头都画好了，只差三个格子，请从下拉菜单里各选一条。选完可以顺着箭头走一遍：第一次猜之前 ci 是几？每多猜一次变成几？',
  caption: '“猜数字游戏”的算法流程图（加上了记录次数的 ci）',
  flow: G6L7_FLOW,
  keys: { 0: { f1: 'ci ← 1', f2: '输出“对了”和 ci 的值', f3: 'ci ← ci + 1' } },
};

// ---------- 任务二：照着课件第18页的“完善后的程序代码”，不用电脑也能预测输出 ----------
// 注意课件的 ci 位置：每轮比完、重新输入之后才 ci = ci + 1。初值 1，所以猜 n 次最后输出 n。
const G6L7_CODE = [
  'da = 55',
  'ci = 1',
  'cai = int(input("猜一个1至100之间的数字"))',
  'while cai != da:',
  '    if cai < da:',
  '        print("小了")',
  '    else:',
  '        print("大了")',
  '    cai = int(input("猜一个1至100之间的数字"))',
  '    ci = ci + 1',
  'print("对了！", "共用次数为：", ci)',
].join('\n');

const G6L7_SMALL_PICK = ['0 次', '1 次', '2 次'];
const G6L7_LAST_PICK = ['对了！共用次数为：1', '对了！共用次数为：2', '对了！共用次数为：3', '对了！共用次数为：4'];
const G6L7_T2 = {
  task: 2,
  heading: '【学习任务二】运行程序、验证算法：跟着程序走一遍',
  intro: '程序已经写好了（见下面的代码）。运行时它会停下来等你输入一个数字，然后告诉你“大了”还是“小了”，直到猜中为止，最后输出一共猜了几次。先不用电脑，看看你能不能预测出屏幕上的输出：三行的目标数都是 55（程序第 1 行 da = 55），请按每行给出的输入顺序，把「输出“小了”几次」和「程序最后输出的一行」选出来。不确定就把自己当成程序，一行一行往下走。',
  caption: '完善后的“猜数字”程序（Python）',
  code: G6L7_CODE,
  cols: [
    { key: 'label', label: '输入顺序' },
    { key: 'small', label: '输出“小了”几次', pick: G6L7_SMALL_PICK },
    { key: 'last', label: '程序最后输出的一行', pick: G6L7_LAST_PICK },
  ],
  rows: 3,
  rowLabels: [
    '① 依次输入 30、40、55',
    '② 依次输入 60、55',
    '③ 第一次就输入 55',
  ],
  keys: {
    0: { small: '2 次', last: '对了！共用次数为：3' },
    1: { small: '0 次', last: '对了！共用次数为：2' },
    2: { small: '0 次', last: '对了！共用次数为：1' },
  },
  center: true,
};

// ---------- 任务三：教材任务三（比次数）+ 课件的“二分查找法”小知识 ----------
const G6L7_N_PICK = ['7 次', '10 次', '50 次', '100 次'];
const G6L7_T3 = {
  task: 3,
  heading: '【学习任务三】比一比：一个一个猜，和每次都猜中间数',
  intro: '先和同桌比一比：把程序里的 da 各改成一个自己的数，看谁用的次数最少。再想一想：如果从 1 开始一个一个往上猜，最坏要猜几次？如果每次都猜剩余范围中间的那个数（二分查找法），又要几次？把下表选完整。二分查找法快，是因为每猜一次，不管对方说“大了”还是“小了”，都能排除掉一半的数。',
  caption: '两种猜法：最多要猜几次',
  cols: [
    { key: 'label', label: '猜法（目标数在范围内）' },
    { key: 'n', label: '最多要猜几次', pick: G6L7_N_PICK },
  ],
  rows: 3,
  rowLabels: [
    '① 从 1 开始，一个一个往上猜：1~100',
    '② 每次都猜剩余范围的中间数：1~100',
    '③ 每次都猜剩余范围的中间数：1~1000',
  ],
  keys: {
    0: { n: '100 次' },
    1: { n: '7 次' },
    2: { n: '10 次' },
  },
  center: true,
};

// ---------- 课后小测 5 题（老师 2026-10-28 追加：跟以前的课保持一致） ----------
// 出处：课件第6页（验证三步）、第8~10页（input→字符串、int() 转换）、第21~22页（二分查找法）、
//       第23页（课堂总结）、第24页（拓展提升：超过 7 次提示“挑战失败”）
const G6L7_QUESTIONS = [
  {
    id: '6-1-7-q1',
    type: 'judge',
    points: 10,
    level: 1,
    q: '小丽说：“用计算机验证算法，只要把程序敲进电脑、能运行起来，就算验证好了。”小丽说得对吗？',
    answer: 'B',
    expl: '小丽说得不对。用计算机验证算法有三步：①编写程序——把算法变成计算机能执行的命令；②调试运行——运行并跟踪、记录结果，看算法有没有真正解决问题；③优化算法——根据运行结果改进算法。程序能跑起来只是第一步，还要看结果对不对、算法能不能更好。',
  },
  {
    id: '6-1-7-q2',
    type: 'single',
    points: 15,
    level: 1,
    q: 'Python 程序里有一句 cai = input("猜一个1至100之间的数字")，小明输入 55 后按回车，这时变量 cai 里装着的是（　　）。',
    options: [
      { key: 'A', text: '整数 55' },
      { key: 'B', text: '字符串 "55"' },
      { key: 'C', text: '小数 55.0' },
      { key: 'D', text: '什么也没有' },
    ],
    answer: 'B',
    expl: 'input() 读进来的内容一律按字符串处理，输入 55 存进 cai 的是字符串 "55"。所以程序里要先用 int() 把 cai = int(input(...)) 转成整数，才能和 da 比较大小、参与计算。',
  },
  {
    id: '6-1-7-q3',
    type: 'multi',
    points: 25,
    level: 2,
    q: '关于“二分查找法”，下面说法正确的有（　　）。（多选）',
    options: [
      { key: 'A', text: '每次都猜“剩余范围”中间的那个数' },
      { key: 'B', text: '每猜一次，不管对方说“大了”还是“小了”，都能排除掉一半的数' },
      { key: 'C', text: '猜 1~100 之间的数，最多 7 次一定能猜中' },
      { key: 'D', text: '它和从 1 开始一个一个往上猜，最坏情况下要猜的次数一样多' },
    ],
    answer: 'A,B,C',
    expl: '二分查找法每次都猜剩余范围的中间数，一次就排除一半，1~100 最多 7 次一定能猜中。从 1 开始一个一个猜，最坏要 100 次——算法不同，效率差得很远，所以 D 错。',
  },
  {
    id: '6-1-7-q4',
    type: 'fill',
    points: 25,
    level: 2,
    q: '【跟着程序走一遍】下面这段程序第 1 行是 da = 55（目标数是 55），运行时小明依次输入 80、20、55。请把屏幕上的输出补完整：输入 80，程序提示“（1）　　”；输入 20，程序提示“（2）　　”；输入 55，程序输出“（3）　　”，然后循环（4）　　；这一局小明一共猜了（5）　　次。',
    blanks: [
      {
        key: 'q4b1', label: '（1）', mode: 'pick', pts: 5,
        words: ['大了', '小了', '对了'], show: '大了', accepts: ['大了'],
      },
      {
        key: 'q4b2', label: '（2）', mode: 'pick', pts: 5,
        words: ['小了', '大了', '对了'], show: '小了', accepts: ['小了'],
      },
      {
        key: 'q4b3', label: '（3）', mode: 'pick', pts: 5,
        words: ['对了！共用次数为：3', '对了！共用次数为：2', '对了！共用次数为：1', '对了！共用次数为：4'],
        show: '对了！共用次数为：3', accepts: ['对了！共用次数为：3'],
      },
      {
        key: 'q4b4', label: '（4）', mode: 'pick', pts: 5,
        words: ['结束', '继续猜', '重新设定目标数'], show: '结束', accepts: ['结束'],
      },
      {
        key: 'q4b5', label: '（5）', mode: 'pick', pts: 5,
        words: ['3 次', '2 次', '1 次', '4 次'], show: '3 次', accepts: ['3 次'],
      },
    ],
    expl: '80 比 55 大，提示“大了”；20 比 55 小，提示“小了”；输入 55 和 da 相等，while 循环结束，输出“对了！共用次数为：3”。ci 从 1 开始（第一次输入之前就计了 1），每多猜一次加 1，猜了 3 次就是 3。',
  },
  {
    id: '6-1-7-q5',
    type: 'fill',
    points: 25,
    level: 3,
    q: '【拓展提升】在完善后的程序上再改一改，实现：用户最多只能猜 7 次，7 次都没猜中就提示“挑战失败”。请把做法补完整：（1）用户每猜一次，都要让 ci ← ci + （1）　　；（2）当 ci 已经到（2）　　次、还没猜中时，就让程序输出“挑战失败”并结束；（3）input() 读进来的内容都是（3）　　，要和 da 比较大小必须先用 int() 转换；（4）用二分查找法猜 1~100 之间的数，最多猜（4）　　就一定能猜中；（5）同样是猜数字游戏，用的算法不同，最多要猜的次数就（5）　　。',
    blanks: [
      {
        key: 'q5b1', label: '（1）', mode: 'pick', pts: 5,
        words: ['1', '7', '0', 'ci'], show: '1', accepts: ['1'],
      },
      {
        key: 'q5b2', label: '（2）', mode: 'pick', pts: 5,
        words: ['7', '6', '8', '100'], show: '7', accepts: ['7'],
      },
      {
        key: 'q5b3', label: '（3）', mode: 'pick', pts: 5,
        words: ['字符串', '整数', '小数', '注释'], show: '字符串', accepts: ['字符串'],
      },
      {
        key: 'q5b4', label: '（4）', mode: 'pick', pts: 5,
        words: ['7 次', '10 次', '50 次', '100 次'], show: '7 次', accepts: ['7 次'],
      },
      {
        key: 'q5b5', label: '（5）', mode: 'pick', pts: 5,
        words: ['不同', '相同', '永远一样', '说不准'], show: '不同', accepts: ['不同'],
      },
    ],
    expl: '每猜一次 ci 加 1，ci 到了 7 还没猜中就是“挑战失败”；input() 读进来是字符串，要先 int() 转成整数；二分查找法猜 1~100 最多 7 次猜中；同样是猜数字，算法不同，最多要猜的次数就不同。',
  },
];

const G6L7_SHEET = {
  title: '课内任务单',
  heading: '【课内任务单】第7课 猜数字算法验证',
  intro: '本课三个任务都在这张任务单上：任务一是「完善算法流程图」——给猜数字游戏加上记录次数的 ci；任务二是「运行程序、验证算法」——程序已经给你了，请你跟着它走一遍，看屏幕上会输出什么、次数算得对不对；任务三是「比一比」——同样猜一个数，一个一个猜和每次都猜中间数，最多各要几次。全部从下拉菜单里选，不用打字；填完点最下面的“保存任务单”，选错了可以反复修改再保存。',
  remind: '① ci 是“次数”变量：开始时要给它一个初值，每多猜一次加 1，猜对以后再把它输出出来；② 程序里的 input() 读进来的是文字（字符串），要用 int() 转成整数才能和 da 比大小；③ 顺序猜 1~100 最坏要 100 次，二分查找法 7 次之内一定能猜中——算法不同，得到的结果也不同。',
  sections: [G6L7_T1, G6L7_T2, G6L7_T3],
  tasks: [
    '完善流程图：加上记录猜测次数的 ci',
    '跟着程序走一遍：看输出、数次数',
    '比一比：顺序猜和二分查找法',
  ],
  taskCount: 3,
};

const LESSON7 = {
  id: '6-1-7',
  no: 7,
  title: '猜数字算法验证',
  // 课后小测 5 题（老师 2026-10-28 追加）；加上任务单 3 分，证书分母 8
  questions: G6L7_QUESTIONS,
  brief: '《猜数字算法验证》分两部分：点【课内任务单】完成三个任务——任务一是完善“猜数字游戏”的算法流程图（给记录次数的 ci 选初值、选“加 1”、选猜对后输出的内容）；任务二是跟着 Python 程序走一遍，选出屏幕上的输出和次数（验证算法）；任务三是比一比顺序猜和二分查找法最多要几次——三个任务都在下拉菜单里选，系统会判分，一个任务 1 分；点【课后小测】完成 5 道自动判分题（判断/单选/多选直接点选，填空题用“下拉候选词”点选），每题整题全对得 1 积分，一课满分 5 分。加油！',
  sheet: G6L7_SHEET,
};

// 与 catalog.sheetRowSpecs 一致的走法：算一下这张任务单有几个可填行（交卷行号 _i 就按它）
function rowSpecs(sheet) {
  const specs = [];
  for (const b of sheet.sections) {
    if (b.flow) { specs.push(b.flow.blanks.map((x) => x.key)); continue; }
    for (let i = 0; i < (b.rows || 0); i++) specs.push((b.cols || []).map((c) => c.key));
  }
  return specs;
}

function main() {
  const c = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  const g6 = c.grades.find((x) => x.grade === 6 && x.semester === '上');
  const unit = g6 && g6.units.find((x) => x.id === '6-1');
  if (!unit) throw new Error('找不到 六年级上册·第一单元 6-1，先确认 content.json');

  const old = unit.lessons.find((l) => l.id === '6-1-7');
  console.log(old ? '• content.json 里已有 6-1-7，本次将整条覆盖' : '• content.json 里还没有 6-1-7，本次新增');
  console.log('  可填行数：' + rowSpecs(G6L7_SHEET).length + '（流程图板块算 1 行）');
  rowSpecs(G6L7_SHEET).forEach((s, i) => console.log('   _i=' + i + '  ' + s.join(',')));
  console.log('  任务数：' + G6L7_SHEET.taskCount + '，课后小测：' + LESSON7.questions.length + ' 题（证书分母 ' +
    (LESSON7.questions.length + G6L7_SHEET.taskCount) + '）');

  if (!APPLY) { console.log('\n（空跑）加 --apply 才写盘'); return; }

  const bak = CONTENT + '.bak-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-g6l7';
  fs.copyFileSync(CONTENT, bak);
  if (old) unit.lessons[unit.lessons.indexOf(old)] = LESSON7;
  else unit.lessons.push(LESSON7);
  unit.lessons.sort((a, b) => (a.no || 0) - (b.no || 0));
  fs.writeFileSync(CONTENT, JSON.stringify(c, null, 1));
  console.log('\n✓ 已写入 ' + path.basename(CONTENT) + '（备份：' + path.basename(bak) + '）');
  console.log('✓ 重启 7000 后生效：kill 掉 node app/server.js，看门狗会把新进程拉起来');
}

main();
