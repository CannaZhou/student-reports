// 四上第3课《数据的价值》接口自检（2026-09-30 新建这一课时写的）：
//   任务一（看四张图选数据价值，下拉）、任务二（天气数据对不同人的作用，下拉）系统判得出；
//   任务三（勾一勾大数据的价值 + 我的体验）是经历记录、没有对错 → 留给老师点。
//   课后小测 5 题：判断/单选/多选/填空(课件第21页课后练习“连一连”)/多选(课堂小结)。
// 用法：先起隔离实例，再 BASE=http://127.0.0.1:7099 node tools/_smoke-g4l3.js
// ⚠️ 只在 7099 隔离实例上跑，别对着真实数据（tools/_tmp/certtest/app）。
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const TAG = Date.now().toString(36).slice(-4);
// 班名里必须带年级字样：赋分台是按「本课年级」筛班级的（四年级的课只列四年级的班）
const CLA = '四年级数据价值自检' + TAG;

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
const LID = '4-1-3';
const content = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'app', 'data', 'content.json'), 'utf8'));
let LESSON = null;
content.grades.forEach((g) => g.units.forEach((u) => u.lessons.forEach((l) => { if (l.id === LID) LESSON = l; })));

// ---- 一份「全对」的任务单（行号＝渲染顺序，见 core/sheetgrade.js walkRows）----
// 0~3 任务一（四张图）｜4 我还知道｜5~9 任务二（五个角色）｜10 我的感想｜11~14 任务三（勾一勾）｜15 我的体验
const PICK_S1 = ['记录事实、传播信息', '了解其承载的历史', '了解不同鸟类的特征', '帮助警察破案'];
const PICK_S2 = ['根据天气决定是否需要带雨具上学', '根据天气安排播种等农事', '根据天气决定上班的出行方式',
  '根据天气决定是否要出海捕鱼', '根据天气预测、发布天气预报'];
function goodRows() {
  return [0, 1, 2, 3].map((i) => ({ _i: i, value: PICK_S1[i] }))
    .concat([{ _i: 4, data: '教室里的温度计', value: '知道今天要不要开窗、开空调' }])
    .concat([0, 1, 2, 3, 4].map((i) => ({ _i: 5 + i, use: PICK_S2[i] })))
    .concat([{ _i: 10, thought: '不一样。同一份天气数据，学生用它决定带不带伞，渔民用它决定出不出海。' }])
    .concat([0, 1, 2, 3].map((i) => ({ _i: 11 + i, tick: i === 2 ? '没经历过' : '✓ 我经历过' })))
    .concat([{ _i: 15, exp: '天气预报说明天有雨，妈妈提前把雨伞放进了我的书包。' }]);
}

(async () => {
  console.log('== 四上第3课《数据的价值》 自检 ==');
  ok(!!LESSON, 'content.json 里有 4-1-3 这一课');
  ok(LESSON && (LESSON.sheet.sections || []).length === 6, '任务单 6 个板块（三块任务 + 三块写一写）');
  ok(LESSON && (LESSON.questions || []).length === 5, '课后小测 5 题');

  const t = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).j;
  ok(t.ok, '教师登录');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  const A = '价值甲' + TAG, B = '价值乙' + TAG;
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B].map((n) => CLA + '，' + n).join('\n') }, T);
  const SA = (await jfetch('/api/student/login', 'POST', { name: A })).ck;
  const SB = (await jfetch('/api/student/login', 'POST', { name: B })).ck;
  ok(!!SA && !!SB, '两位学生登录');

  console.log('\n-- 1. 学生拿到的任务单：结构对、图片对、答案不下发');
  const sheet = (await jfetch('/api/lesson/' + LID + '/sheet', 'GET', null, SA)).j;
  ok(sheet.taskFull === 3, '学生端知道满分是 3（一个任务 1 分）');
  ok((sheet.sheet.sections || []).length === 6, '下发 6 个板块');
  const raw = JSON.stringify(sheet);
  ok(!/"keys"|"matchBy"|"rowTask"|"fillThrough"|"taskCount"|"want"/.test(raw),
    '学生端 payload 里没有 keys/matchBy/rowTask/fillThrough/taskCount/want 这些答案字段');
  ok(/"task":1/.test(raw) === false, '板块里的 task 号也不下发（它是服务端分任务的依据）');
  const s1 = sheet.sheet.sections[0];
  ok(s1.rowImages && s1.rowImages.length === 4 && s1.rowImages[0].src === '/img/g4l3-a1.png',
    '任务一四张图都在（' + s1.rowImages.map((x) => x.src.replace('/img/', '')).join(' ') + '）');
  ok(s1.cols[1].pick && s1.cols[1].pick.length === 6, '任务一下拉框 6 个候选词（4 个对的 + 2 个干扰项）');
  ok(s1.cols[1].pick.indexOf('记录事实、传播信息') >= 0 && s1.cols[1].pick.indexOf('帮助人们规划出行路线') >= 0,
    '候选词里既有正确答案也有干扰项');
  ok(sheet.sheet.sections[4].cols[1].pick.join('|') === '✓ 我经历过|没经历过', '任务三“勾一勾”是一个二选一的下拉');

  console.log('\n-- 2. 全对的一份：任务一、任务二系统判对，任务三留给老师');
  const good = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: goodRows() }, SA)).j;
  const g = good.auto || {};
  ok(g.taskFull === 3 && g.tasks.length === 3, '系统回 3 个任务');
  ok(g.tasks[0].ok === true, '任务一（四张图全选对）判对');
  ok(g.tasks[1].ok === true, '任务二（五个角色全选对）判对');
  ok(g.tasks[2].graded === false, '任务三没有标准答案 → 系统不判，等老师点');
  ok(g.score === 2, '系统分 2/3（任务三不计）');
  ok(g.tasks.reduce((n, t) => n + t.manual, 0) === 8,
    '有 8 格是“系统不判、留给老师看”的（我还知道 2 + 我的感想 1 + 勾一勾 4 + 我的体验 1）');
  ok(g.tasks[2].manual === 5, '任务三五格全要老师看（勾一勾 4 格 + 我的体验 1 格）');

  console.log('\n-- 3. 错的情形：只有选错的那个任务判错');
  const bad = goodRows();
  bad[1].value = '帮助警察破案';                       // 甲骨文符号 选成了 指纹 的答案
  const b1 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: bad }, SB)).j;
  ok(b1.auto.tasks[0].ok === false, '任务一错一格 → 整个任务一判错');
  ok(b1.auto.tasks[1].ok === true, '任务二不受影响，照样判对');
  ok(b1.auto.tasks[0].right === 3 && b1.auto.tasks[0].wrong === 1, '任务一 3 对 1 错');
  const bad2 = goodRows();
  bad2[7].use = '根据天气决定是否要出海捕鱼';          // 上班族 选成了 渔民 的答案（渔民那行没选 → 也算错）
  const b2 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: bad2 }, SB)).j;
  ok(b2.auto.tasks[1].ok === false && b2.auto.tasks[1].right === 4, '任务二重复选一条 → 少了一条 → 判错（4 对 1 错）');
  const b3 = await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: [] }, SB);
  ok(b3.r.status === 400 && b3.j.ok === false, '整份空表不许保存（400：请至少填一行再保存）');
  // 只填了任务一的第一格：任务一判错（1 对 3 错），任务二整块没填 → 也判错
  const b4 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: [{ _i: 0, value: PICK_S1[0] }] }, SB)).j;
  ok(b4.auto.tasks[0].ok === false && b4.auto.tasks[0].right === 1, '只填一格 → 任务一 1 对 3 错');
  ok(b4.auto.tasks[1].ok === false && b4.auto.tasks[1].right === 0, '任务二一格没填 → 全错');
  // 把乙改回全对，后面看老师赋分
  await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: goodRows() }, SB);

  console.log('\n-- 4. 赋分台：三个任务一排按钮，打勾的总数就是总分');
  const bd = (await jfetch('/api/teacher/sheet-board/' + LID + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(bd.lesson && bd.lesson.taskFull === 3 && bd.lesson.tasks.length === 3,
    '赋分台任务清单 3 条 = 满分 3（' + (bd.lesson.tasks || []).map((x) => x.no + ':' + x.title).join(' / ') + '）');
  const rows = (bd.rows || bd.list || bd.students || []);
  const uidA = A + '｜' + CLA;
  const rowA = rows.filter((r) => r.uid === uidA || r.name === A)[0];
  ok(!!rowA, '甲的行在赋分台上');
  ok(rowA && rowA.auto && rowA.auto.tasks && rowA.auto.tasks[2].graded === false,
    '行上带着系统判定（任务三标着“系统不判”）');
  const m1 = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: uidA, task: 1, ok: true }, T)).j;
  ok(m1.score === 1, '只点任务一 ✓ → 1 分');
  const m3 = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: uidA, task: 3, ok: true }, T)).j;
  ok(m3.score === 2 && m3.tasks['1'] === true && m3.tasks['3'] === true, '再点任务三 ✓ → 2 分（总分＝打勾个数）');
  const m3x = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: uidA, task: 3, ok: false }, T)).j;
  ok(m3x.score === 1 && m3x.tasks['3'] === false, '任务三点成 ✗ → 1 分');
  const m3n = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: uidA, task: 3, ok: null }, T)).j;
  ok(m3n.score === 1 && m3n.tasks['3'] === undefined, '再点回未标记 → 仍 1 分、第 3 题没有标记');
  const stuA = (await jfetch('/api/lesson/' + LID + '/sheet', 'GET', null, SA)).j;
  ok(stuA.mark && stuA.mark.score === 1, '学生端看到老师的 1 分');
  ok(stuA.taskFull === 3 && LESSON.sheet.taskCount === 3, '证书分母（taskCount）＝系统满分（taskFull）＝3');

  console.log('\n-- 5. 课后小测 5 题');
  const lc = (await jfetch('/api/lesson/' + LID, 'GET', null, SA)).j;
  const qs = lc.lesson.questions || [];
  ok(qs.length === 5, '5 道题');
  ok(qs.map((q) => q.type).join(',') === 'judge,single,multi,fill,multi',
    '题型：' + qs.map((q) => q.type).join(','));
  ok(qs[0].q.indexOf('作用是一样的') >= 0 && qs[0].judgeLabel.length === 2, '第1题判断题给了 √/× 两个标签');
  const q4 = qs[3];
  ok(q4.blanks.length === 4 && q4.blanks.every((b) => b.mode === 'pick' && b.words.length === 4),
    '第4题（课后练习连一连）4 个空、每空 4 个候选词');
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
  // 单看第 4 题（课后练习连一连）：四个空错一个 → 这题判错（整题全对才给 1 分）
  const oneOff = JSON.parse(JSON.stringify(answers));
  oneOff['4-1-3-q4'].blanks.q4b2 = '选择服装厚度';
  const sub3 = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers: oneOff }, SA)).j;
  const d4 = (sub3.detail || []).filter((x) => x.id === '4-1-3-q4')[0] || {};
  ok(sub3.score === 4 && d4.ok === false, '第4题错一个空 → 4/5（这一题不给分）');

  console.log('\n== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ==');
  // 清掉本测试班
  const list = (await jfetch('/api/teacher/roster', 'GET', null, T)).j.list || [];
  for (const s of list.filter((x) => x.className === CLA)) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: s.uid }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: s.uid }, T);
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检脚本异常：', e); process.exit(2); });
