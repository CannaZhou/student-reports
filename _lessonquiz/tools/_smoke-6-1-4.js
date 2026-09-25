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
  ok(sec && sec.length === 6, '任务单 6 个板块（任务一 + 任务二 ×3 + 任务三 ×2，实际 ' + (sec && sec.length) + '）');
  ok(sec[0].rows === 3 && sec[0].cols.length === 3, '任务一 3 行 × 3 列（程序/功能/体会）');
  const code = sec[1].code || '';
  ok(code.startsWith('tu = 0') && code.includes('while tu < 36:') && code.includes('if ji * 2 + tu * 4 == 94:'),
    '任务二带回了「鸡兔同笼.py」代码块');
  ok(/print\(ji, "只鸡", tu, "只兔"\)/.test(code), '代码里 print 用的是英文引号、参数用英文逗号');
  ok(!/\bIf\b/.test(code) && !/[“”]/.test(code), '代码里没有任务单原文的大写 If / 中文引号（照抄会报错）');
  ok(code.split('\n').length === 6, '代码 6 行，换行与缩进原样保留');
  ok(sec[1].preset && sec[1].preset['0'] && sec[1].preset['0'].tou === '35' && sec[1].preset['0'].jiao === '94',
    '「程序输出」表的头 35、脚 94 是题目给好的（preset）');
  ok(sec[1].cols.length === 4 && sec[1].rows === 1, '程序输出表 4 列 1 行');
  ok(sec[2].rows === 1 && sec[2].cols.map((c) => c.key).join(',') === 'tuExpr,jiExpr',
    '手工算式：兔/鸡两个填写列（写成 1 列 + rowLabels 的话标签会把唯一一列占掉，学生看不到输入框）');
  ok(sec[3].preset && sec[3].preset['0'].tou === '35', '「手工计算」表也印好了头 35、脚 94');
  // 通例：每个板块都得有「能填的格子」。rowLabels 只贴第一列，所以带 rowLabels 的板块至少要 2 列。
  const noField = sec.filter((b) => (b.flow ? !(b.flow.blanks || []).length
    : (b.cols || []).length < ((b.rowLabels || []).length ? 2 : 1)));
  ok(noField.length === 0, '每个板块都有可填的格子（没有「只有标签、没有输入框」的空板块）');
  ok(sec[4].cols[1].pick.join(',') === '+,-,*,/', '任务三（一）下拉＝+ - * /');
  ok(sec[4].rowLabels.join(',') === '＋ （加）,－ （减）,× （乘）,÷ （除）', '任务三（一）4 行运算符');
  ok(sec[5].cols[1].pick.join(',') === '等于,不等于,大于,小于', '任务三（二）下拉＝等于/不等于/大于/小于');
  ok(sec[5].rowLabels.join(',') === '==,!=,>,<', '任务三（二）4 行比较运算符');
  ok(!/accepts|expl|answer/.test(JSON.stringify(sheet.sheet)), '任务单已脱敏');

  // 交任务单：任务一 1 行 + 程序输出 1 行 + 算式 1 行 + 手工结果 1 行 + 连线 8 行 = 12 行
  // 行号顺序＝各板块依次展开：任务一 0~2、程序输出 3、算式 4、手工结果 5、运算符 6~9、比较运算符 10~13
  const rows = [
    { _i: 0, prog: '微信', func: '和爸爸妈妈视频通话', feel: '远在外地也能见面' },
    { _i: 3, tou: '35', jiao: '94', ji: '23', tu: '12' },
    { _i: 4, tuExpr: '(94-35×2)÷2=12（只）', jiExpr: '35-12=23（只）' },
    { _i: 5, tou: '35', jiao: '94', ji: '23', tu: '12' },
    { _i: 6, sym: '＋ （加）', py: '+' }, { _i: 7, sym: '－ （减）', py: '-' },
    { _i: 8, sym: '× （乘）', py: '*' }, { _i: 9, sym: '÷ （除）', py: '/' },
    { _i: 10, op: '==', mean: '等于' }, { _i: 11, op: '!=', mean: '不等于' },
    { _i: 12, op: '>', mean: '大于' }, { _i: 13, op: '<', mean: '小于' },
  ];
  const save = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows }, S)).j;
  ok(save.ok && save.rows.length === 12, '任务单保存 12 行（实际 ' + (save.rows || []).length + '）');
  const back = (await jfetch('/api/lesson/' + LESSON + '/sheet', 'GET', null, S)).j;
  const g = (i) => (back.prev || []).find((r) => r._i === i) || {};
  ok(g(8).py === '*', '连线（一）「×」选的 * 能回读（续填）');
  ok(g(11).mean === '不等于', '连线（二）「!=」选的「不等于」能回读');
  ok(g(4).tuExpr === '(94-35×2)÷2=12（只）', '手工算式能回读（括号、乘号、单位都保留）');
  ok(!!sheet.mates && sheet.mates.total >= 1, '任务单接口带回了本班名单（左栏用）');

  // 教师赋分台
  const board = (await jfetch('/api/teacher/sheet-board/' + LESSON + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(board.sheet.sections.length === 6, '教师端拿到 6 个板块定义');
  const me = (board.students || []).find((x) => x.uid === NAME + '｜' + CLA);
  ok(me && me.submitted && me.rows.length === 12, '教师端看到该生的 12 行');
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
