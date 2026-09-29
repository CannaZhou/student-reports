// 第4课《算法的程序体验》专项自检：取卷脱敏 → 交卷判分 → 任务单（六个板块 + 程序代码块 + 灰底 preset 格）存取 → 教师赋分台
// 用法：先启动服务，再 BASE=http://127.0.0.1:7099 node tools/_smoke-6-1-4.js
// 注意：这个脚本要读 content.json 取标准答案，所以得跟被测的那份 app/data 放在同一棵树下跑。
const BASE = process.env.BASE || 'http://localhost:7000';
const TAG = Date.now().toString(36).slice(-4);
const CLA = '测试六年级';
const NAME = '四课自检' + TAG;
const LESSON = '6-1-4';

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
  console.log('== 第4课《算法的程序体验》自检 ==');
  const t = await jfetch('/api/teacher/login', 'POST', { password: '123456' });
  ok(t.j.ok, '教师登录');
  const T = t.ck;
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + NAME }, T);

  const s = await jfetch('/api/student/login', 'POST', { name: NAME });
  ok(s.j.ok, '学生登录');
  const S = s.ck;

  // ---- 课后小测 ----
  const cat = (await jfetch('/api/catalog', 'GET', null, S)).j.catalog;
  const l4 = (cat || []).flatMap((g) => (g.units || []).flatMap((u) => u.lessons || [])).find((l) => l.id === LESSON);
  ok(!!l4, '目录里有第4课');
  ok(l4 && l4.title === '第4课 算法的程序体验', '课名＝第4课 算法的程序体验（实际：' + (l4 && l4.title) + '）');
  ok(l4 && l4.full === 5, '满分为 5 题');
  ok(l4 && l4.hasSheet === true, '标记为有课内任务单');
  ok(l4 && !l4.hasFlow, '本课不含流程图题（标记应为假）');

  const les = (await jfetch('/api/lesson/' + LESSON, 'GET', null, S)).j.lesson;
  ok(les && les.questions.length === 5, '取到 5 题');
  ok(les && les.questions.map((q) => q.type).join(',') === 'judge,single,multi,fill,fill',
    '题型＝判断/单选/多选/填空/填空（实际 ' + (les && les.questions.map((q) => q.type).join(',')) + '）');
  ok(!/answer|"expl"|accepts/.test(JSON.stringify(les)), '取卷已脱敏（不含答案/解析）');
  const q4 = les.questions[3], q5 = les.questions[4];
  ok(q4.blanks.length === 5 && q5.blanks.length === 3, '第4题 5 个空、第5题 3 个空');
  ok(q4.blanks.every((b) => b.words && b.words.length === 4), '填空题每个空都有 4 个候选词');
  ok(!q5.blanks[0].words.includes('3'), '第5题第1空没有「3」这种靠数字凑的干扰项');

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

  // 比较运算符写成一个等号 → 整题不得分（填空整题全对才得分）
  const bad = JSON.parse(JSON.stringify(answers));
  bad[q4.id].blanks[q4.blanks[0].key] = q4.blanks[0].words[1];
  const sub2 = (await jfetch('/api/lesson/' + LESSON + '/submit', 'POST', { answers: bad }, S)).j;
  ok(sub2.score === 4, '把「==」错选成「=」→ 第4题不得分，得 4 分（实际 ' + sub2.score + '）');
  const det = (sub2.detail || []).find((d) => d.id === q4.id);
  ok(det && det.ok === false, '该题被标为错，且按空给了解析');

  // ---- 课内任务单 ----
  const sheet = (await jfetch('/api/lesson/' + LESSON + '/sheet', 'GET', null, S)).j;
  const sec = sheet.sheet.sections;
  ok(sec && sec.length === 6, '任务单 6 个板块（任务一 + 任务二 ×2 符号连线 + 任务三 ×3 运行/算式/结果，实际 ' + (sec && sec.length) + '）');
  // 任务一（2026-09-29 老师改版）：四个用过的程序，三列全部改成下拉选，判分按任务给
  ok(sec[0].rows === 4 && sec[0].cols.length === 3, '任务一 4 行 × 3 列（程序/功能/体会）');
  ok(sec[0].cols.map((c) => c.key).join(',') === 'prog,func,feel', '任务一三列＝程序/主要功能/使用体会');
  ok(sec[0].cols[0].pick.join(',') === '在线打字,画图,Word,剪映', '任务一程序下拉＝在线打字/画图/Word/剪映');
  ok(sec[0].cols.every((c) => (c.pick || []).length === 4), '三列都是 4 选 1 的下拉（不用打字，只要选）');
  ok(!sec[0].example, '去掉了「计算器」示例行（它不在四个程序里，留着会让人以为也要选它）');
  // task / keys 只在服务端（content.json）里，不下发学生 —— 所以对着原文断言
  ok(def.sheet.sections.map((b) => b.task).join(',') === '1,2,2,3,3,3',
    '六个板块归到三个任务（任务二两块＝符号连线／任务三三块＝运行+算式+结果，各算同一个任务）');
  ok(def.sheet.sections.filter((b) => b.keys).length === 5, '五个板块写了标准答案（只有任务二的算式那块没有）');
  ok(def.sheet.sections[0].matchBy === 'prog', '任务一按「选中的程序」查答案（不看行号）');
  ok(!/keys|matchBy|want/.test(JSON.stringify(sheet.sheet)), '任务单已脱敏：标准答案（keys）和 matchBy 没下发（是白名单，不是黑名单）');
  const code = sec[3].code || '';
  ok(code.startsWith('tu = 0') && code.includes('while tu < 36:') && code.includes('if ji * 2 + tu * 4 == 94:'),
    '任务三带回了「鸡兔同笼.py」代码块');
  ok(/print\(ji, "只鸡", tu, "只兔"\)/.test(code), '代码里 print 用的是英文引号、参数用英文逗号');
  ok(!/\bIf\b/.test(code) && !/[“”]/.test(code), '代码里没有任务单原文的大写 If / 中文引号（照抄会报错）');
  ok(code.split('\n').length === 6, '代码 6 行，换行与缩进原样保留');
  ok(sec[3].preset && sec[3].preset['0'] && sec[3].preset['0'].tou === '35' && sec[3].preset['0'].jiao === '94',
    '「程序输出」表的头 35、脚 94 是题目给好的（preset）');
  ok(sec[3].cols.length === 4 && sec[3].rows === 1, '程序输出表 4 列 1 行');
  ok(sec[4].rows === 1 && sec[4].cols.map((c) => c.key).join(',') === 'tuExpr,jiExpr',
    '手工算式：兔/鸡两个填写列（写成 1 列 + rowLabels 的话标签会把唯一一列占掉，学生看不到输入框）');
  ok(sec[5].preset && sec[5].preset['0'].tou === '35', '「手工计算」表也印好了头 35、脚 94');
  // 通例：每个板块都得有「能填的格子」。rowLabels 只贴第一列，所以带 rowLabels 的板块至少要 2 列。
  const noField = sec.filter((b) => (b.flow ? !(b.flow.blanks || []).length
    : (b.cols || []).length < ((b.rowLabels || []).length ? 2 : 1)));
  ok(noField.length === 0, '每个板块都有可填的格子（没有「只有标签、没有输入框」的空板块）');
  ok(sec[1].cols[1].pick.join(',') === '+,-,*,/', '任务二（一）下拉＝+ - * /');
  ok(sec[1].rowLabels.join(',') === '＋ （加）,－ （减）,× （乘）,÷ （除）', '任务二（一）4 行运算符');
  ok(sec[2].cols[1].pick.join(',') === '等于,不等于,大于,小于', '任务二（二）下拉＝等于/不等于/大于/小于');
  ok(sec[2].rowLabels.join(',') === '==,!=,>,<', '任务二（二）4 行比较运算符');
  ok(!/accepts|expl|answer/.test(JSON.stringify(sheet.sheet)), '任务单已脱敏');

  // 标准答案（下拉选项里的正确项）——直接抄 seed 里那份，学生不会拿到
  const PROG = {
    '在线打字': ['练打字：照着屏幕上的字打，练速度和正确率', '一开始总要低头看键盘，练多了就能盲打'],
    '画图': ['画画、涂色，还能用各种工具修改画面', '画错了可以撤销重来，比在纸上画省事'],
    'Word': ['写文章、做表格，排版好以后打印出来', '写错了随时能改，还能调字号、插图片'],
    '剪映': ['剪视频，加上字幕、音乐和转场效果', '手机电脑都能剪，加个字幕就有大片的感觉'],
  };
  const t1rows = (ord) => ord.map((p, i) => ({ _i: i, prog: p, func: PROG[p][0], feel: PROG[p][1] }));
  // 交任务单：任务一 4 行 + 连线 8 行 + 程序输出 1 行 + 算式 1 行 + 手工结果 1 行 = 15 行
  // 行号顺序＝各板块依次展开：任务一 0~3、运算符 4~7、比较运算符 8~11、程序输出 12、算式 13、手工结果 14
  // （2026-09-29 老师把原来的任务二/三整体对调了：先认运算符，再跑程序）
  const rest = () => [
    { _i: 4, sym: '＋ （加）', py: '+' }, { _i: 5, sym: '－ （减）', py: '-' },
    { _i: 6, sym: '× （乘）', py: '*' }, { _i: 7, sym: '÷ （除）', py: '/' },
    { _i: 8, op: '==', mean: '等于' }, { _i: 9, op: '!=', mean: '不等于' },
    { _i: 10, op: '>', mean: '大于' }, { _i: 11, op: '<', mean: '小于' },
    { _i: 12, tou: '35', jiao: '94', ji: '23', tu: '12' },
    { _i: 13, tuExpr: '(94-35×2)÷2=12（只）', jiExpr: '35-12=23（只）' },
    { _i: 14, tou: '35', jiao: '94', ji: '23', tu: '12' },
  ];
  const rows = t1rows(['在线打字', '画图', 'Word', '剪映']).concat(rest());
  const save = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows }, S)).j;
  ok(save.ok && save.rows.length === 15, '任务单保存 15 行（实际 ' + (save.rows || []).length + '）');
  const back = (await jfetch('/api/lesson/' + LESSON + '/sheet', 'GET', null, S)).j;
  const g = (i) => (back.prev || []).find((r) => r._i === i) || {};
  ok(g(6).py === '*', '连线（一）「×」选的 * 能回读（续填）');
  ok(g(9).mean === '不等于', '连线（二）「!=」选的「不等于」能回读');
  ok(g(13).tuExpr === '(94-35×2)÷2=12（只）', '手工算式能回读（括号、乘号、单位都保留）');
  ok(g(2).prog === 'Word', '任务一「Word」这一行能回读');

  // ---- 系统按任务判分（一个任务 1 分，做对得 1 分）----
  const a = back.auto;
  ok(!!a, '任务单接口带回了系统判分结果');
  ok(a && a.taskFull === 3 && a.score === 3, '全对 → 系统 3/3 分（实际 ' + (a && a.score) + '/' + (a && a.taskFull) + '）');
  ok(a && a.tasks.map((t) => t.ok).join(',') === 'true,true,true', '三个任务都判成对');
  ok(a && a.tasks.map((t) => t.title).join(',') === '生活中常用的程序,符号连线,运行程序并手工计算',
    '三个任务的题号/名字＝任务一/任务二(符号连线)/任务三(运行程序)，与板块顺序一致');
  ok(a && a.tasks[2].manual === 2, '任务三里那两格「手工算式」系统不判、留给老师（manual=2）');
  ok(a && !/want/.test(JSON.stringify(a)), '学生拿到的判分结果里没有标准答案');
  ok(a && (a.wrong || []).length === 0, '全对时没有标红的格子');
  // 老师端才带标准答案，老师才能看出学生错在哪一格
  const bd0 = (await jfetch('/api/teacher/sheet-board/' + LESSON + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const me0 = (bd0.students || []).find((x) => x.uid === NAME + '｜' + CLA);
  ok(me0 && me0.auto && me0.auto.score === 3, '教师端也有系统判分（3/3）');
  ok(me0 && me0.auto.cells.every((c) => c.want !== undefined), '教师端每格都带标准答案（改分时看得见学生错在哪）');

  // 错一个：任务一把「在线打字」的使用体会选成了剪映的 → 任务一 0 分、任务二/三照旧
  const badRows = t1rows(['在线打字', '画图', 'Word', '剪映'])
    .map((r) => (r.prog === '在线打字' ? { ...r, feel: PROG['剪映'][1] } : r)).concat(rest());
  const save2 = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows: badRows }, S)).j;
  ok(save2.auto && save2.auto.score === 2, '错一格 → 系统降到 2/3（实际 ' + (save2.auto && save2.auto.score) + '）');
  ok(save2.auto && save2.auto.tasks[0].ok === false && save2.auto.tasks[0].wrong === 1, '任务一被判错，且只指出 1 处');
  ok(save2.auto && (save2.auto.wrong || []).some((w) => w.i === 0 && w.col === 'feel'), '标红的是第 1 行的「使用体会」格');
  ok(save2.auto && save2.auto.tasks[1].ok === true && save2.auto.tasks[2].ok === true, '另外两个任务不受影响（这就是「精准识别」）');
  // 漏选一个程序 / 一个程序选两遍：都必须算错（否则"四行里有三行对"就能蒙混过关）
  const missOne = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST',
    { rows: t1rows(['在线打字', '画图', 'Word']).concat(rest()) }, S)).j;
  ok(missOne.auto && missOne.auto.tasks[0].ok === false, '只填三行（漏了剪映）→ 任务一算错');
  const dupOne = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST',
    { rows: t1rows(['在线打字', '画图', 'Word', 'Word']).concat(rest()) }, S)).j;
  ok(dupOne.auto && dupOne.auto.tasks[0].ok === false, 'Word 选了两遍、剪映没出现 → 任务一算错');
  const swapped = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST',
    { rows: t1rows(['剪映', 'Word', '画图', '在线打字']).concat(rest()) }, S)).j;
  ok(swapped.auto && swapped.auto.tasks[0].ok === true, '四行前后调换顺序 → 照样判对（按选中的程序查答案，不看行号）');
  // 回到全对那一版，后面的赋分/成绩断言按它来
  await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows }, S);
  ok(!!sheet.mates && sheet.mates.total >= 1, '任务单接口带回了本班名单（左栏用）');

  // 教师赋分台
  const board = (await jfetch('/api/teacher/sheet-board/' + LESSON + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(board.sheet.sections.length === 6, '教师端拿到 6 个板块定义');
  const me = (board.students || []).find((x) => x.uid === NAME + '｜' + CLA);
  ok(me && me.submitted && me.rows.length === 15, '教师端看到该生的 15 行');
  const sc = (await jfetch('/api/teacher/sheet-board/' + LESSON + '/score', 'POST', { uid: me.uid, score: 0 }, T)).j;
  ok(sc.ok, '教师可以赋 0 分（0 分也是分）');
  const mine = (await jfetch('/api/student/scores', 'GET', null, S)).j;
  const row4 = (mine.rows || []).find((x) => x.lessonId === LESSON);
  ok(row4 && row4.task === 0 && row4.best === 5, '学生「我的成绩」：小测 5 分 + 任务单 0 分（两项分开记）');

  // 清理
  await jfetch('/api/teacher/progress/delete', 'POST', { uid: me.uid, lessonId: LESSON, kind: 'sheet' }, T);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: me.uid }, T);
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
