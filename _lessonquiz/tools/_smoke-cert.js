// 一课一证书 · 后端自检：发证条件 / 综合评价口径（百分数＋星级＋评语） / 老师批阅与清分 / 未完成态
// 用法：APP=绝对路径/tools/_tmp/certtest/app node tools/_smoke-cert.js
// 建议跑在一份独立数据目录的实例上（见 tools/_tmp/certtest），别碰真实名单与成绩。
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
// 跑在一份**独立数据目录**的服务实例上（APP 指向那份 app 目录），别碰真实成绩与名单
const APP = process.env.APP || path.join(__dirname, '..', 'app');
const CLA = '六年级测试证书班'; // 带「六年级」：教师端按班名推断年级，证书墙才会带上单元名
const TAG = Date.now().toString(36).slice(-4);
const A = '证书全交' + TAG, B = '证书只单' + TAG, C = '证书无单' + TAG, D = '证书没做' + TAG;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const eq = (a, b, m) => ok(a === b, m + '（实际 ' + JSON.stringify(a) + '，期望 ' + JSON.stringify(b) + '）');

const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => ({})), ck: cookie(r) };
}

// 从 content.json 里取标准答案，凑一份满分答案（用来把学生的分数钉死在已知值上）
const { sheetTaskCount } = require(path.join(APP, 'core', 'lesson.js'));
const CONTENT = JSON.parse(fs.readFileSync(path.join(APP, 'data', 'content.json'), 'utf8'));
function findLesson(id) {
  for (const g of CONTENT.grades || []) for (const u of g.units || []) for (const l of u.lessons || []) if (l.id === id) return l;
  return null;
}
function fullAnswers(lesson) {
  const out = {};
  for (const q of lesson.questions || []) {
    const blanks = q.type === 'flow' ? (q.flow && q.flow.blanks) : (q.type === 'fill' && q.blanks ? q.blanks : null);
    if (blanks) {
      const b = {};
      blanks.forEach((x) => { b[x.key] = (x.accepts && x.accepts[0]) || x.show || ''; });
      out[q.id] = { blanks: b };
    } else if (q.type === 'fill') {
      out[q.id] = { ans: (q.answers && q.answers[0]) || q.answer || '' };
    } else {
      out[q.id] = { ans: q.answer || '' };
    }
  }
  return out;
}
const hasSheet = (id) => !!(findLesson(id) || {}).sheet;
const qCount = (id) => ((findLesson(id) || {}).questions || []).length;
const SHEET_ROW = (id) => (hasSheet(id) ? [{ _i: 0, lab: '烟雾自检', c1: '1', f1: 'x' }] : []);

(async () => {
  console.log('== 一课一证书 后端自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  ok(!!T, '教师登录');
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B, C, D].map((n) => CLA + '，' + n).join('\n') }, T);

  const S = {};
  for (const n of [A, B, C, D]) S[n] = (await jfetch('/api/student/login', 'POST', { name: n })).ck;

  const L1 = '6-1-3';                 // 任务单 2 题：5 题小测 + 2 题任务单，满分 7
  const L2 = '6-1-1';                 // 无任务单：5 题，满分 5
  const L3 = '6-1-2';                 // 任务单 1 题：5 题小测 + 1 题任务单，满分 6
  const taskFullOf = (id) => ((findLesson(id) || {}).sheet ? sheetTaskCount(findLesson(id).sheet) : 0);
  const lid = (n) => (n === C ? L2 : L1);
  const lc = findLesson(L1);

  console.log('\n-- 1. 什么都没做：不发证，评语是「未完成」');
  let r = await jfetch('/api/student/certs/' + L1, 'GET', null, S[D]);
  eq(r.j.item.issued, false, '未完成 issued=false');
  eq(r.j.item.missing.join(','), 'quiz,sheet', 'missing=quiz,sheet');
  eq(r.j.item.comment, '作业未完成，良好习惯从小事做起！', '未完成评语');

  console.log('\n-- 2. 只交任务单（小测没交）：不发证');
  await jfetch('/api/lesson/' + L1 + '/sheet/submit', 'POST', { rows: SHEET_ROW(L1) }, S[B]);
  r = await jfetch('/api/student/certs/' + L1, 'GET', null, S[B]);
  eq(r.j.item.issued, false, '只交任务单 issued=false');
  eq(r.j.item.missing.join(','), 'quiz', 'missing=quiz');
  ok(r.j.item.sheetDone === true && r.j.item.quizDone === false, 'sheetDone=true / quizDone=false');

  console.log('\n-- 3. 小测满分 + 交任务单 → 当场发证，待老师批阅时按客观题口径');
  r = await jfetch('/api/lesson/' + L1 + '/submit', 'POST', { answers: fullAnswers(lc) }, S[A]);
  eq(r.j.score, qCount(L1), '小测满分');
  eq(r.j.cert.issued, false, '只交小测还没交任务单 → 未发证');
  eq(r.j.cert.missing.join(','), 'sheet', 'missing=sheet');
  r = await jfetch('/api/lesson/' + L1 + '/sheet/submit', 'POST', { rows: SHEET_ROW(L1) }, S[A]);
  eq(r.j.cert.issued, true, '两样都交 → 已发证');
  eq(r.j.cert.pending, true, 'pending=任务单待老师批阅');
  eq(r.j.cert.pct, 100, '待批阅时 pct 只按客观题 = 100');
  eq(r.j.cert.stars, 5, 'stars=5');

  console.log('\n-- 4. 证书落盘：firstAt 记下来了');
  const pf = path.join(APP, 'data', 'progress', encodeURIComponent(A + '｜' + CLA) + '.json');
  let disk = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const firstAt = disk.certs && disk.certs[L1] && disk.certs[L1].firstAt;
  ok(!!firstAt, 'p.certs[' + L1 + '].firstAt 已写入');

  // 任务单满分 = 本课任务数（老师口径：一题 1 分，做对几题得几分）
  console.log('\n-- 4b. 任务单满分就是"这一课有几题"');
  eq(taskFullOf(L1), 2, L1 + ' 的任务单满分');
  eq(taskFullOf(L3), 1, L3 + ' 的任务单满分');
  eq(taskFullOf(L2), 0, L2 + '（无任务单）满分 0');
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score', 'POST', { uid: A + '｜' + CLA, score: 3 }, T);
  eq(r.status, 400, '超过任务数（2 题却给 3 分）被拒：' + (r.j.error && r.j.error.msg));
  r = await jfetch('/api/teacher/sheet-board/' + L1 + '/score', 'POST', { uid: A + '｜' + CLA, score: 2 }, T);
  eq(r.status, 200, '正好等于任务数 2 分可以');

  console.log('\n-- 5. 锚点：做对 1/2 题 → (5+1)/7 = 85.7% → 4.3 星「作业完成较好」');
  await jfetch('/api/teacher/sheet-board/' + L1 + '/score', 'POST', { uid: A + '｜' + CLA, score: 1 }, T);
  r = await jfetch('/api/student/certs/' + L1, 'GET', null, S[A]);
  const it = r.j.item;
  eq(it.pending, false, 'pending=false');
  eq(it.taskFull, 2, 'taskFull=2');
  eq(it.pct, 85.7, 'pct=(5+1)/7=85.7');
  eq(it.stars, 4.3, 'stars=4.3');
  eq(it.level, 'good', 'level=good');
  eq(it.comment, '作业完成较好，细节仍需改善', '评价语');
  eq(it.issuedAt, firstAt, '发证时间不因批阅而变');
  ok(/^LXQ-6-1-3-[0-9A-F]{6}$/.test(it.serial), '证书编号格式 ' + it.serial);

  console.log('\n-- 6. 做对 2/2 题 → 100%「作业做得很棒」；做对 0/2 → 5/7 = 71.4% 仍是「作业完成较好」');
  await jfetch('/api/teacher/sheet-board/' + L1 + '/score', 'POST', { uid: A + '｜' + CLA, score: 2 }, T);
  r = await jfetch('/api/student/certs/' + L1, 'GET', null, S[A]);
  eq(r.j.item.pct, 100, '小测满分+任务单满分 = 100');
  eq(r.j.item.comment, '作业做得很棒，希望你继续保持', '满分评价语');
  await jfetch('/api/teacher/sheet-board/' + L1 + '/score', 'POST', { uid: A + '｜' + CLA, score: 0 }, T);
  r = await jfetch('/api/student/certs/' + L1, 'GET', null, S[A]);
  eq(r.j.item.pct, 71.4, '小测满分+任务单0分 = 5/7 = 71.4');
  eq(r.j.item.comment, '作业完成较好，细节仍需改善', '71.4% 属 ≥60% 档');

  console.log('\n-- 6b. 「作业错误较多」档：小测只对 3/5 + 任务单 1/2 → 4/7 = 57.1%');
  const E = '证书偏低' + TAG;
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + E }, T);
  const SE = (await jfetch('/api/student/login', 'POST', { name: E })).ck;
  const partial = fullAnswers(lc);
  // 只答对前 3 题：把后两题改成空答案（判 0 分）
  Object.keys(partial).slice(3).forEach((k) => { partial[k] = { ans: '', blanks: {} }; });
  await jfetch('/api/lesson/' + L1 + '/submit', 'POST', { answers: partial }, SE);
  await jfetch('/api/lesson/' + L1 + '/sheet/submit', 'POST', { rows: SHEET_ROW(L1) }, SE);
  await jfetch('/api/teacher/sheet-board/' + L1 + '/score', 'POST', { uid: E + '｜' + CLA, score: 1 }, T);
  r = await jfetch('/api/student/certs/' + L1, 'GET', null, SE);
  const et = r.j.item;
  eq(et.quizScore, 3, '小测 3/5');
  eq(et.pct, 57.1, 'pct=(3+1)/7=57.1');
  eq(et.stars, 2.9, 'stars=2.9');
  eq(et.comment, '作业错误较多，老师期待你的进步', '低于 60% 的评价语');

  console.log('\n-- 6c. 陶然那种课（1 题任务单）：小测满分 + 任务做对 1/1 → 100%');
  const F = '证书单题' + TAG;
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + F }, T);
  const SF = (await jfetch('/api/student/login', 'POST', { name: F })).ck;
  await jfetch('/api/lesson/' + L3 + '/submit', 'POST', { answers: fullAnswers(findLesson(L3)) }, SF);
  await jfetch('/api/lesson/' + L3 + '/sheet/submit', 'POST', { rows: SHEET_ROW(L3) }, SF);
  r = await jfetch('/api/lesson/' + L3 + '/sheet/submit', 'POST', { rows: SHEET_ROW(L3) }, SF);
  eq(r.j.cert.pct, 100, '待批阅时先按客观题 100');
  await jfetch('/api/teacher/sheet-board/' + L3 + '/score', 'POST', { uid: F + '｜' + CLA, score: 1 }, T);
  r = await jfetch('/api/student/certs/' + L3, 'GET', null, SF);
  eq(r.j.item.taskFull, 1, '1 题任务单');
  eq(r.j.item.pct, 100, '小测满分 + 做对 1/1 题 = (5+1)/6 = 100%');
  eq(r.j.item.comment, '作业做得很棒，希望你继续保持', '仍是最优评语');

  console.log('\n-- 7. 老师清除评分 → 回到待批阅口径，证书不撤回');
  await jfetch('/api/teacher/sheet-board/' + L1 + '/score', 'POST', { uid: A + '｜' + CLA, score: '' }, T);
  r = await jfetch('/api/student/certs/' + L1, 'GET', null, S[A]);
  eq(r.j.item.pending, true, '清分后 pending=true');
  eq(r.j.item.pct, 100, '回到客观题口径 100');
  eq(r.j.item.issued, true, '证书不撤回');

  console.log('\n-- 8. 重复交卷：取最高一次，发证时间不变');
  await jfetch('/api/lesson/' + L1 + '/submit', 'POST', { answers: {} }, S[A]); // 0 分的一次
  r = await jfetch('/api/student/certs/' + L1, 'GET', null, S[A]);
  eq(r.j.item.quizScore, qCount(L1), 'quizScore 取最高一次');
  eq(r.j.item.issuedAt, firstAt, 'firstAt 未被覆盖');

  console.log('\n-- 9. 无任务单的课（' + L2 + '）：交完小测当场发证');
  r = await jfetch('/api/lesson/' + L2 + '/submit', 'POST', { answers: fullAnswers(findLesson(L2)) }, S[C]);
  eq(r.j.cert.issued, true, '无任务单课已发证');
  eq(r.j.cert.pending, false, 'pending 恒 false');
  r = await jfetch('/api/student/certs/' + L2, 'GET', null, S[C]);
  eq(r.j.item.taskFull, 0, 'taskFull=0');
  eq(r.j.item.total, qCount(L2), '分母只有题数');
  eq(r.j.item.pct, 100, 'pct=100');

  console.log('\n-- 10. 证书墙与课程地图');
  r = await jfetch('/api/student/certs', 'GET', null, S[A]);
  const wall = r.j.items;
  eq(wall.length, 4, '证书墙列出本年级全部 4 课');
  const w1 = wall.filter((x) => x.lessonId === L1)[0];
  ok(w1 && w1.issued && w1.title.indexOf('第3课') === 0, '墙上课卡带课名与已发证状态');
  ok(wall.some((x) => x.unitTitle), '带单元名（分组用）');
  r = await jfetch('/api/catalog', 'GET', null, S[A]);
  const card = r.j.catalog.flatMap((g) => g.units).flatMap((u) => u.lessons).filter((l) => l.id === L1)[0];
  ok(card.cert && card.cert.issued === true && card.cert.stars === 5, '课程地图课卡带证书小标');
  r = await jfetch('/api/student/scores', 'GET', null, S[A]);
  const row = r.j.rows.filter((x) => x.lessonId === L1)[0];
  ok(row.cert && row.cert.issued, '成绩表行带证书字段');

  console.log('\n-- 11. 权限与不存在的课');
  r = await jfetch('/api/student/certs', 'GET');
  eq(r.status, 401, '未登录 401');
  r = await jfetch('/api/student/certs/9-9-9', 'GET', null, S[A]);
  eq(r.status, 404, '不存在的课 404');

  console.log('\n-- 12. 老进度文件（没有 certs 键）也能推出颁发日期');
  delete disk.certs;
  fs.writeFileSync(pf, JSON.stringify(disk, null, 1));
  const { Store } = require(path.join(APP, 'core', 'store.js'));
  const CONFIG = require(path.join(APP, 'config.js'));
  const st2 = new Store(CONFIG).loadAll();
  const { evalLesson, buildCertWall } = require(path.join(APP, 'core', 'cert.js'));
  const stu2 = st2.findRoster(A + '｜' + CLA);
  const ev = evalLesson(st2, stu2, st2.findLesson(L1));
  eq(ev.issued, true, '无 certs 键仍判定已发证');
  ok(!!ev.issuedAt, '颁发日期由最后一次交卷/交任务单时间推出来：' + ev.issuedAt);
  ok(buildCertWall(st2, stu2).items.length >= 1, '证书墙正常');

  console.log('\n-- 清理测试数据');
  for (const n of [A, B, C, D, E, F]) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: n + '｜' + CLA }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: n + '｜' + CLA }, T);
  }
  ok(!fs.existsSync(pf), '测试生的成绩文件已删除');

  console.log('\n== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检脚本异常：', e); process.exit(1); });
