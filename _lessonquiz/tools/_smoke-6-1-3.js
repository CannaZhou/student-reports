// 第3课《算法设计》专项自检：取卷脱敏 → 交卷判分 → 任务单（36 列枚举表 + 流程图板块）存取 → 教师赋分台
// 用法：先启动服务，再 node tools/_smoke-6-1-3.js
const BASE = process.env.BASE || 'http://localhost:7000';
const TAG = Date.now().toString(36).slice(-4);
const CLA = '测试六年级';
const NAME = '三课自检' + TAG;
const LESSON = '6-1-3';

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
  console.log('== 第3课《算法设计》自检 ==');
  const t = await jfetch('/api/teacher/login', 'POST', { password: '123456' });
  ok(t.j.ok, '教师登录');
  const T = t.ck;
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + NAME }, T);

  const s = await jfetch('/api/student/login', 'POST', { name: NAME });
  ok(s.j.ok, '学生登录');
  const S = s.ck;

  // ---- 课后小测 ----
  const cat = (await jfetch('/api/catalog', 'GET', null, S)).j.catalog; // 形如 [{grade, semester, units:[{lessons:[…]}]}]
  const l3 = (cat || []).flatMap((g) => (g.units || []).flatMap((u) => u.lessons || [])).find((l) => l.id === LESSON);
  ok(!!l3, '目录里有第3课');
  ok(l3 && l3.title === '第3课 算法设计', '课名＝第3课 算法设计（实际：' + (l3 && l3.title) + '）');
  ok(l3 && l3.full === 5, '满分为 5 题');
  ok(l3 && l3.hasFlow === true, '标记为含流程图');
  ok(l3 && l3.hasSheet === true, '标记为有课内任务单');

  const les = (await jfetch('/api/lesson/' + LESSON, 'GET', null, S)).j.lesson;
  ok(les && les.questions.length === 5, '取到 5 题');
  const flow = les.questions.find((q) => q.type === 'flow');
  const rawFlow = JSON.stringify(flow);
  ok(!/accepts|"expl"/.test(rawFlow), '流程图题已脱敏（不含答案/解析）'); // pts 是连线折点坐标，不是分数
  ok(flow.flow.blanks.length === 5 && flow.flow.blanks.every((b) => b.words.length === 5), '流程图 5 个空、每空 5 个标准候选词');

  // 全对交卷：答案写在服务端的 content.json 里，这里按候选词首项（=正确项）作答
  const fs = require('fs'); const path = require('path');
  const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'data', 'content.json'), 'utf8'));
  const def = content.grades.flatMap((g) => g.units).flatMap((u) => u.lessons).find((l) => l.id === LESSON);
  const answers = {};
  // 交卷格式与前端一致：多空题 answers[id] = { blanks: { key: 值 } }；选择题 = { ans: 'A' }
  for (const q of def.questions) {
    if (q.type === 'flow') { const m = {}; q.flow.blanks.forEach((b) => { m[b.key] = b.words[0]; }); answers[q.id] = { blanks: m }; }
    else if (q.type === 'fill') { const m = {}; q.blanks.forEach((b) => { m[b.key] = b.words[0]; }); answers[q.id] = { blanks: m }; }
    else answers[q.id] = { ans: q.answer };
  }
  // 故意把流程图第 2 个空选错，检查「整题全对才得分」
  const flowQ = def.questions.find((q) => q.type === 'flow');
  answers[flowQ.id].blanks[flowQ.flow.blanks[1].key] = flowQ.flow.blanks[1].words[1];
  const sub = (await jfetch('/api/lesson/' + LESSON + '/submit', 'POST', { answers }, S)).j;
  ok(sub.score === 4, '4 题全对得 4 分（流程图错一个空 → 不得分，实际 ' + sub.score + '）');
  const flowDet = (sub.detail || []).find((d) => d.id === flowQ.id);
  ok(flowDet && flowDet.ok === false && flowDet.blanks.some((b) => !b.ok), '流程图题按空判分并标出错的空');

  // ---- 课内任务单 ----
  const sheet = (await jfetch('/api/lesson/' + LESSON + '/sheet', 'GET', null, S)).j;
  ok(sheet.sheet.sections.length === 2, '任务单有 2 个板块（任务一 + 任务二）');
  const t1 = sheet.sheet.sections[0], t2 = sheet.sheet.sections[1];
  ok(t1.cols.length === 37, '任务一 1 列行标签 + 36 列枚举（实际 ' + t1.cols.length + '）');
  ok(t1.rows === 3 && t1.rowLabels.length === 3, '任务一 3 个可填行');
  ok(t1.givenTop && t1.givenTop[0].c1 === '0' && t1.givenTop[0].c36 === '35', '兔的只数只读行 0~35 已印好');
  ok(t1.rowPick && t1.rowPick['2'] && t1.rowPick['2'].length === 2, '「是否满足正确解条件?」整行下拉 √/×');
  ok(t2.flow && t2.flow.nodes.length === 8 && t2.flow.blanks.length === 4, '任务二流程图 8 个图形 + 4 个空');
  ok(!/accepts|expl/.test(JSON.stringify(t2.flow)), '任务二流程图已脱敏');

  // 交任务单：3 行表 + 流程图 1 行
  const rows = [
    { _i: 0, lab: '鸡的只数', c1: '35', c2: '34', c36: '0' },
    { _i: 1, lab: '总脚数', c1: '70', c2: '72', c36: '140' },
    { _i: 2, lab: '是否满足正确解条件?', c1: '×', c2: '×', c36: '×' },
    { _i: 3, f1: 'tu < 36 ?', f2: 'ji ← 35 - tu', f3: 'ji × 2 + tu × 4 = 94 ?', f4: 'tu ← tu + 1' },
  ];
  const save = (await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', { rows }, S)).j;
  ok(save.rows && save.rows.length === 4, '任务单保存 4 行（含流程图 1 行）');
  const back = (await jfetch('/api/lesson/' + LESSON + '/sheet', 'GET', null, S)).j;
  const frow = (back.prev || []).find((r) => r._i === 3);
  ok(frow && frow.f3 === 'ji × 2 + tu × 4 = 94 ?', '流程图所填能回读（续填）');

  // 教师赋分台
  const board = (await jfetch('/api/teacher/sheet-board/' + LESSON + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(board.sheet.sections.length === 2, '教师端拿到 2 个板块定义');
  const me = (board.students || []).find((x) => x.uid === NAME + '｜' + CLA);
  ok(me && me.submitted && me.rows.length === 4, '教师端看到该生的 4 行（表格 3 行 + 流程图 1 行）');
  const sc = (await jfetch('/api/teacher/sheet-board/' + LESSON + '/score', 'POST', { uid: me.uid, score: 9 }, T)).j;
  ok(sc.ok, '教师赋分 9 分');
  const mine = (await jfetch('/api/student/scores', 'GET', null, S)).j;
  const row3 = (mine.rows || []).find((x) => x.lessonId === LESSON);
  ok(row3 && row3.task === 9 && row3.best === 4, '学生「我的成绩」：小测 4 分 + 任务单 9 分');

  // 清理
  await jfetch('/api/teacher/progress/delete', 'POST', { uid: me.uid, lessonId: LESSON, kind: 'sheet' }, T);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: me.uid }, T);
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0; // 用 exitCode 而非 process.exit，避免 Windows 下 libuv 断言噪音
})().catch((e) => { console.error(e); process.exit(1); });
