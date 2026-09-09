// 无浏览器冒烟测试：教师登录 → 名单 → 取卷(脱敏) → 学生登录 → 全对=5积分 → 部分错=3积分
// 整题判分（每题全对得 1 积分，满分=题数=5）→ 成绩回读 → 教师按课成绩。用法：先启动服务，再 node tools/smoke.js
const BASE = process.env.BASE || 'http://localhost:7000';
// 用一次性测试学生（不依赖 seed 示例账号，真实名单环境下也能跑；跑完即清）
const TAG = Date.now().toString(36).slice(-4);
const CLA = '测试六年级';                 // inferGrade → /六年级/ → 6
const NAME = '冒烟测试' + TAG;            // 唯一，避免名单里撞名
const UID = NAME + '｜' + CLA;
const LESSON = '6-1-1';

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}
function cookie(res) { const s = res.headers.get('set-cookie') || ''; return s.split(';')[0]; }
async function jfetch(path, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + path, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { r, j, ck: cookie(r) };
}

(async () => {
  console.log('== 冒烟测试：课堂检测系统 ==');

  // 教师
  const t = await jfetch('/api/teacher/login', 'POST', { password: '123456' });
  ok(t.r.status === 200 && t.j.ok, '教师登录（默认密码）');
  const T = t.ck;

  // 追加一次性测试学生（真实名单下也安全，跑完删除）
  const imp = await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + NAME }, T);
  ok(imp.j.added === 1 && imp.j.total >= 1, '已加入冒烟测试学生');
  let list = (await jfetch('/api/teacher/roster', 'GET', null, T)).j.list || [];
  ok(Array.isArray(list) && list.length >= 4, '名单返回（真实名单可用）');

  // 学生登录 + 目录
  const s = await jfetch('/api/student/login', 'POST', { name: NAME });
  ok(s.r.status === 200 && s.j.ok, '学生“' + NAME + '”登录');
  const S = s.ck;
  const cat = (await jfetch('/api/catalog', 'GET', null, S)).j;
  const lv = cat.catalog && cat.catalog[0] && cat.catalog[0].units[0].lessons.find((l) => l.id === LESSON);
  ok(!!lv && lv.title.includes('算法') && lv.hasFlow === true, '目录含六年级上第1课（hasFlow=true）');

  // 取卷（脱敏）
  const paper = (await jfetch('/api/lesson/' + LESSON, 'GET', null, S)).j;
  ok(paper.lesson.questions.length === 5, '取卷：共5题');
  const leaked = paper.lesson.questions.some((q) =>
    JSON.stringify(q).includes('accepts') || JSON.stringify(q).includes('"expl"') || JSON.stringify(q).includes('"answer"'));
  ok(!leaked, '取卷不泄露答案/解析/accepts');
  const flowQ = paper.lesson.questions.find((q) => q.type === 'flow');
  ok(flowQ && flowQ.flow.blanks.length === 6 && flowQ.flow.nodes.length >= 10, '流程图题含 6 空 + 节点');

  // 全对提交 = 5 积分（每题全对得 1）
  function rightAns(q) {
    if (q.type === 'judge') return { ans: 'A' };
    if (q.type === 'single') return { ans: q.options.find((o) => true) ? q.options[2].key : '' }; // seed 答案在 C
    if (q.type === 'multi') return { ans: 'A,B,C' };
    if (q.type === 'fill') return { blanks: { q3b1: '变量', q3b2: '抽象与建模', q3b3: '验证算法' } };
    if (q.type === 'flow') return {
      blanks: { q5b1: 'A、B、C 的得票数都从 0 开始', q5b2: '是 A 吗？', q5b3: '是 B 吗？',
        q5b4: '是 C 吗？', q5b5: 'C 的得票数加 1', q5b6: '提示“输入有误”，这次不计票' },
    };
    return {};
  }
  const answers1 = {};
  for (const q of paper.lesson.questions) answers1[q.id] = rightAns(q);
  const sub1 = await jfetch('/api/lesson/' + LESSON + '/submit', 'POST', { answers: answers1 }, S);
  ok(sub1.j.score === 5 && sub1.j.full === 5, '全对交卷 = 5/5 积分（每题全对得1）');
  ok(sub1.j.perQ.every((p) => p.ok), '全对：逐题全部 ok');

  // 部分错 = 3 积分（Q4 只选 AB 错 1 项 → 整题0；Q5 第2空填错 → 整题0；其余 3 题对）
  const answers2 = {};
  for (const q of paper.lesson.questions) {
    if (q.id === '6-1-1-q4') { answers2[q.id] = { ans: 'A,B' }; continue; }
    if (q.type === 'flow') {
      answers2[q.id] = { blanks: { q5b1: 'A、B、C 的得票数都从 0 开始', q5b2: '是 B 吗？', q5b3: '是 B 吗？',
        q5b4: '是 C 吗？', q5b5: 'C 的得票数加 1', q5b6: '提示“输入有误”，这次不计票' } };
      continue;
    }
    answers2[q.id] = rightAns(q);
  }
  const sub2 = await jfetch('/api/lesson/' + LESSON + '/submit', 'POST', { answers: answers2 }, S);
  ok(sub2.j.score === 3 && sub2.j.full === 5, '部分错交卷 = 3/5 积分');
  const p4 = sub2.j.perQ.find((p) => p.id === '6-1-1-q4');
  const p5 = sub2.j.perQ.find((p) => p.id === '6-1-1-q5');
  ok(p4 && p4.ok === false, '多选错 1 项 → 整题不得分');
  ok(p5 && p5.ok === false, '流程图错 1 空 → 整题不得分');
  const fb = sub2.j.detail.find((d) => d.id === '6-1-1-q5');
  const blank2 = fb && fb.blanks && fb.blanks.find((b) => b.key === 'q5b2');
  ok(blank2 && blank2.ok === false && blank2.correct === '是 A 吗？', '流程第2空判错并给出正确答案');

  // 成绩回读：best 5 / last 3 / 2 次
  const sc = (await jfetch('/api/student/scores', 'GET', null, S)).j;
  const row = sc.rows.find((r) => r.lessonId === LESSON);
  ok(row && row.best === 5 && row.lastScore === 3 && row.attempts === 2, '成绩回读 best=5 / last=3 / 2次');

  // 教师按课成绩含该生
  const ls = (await jfetch('/api/teacher/lesson-scores/' + LESSON, 'GET', null, T)).j;
  const stu = ls.rows.find((r) => r.uid === UID);
  ok(stu && stu.best === 5, '教师端按课成绩含 best=5');

  // 清理测试学生：删成绩 + 移出名单，恢复原样
  await jfetch('/api/teacher/progress/delete', 'POST', { uid: UID }, T);
  const after = (await jfetch('/api/teacher/lesson-scores/' + LESSON, 'GET', null, T)).j;
  ok(after.rows.find((r) => r.uid === UID).best === null, '已清理测试成绩');
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: UID }, T);
  const finalList = (await jfetch('/api/teacher/roster', 'GET', null, T)).j.list || [];
  ok(!finalList.find((r) => r.uid === UID), '已移出冒烟测试学生');

  console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
  // 稍等让 fetch 连接关闭干净再退出（Windows Node 直接 exit 可能报 UV_HANDLE_CLOSING）
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
})().catch((e) => { console.error('冒烟测试异常：', e); process.exit(2); });
