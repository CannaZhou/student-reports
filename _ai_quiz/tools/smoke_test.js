// 无浏览器 API 冒烟测试：登录/判分/选题去重/打卡解锁/幂等/排行榜
// 用法：node tools/smoke_test.js [BASE_URL] [教师密码]
const BASE = process.argv[2] || 'http://localhost:8080';
const TEACHER_PW = process.argv[3] || 'test1234';
const bank = require('../app/data/bank.json');
const byId = new Map(bank.questions.map((q) => [q.id, q]));

// 每次运行用独立学生名，避免上次运行残留的打卡进度影响本断言
const RUN = process.pid % 90000 + 10000;
const MING = '冒烟小明' + RUN;
const HONG = '冒烟小红' + RUN;

let cookie = '';
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const j = await res.json().catch(() => ({}));
  return { status: res.status, ...j };
}
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗ FAIL:', msg); }
}
function correctAnswer(q) {
  if (q.type === 'fill') return (q.answers && q.answers[0]) || q.answer || '';
  return q.answer || '';
}
function wrongAnswer(q) {
  if (q.type === 'fill') return 'XXXX错误答案XXXX';
  const keys = q.options.map((o) => o.key);
  const wrong = keys.find((k) => !String(q.answer).split(',').includes(k));
  return wrong || 'Z';
}

async function main() {
  console.log('== 教师设置/登录 ==');
  let r = await api('POST', '/api/teacher/login', { password: TEACHER_PW });
  if (r.needsSetup) {
    r = await api('POST', '/api/teacher/setup', { password: TEACHER_PW });
    assert(r.ok === true, '首次设置教师密码');
    r = await api('POST', '/api/teacher/login', { password: TEACHER_PW });
  }
  assert(r.ok === true, '教师登录');

  // 停用历史测试学生，保证排行榜/断言只受本次运行影响
  r = await api('GET', '/api/teacher/students');
  for (const s of r.list) {
    if (s.name.startsWith('冒烟') || ['小明', '小红', '测试生'].includes(s.name)) {
      await api('DELETE', '/api/teacher/students/' + encodeURIComponent(s.name));
    }
  }

  console.log('== 添加学生 ==');
  r = await api('POST', '/api/teacher/students', { nameText: MING + '\n' + HONG + '\n测试生' });
  assert(r.ok === true && r.added.length >= 0, '添加学生（返回 ' + JSON.stringify(r.added).length + '）');

  console.log('== 学生登录 ==');
  r = await api('POST', '/api/student/login', { name: MING, password: 'zqxx2025' });
  assert(r.ok === true && r.name === MING, MING + '登录, nextDay=' + r.nextDay);
  assert(r.totalDays === 50 && r.daySize === 50 && r.scorePerQuestion === 2, '打卡参数(50天×50题×2分)');

  console.log('== 分类 ==');
  r = await api('GET', '/api/student/categories');
  const unitCount = r.categories.reduce((n, c) => n + c.units.length, 0);
  assert(r.ok && unitCount === 28, '分类共 ' + unitCount + ' 个单元');
  const c0 = r.categories[0].units[0];
  assert(c0 && c0.count > 0, '单元 ' + c0.id + ' 有 ' + c0.count + ' 题');

  console.log('== 每日打卡第1天 ==');
  r = await api('GET', '/api/student/daily/1');
  assert(r.ok && r.questions.length === 50, '第1天 50 题');
  const hasAnswerLeak = r.questions.some((q) => q.answer !== undefined || q.expl !== undefined || q.correctAnswer);
  assert(!hasAnswerLeak, '判分前不下发答案/解析');
  const day1Questions = r.questions;

  r = await api('GET', '/api/student/daily/1');
  assert(JSON.stringify(r.questions.map((q) => q.id)) === JSON.stringify(day1Questions.map((q) => q.id)), '刷新题目不变（确定性种子）');

  console.log('== 判分（前20对，后30错）==');
  const answers = day1Questions.map((q, i) => ({
    id: q.id,
    answer: i < 20 ? correctAnswer(byId.get(q.id)) : wrongAnswer(byId.get(q.id)),
  }));
  r = await api('POST', '/api/student/daily/1/submit', { answers });
  assert(r.ok && r.correct === 20 && r.total === 50 && r.score === 40, `判分正确: ${r.correct}/${r.total}, ${r.score}分`);
  assert(r.nextDay === 2, '第2天解锁 nextDay=' + r.nextDay);

  console.log('== 幂等（重复提交不重复计分/计错）==');
  const before = await api('GET', '/api/student/wrong');
  r = await api('POST', '/api/student/daily/1/submit', { answers: [] });
  assert(r.replay === true && r.score === 40, '重复提交返回既有记录');
  const after = await api('GET', '/api/student/wrong');
  assert(before.list.length === after.list.length, '幂等：错题本数量不变');

  console.log('== 关卡锁定 ==');
  r = await api('GET', '/api/student/daily/3');
  assert(r.status === 403, '未完成的第3天被锁定(403)');

  console.log('== 错题本 ==');
  assert(after.list.length >= 25, '错题本约30条, 实际 ' + after.list.length);

  console.log('== 第2天 错题优先 ==');
  r = await api('GET', '/api/student/daily/2');
  assert(r.ok && r.questions.length === 50, '第2天 50 题');
  // 第2天主池 50 全新题，应避开第1天做过的 50 题（前49天主池足够）
  const day2Ids = new Set(r.questions.map((q) => q.id));
  const overlap = day1Questions.filter((q) => day2Ids.has(q.id)).length;
  assert(overlap === 0, `第2天与第1天无重复 (重复 ${overlap})`);

  console.log('== 分类练习 ==');
  r = await api('GET', '/api/student/practice?unit=4.3&limit=10');
  assert(r.ok && r.questions.length === 10, '单元4.3 练习抽10题');
  assert(r.questions.every((q) => q.answer === undefined), '练习题不含答案');
  r = await api('POST', '/api/student/practice/submit', {
    questions: r.questions,
    answers: r.questions.map((q) => ({ id: q.id, answer: wrongAnswer(byId.get(q.id)) })),
  });
  assert(r.ok && r.total === 10, '练习提交判分 ' + r.correct + '/10');

  console.log('== 排行榜 ==');
  r = await api('GET', '/api/student/leaderboard');
  assert(r.ok && r.me && r.me.name === MING && r.me.rank === 1, MING + '排行榜第1');

  console.log('== 学生视角无教师接口 ==');
  const r2 = await api('GET', '/api/teacher/overview');
  assert(r2.status === 401, '学生cookie访问教师接口被拒(401)');

  console.log('== 不同学生题目不同 ==');
  await api('POST', '/api/student/logout', {});
  r = await api('POST', '/api/student/login', { name: HONG, password: 'zqxx2025' });
  assert(r.ok, HONG + '登录');
  r = await api('GET', '/api/student/daily/1');
  const xiaohong = new Set(r.questions.map((q) => q.id));
  const overlap2 = day1Questions.filter((q) => xiaohong.has(q.id)).length;
  assert(overlap2 < 30, MING + '/' + HONG + '第1天题目不同（重叠 ' + overlap2 + '）');

  console.log('== 教师查看学生详情 ==');
  await api('POST', '/api/teacher/login', { password: TEACHER_PW });
  r = await api('GET', '/api/teacher/student/' + encodeURIComponent(MING));
  assert(r.ok && r.days.some((d) => d.day === 1 && d.done && d.score === 40), '教师端可见' + MING + '第1天40分');
  r = await api('GET', '/api/teacher/overview');
  const xiaoming = r.students.find((s) => s.name === MING);
  assert(xiaoming && xiaoming.doneDays === 1, '教师概览' + MING + '完成1天');

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('测试异常:', e); process.exit(1); });
