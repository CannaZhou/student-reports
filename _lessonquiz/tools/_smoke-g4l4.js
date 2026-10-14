// 四上第4课《数据的安全》接口自检（2026-10-14 新建这一课时写的）：
//   任务一（明明和妈妈的哪些行为导致了数据泄漏）是开放作答 → **不给 keys、系统不判**，留给老师点；
//   任务二（给明明和他妈妈提建议，情境→建议）系统判得出。
//   老师拍板：这一课任务单满分 **2 分**（不是 3、更不是 10）；课后小测 5 题（判断/单选/多选/填空/填空）。
// 用法：先起隔离实例，再 BASE=http://127.0.0.1:7099 node tools/_smoke-g4l4.js
// ⚠️ 只在 7099 隔离实例上跑，别对着真实数据（tools/_tmp/certtest/app）。
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const TAG = Date.now().toString(36).slice(-4);
// 班名里必须带年级字样：赋分台是按「本课年级」筛班级的（四年级的课只列四年级的班）
const CLA = '四年级数据安全自检' + TAG;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
function cookie(res) { return (res.headers.get('set-cookie') || '').split(';')[0]; }
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { r, j, ck: cookie(r) };
}

// 本课内容（只读 content.json，不碰学生数据）
const LID = '4-1-4';
const content = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'app', 'data', 'content.json'), 'utf8'));
let LESSON = null;
content.grades.forEach((g) => g.units.forEach((u) => u.lessons.forEach((l) => { if (l.id === LID) LESSON = l; })));

const S1 = LESSON.sheet.sections[0];
const S2 = LESSON.sheet.sections[1];
const ACTS = S1.cols[0].pick;                       // 任务一 7 个候选（前 4 个是课件第11页「人为窃取」那 4 条）
const TIPS = S2.cols[1].pick;                       // 任务二 7 个候选（前 4 个是对的）
const KEY2 = [0, 1, 2, 3].map((i) => S2.keys[i].tip); // 任务二的标准答案

// ---- 一份「全对」的任务单（行号＝渲染顺序，见 core/sheetgrade.js walkRows）----
// 0~3 任务一（四个行为，系统不判）｜4~7 任务二（四行建议，系统判）
function goodRows() {
  return [
    { _i: 0, act: ACTS[0] }, { _i: 1, act: ACTS[1] }, { _i: 2, act: ACTS[2] }, { _i: 3, act: ACTS[3] },
    { _i: 4, tip: KEY2[0] }, { _i: 5, tip: KEY2[1] }, { _i: 6, tip: KEY2[2] }, { _i: 7, tip: KEY2[3] },
  ];
}

(async () => {
  console.log('== 四上第4课《数据的安全》 自检 ==');
  ok(!!LESSON, 'content.json 里有 4-1-4 这一课');
  ok(LESSON && LESSON.title === '数据的安全', '课名就是《数据的安全》');
  ok(LESSON && (LESSON.sheet.sections || []).length === 2, '任务单 2 个板块（任务一、任务二各一块）');
  ok(LESSON && LESSON.sheet.taskCount === 2, '老师拍板：任务单满分 2 分（写死 taskCount，别被“顺手纠正”）');
  ok(LESSON && (LESSON.questions || []).length === 5, '课后小测 5 题');

  console.log('\n-- 0. 答案表自洽：keys 里的值必须都在候选词里（否则那格永远选不出正确答案）');
  const miss = [];
  [S1, S2].forEach((b, bi) => {
    if (!b.keys) return;
    Object.keys(b.keys).forEach((ri) => Object.keys(b.keys[ri]).forEach((col) => {
      const c = (b.cols || []).find((x) => x.key === col);
      if (c && c.pick && c.pick.indexOf(b.keys[ri][col]) < 0) miss.push('板块' + bi + '行' + ri + '列' + col);
    }));
  });
  ok(miss.length === 0, '两个板块的 keys 全部命中候选词' + (miss.length ? '（漏：' + miss.join(',') + '）' : ''));
  ok(!S1.keys, '任务一故意没有 keys（老师：不判分）');
  ok(S2.keys && S2.keys[0] && S2.keys[1] && S2.keys[2] && S2.keys[3], '任务二四行都有标准答案');
  ok(ACTS.length === 7 && TIPS.length === 7, '两个下拉都是 7 个候选（4 个对的 + 3 个干扰项）');
  ok(TIPS.slice(0, 4).join('|') === KEY2.join('|'), '任务二候选词前 4 个就是四行的标准答案、顺序一一对应');

  const t = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).j;
  ok(t.ok, '教师登录');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  const A = '安全甲' + TAG, B = '安全乙' + TAG;
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B].map((n) => CLA + '，' + n).join('\n') }, T);
  const SA = (await jfetch('/api/student/login', 'POST', { name: A })).ck;
  const SB = (await jfetch('/api/student/login', 'POST', { name: B })).ck;
  ok(!!SA && !!SB, '两位学生登录');

  console.log('\n-- 1. 学生拿到的任务单：结构对、答案不下发');
  const sheet = (await jfetch('/api/lesson/' + LID + '/sheet', 'GET', null, SA)).j;
  ok(sheet.taskFull === 2, '学生端知道满分是 2（一个任务 1 分）');
  ok((sheet.sheet.sections || []).length === 2, '下发 2 个板块');
  const raw = JSON.stringify(sheet);
  ok(!/"keys"|"matchBy"|"rowTask"|"fillThrough"|"taskCount"|"want"/.test(raw),
    '学生端 payload 里没有 keys/matchBy/rowTask/fillThrough/taskCount/want 这些答案字段');
  ok(/"task":1/.test(raw) === false, '板块里的 task 号也不下发（它是服务端分任务的依据）');
  const st1 = sheet.sheet.sections[0], st2 = sheet.sheet.sections[1];
  ok(st1.cols.length === 1 && st1.cols[0].pick.length === 7, '任务一是一列、7 个候选的下拉');
  ok(st2.cols.length === 2 && st2.cols[1].pick.length === 7, '任务二是「情境 + 建议」两列，建议那列 7 个候选');
  ok((st2.rowLabels || []).join('|') === S2.rowLabels.join('|'),
    '任务二四行情境印在行首：' + (st2.rowLabels || []).join(' / '));

  console.log('\n-- 2. 全对的一份：任务一留老师、任务二系统判对');
  const good = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: goodRows() }, SA)).j;
  const g = good.auto || {};
  ok(g.taskFull === 2 && g.tasks.length === 2, '系统回 2 个任务');
  ok(g.tasks[0].graded === false, '任务一没有标准答案 → 系统不判，等老师点');
  ok(g.tasks[0].manual === 4, '任务一 4 格全归老师看');
  ok(g.tasks[1].ok === true, '任务二（四行建议全选对）判对');
  ok(g.tasks[1].manual === 0, '任务二没有留给老师的格');
  ok(g.score === 1, '系统分 1/2（任务一不计）');

  console.log('\n-- 3. 错的情形：只有任务二会翻 ❌，而且只翻它自己');
  const bad = goodRows();
  bad[6].tip = TIPS[4];                                 // 第 3 行（快递单）选了干扰项「快递单反正是废纸，直接扔」
  const b1 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: bad }, SB)).j;
  ok(b1.auto.tasks[1].ok === false, '任务二错一格 → 整个任务二判错');
  ok(b1.auto.tasks[1].right === 3 && b1.auto.tasks[1].wrong === 1, '任务二 3 对 1 错');
  ok(b1.auto.tasks[0].graded === false, '任务一照样不判（学生填什么都不影响）');
  const bad2 = goodRows();
  bad2[1].act = '';                                     // 任务一只填三行
  const b2 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: bad2 }, SB)).j;
  ok(b2.auto.tasks[0].graded === false && b2.auto.score === 1, '任务一少填一行 → 系统分还是 1（它不参与判分）');
  const b3 = await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: [] }, SB);
  ok(b3.r.status === 400 && b3.j.ok === false, '整份空表不许保存（400：请至少填一行再保存）');
  // 只填了任务二最后一行：任务二 1 对 3 错
  const b4 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: [{ _i: 7, tip: KEY2[3] }] }, SB)).j;
  ok(b4.auto.tasks[1].ok === false && b4.auto.tasks[1].right === 1, '只填一格 → 任务二 1 对 3 错');
  // 把乙改回全对，后面看老师赋分
  await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: goodRows() }, SB);

  console.log('\n-- 4. 赋分台：两个任务一排按钮，打勾的总数就是总分');
  const bd = (await jfetch('/api/teacher/sheet-board/' + LID + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(bd.lesson && bd.lesson.taskFull === 2 && bd.lesson.tasks.length === 2,
    '赋分台任务清单 2 条 = 满分 2（' + (bd.lesson.tasks || []).map((x) => x.no + ':' + x.title).join(' / ') + '）');
  const rows = (bd.rows || bd.list || bd.students || []);
  const uidA = A + '｜' + CLA;
  const rowA = rows.filter((r) => r.uid === uidA || r.name === A)[0];
  ok(!!rowA, '甲的行在赋分台上');
  ok(rowA && rowA.auto && rowA.auto.tasks && rowA.auto.tasks[0].graded === false,
    '行上带着系统判定（任务一标着“系统不判”，等老师点）');
  ok(rowA && rowA.auto && rowA.auto.tasks[1].ok === true, '任务二系统判对');
  ok(rowA && rowA.rows && rowA.rows.length === 8, '收上来 8 行（任务一 4 + 任务二 4）');
  const m1 = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: uidA, task: 1, ok: true }, T)).j;
  ok(m1.score === 1, '只点任务一 ✓ → 1 分');
  const m2 = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: uidA, task: 2, ok: true }, T)).j;
  ok(m2.score === 2 && m2.tasks['1'] === true && m2.tasks['2'] === true, '再点任务二 ✓ → 2 分（总分＝打勾个数）');
  const m2x = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: uidA, task: 2, ok: false }, T)).j;
  ok(m2x.score === 1 && m2x.tasks['2'] === false, '任务二点成 ✗ → 1 分');
  const m2n = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: uidA, task: 2, ok: null }, T)).j;
  ok(m2n.score === 1 && m2n.tasks['2'] === undefined, '再点回未标记 → 仍 1 分、第 2 题没有标记');
  const stuA = (await jfetch('/api/lesson/' + LID + '/sheet', 'GET', null, SA)).j;
  ok(stuA.mark && stuA.mark.score === 1, '学生端看到老师的 1 分');
  ok(stuA.taskFull === 2 && LESSON.sheet.taskCount === 2, '证书分母（taskCount）＝系统满分（taskFull）＝2');

  console.log('\n-- 5. 课后小测 5 题');
  const lc = (await jfetch('/api/lesson/' + LID, 'GET', null, SA)).j;
  const qs = lc.lesson.questions || [];
  ok(qs.length === 5, '5 道题');
  ok(qs.map((q) => q.type).join(',') === 'judge,single,multi,fill,fill',
    '题型：' + qs.map((q) => q.type).join(','));
  ok(LESSON.questions.reduce((n, q) => n + q.points, 0) === 100, '总分 100（10+15+25+25+25）');
  ok(qs[0].q.indexOf('数据安全是大人的事') >= 0 && qs[0].judgeLabel.length === 2, '第1题判断题给了 √/× 两个标签');
  const q4 = qs[3], q5 = qs[4];
  ok(q4.blanks.length === 3 && q4.blanks.every((b) => b.mode === 'pick'), '第4题（保护密码）3 个空、都用下拉候选词');
  ok(q5.blanks.length === 3 && q5.blanks.every((b) => b.mode === 'pick'), '第5题（课堂小结）3 个空、都用下拉候选词');
  ok(JSON.stringify(q4).indexOf('"accepts"') < 0 && JSON.stringify(q4).indexOf('"show"') < 0,
    '第4题不下发 accepts/show（答案留在服务端）');
  const answers = {};
  for (const q of LESSON.questions) {
    if (q.type === 'fill') {
      const bl = {};
      q.blanks.forEach((x) => { bl[x.key] = x.show; });
      answers[q.id] = { blanks: bl };
    } else answers[q.id] = { ans: q.answer };
  }
  const sub = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers }, SA)).j;
  ok(sub.score === 5 && sub.full === 5, '按标准答案作答 → 5/5（每题整题全对 1 积分）');
  // 一份「全错」的：判断/单选挑另一个选项、多选少选一个、填空挑一个别的候选词
  const wrong = {};
  for (const q of LESSON.questions) {
    if (q.type === 'fill') {
      const bl = {};
      q.blanks.forEach((x) => { bl[x.key] = (x.words || []).filter((w) => w !== x.show)[0] || ''; });
      wrong[q.id] = { blanks: bl };
    } else if (q.type === 'single' || q.type === 'judge') wrong[q.id] = { ans: q.answer === 'A' ? 'B' : 'A' };
    else wrong[q.id] = { ans: q.answer.split(',').slice(0, 1).join(',') };
  }
  const sub2 = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers: wrong }, SA)).j;
  ok(sub2.score === 0 && sub2.full === 5, '全错的一份 → 0/5（多选题少选也算错）');
  // 单看第 4 题：三个空错一个 → 这题判错（整题全对才给 1 分）
  const oneOff = JSON.parse(JSON.stringify(answers));
  oneOff['4-1-4-q4'].blanks.q4b3 = '身高';
  const sub3 = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers: oneOff }, SA)).j;
  const d4 = (sub3.detail || []).filter((x) => x.id === '4-1-4-q4')[0] || {};
  ok(sub3.score === 4 && d4.ok === false, '第4题错一个空 → 4/5（这一题不给分）');
  const sub4 = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers }, SA)).j;
  ok(sub4.score === 5, '再交一次全对 → 又是 5/5（取最高分）');

  console.log('\n-- 6. 证书口径：小测 5 + 任务单 2 = 7');
  // 一次把两个任务都打勾（老师端就是这么发的整张表）——总分＝打勾个数
  const mAll = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: uidA, tasks: { 1: true, 2: true } }, T)).j;
  ok(mAll.score === 2 && mAll.tasks['1'] === true && mAll.tasks['2'] === true, '整张表一次提交：两个任务都 ✓ → 2 分');
  const certs = (await jfetch('/api/student/certs', 'GET', null, SA)).j;
  const item = (certs.items || []).filter((x) => x.lessonId === LID)[0] || {};
  ok(item.total === 7, '证书满分 7（小测 5 + 任务单 2）—— 任务单只算 2 题，不是 10 分制');
  ok(item.earned === 7, '甲拿满 7 分（小测 5 + 老师给的任务单 2）');
  ok(item.issued === true && item.missing.length === 0, '小测 + 任务单都交了 → 发证，缺项为空');
  ok(item.pct === 100 && item.stars === 5, '综合 100% / 5 星');

  console.log('\n== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ==');
  // 清掉本测试班
  const list = (await jfetch('/api/teacher/roster', 'GET', null, T)).j.list || [];
  for (const s of list.filter((x) => x.className === CLA)) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: s.uid }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: s.uid }, T);
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检脚本异常：', e); process.exit(2); });
