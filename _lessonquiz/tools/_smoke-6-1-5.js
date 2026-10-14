// 第5课《算法的执行》专项自检：取卷脱敏 → 交卷判分 → 任务单（三个报错程序 + 运行记录 + jie 完善程序）存取
//   → 教师赋分台 → 证书/成绩口径（满分 = 小测 5 + 任务单 3 = 8）。
// 用法：先启动服务，再 BASE=http://127.0.0.1:7099 node tools/_smoke-6-1-5.js
// 注意：这个脚本要读 content.json 取标准答案，所以得跟被测的那份 app/data 放在同一棵树下跑。
const BASE = process.env.BASE || 'http://localhost:7099';
const TAG = Date.now().toString(36).slice(-4);
const CLA = '测试六年级五课';
const NAME = '五课自检' + TAG;
const LESSON = '6-1-5';

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
function cookie(res) { return (res.headers.get('set-cookie') || '').split(';')[0]; }
async function jfetch(path, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + path, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { r, j, ck: cookie(r) };
}

(async () => {
  console.log('== 第5课《算法的执行》自检 ==');
  const t = await jfetch('/api/teacher/login', 'POST', { password: '123456' });
  ok(t.j.ok, '教师登录');
  const T = t.ck;
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + NAME }, T);

  const s = await jfetch('/api/student/login', 'POST', { name: NAME });
  ok(s.j.ok, '学生登录');
  const S = s.ck;

  // ---- 课后小测 ----
  const cat = (await jfetch('/api/catalog', 'GET', null, S)).j.catalog;
  const l5 = (cat || []).flatMap((g) => (g.units || []).flatMap((u) => u.lessons || [])).find((l) => l.id === LESSON);
  ok(!!l5, '目录里有第5课');
  ok(l5 && l5.title === '第5课 算法的执行', '课名＝第5课 算法的执行（实际：' + (l5 && l5.title) + '）');
  ok(l5 && l5.full === 5, '满分为 5 题');
  ok(l5 && l5.hasSheet === true, '标记为有课内任务单');
  ok(l5 && !l5.hasFlow, '本课不含流程图题（标记应为假）');

  const les = (await jfetch('/api/lesson/' + LESSON, 'GET', null, S)).j.lesson;
  ok(les && les.questions.length === 5, '取到 5 题');
  ok(les && les.questions.map((q) => q.type).join(',') === 'judge,single,multi,fill,fill',
    '题型＝判断/单选/多选/填空/填空（实际 ' + (les && les.questions.map((q) => q.type).join(',')) + '）');
  ok(!/answer|"expl"|accepts/.test(JSON.stringify(les)), '取卷已脱敏（不含答案/解析）');
  const q4 = les.questions[3], q5 = les.questions[4];
  ok(q4.blanks.length === 5 && q5.blanks.length === 3, '第4题 5 个空（跟踪程序执行）、第5题 3 个空（改成变量）');
  ok(q4.blanks.every((b) => b.words && b.words.length === 4), '填空题每个空都有 4 个候选词');
  ok(q4.blanks[3].words.includes('94') && q4.blanks[4].words.includes('36'),
    '第4题第4空是 94（脚数）、第5空是 36（循环次数）——就是课件里那三个数');

  // 标准答案写在服务端 content.json 里，按候选词首项（＝正确项）作答
  const fs = require('fs'); const path = require('path');
  const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'data', 'content.json'), 'utf8'));
  const def = content.grades.flatMap((g) => g.units).flatMap((u) => u.lessons).find((l) => l.id === LESSON);
  const answers = {};
  for (const q of def.questions) {
    if (q.type === 'fill') { const m = {}; q.blanks.forEach((b) => { m[b.key] = b.words[0]; }); answers[q.id] = { blanks: m }; }
    else answers[q.id] = { ans: q.answer };
  }
  const sub = (await jfetch('/api/lesson/' + LESSON + '/submit', 'POST', { answers }, S)).j;
  ok(sub.score === 5, '5 题全对得 5 分（实际 ' + sub.score + '）');

  const bad = JSON.parse(JSON.stringify(answers));
  bad[q4.id].blanks[q4.blanks[4].key] = q4.blanks[4].words[1]; // 循环次数 36 错选成 35
  const sub2 = (await jfetch('/api/lesson/' + LESSON + '/submit', 'POST', { answers: bad }, S)).j;
  ok(sub2.score === 4, '把循环次数 36 错选成 35 → 第4题不得分，得 4 分（实际 ' + sub2.score + '）');
  const det = (sub2.detail || []).find((d) => d.id === q4.id);
  ok(det && det.ok === false, '该题被标为错，且按空给了解析');
  await jfetch('/api/lesson/' + LESSON + '/submit', 'POST', { answers }, S); // 回到全对

  // ---- 课内任务单 ----
  const sheet = (await jfetch('/api/lesson/' + LESSON + '/sheet', 'GET', null, S)).j;
  const sec = sheet.sheet.sections;
  ok(sec && sec.length === 8, '任务单 8 个板块（任务一 ×3 + 任务二 ×3 + 任务三 ×2，实际 ' + (sec && sec.length) + '）');
  ok(def.sheet.sections.map((b) => b.task).join(',') === '1,1,1,2,2,2,3,3',
    '八个板块归到三个任务（任务一＝三个程序各一块，任务二＝运行记录+补程序+选改进意见，任务三＝选问题+写创想）');
  ok(def.sheet.taskCount === 3, '任务单满分＝3 题（一个任务 1 分）');
  ok(def.sheet.sections.filter((b) => b.keys).length === 6,
    '六个板块写了标准答案（只有「改进意见」「我的新创想」两块开放题没有）');

  // 三个程序：bug 必须原样带过来，否则学生看不到要调的东西
  const c1 = sec[0].code || '', c2 = sec[1].code || '', c3 = sec[2].code || '';
  ok(c1.includes('while Tu < 36:'), '程序一：第 2 行是 while Tu < 36:（变量名大小写 bug 还在）');
  ok(c2.includes('while tu < 36：'), '程序二：冒号是全角 U+FF1A（不是半角）');
  ok(!c1.includes('：') && !c3.includes('：'), '程序一/三里没有全角冒号（只有程序二有，才能一眼看出不同）');
  ok(/\nji = 35 - tu/.test(c3), '程序三：ji = 35 - tu 顶格写（缩进 bug 还在）');
  ok(/\n    #如果符合正确解条件/.test(c3), '程序三：下面几行仍然缩进着（对比之下那一行特别扎眼）');
  ok(c1.includes('tu = tu + 1') && c2.includes('tu = tu + 1'), '另外几行都是正常写法');
  ok(sec[0].cols.length === 2 && sec[0].rows === 1, '任务一每个程序一块：1 行 × 2 列（错误提示信息 / 错在哪里）');
  ok(sec[0].cols.every((c) => c.pick.length === 5), '两列都是 5 选 1 的下拉（含两条干扰项）');
  ok(sec[0].cols[0].pick.some((w) => w.indexOf('NameError') === 0)
    && sec[0].cols[0].pick.some((w) => w.indexOf('SyntaxError') === 0)
    && sec[0].cols[0].pick.some((w) => w.indexOf('IndentationError') === 0),
    '错误提示候选里三条 Python 报错都在');
  ok(sec[0].cols[0].pick.some((w) => w.indexOf('程序没有报错') === 0),
    '还带了「不报错但什么也没输出」这条（任务二 60/66 那行的答案，当干扰项用）');
  ok(sec[0].cols[1].pick.join('|').length < 200, '「错在哪里」候选词都很短（长句会把窄屏表格撑破，2026-10-14 修）');

  ok(sec[3].rows === 3 && sec[3].cols.map((c) => c.key).join(',') === 'tou,jiao,res',
    '任务二（1）运行记录表 3 行 × 3 列');
  ok(sec[3].preset['0'].tou === '35' && sec[3].preset['1'].jiao === '50' && sec[3].preset['2'].tou === '60' && sec[3].preset['2'].jiao === '66',
    '三组头/脚数都是题目印好的（35/94、20/50、60/66）');
  ok(sec[3].preset['0'].res === '23只鸡，12只兔' && !def.sheet.sections[3].keys['0'],
    '第一行（35 头 94 脚）是课本例题，答案直接印出来、不用学生选也不判分（老师 2026-10-14）');
  ok(sec[3].cols[2].pick.length === 4, '运行结果也做成 4 选 1 的下拉（含「12只鸡，23只兔」这个鸡兔颠倒的干扰项）');
  ok(sec[3].cols[2].pick.some((w) => w.indexOf('无解') >= 0), '里面有「屏幕上什么也没有输出（无解）」这一项');
  ok(Object.keys(def.sheet.sections[3].keys).join(',') === '1,2', '剩下 20/50、60/66 两行才是学生要填、要判的');

  ok(sec[4].rows === 3 && sec[4].cols.length === 2 && sec[4].rowLabels.length === 3,
    '任务二（2）jie 完善程序做成 3 行 × 2 列（行标签写问题，另一列选 0/1）');
  ok(sec[4].cols[1].pick.join(',') === '0,1', '选值列是 0/1 二选一');
  ok((sec[4].code || '').includes('print("此题无解")') && (sec[4].code || '').includes('jie = ①'),
    '完善程序的代码块里带着 ①②③ 空位和「此题无解」那一句');
  ok(sec[4].image && sec[4].image.src === '/img/g6l5-jie-flow.png',
    '任务二（2）挂上了老师给的流程图（老师 2026-10-14 要求，作参考）');
  ok(sec[4].heading.indexOf('没有答案时怎么办') >= 0, '这一块标题写明是「给程序补上"没有答案时怎么办"」');
  const imgFile = require('fs').statSync(require('path').join(__dirname, '..', 'app', 'public', sec[4].image.src));
  ok(imgFile.size > 10000, '流程图文件真的在 app/public 里（' + Math.round(imgFile.size / 1024) + 'KB），新克隆也拉得到');

  ok(sec[5].rows === 1 && sec[5].cols.length === 1, '任务二（3）算法改进意见：1 行 1 列');
  ok(sec[5].cols[0].pick && sec[5].cols[0].pick.length === 4,
    '改进意见做成了 4 选 1 的下拉（老师 2026-10-14：这里也做成选择）');
  ok(!def.sheet.sections[5].keys, '改进意见不判分（没有唯一答案），留给老师看学生选了哪条思路');
  ok(sec[6].rows === 1 && sec[6].cols.map((c) => c.key).join(',') === 'ans',
    '任务三（1）是一条选择题：1 行 × 1 列下拉');
  ok(sec[6].cols[0].pick.length === 4, '选择题 4 个选项');
  ok(def.sheet.sections[6].keys && def.sheet.sections[6].keys[0].ans === sec[6].cols[0].pick[0],
    '选择题有标准答案（选对了任务三才得分），答案就在候选词里');
  ok(sec[7].rows === 1 && sec[7].cols.map((c) => c.key).join(',') === 'idea',
    '任务三（2）是一条填空题：1 行 × 1 列自由写');
  ok(!def.sheet.sections[7].keys, '新创想不判分（开放题），留给老师看');
  // 通例：每个板块都得有「能填的格子」。rowLabels 只贴第一列，所以带 rowLabels 的板块至少要 2 列。
  const noField = sec.filter((b) => (b.flow ? !(b.flow.blanks || []).length
    : (b.cols || []).length < ((b.rowLabels || []).length ? 2 : 1)));
  ok(noField.length === 0, '每个板块都有可填的格子（没有「只有标签、没有输入框」的空板块）');
  ok(!/keys|matchBy|want/.test(JSON.stringify(sheet.sheet)), '任务单已脱敏：标准答案（keys）和 matchBy 没下发（是白名单，不是黑名单）');
  ok(!/accepts|expl|answer/.test(JSON.stringify(sheet.sheet)), '任务单已脱敏（不含 accepts/解析）');

  // 交任务单：12 个可填行 —— 任务一 3 行、运行记录 3 行（第一行全印好、学生不用填）、
  //   jie 3 行、改进意见 1 行、任务三 选择 1 行 + 填空 1 行
  const S1 = def.sheet.sections; // 服务端定义里才有 keys
  const ERR = S1[0].cols[0].pick, WHY = S1[0].cols[1].pick;
  ok(ERR.includes(S1[0].keys['0'].msg) && WHY.includes(S1[0].keys['0'].why),
    '标准答案就是候选词本身（程序一＝NameError + 变量名大小写）——字符串逐字相同，学生选得到');
  ok(new Set(S1.slice(0, 3).map((b) => b.keys['0'].msg)).size === 3
    && new Set(S1.slice(0, 3).map((b) => b.keys['0'].why)).size === 3,
    '三个程序的报错信息与错因各不相同（照抄同一项就得不了分）');
  const K = S1.map((b) => b.keys || {});
  const rows = () => [
    { _i: 0, msg: K[0][0].msg, why: K[0][0].why },
    { _i: 1, msg: K[1][0].msg, why: K[1][0].why },
    { _i: 2, msg: K[2][0].msg, why: K[2][0].why },
    // _i 3 是 35/94 那一行：三格全是题目印好的，学生一个格子都不用填 → 前端根本不会提交这一行
    { _i: 4, tou: '20', jiao: '50', res: K[3][1].res },
    { _i: 5, tou: '60', jiao: '66', res: K[3][2].res },
    { _i: 6, val: K[4][0].val }, { _i: 7, val: K[4][1].val }, { _i: 8, val: K[4][2].val },
    { _i: 9, idea: S1[5].cols[0].pick[1] },
    { _i: 10, ans: K[6][0].ans },
    { _i: 11, idea: '让用户自己输入头数和脚数，再判断这两个数能不能配出鸡兔。' },
  ];
  const save = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows: rows() }, S)).j;
  ok(save.ok && save.rows.length === 11, '任务单保存 11 行（35/94 那行全印好，不算学生填的，实际 ' + (save.rows || []).length + '）');
  const saveFull = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST',
    { rows: rows().concat([{ _i: 3, tou: '35', jiao: '94', res: K[3][1].res }]) }, S)).j;
  ok(saveFull.auto && saveFull.auto.score === 3,
    '老版式的作答（把 35/94 那行的结果也交上来）照样判 3/3，preset 格不参与判分（实际 ' + (saveFull.auto && saveFull.auto.score) + '）');
  const back = (await jfetch('/api/lesson/' + LESSON + '/sheet', 'GET', null, S)).j;
  const g = (i) => (back.prev || []).find((r) => r._i === i) || {};
  ok(g(0).msg === K[0][0].msg, '程序一的报错选择能回读');
  ok(g(5).res === K[3][2].res, '60 头 66 脚那行的「无解」能回读');
  ok(g(7).val === '1', 'jie ②「找到答案以后＝1」能回读');
  ok(g(9).idea === S1[5].cols[0].pick[1], '改进意见的下拉选择能回读');
  ok(g(10).ans === K[6][0].ans, '任务三选择题的作答能回读');

  // ---- 系统按任务判分 ----
  const a = back.auto;
  ok(!!a, '任务单接口带回了系统判分结果');
  ok(a && a.taskFull === 3, '任务单满分＝3（一个任务 1 分）');
  ok(a && a.score === 3, '全对 → 系统 3/3（任务三现在也能判了，实际 ' + (a && a.score) + '）');
  ok(a && a.tasks.map((t) => String(t.ok)).join(',') === 'true,true,true',
    '三个任务全判对（true,true,true，实际 ' + (a && a.tasks.map((t) => String(t.ok)).join(',')) + '）');
  ok(a && a.tasks.map((t) => String(t.graded)).join(',') === 'true,true,true', '三个任务现在都有系统判分');
  ok(a && a.tasks.map((t) => t.title).join(',') === '调试程序,模拟情境 完善算法,运行完善后的程序，发现问题与提出新创想',
    '三个任务的名字与任务单一致（任务三按老师 2026-10-14 的说法改名）');
  ok(a && a.tasks[2].cells === 1 && a.tasks[2].manual === 1,
    '任务三只有选择题那 1 格判分，新创想那 1 格归老师');
  ok(a && a.tasks[1].manual === 1, '任务二里有 1 格（算法改进意见）系统不判、留给老师');
  ok(a && a.tasks.reduce((n, t) => n + t.manual, 0) === 2,
    '全表只有 2 格留给老师（任务二改进意见 + 任务三新创想，都是开放写的）');
  ok(a && (a.wrong || []).length === 0, '全对时没有标红的格子');
  ok(a && !/want/.test(JSON.stringify(a)), '学生拿到的判分结果里没有标准答案');

  // 错一个：程序二那个冒号的选择换掉 → 任务一 0 分，任务二/三不受影响
  const badRows = rows();
  badRows[1].why = WHY.filter((w) => w !== K[1][0].why)[0];
  const save2 = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows: badRows }, S)).j;
  ok(save2.auto && save2.auto.score === 2, '程序二改错一处 → 系统降到 2/3（实际 ' + (save2.auto && save2.auto.score) + '）');
  ok(save2.auto && save2.auto.tasks[0].ok === false && save2.auto.tasks[0].wrong === 1, '任务一被判错，且只指出 1 处');
  ok(save2.auto && (save2.auto.wrong || []).some((w) => w.i === 1 && w.col === 'why'), '标红的是第 2 行（程序二）的「错在哪里」格');
  ok(save2.auto && save2.auto.tasks[1].ok === true, '任务二不受影响（这就是「按任务分别判分」）');
  // 任务三那道选择题选错 → 任务三 0 分，任务一/二不受影响
  const badPick = rows();
  badPick[9].ans = S1[6].cols[0].pick.filter((w) => w !== K[6][0].ans)[0];
  const save3 = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows: badPick }, S)).j;
  ok(save3.auto && save3.auto.score === 2 && save3.auto.tasks[2].ok === false,
    '任务三选择题选错 → 任务三 0 分、总分 2/3（老师口径：学生完成这个选择就算分）');
  ok(save3.auto && (save3.auto.wrong || []).some((w) => w.i === 10 && w.col === 'ans'), '标红的是任务三那一格');
  // 没选（留着空交）也判错，不能靠不答蒙分
  const noPick = rows().filter((r) => r._i !== 10);
  const save4 = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows: noPick }, S)).j;
  ok(save4.auto && save4.auto.tasks[2].ok === false, '任务三选择题空着不选 → 一样算错');
  // 只填对一半：任务一整块没动时不能蒙混过关
  const missOne = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST',
    { rows: rows().filter((r) => r._i !== 2) }, S)).j;
  ok(missOne.auto && missOne.auto.tasks[0].ok === false, '程序三整行没填 → 任务一算错（漏填不给分）');
  await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows: rows() }, S); // 回到全对
  ok(!!sheet.mates && sheet.mates.total >= 1, '任务单接口带回了本班名单（左栏用）');

  // ---- 老师还没批的时候：证先发，任务单那几分算「待批阅」 ----
  const c0 = ((await jfetch('/api/student/certs/' + LESSON, 'GET', null, S)).j || {}).item;
  ok(c0 && c0.issued === true && c0.missing.length === 0, '小测和任务单都交了 → 立刻发证（不等老师批）');
  ok(c0 && c0.pending === true && c0.taskMarked === false, '老师没批之前标「待批阅」，任务单得分不计入');
  ok(c0 && c0.quizScore === 5 && c0.quizFull === 5, '待批阅时只按客观题算：小测 5/5');
  const wall0 = (await jfetch('/api/student/certs', 'GET', null, S)).j;
  const wallItem = (wall0.items || []).find((x) => x.lessonId === LESSON);
  ok(!!wallItem, '证书墙上有这一课');
  // 待批阅阶段分母只算客观题，但任务单满分仍如实写着 3（老师批完分母才变成 8）
  ok(wallItem && wallItem.total === 5 && wallItem.taskFull === 3,
    '待批阅时证书墙分母＝小测 5 题，任务单满分仍标 3（实际 total=' + (wallItem && wallItem.total) + ', taskFull=' + (wallItem && wallItem.taskFull) + '）');
  ok(!/keys|NameError/.test(JSON.stringify(wall0)), '证书墙不下发标准答案');
  ok(wallItem && wallItem.pct === 100 && String(wallItem.comment || '').length > 0, '待批阅时按客观题算出的百分比 + 评语都在');

  // ---- 教师赋分台 ----
  const bd0 = (await jfetch('/api/teacher/sheet-board/' + LESSON + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(bd0.sheet.sections.length === 8, '教师端拿到 8 个板块定义');
  const me0 = (bd0.students || []).find((x) => x.uid === NAME + '｜' + CLA);
  ok(me0 && me0.submitted && me0.rows.length === 11, '教师端看到该生的 11 行（35/94 那行全印好，不占学生作答）');
  ok(me0 && me0.auto && me0.auto.score === 3, '教师端也有系统判分（3/3）');
  ok(me0 && me0.auto.cells.every((c) => c.want !== undefined) && me0.auto.cells.length === 12,
    '教师端 12 个系统判的格子每格都带标准答案（改分时看得见学生错在哪）');
  ok(me0 && me0.auto.tasks.every((t) => t.graded), '三个任务现在都判得出分（任务三有选择题了）');
  ok((bd0.lesson.tasks || []).length === 3, '赋分台那一排「逐题打勾」按钮＝3 个任务');

  // 老师逐题打勾 → 证书/成绩里的任务单得分（证书只认老师打的勾）
  const m1 = (await jfetch('/api/teacher/sheet-board/' + LESSON + '/task', 'POST', { uid: me0.uid, task: 1, ok: true }, T)).j;
  const m2 = (await jfetch('/api/teacher/sheet-board/' + LESSON + '/task', 'POST', { uid: me0.uid, task: 2, ok: true }, T)).j;
  const m3 = (await jfetch('/api/teacher/sheet-board/' + LESSON + '/task', 'POST', { uid: me0.uid, task: 3, ok: true }, T)).j;
  ok(m1.score === 1 && m2.score === 2 && m3.score === 3, '老师打三个勾 → 任务单得 3 分（实际 ' + m3.score + '）');
  const mine = (await jfetch('/api/student/scores', 'GET', null, S)).j;
  const row5 = (mine.rows || []).find((x) => x.lessonId === LESSON);
  ok(row5 && row5.best === 5 && row5.task === 3, '学生「我的成绩」：小测 5 分 + 任务单 3 分（两项分开记）');
  const certJ = (await jfetch('/api/student/certs/' + LESSON, 'GET', null, S)).j;
  const cert = certJ.item || certJ.cert;
  ok(cert && cert.issued === true, '这一课发证书了（小测交齐 + 任务单交齐）');
  ok(cert && cert.quizScore === 5 && cert.taskScore === 3 && cert.taskFull === 3,
    '证书口径：小测 5/5 + 老师评的任务单 3/3（实际 ' + (cert && cert.quizScore) + '+' + (cert && cert.taskScore) + '）');
  ok(cert && cert.pending === false, '老师已批 → 不再显示「待批阅」');
  ok(cert && cert.pct === 100, '综合 100%（5 + 3 = 8/8，实际 ' + (cert && cert.pct) + '%）');
  // 关键口径：证书只认老师打的勾，系统判的 3/3 不算 —— 老师那三个勾是这一课 3 分的唯一来源
  ok(cert && cert.earned === 8 && cert.total === 8, '证书得分/满分＝8/8');
  const wall1 = (await jfetch('/api/student/certs', 'GET', null, S)).j;
  const w2 = (wall1.items || []).find((x) => x.lessonId === LESSON);
  ok(w2 && w2.earned === 8 && w2.total === 8 && w2.stars === 5, '老师批完之后证书墙才变成 8 分制、5 星');
  ok(w2 && w2.pending === false && w2.issued === true, '证书墙上也同步成「已发证、不待批」');

  // 没交的学生也要能赋分（赋分台不挑人）
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，五课未交' + TAG }, T);
  const bd1 = (await jfetch('/api/teacher/sheet-board/' + LESSON + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const nosub = (bd1.students || []).find((x) => x.name === '五课未交' + TAG);
  const sc0 = (await jfetch('/api/teacher/sheet-board/' + LESSON + '/task', 'POST', { uid: nosub.uid, task: 1, ok: false }, T)).j;
  ok(sc0.score === 0, '没交的学生也能赋分（打 ✗ → 0 分，不做自动打 0）');

  // 清理
  await jfetch('/api/teacher/progress/delete', 'POST', { uid: me0.uid }, T);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: me0.uid }, T);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: nosub.uid }, T);
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
