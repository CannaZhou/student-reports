// 六上第7课《猜数字算法验证》接口自检（2026-10-28 加课后小测时写的）：
//   课内任务单 3 个板块 / 3 个任务（满分 3）：任务一流程图 3 处补空、任务二跟着程序走 3 行、任务三比一比 3 行；
//   课后小测 5 题（判断/单选/多选/填空/填空，10+15+25+25+25=100），每题整题全对 1 积分；
//   证书分母 = 5（小测）+ 3（任务单）= 8，不是 10 分制。
// 用法：先起隔离实例 → BASE=http://127.0.0.1:7099 node tools/_smoke-g6l7.js
// ⚠️ 只在 7099 隔离实例上跑（tools/_tmp/certtest/app），别对着真实数据。
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const TAG = Date.now().toString(36).slice(-4);
// 班名里必须带年级字样：赋分台按「本课年级」筛班级
const CLA = '六年级猜数字验证自检' + TAG;

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
const LID = '6-1-7';
const content = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'app', 'data', 'content.json'), 'utf8'));
let LESSON = null;
content.grades.forEach((g) => (g.units || []).forEach((u) => (u.lessons || []).forEach((l) => { if (l.id === LID) LESSON = l; })));

const S1 = LESSON.sheet.sections[0];
const S2 = LESSON.sheet.sections[1];
const S3 = LESSON.sheet.sections[2];

// 一份「全对」的任务单（行号＝渲染顺序：0 是流程图那一行，1~3 任务二，4~6 任务三）
function goodRows() {
  return [
    { _i: 0, f1: 'ci ← 1', f2: '输出“对了”和 ci 的值', f3: 'ci ← ci + 1' },
    { _i: 1, small: '2 次', last: '对了！共用次数为：3' },
    { _i: 2, small: '0 次', last: '对了！共用次数为：2' },
    { _i: 3, small: '0 次', last: '对了！共用次数为：1' },
    { _i: 4, n: '100 次' },
    { _i: 5, n: '7 次' },
    { _i: 6, n: '10 次' },
  ];
}

(async () => {
  console.log('== 六上第7课《猜数字算法验证》 接口自检 ==');
  ok(!!LESSON, 'content.json 里有 6-1-7 这一课');
  ok(LESSON && LESSON.title === '猜数字算法验证', '课名就是《猜数字算法验证》');
  ok(LESSON && (LESSON.sheet.sections || []).length === 3, '任务单 3 个板块（任务一、二、三）');
  ok(LESSON && LESSON.sheet.taskCount === 3, '任务单满分 3 分（三个板块各 1 分）');
  ok(LESSON && (LESSON.questions || []).length === 5, '课后小测 5 题');
  ok(LESSON.questions.reduce((n, q) => n + q.points, 0) === 100, '小测总分 100（10+15+25+25+25）');

  console.log('\n-- 0. 结构：流程图空位、下拉候选都能命中答案');
  ok(!!S1.flow && S1.flow.blanks.length === 3, '任务一是流程图，3 个空位（f1/f2/f3）');
  ok(S1.flow.blanks.every((b) => b.mode === 'pick' && b.words.length >= 3), '三个空位都是下拉候选词');
  const missK = [];
  [S1, S2, S3].forEach((S, si) => {
    Object.keys(S.keys || {}).forEach((ri) => Object.keys(S.keys[ri]).forEach((col) => {
      const want = S.keys[ri][col];
      let pool = null;
      if (S.flow) { const b = S.flow.blanks.filter((x) => x.key === col)[0]; pool = b && b.words; }
      else { const c = (S.cols || []).filter((x) => x.key === col)[0]; pool = c && c.pick; }
      (Array.isArray(want) ? want : [want]).forEach((w) => {
        if (pool && pool.indexOf(w) < 0) missK.push('板块' + si + ' 行' + ri + ' 列' + col + '「' + w + '」');
      });
    }));
  });
  ok(missK.length === 0, '三块的 keys 全部命中下拉候选词' + (missK.length ? '（漏：' + missK.join(',') + '）' : ''));
  ok(S2.rows === 3 && S2.rowLabels.length === 3, '任务二 3 行、行首印输入顺序');
  ok(S3.rows === 3 && S3.rowLabels.length === 3, '任务三 3 行、行首印猜法');
  const longest = [].concat(
    S1.flow.blanks.map((b) => Math.max.apply(null, b.words.map((w) => w.length))),
    (S2.cols || []).filter((c) => c.pick).map((c) => Math.max.apply(null, c.pick.map((w) => w.length))),
    (S3.cols || []).filter((c) => c.pick).map((c) => Math.max.apply(null, c.pick.map((w) => w.length)))
  );
  ok(Math.max.apply(null, longest) <= 18, '最长候选词 ' + Math.max.apply(null, longest) + ' 字（≤18，窄屏下拉不会被撑宽）');
  ok(S2.code.indexOf('while cai != da:') >= 0 && S2.code.indexOf('ci = ci + 1') >= 0, '任务二带着那份 Python 程序');

  const t = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  ok(!!t, '教师登录');
  const A = '验证甲' + TAG, B = '验证乙' + TAG;
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B].map((n) => CLA + '，' + n).join('\n') }, t);
  const SA = (await jfetch('/api/student/login', 'POST', { name: A })).ck;
  const SB = (await jfetch('/api/student/login', 'POST', { name: B })).ck;
  ok(!!SA && !!SB, '两位学生登录');

  console.log('\n-- 1. 学生拿到的任务单：结构对、答案不下发');
  const sheet = (await jfetch('/api/lesson/' + LID + '/sheet', 'GET', null, SA)).j;
  ok(sheet.taskFull === 3, '学生端知道满分是 3（一个任务 1 分）');
  ok((sheet.sheet.sections || []).length === 3, '下发 3 个板块');
  const raw = JSON.stringify(sheet);
  ok(!/"keys"|"matchBy"|"altKeys"|"rowTask"|"fillThrough"|"taskCount"|"want"/.test(raw),
    '学生端 payload 里没有 keys/matchBy/altKeys/taskCount/want 这些答案字段');
  ok(raw.indexOf('ci ← ci + 1') >= 0, '候选词照常下发（学生要能选）');

  console.log('\n-- 2. 全对：三个任务系统都判对');
  const good = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: goodRows() }, SA)).j;
  ok(good.auto && good.auto.taskFull === 3 && good.auto.tasks.length === 3, '系统回 3 个任务');
  ok(good.auto.tasks.every((x) => x.ok === true), '三个任务都 ✅');
  ok(good.auto.score === 3, '系统分 3/3');

  console.log('\n-- 3. 错的情形：三个任务各自独立判');
  const b1 = goodRows(); b1[0].f3 = 'ci ← 1';
  const r1 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: b1 }, SB)).j;
  ok(r1.auto.tasks[0].ok === false && r1.auto.tasks[0].wrong === 1, '流程图 f3 选错 → 任务一 ❌（只错 1 格）');
  ok(r1.auto.tasks[1].ok === true && r1.auto.tasks[2].ok === true, '任务二、任务三不受牵连，照样 ✅');
  ok(r1.auto.score === 2, '系统分 2/3');

  const b2 = goodRows(); b2[2].last = '对了！共用次数为：3';
  const r2 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: b2 }, SB)).j;
  ok(r2.auto.tasks[1].ok === false, '任务二第 2 行次数选错 → 任务二 ❌');
  ok(r2.auto.tasks[0].ok === true && r2.auto.tasks[2].ok === true, '任务一、三不受影响');
  ok(r2.auto.score === 2, '系统分 2/3');

  const b3 = goodRows(); b3[5].n = '10 次';
  const r3 = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: b3 }, SB)).j;
  ok(r3.auto.tasks[2].ok === false && r3.auto.tasks[0].ok === true && r3.auto.tasks[1].ok === true,
    '任务三“二分查找 1~100”选成 10 次 → 只有任务三 ❌');
  ok(r3.auto.score === 2, '系统分 2/3');

  const b4 = await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: [] }, SB);
  ok(b4.r.status === 400 && b4.j.ok === false, '整份空表不许保存（400）');
  await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: goodRows() }, SB);

  console.log('\n-- 4. 赋分台：3 个任务、收上来 7 行');
  const bd = (await jfetch('/api/teacher/sheet-board/' + LID + '?class=' + encodeURIComponent(CLA), 'GET', null, t)).j;
  ok(bd.lesson && bd.lesson.taskFull === 3 && bd.lesson.tasks.length === 3,
    '赋分台任务清单 3 条 = 满分 3（' + (bd.lesson.tasks || []).map((x) => x.no + ':' + x.title).join(' / ') + '）');
  const rowA = (bd.students || []).filter((r) => r.name === A)[0];
  ok(!!rowA, '甲的行在赋分台上');
  ok(rowA && rowA.auto && rowA.auto.tasks.every((x) => x.ok === true), '行上带着系统判定：三个任务都 ✅');
  ok(rowA && rowA.rows && rowA.rows.length === 7, '收上来 7 行（流程图 1 + 任务二 3 + 任务三 3）');

  console.log('\n-- 5. 课后小测 5 题');
  const lc = (await jfetch('/api/lesson/' + LID, 'GET', null, SA)).j;
  const qs = lc.lesson.questions || [];
  ok(qs.length === 5, '5 道题');
  ok(qs.map((q) => q.type).join(',') === 'judge,single,multi,fill,fill',
    '题型：' + qs.map((q) => q.type).join(','));
  ok(qs[2].options.length === 4, '第3题多选 4 个选项（二分查找法）');
  ok(qs[3].blanks.length === 5 && qs[3].blanks.every((b) => b.mode === 'pick'), '第4题（跟着程序走）5 空、都用下拉候选词');
  ok(qs[4].blanks.length === 5 && qs[4].blanks.every((b) => b.mode === 'pick'), '第5题（拓展提升）5 空、都用下拉候选词');
  ok(JSON.stringify(qs).indexOf('"accepts"') < 0 && JSON.stringify(qs).indexOf('"show"') < 0,
    '第4、5题不下发 accepts/show（答案留在服务端）');
  ok(JSON.stringify(qs).indexOf('"expl"') < 0, '讲解也不下发（交卷后才给）');

  const answers = {};
  LESSON.questions.forEach((q) => {
    if (q.type === 'fill') {
      const bl = {};
      q.blanks.forEach((x) => { bl[x.key] = x.show; });
      answers[q.id] = { blanks: bl };
    } else answers[q.id] = { ans: q.answer };
  });
  const sub = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers }, SA)).j;
  ok(sub.score === 5 && sub.full === 5, '按标准答案作答 → 5/5（每题整题全对 1 积分）');

  const q3off = JSON.parse(JSON.stringify(answers));
  q3off['6-1-7-q3'].ans = 'A,B,C,D';
  const subQ3 = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers: q3off }, SA)).j;
  const d3 = (subQ3.detail || []).filter((x) => x.id === '6-1-7-q3')[0] || {};
  ok(subQ3.score === 4 && d3.ok === false, '第3题多选多选了 D → 4/5（全对才给分）');

  const oneOff = JSON.parse(JSON.stringify(answers));
  oneOff['6-1-7-q4'].blanks.q4b3 = '对了！共用次数为：2';
  const sub4 = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers: oneOff }, SA)).j;
  const d4 = (sub4.detail || []).filter((x) => x.id === '6-1-7-q4')[0] || {};
  ok(sub4.score === 4 && d4.ok === false, '第4题次数选错一个空 → 4/5（这一题不给分）');

  const subFinal = (await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers }, SA)).j;
  ok(subFinal.score === 5, '再交一次全对 → 又是 5/5（取最高分）');

  console.log('\n-- 6. 证书口径：小测 5 + 任务单 3 = 8');
  const certs0 = (await jfetch('/api/student/certs', 'GET', null, SB)).j;
  const item0 = (certs0.items || []).filter((x) => x.lessonId === LID)[0] || {};
  ok(item0.total === 5 && item0.pending === true,
    '乙：小测交了、任务单没批 → pending，暂按客观题口径算（' + item0.earned + '/' + item0.total + '）');
  ok(item0.earned === 0 && item0.stars === 0, '乙小测还没做 → 0 分 0 星（但已发证，pending）');

  const mAll = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST',
    { uid: rowA.uid, tasks: { 1: true, 2: true, 3: true } }, t)).j;
  ok(mAll.score === 3 && mAll.tasks['1'] === true && mAll.tasks['3'] === true, '整张表一次提交：三个任务都 ✓ → 3 分');
  const certs = (await jfetch('/api/student/certs', 'GET', null, SA)).j;
  const item = (certs.items || []).filter((x) => x.lessonId === LID)[0] || {};
  ok(item.total === 8, '证书满分 8（小测 5 + 任务单 3），不是 10 分制');
  ok(item.earned === 8, '甲拿满 8 分（小测 5 + 老师给的任务单 3）');
  ok(item.issued === true && item.missing.length === 0, '小测 + 任务单都交了 → 发证，缺项为空');
  ok(item.pct === 100 && item.stars === 5, '综合 100% / 5 星');
  ok(/^LXQ-6-1-7-[0-9A-F]{6}$/.test(item.serial || ''), '证书编号形如 LXQ-6-1-7-XXXXXX：' + item.serial);

  const mPart = (await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST',
    { uid: rowA.uid, tasks: { 1: true, 2: true, 3: false } }, t)).j;
  ok(mPart.score === 2, '改成 √√× → 2 分');
  const certs2 = (await jfetch('/api/student/certs', 'GET', null, SA)).j;
  const item2 = (certs2.items || []).filter((x) => x.lessonId === LID)[0] || {};
  ok(item2.earned === 7 && item2.total === 8 && item2.pct === 87.5, '7/8 = 87.5%');
  ok(item2.stars === 4.4 && item2.level === 'good', '4.4 星 / 评价「作业完成较好」');
  ok(item2.issuedAt && item2.issuedAt === item.issuedAt, '颁发日期不因重算而变（firstAt 不覆盖）');

  console.log('\n== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ==');
  // 清掉本测试班
  const list = (await jfetch('/api/teacher/roster', 'GET', null, t)).j.list || [];
  for (const s of list.filter((x) => x.className === CLA)) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: s.uid }, t);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: s.uid }, t);
  }
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检脚本异常：', e); process.exit(2); });
