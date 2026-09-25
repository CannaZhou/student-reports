// 赋分台「批量赋分」后端自检：勾选一批人统一记分 / 清除 / 给没交的人记 0 分
// 用法：node tools/_smoke-batch.js   （跑在 7099 那台独立数据目录的实例上，别指生产）
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const CLA = '六年级批量赋分班';
const TAG = Date.now().toString(36).slice(-4);
const A = '批甲' + TAG, B = '批乙' + TAG, C = '批丙' + TAG, D = '批丁' + TAG, E = '批戊' + TAG;
const L1 = '6-1-3';                       // 任务单 2 题 → 赋分上限 2
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '（实际 ' + JSON.stringify(a) + '，期望 ' + JSON.stringify(b) + '）');

const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => ({})), ck: cookie(r) };
}
const ROW = [{ _i: 0, lab: '批量自检', c1: '1', f1: 'x' }];

// 先把本测试班清空：脚本中途崩过会留下上一轮的学生，脏数据会把计数类断言撑大
async function purge(T) {
  const list = (await jfetch('/api/teacher/roster', 'GET', null, T)).j.list || [];
  const junk = list.filter((s) => s.className === CLA);
  for (const s of junk) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: s.uid }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: s.uid }, T);
  }
  return junk.length;
}

// 把赋分台那一屏的数据取回来（前端就是拿它决定勾选、批量按钮和行底色）
// 必须显式带上 ?class=：接口默认取「本年级第一个班」，而这份隔离数据里还躺着别的测试班，
// 一旦别人排到前面，断言就会对着错误的班做。
const board = async (T) => (await jfetch('/api/teacher/sheet-board/' + L1 + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
const rowOf = (j, name) => j.students.filter((s) => s.name === name)[0] || null;
const scoreOf = async (T, name) => { const r = rowOf(await board(T), name); return r ? r.score : '查无此人'; };

(async () => {
  console.log('== 赋分台批量赋分 · 后端自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  ok(!!T, '教师登录');
  const cleaned = await purge(T);
  if (cleaned) console.log('  （先清掉上一轮残留的 ' + cleaned + ' 个测试生）');
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B, C, D, E].map((n) => CLA + '，' + n).join('\n') }, T);
  const S = {};
  for (const n of [A, B, C, D, E]) S[n] = (await jfetch('/api/student/login', 'POST', { name: n })).ck;
  // 甲、乙交了任务单；丙、丁、戊没交
  await jfetch('/api/lesson/' + L1 + '/sheet/submit', 'POST', { rows: ROW }, S[A]);
  await jfetch('/api/lesson/' + L1 + '/sheet/submit', 'POST', { rows: ROW }, S[B]);
  ok(true, '测试数据已备好：' + A + '/' + B + ' 已交，' + C + '/' + D + '/' + E + ' 未交');

  console.log('\n-- 1. 前提：未交的人也在赋分台里，而且分数是 null（所以能给他们赋分）');
  let j = await board(T);
  eq(j.lesson.taskFull, 2, '本课任务单满分 = 2 题');
  eq(rowOf(j, A).submitted, true, A + ' submitted=true');
  eq(rowOf(j, C).submitted, false, C + ' submitted=false（未交的也在名单里）');
  eq(rowOf(j, C).score, null, C + ' 未交时 score=null → 前端画红行');

  console.log('\n-- 2. 勾一批人（含未交的）统一记 2 分');
  const uA = rowOf(j, A).uid, uB = rowOf(j, B).uid, uC = rowOf(j, C).uid;
  let r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [uA, uB, uC], score: 2 }, T);
  eq(r.status, 200, '批量接口 200');
  eq(r.j.updated, 3, 'updated=3');
  eq(r.j.skipped, 0, 'skipped=0');
  eq(r.j.score, 2, '返回统一记的分数 2');
  eq(r.j.rows.length, 3, '逐人回执 3 条');
  ok(r.j.rows[0].uid && r.j.rows[0].scoredAt && typeof r.j.rows[0].termScore === 'number',
    '回执带 uid / scoredAt / termScore（前端靠它就地刷新那一行）');
  eq(await scoreOf(T, A), 2, '甲 = 2');
  eq(await scoreOf(T, B), 2, '乙 = 2');
  eq(await scoreOf(T, C), 2, '丙（未交）= 2');
  j = await board(T);
  ok(rowOf(j, C).submitted === false && rowOf(j, C).score === 2,
    '未交 + 有分 → 前端画绿行、标签「未交·记2分」（分不是 null，所以不会被判成未赋分）');

  console.log('\n-- 3. 「没交且没赋分的人」正是那个一键按钮要打的集合');
  // 只数本轮造出来的 5 个人：这份隔离数据里可能还留着别的班/别轮的学生
  const mine = [A, B, C, D, E];
  const zeroTargets = () => j.students.filter((x) => mine.indexOf(x.name) >= 0 && !x.submitted && x.score == null).map((x) => x.name).sort();
  eq(zeroTargets().join(','), [D, E].sort().join(','), '一键「记 0 分」的目标 = 没交且没赋分的两个（丙没交但已有分，不动）');

  console.log('\n-- 4. 一键给没交的记 0 分');
  const dUid = rowOf(j, D).uid, eUid = rowOf(j, E).uid;
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [dUid, eUid], score: 0 }, T);
  eq(r.j.updated, 2, 'updated=2');
  eq(await scoreOf(T, D), 0, '丁 = 0');
  eq(await scoreOf(T, E), 0, '戊 = 0');
  eq(await scoreOf(T, C), 2, '丙仍是 2（批量不会误伤没选中的人）');
  j = await board(T);
  eq(zeroTargets().length, 0, '记完之后「没交且没赋分」清零 → 按钮自己会变灰');

  console.log('\n-- 4b. 给没交的人记 0 分，不能凭空把证书发出去');
  // 丁：小测没做、任务单没交，只是被记了 0 分。发证条件看的是「交了没」，不是「有没有分」
  r = await jfetch('/api/student/certs/' + L1, 'GET', null, S[D]);
  eq(r.j.item.issued, false, '没做小测＋没交任务单 → 仍然不发证');
  eq(r.j.item.missing.join(','), 'quiz,sheet', 'missing=quiz,sheet');
  eq(r.j.item.comment, '作业未完成，良好习惯从小事做起！', '评语仍是「未完成」');
  r = await jfetch('/api/student/scores', 'GET', null, S[D]);
  ok(r.j.rows.some((x) => x.lessonId === L1), '学生自己的成绩表里能看到这课的记录（老师给的 0 分）');

  console.log('\n-- 5. 批量清除评分');
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [dUid, eUid], score: '' }, T);
  eq(r.status, 200, '清除 200');
  eq(r.j.score, null, '返回 score=null');
  eq(await scoreOf(T, D), null, '丁 回到未赋分');
  eq(await scoreOf(T, E), null, '戊 回到未赋分');
  j = await board(T);
  eq(zeroTargets().length, 2, '清除后这两人又回到「没交且没赋分」');

  console.log('\n-- 6. 边界：超范围 / 空选 / 名单外的人 / 小数');
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [uA], score: 3 }, T);
  eq(r.status, 400, '超过任务数（2 题给 3 分）被拒：' + (r.j.error && r.j.error.msg));
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [uA], score: 1.5 }, T);
  eq(r.status, 400, '小数被拒');
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [uA], score: -1 }, T);
  eq(r.status, 400, '负数被拒');
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [], score: 1 }, T);
  eq(r.status, 400, '一个都没选被拒');
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [uA, '查无此人｜' + CLA], score: 1 }, T);
  eq(r.status, 200, '夹带名单外的人不整体失败');
  eq(r.j.updated, 1, 'updated=1');
  eq(r.j.skipped, 1, 'skipped=1（前端提示「1 人不在名单里，已跳过」）');
  eq(await scoreOf(T, A), 1, '甲被改成 1');
  r = await jfetch('/api/teacher/sheet-board/9-9-9/score-batch', 'POST', { uids: [uA], score: 1 }, T);
  eq(r.status, 404, '不存在的课 404');
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [uA], score: 1 });
  eq(r.status, 401, '未登录 401');

  console.log('\n-- 7. 回归：单人赋分通道没被改坏（还多了 scoredAt）');
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score', 'POST', { uid: uA, score: 2 }, T);
  eq(r.status, 200, '单人赋分 200');
  ok(!!r.j.scoredAt, '单人赋分现在也回 scoredAt（前端显示「赋分于 …」）');
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score', 'POST', { uid: uA, score: '' }, T);
  eq(r.j.score, null, '单人清除仍可用');
  eq(r.j.scoredAt, null, '清除后 scoredAt=null');

  console.log('\n-- 8. 学生订正重交之后，批量赋的分还在（这是老师说「看着像丢了」的那条路径）');
  await jfetch('/api/teacher/sheet-board/' + L1 + '/score-batch', 'POST', { uids: [uA, uB], score: 2 }, T);
  await jfetch('/api/lesson/' + L1 + '/sheet/submit', 'POST', { rows: [{ _i: 0, lab: '订正后重交', c1: '2', f1: 'y' }] }, S[A]);
  eq(await scoreOf(T, A), 2, '甲订正重交后仍是 2 分（批量赋的分不会被冲掉）');

  console.log('\n-- 清理测试数据');
  for (const n of [A, B, C, D, E]) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: n + '｜' + CLA }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: n + '｜' + CLA }, T);
  }
  ok(true, '已清理');

  console.log('\n== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检脚本异常：', e); process.exit(1); });
