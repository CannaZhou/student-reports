// 四上第5课《数据的获取》接口自检（2026-10-21 新建这一课时写的）：
//   任务一（四件事各选一种数据获取方法）系统判得出；教案里的两份预设答案取并集
//     （天气：设备采集/网络获取；全校设备使用：问卷调查/现场记录）；
//   任务二（四个因素 → 各自的调查问题）也是下拉选择，4 个候选＝4 个答案、不放无关选项，系统判得出
//     （老师 2026-10-21 追加「任务二也改成选择的形式」「答案要紧跟问题，不需要无关的答案」）；
//   任务三只在平台上显示题目（lines），没有任何可填行，也不占任务分；
//   任务单满分 2（任务一 1 + 任务二 1），课后小测 5 题，证书分母 7。
// 用法：先起隔离实例，再 BASE=http://127.0.0.1:7099 node tools/_smoke-g4l5.js
// ⚠️ 只在 7099 隔离实例上跑，别对着真实数据（tools/_tmp/certtest/app）。
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const TAG = Date.now().toString(36).slice(-4);
// 班名里必须带年级字样：赋分台是按「本课年级」筛班级的（四年级的课只列四年级的班）
const CLA = '四年级数据获取自检' + TAG;

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
const LID = '4-1-5';
const content = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'app', 'data', 'content.json'), 'utf8'));
let LESSON = null;
content.grades.forEach((g) => g.units.forEach((u) => u.lessons.forEach((l) => { if (l.id === LID) LESSON = l; })));

const S1 = LESSON.sheet.sections[0];
const S2 = LESSON.sheet.sections[1];
const S3 = LESSON.sheet.sections[2];
const WAYS = S1.cols[1].pick;

// 一份「全对」的任务单（行号＝渲染顺序，见 core/sheetgrade.js walkRows）
// 0~3 任务一（四个场景，系统判）｜4~7 任务二（四个因素，系统判）
function goodRows() {
  return [
    { _i: 0, scene: S1.rowLabels[0], way: '网络获取' },   // 天气：两个预设答案之一
    { _i: 1, scene: S1.rowLabels[1], way: '现场记录' },
    { _i: 2, scene: S1.rowLabels[2], way: '设备采集' },
    { _i: 3, scene: S1.rowLabels[3], way: '问卷调查' },
    { _i: 4, factor: '年级', question: '你现在读几年级？' },
    { _i: 5, factor: '性别', question: '你是男生还是女生？' },
    { _i: 6, factor: '每天使用时长', question: '你每天使用数字设备大约多长时间？' },
    { _i: 7, factor: '家长的态度', question: '你的家长支持你使用数字设备吗？' },
  ];
}

(async () => {
  console.log('== 四上第5课《数据的获取》 自检 ==');
  ok(!!LESSON, 'content.json 里有 4-1-5 这一课');
  ok(LESSON && LESSON.title === '数据的获取', '课名就是《数据的获取》');
  ok(LESSON && (LESSON.sheet.sections || []).length === 3, '任务单 3 个板块（任务一、任务二、任务三）');
  ok(LESSON && LESSON.sheet.taskCount === 2, '任务单满分 2 分（任务三不在平台上作答，不算分）');
  ok(LESSON && (LESSON.questions || []).length === 5, '课后小测 5 题');

  console.log('\n-- 0. 答案表与任务三结构');
  const miss = [];
  Object.keys(S1.keys || {}).forEach((ri) => Object.keys(S1.keys[ri]).forEach((col) => {
    const c = (S1.cols || []).find((x) => x.key === col);
    const want = S1.keys[ri][col];
    (Array.isArray(want) ? want : [want]).forEach((w) => {
      if (c && c.pick && c.pick.indexOf(w) < 0) miss.push('行' + ri + '列' + col + '「' + w + '」');
    });
  }));
  ok(miss.length === 0, '任务一的 keys 全部命中候选词' + (miss.length ? '（漏：' + miss.join(',') + '）' : ''));
  ok(!!S2.keys && (S2.cols[1].pick || []).length === 4, '任务二改成下拉：4 个候选问题，只放与因素对应的');
  ok((S2.rowLabels || []).length === 4 && S2.rows === 4, '任务二四个因素印在行首、4 行');
  const miss2 = [];
  Object.keys(S2.keys || {}).forEach((ri) => {
    const want = S2.keys[ri].question;
    if ((S2.cols[1].pick || []).indexOf(want) < 0) miss2.push('行' + ri + '「' + want + '」');
  });
  ok(miss2.length === 0, '任务二的 keys 全部命中候选词' + (miss2.length ? '（漏：' + miss2.join(',') + '）' : ''));
  const keySet = Object.keys(S2.keys || {}).map((ri) => S2.keys[ri].question).sort();
  ok(JSON.stringify(S2.cols[1].pick.slice().sort()) === JSON.stringify(keySet),
    '候选问题就是四个因素各自对应的答案，没有无关选项');
  ok(S2.cols[1].pick.every((w) => w.length <= 18), '任务二候选问题都不超过 18 字（窄屏下拉不会被撑宽）');
  ok(S3 && !S3.cols && !S3.rows && (S3.lines || []).length === 2, '任务三只有题目文字（lines 2 条），没有可填列/行');

  const t = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).j;
  ok(t.ok, '教师登录');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  const A = '获取甲' + TAG, B = '获取乙' + TAG;
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B].map((n) => CLA + '，' + n).join('\n') }, T);
  const SA = (await jfetch('/api/student/login', 'POST', { name: A })).ck;
  const SB = (await jfetch('/api/student/login', 'POST', { name: B })).ck;
  ok(!!SA && !!SB, '两位学生登录');

  console.log('\n-- 1. 学生拿到的任务单：结构对、答案不下发');
  const sheet = (await jfetch('/api/lesson/' + LID + '/sheet', 'GET', null, SA)).j;
  ok(sheet.taskFull === 2, '学生端知道满分是 2（一个任务 1 分）');
  ok((sheet.sheet.sections || []).length === 3, '下发 3 个板块');
  const raw = JSON.stringify(sheet);
  ok(!/"keys"|"matchBy"|"rowTask"|"fillThrough"|"taskCount"|"want"/.test(raw),
    '学生端 payload 里没有 keys/matchBy/rowTask/fillThrough/taskCount/want 这些答案字段');
  const st1 = sheet.sheet.sections[0], st2 = sheet.sheet.sections[1], st3 = sheet.sheet.sections[2];
  ok(st1.cols.length === 2 && st1.cols[1].pick.length === 4, '任务一两列，方法那列 4 个候选');
  ok((st1.rowLabels || []).length === 4, '任务一四件事印在行首：' + (st1.rowLabels || []).join(' / '));
  ok(st2.cols.length === 2 && st2.cols[1].pick.length === 4, '任务二第二列是下拉、4 个候选问题');
  ok((st2.rowLabels || []).length === 4, '任务二四个因素印在行首：' + (st2.rowLabels || []).join(' / '));
  ok(!st2.example, '任务二不再需要范例行（因素已印好）');
  ok((st3.lines || []).length === 2, '任务三两道小题下发到学生端：' + (st3.lines || []).join(' / '));

  console.log('\n-- 2. 全对的一份：两个任务系统都判对');
  const good = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: goodRows() }, SA)).j;
  const g = good.auto || {};
  ok(g.taskFull === 2 && g.tasks.length === 2, '系统回 2 个任务');
  ok(g.tasks[0].ok === true, '任务一四行都选对 → 判对');
  ok(g.tasks[0].manual === 0, '任务一没有留给老师的格');
  ok(g.tasks[1].graded === true && g.tasks[1].ok === true, '任务二四个问题都选对 → 判对');
  ok(g.tasks[1].manual === 0, '任务二没有留给老师的格');
  ok(g.score === 2, '系统分 2/2');

  console.log('\n-- 3. 任务一的两组“都算对”的答案');
  const alt = goodRows();
  alt[0].way = '设备采集';   // 天气：另一个预设答案
  alt[3].way = '现场记录';   // 全校设备使用：另一个预设答案
  const a1 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: alt }, SB)).j;
  ok(a1.auto.tasks[0].ok === true, '天气选“设备采集”、全校选“现场记录”也判对（教学设计两份预设取并集）');

  console.log('\n-- 4. 错的情形：两个任务各自独立判');
  const bad = goodRows();
  bad[0].way = '现场记录';                     // 天气不适合只靠现场记录
  const b1 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: bad }, SB)).j;
  ok(b1.auto.tasks[0].ok === false, '任务一错一格 → 整个任务一判错');
  ok(b1.auto.tasks[0].right === 3 && b1.auto.tasks[0].wrong === 1, '任务一 3 对 1 错');
  ok(b1.auto.tasks[1].ok === true, '任务二没动 → 照样判对（不被任务一连累）');
  ok(b1.auto.score === 1, '系统分 1/2');
  const b2 = goodRows();
  b2[5].question = '你现在读几年级？';           // 性别那行错选成“年级”的问题
  const b3 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: b2 }, SB)).j;
  ok(b3.auto.tasks[1].ok === false, '任务二有一行选成别的问题 → 整个任务二判错');
  ok(b3.auto.tasks[0].ok === true, '任务一不受影响，仍是 ✅');
  ok(b3.auto.score === 1, '系统分 1/2');
  const b4 = goodRows();
  b4[1].way = '';                               // 400 米那行没选
  const b5 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: b4 }, SB)).j;
  ok(b5.auto.tasks[0].ok === false && b5.auto.tasks[0].wrong === 1, '少选一行 → 任务一也不对');
  const b6 = await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: [] }, SB);
  ok(b6.r.status === 400 && b6.j.ok === false, '整份空表不许保存（400：请至少填一行再保存）');
  await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: goodRows() }, SB);

  console.log('\n-- 5. 赋分台：两个任务；学生收上来 8 行（任务三没有行）');
  const bd = (await jfetch('/api/teacher/sheet-board/' + LID + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(bd.lesson && bd.lesson.taskFull === 2 && bd.lesson.tasks.length === 2,
    '赋分台任务清单 2 条 = 满分 2（' + (bd.lesson.tasks || []).map((x) => x.no + ':' + x.title).join(' / ') + '）');
  const rows = (bd.students || []);
  const rowA = rows.filter((r) => r.name === A)[0];
  ok(!!rowA, '甲的行在赋分台上');
  ok(rowA && rowA.auto && rowA.auto.tasks[0].ok === true, '行上带着系统判定：任务一 ✅');
  ok(rowA && rowA.auto && rowA.auto.tasks[1].ok === true, '任务二也带着系统判定：✅');
  ok(rowA && rowA.rows && rowA.rows.length === 8, '收上来 8 行（任务一 4 + 任务二 4，任务三没有行）');

  console.log('\n-- 6. 课后小测 5 题');
  const lc = (await jfetch('/api/lesson/' + LID, 'GET', null, SA)).j;
  const qs = lc.lesson.questions || [];
  ok(qs.length === 5, '5 道题');
  ok(qs.map((q) => q.type).join(',') === 'judge,single,multi,fill,fill',
    '题型：' + qs.map((q) => q.type).join(','));
  ok(LESSON.questions.reduce((n, q) => n + q.points, 0) === 100, '总分 100（10+15+25+25+25）');
  const q3 = qs[2], q4 = qs[3], q5 = qs[4];
  ok(q3.options.length === 4, '第3题多选 4 个选项（现场记录/问卷调查/网络获取/设备采集）');
  ok(q4.blanks.length === 6 && q4.blanks.every((b) => b.mode === 'pick'), '第4题（步骤+要素）6 个空、都用下拉候选词');
  ok(q5.blanks.length === 3 && q5.blanks.every((b) => b.mode === 'pick'), '第5题（网络问卷+问题设计）3 个空、都用下拉候选词');
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
  // 多选题少选一个 D → 这题算错
  const q3off = JSON.parse(JSON.stringify(answers));
  q3off['4-1-5-q3'].ans = 'A,B,C';
  const subQ3 = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers: q3off }, SA)).j;
  const d3 = (subQ3.detail || []).filter((x) => x.id === '4-1-5-q3')[0] || {};
  ok(subQ3.score === 4 && d3.ok === false, '第3题少选“设备采集” → 4/5（多选题全对才给分）');
  // 第4题错一个空 → 这题整题不给分
  const oneOff = JSON.parse(JSON.stringify(answers));
  oneOff['4-1-5-q4'].blanks.q4b5 = '调查结果';
  const sub4 = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers: oneOff }, SA)).j;
  const d4 = (sub4.detail || []).filter((x) => x.id === '4-1-5-q4')[0] || {};
  ok(sub4.score === 4 && d4.ok === false, '第4题错一个空 → 4/5（这一题不给分）');
  const subFinal = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers }, SA)).j;
  ok(subFinal.score === 5, '再交一次全对 → 又是 5/5（取最高分）');

  console.log('\n-- 7. 证书口径：小测 5 + 任务单 2 = 7');
  const mAll = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: rowA.uid, tasks: { 1: true, 2: true } }, T)).j;
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
