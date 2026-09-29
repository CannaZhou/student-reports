// 任务单「一题一改赋分」接口自检（2026-09-29 老师口径）：
//   每个任务一个「✓对/✗错」按钮 → 总分恒定＝打勾的个数 → 证书/期末汇总那条链路一个字不改。
// 覆盖：五课任务划分一致性 → 逐题打勾/打叉/撤销 → 总分＝勾数 → 未交也能赋分 →
//       直接填总分或批量记分会清掉逐题标记 → 6-1-3 枚举表的 fillThrough 口径（填到答案列才算做完）。
// 用法：先起隔离实例（PORT=7099），再 BASE=http://127.0.0.1:7099 node tools/_smoke-tasks.js
// ⚠️ 只在 7099 隔离实例上跑，别对着真实数据（tools/_tmp/certtest/app）。
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const TAG = Date.now().toString(36).slice(-4);
// 班名里必须带年级字样：赋分台是按「本课年级」筛班级的（六年级的课只列六年级的班），
// 所以六年级的课和四年级的课各要一个班，别合成一个班不然查不到人。
const CLA = '六年级逐题自检' + TAG;
const CLA4 = '四年级逐题自检' + TAG;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
function cookie(res) { return (res.headers.get('set-cookie') || '').split(';')[0]; }
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { r, j, ck: cookie(r) };
}

(async () => {
  console.log('== 任务单一题一改赋分 自检 ==');
  const t = await jfetch('/api/teacher/login', 'POST', { password: '123456' });
  ok(t.j.ok, '教师登录');
  const T = t.ck;
  const A = '逐题甲' + TAG, B = '逐题乙' + TAG, C = '逐题丙' + TAG;
  const D = '逐题丁' + TAG;   // 四年级那一班只有一个学生，用来试四上第1课
  await jfetch('/api/teacher/roster', 'POST', {
    text: [A, B, C].map((n) => CLA + '，' + n).concat([D].map((n) => CLA4 + '，' + n)).join('\n'),
  }, T);
  const sa = await jfetch('/api/student/login', 'POST', { name: A });
  const sb = await jfetch('/api/student/login', 'POST', { name: B });
  const sd = await jfetch('/api/student/login', 'POST', { name: D });
  ok(sa.j.ok && sb.j.ok && sd.j.ok, '三位学生登录');
  const SA = sa.ck, SB = sb.ck, SD = sd.ck;

  console.log('\n-- 1. 每课任务划分：列表长度 = 满分 = 逐题按钮个数');
  for (const id of ['4-1-1', '4-1-2', '6-1-2', '6-1-3', '6-1-4']) {
    const bd = (await jfetch('/api/teacher/sheet-board/' + id + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
    const L = bd.lesson || {};
    ok(Array.isArray(L.tasks) && L.tasks.length === L.taskFull,
      id + ' 任务清单 ' + (L.tasks || []).length + ' 条 = 满分 ' + L.taskFull);
    ok((L.tasks || []).every((x) => Number.isInteger(x.no) && x.no >= 1 && !!x.title),
      id + ' 每条任务都有题号+名字（' + (L.tasks || []).map((x) => x.no + ':' + x.title).join(' / ') + '）');
  }
  const bd614 = (await jfetch('/api/teacher/sheet-board/6-1-4?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(bd614.lesson.tasks.map((x) => x.title).join(',') === '生活中常用的程序,符号连线,运行程序并手工计算',
    '6-1-4 任务二/三 已对调（' + bd614.lesson.tasks.map((x) => x.title).join(',') + '）');

  console.log('\n-- 2. 6-1-4：学生全对 → 系统 3/3，逐题按钮认得出每题的判定');
  // 板块顺序：任务一 4 行(0~3)、任务二 连线 8 行(4~11)、任务三 程序输出/算式/手工结果(12~14)
  const PROG = {
    '在线打字': ['练打字：照着屏幕上的字打，练速度和正确率', '一开始总要低头看键盘，练多了就能盲打'],
    '画图': ['画画、涂色，还能用各种工具修改画面', '画错了可以撤销重来，比在纸上画省事'],
    'Word': ['写文章、做表格，排版好以后打印出来', '写错了随时能改，还能调字号、插图片'],
    '剪映': ['剪视频，加上字幕、音乐和转场效果', '手机电脑都能剪，加个字幕就有大片的感觉'],
  };
  const t1 = (ord) => ord.map((p, i) => ({ _i: i, prog: p, func: PROG[p][0], feel: PROG[p][1] }));
  const links = (bad) => [
    { _i: 4, sym: '＋ （加）', py: '+' }, { _i: 5, sym: '－ （减）', py: '-' },
    { _i: 6, sym: '× （乘）', py: bad ? '/' : '*' }, { _i: 7, sym: '÷ （除）', py: '/' },
    { _i: 8, op: '==', mean: '等于' }, { _i: 9, op: '!=', mean: '不等于' },
    { _i: 10, op: '>', mean: '大于' }, { _i: 11, op: '<', mean: '小于' },
  ];
  const tail = () => [
    { _i: 12, tou: '35', jiao: '94', ji: '23', tu: '12' },
    { _i: 13, tuExpr: '(94-35×2)÷2=12（只）', jiExpr: '35-12=23（只）' },
    { _i: 14, tou: '35', jiao: '94', ji: '23', tu: '12' },
  ];
  const sheetA = t1(['在线打字', '画图', 'Word', '剪映']).concat(links(false)).concat(tail());
  const saveA = (await jfetch('/api/lesson/6-1-4/sheet/submit', 'POST', { rows: sheetA }, SA)).j;
  ok(saveA.auto && saveA.auto.score === 3 && saveA.auto.taskFull === 3, '甲全对 → 系统 3/3');
  ok(saveA.auto && saveA.auto.tasks.map((t2) => t2.no).join(',') === '1,2,3', '系统结果里三个任务都在');
  const sheetB = t1(['在线打字', '画图', 'Word', '剪映']).concat(links(true)).concat(tail());
  const saveB = (await jfetch('/api/lesson/6-1-4/sheet/submit', 'POST', { rows: sheetB }, SB)).j;
  ok(saveB.auto && saveB.auto.score === 2, '乙把「×」写成 / → 系统 2/3（任务二错）');
  ok(saveB.auto && saveB.auto.tasks[1].ok === false && saveB.auto.tasks[0].ok === true,
    '系统只把任务二判错（一题一改才看得出来是哪个任务错）');

  const back0 = (await jfetch('/api/lesson/6-1-4/sheet', 'GET', null, SA)).j;
  ok(back0.taskFull === 3, '学生接口带回本课满分 3');
  ok(back0.mark === null, '还没赋分 → mark 为空（前端不显示「老师的评分」）');

  console.log('\n-- 3. 老师逐题点「✓对/✗错」：总分＝打勾的个数');
  const uidA = A + '｜' + CLA;
  const uidB = B + '｜' + CLA;
  const post = (uid, task, v) => jfetch('/api/teacher/sheet-board/6-1-4/task', 'POST', { uid, task, ok: v }, T);
  const p1 = (await post(uidA, 1, false)).j;
  ok(p1.score === 0 && p1.tasks['1'] === false, '任务①打✗ → 0 分（tasks ' + JSON.stringify(p1.tasks) + '）');
  const p2 = (await post(uidA, 2, true)).j;
  ok(p2.score === 1 && p2.tasks['2'] === true, '任务②打✓ → 1 分');
  const p3 = (await post(uidA, 3, true)).j;
  ok(p3.score === 2 && p3.tasks['1'] === false && p3.tasks['2'] === true && p3.tasks['3'] === true,
    '任务③打✓ → 2 分（三条判定都记着）');
  ok(!!p3.scoredAt, '回了赋分时间');
  const p4 = (await post(uidA, 3, null)).j;
  ok(p4.score === 1 && !('3' in p4.tasks), '再把任务③点回「未标」→ 撤销，只剩 1 分');
  ok((await post(uidA, 2, null)).j.score === 0, '任务②也撤销 → 0 分');
  const p5 = (await post(uidA, 1, null)).j;
  ok(p5.score === null && p5.tasks === null, '三题全部撤销 → 评分整条删掉（退回「未赋分」，不是记 0 分）');

  // 三题全打✗ —— 这才是货真价实的 0 分记录，必须留下来
  await post(uidA, 1, false); await post(uidA, 2, false);
  const pz = (await post(uidA, 3, false)).j;
  ok(pz.score === 0 && Object.keys(pz.tasks).length === 3, '三题都打✗ → 0 分，而且是「已赋分」的 0 分（不是未赋分）');

  // 越界题号要挡住
  const bad = await post(uidA, 4, true);
  const badMsg = (bad.j.error && bad.j.error.msg) || '';
  ok(bad.r.status === 400 && /1–3/.test(badMsg), '题号 4 越界被挡（' + badMsg + '）');

  console.log('\n-- 4. 落盘与下发：教师端 taskMarks、学生端自己的 mark');
  await post(uidA, 1, true); await post(uidA, 2, false); await post(uidA, 3, true);
  const bd = (await jfetch('/api/teacher/sheet-board/6-1-4?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const rowA = (bd.students || []).find((x) => x.uid === uidA);
  ok(rowA && rowA.score === 2 && rowA.taskMarks && rowA.taskMarks['1'] === true
    && rowA.taskMarks['2'] === false && rowA.taskMarks['3'] === true,
    '赋分台每行带回了逐题判定 ' + JSON.stringify(rowA && rowA.taskMarks));
  const backA = (await jfetch('/api/lesson/6-1-4/sheet', 'GET', null, SA)).j;
  ok(backA.mark && backA.mark.score === 2 && backA.mark.tasks['2'] === false,
    '学生端只拿到自己的评分：' + JSON.stringify(backA.mark && backA.mark.tasks));
  const backB = (await jfetch('/api/lesson/6-1-4/sheet', 'GET', null, SB)).j;
  ok(backB.mark === null, '乙还没被赋分 → 拿到的 mark 是空的（看不到别人的分）');

  console.log('\n-- 5. 没交任务单的学生照样能逐题赋分');
  const pC = (await post(C + '｜' + CLA, 2, true)).j;
  ok(pC.score === 1, '丙从没交过任务单，老师直接给任务②打✓ → 1 分');
  const bdC = (await jfetch('/api/teacher/sheet-board/6-1-4?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const rowC = (bdC.students || []).find((x) => x.uid === C + '｜' + CLA);
  ok(rowC && !rowC.submitted && rowC.score === 1 && rowC.taskMarks['2'] === true,
    '赋分台上丙是「未交但有分有勾」');

  console.log('\n-- 6. 直接填总分 / 批量记分 → 逐题标记作废（不留「总分 2 只打了一个勾」）');
  const sc = (await jfetch('/api/teacher/sheet-board/6-1-4/score', 'POST', { uid: uidA, score: 3 }, T)).j;
  ok(sc.score === 3 && sc.tasks === null, '直接填总分 3 → 响应里的 tasks 是空的（前端把那一排勾清掉）');
  const bd2 = (await jfetch('/api/teacher/sheet-board/6-1-4?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(((bd2.students || []).find((x) => x.uid === uidA) || {}).taskMarks === null, '落盘里也没有残留的逐题勾');
  await post(uidA, 1, true); await post(uidA, 2, true);
  const bt = (await jfetch('/api/teacher/sheet-board/6-1-4/score-batch', 'POST',
    { uids: [uidA, uidB], score: 0 }, T)).j;
  ok((bt.rows || []).every((x) => x.tasks === null), '批量记 0 分 → 每行的 tasks 都作废');
  const bd3 = (await jfetch('/api/teacher/sheet-board/6-1-4?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok(((bd3.students || []).find((x) => x.uid === uidA) || {}).taskMarks === null, '批量后确实没有残留的逐题勾');

  console.log('\n-- 7. 6-1-3 枚举表：做到答案列就算做完（fillThrough）');
  const TRIES = 36;
  // 枚举表：行 0 鸡、行 1 总脚数、行 2 √/×（_i 就是行号）；depth＝学生填到第几列，junkAt＝再往哪一列乱填
  const enumRows = (depth, junkAt) => {
    const r = [{ _i: 0 }, { _i: 1 }, { _i: 2 }];
    for (let i = 1; i <= depth; i++) {
      const tu = i - 1, ji = TRIES - i;
      r[0]['c' + i] = String(ji);
      r[1]['c' + i] = String(ji * 2 + tu * 4);
      r[2]['c' + i] = (tu === 12) ? '√' : '×';
    }
    if (junkAt) { r[0]['c' + junkAt] = '999'; r[1]['c' + junkAt] = '999'; r[2]['c' + junkAt] = '√'; }
    return r;
  };
  const flowRow = { _i: 3, f1: 'tu < 36 ?', f2: 'ji ← 35 - tu', f3: 'ji × 2 + tu × 4 = 94 ?', f4: 'tu ← tu + 1' };
  const sub63 = async (rows, who) => {
    const j = (await jfetch('/api/lesson/6-1-3/sheet/submit', 'POST', { rows }, SA)).j;
    const ta = ((j.auto || {}).tasks || [])[0] || {};
    ok(ta.ok === who.ok, '6-1-3 任务一：' + who.msg + ' → ' + (ta.ok === true ? '判对' : '判错')
      + '（对 ' + ta.right + ' / 错 ' + ta.wrong + '）');
  };
  await sub63(enumRows(13).concat([flowRow]), { ok: true, msg: '正好填到第 13 列（兔=12 答案列）就停' });
  await sub63(enumRows(TRIES).concat([flowRow]), { ok: true, msg: '36 列全填满且全对' });
  await sub63(enumRows(12).concat([flowRow]), { ok: false, msg: '只填到第 12 列（还没枚举到答案）' });
  await sub63(enumRows(13, 16).concat([flowRow]), { ok: false, msg: '第 13 列做完之后又隔两列乱填一格' });
  const s63 = (await jfetch('/api/lesson/6-1-3/sheet/submit', 'POST',
    { rows: enumRows(13).concat([flowRow]) }, SA)).j;
  ok(s63.auto && s63.auto.score === 2 && s63.auto.taskFull === 2, '6-1-3 两个任务都判对 → 系统 2/2');

  console.log('\n-- 8. 4-1-1（三行自由填写，没有标准答案）：系统不判，老师逐题点');
  const free411 = [
    { _i: 0, scene: '校门口', data: '上学、放学的时间', impact: '知道什么时候路口最挤' },
    { _i: 1, scene: '教室', data: '温度、湿度', impact: '决定要不要开窗、开空调' },
    { _i: 2, scene: '操场', data: '跑步成绩', impact: '知道自己有没有进步' },
  ];
  const s411 = (await jfetch('/api/lesson/4-1-1/sheet/submit', 'POST', { rows: free411 }, SD)).j;
  ok(!s411.auto, '4-1-1 系统不判（没有标准答案 → 不下发 auto）');
  const bd411 = (await jfetch('/api/teacher/sheet-board/4-1-1?class=' + encodeURIComponent(CLA4), 'GET', null, T)).j;
  ok(bd411.lesson.taskFull === 3 && bd411.lesson.tasks.length === 3,
    '4-1-1 满分 3、三行就是三题（' + bd411.lesson.tasks.map((x) => x.title).join('/') + '）');
  const uidD = D + '｜' + CLA4;
  const q1 = (await jfetch('/api/teacher/sheet-board/4-1-1/task', 'POST', { uid: uidD, task: 1, ok: true }, T)).j;
  const q2 = (await jfetch('/api/teacher/sheet-board/4-1-1/task', 'POST', { uid: uidD, task: 3, ok: true }, T)).j;
  ok(q1.score === 1 && q2.score === 2, '老师逐题点：第 1 行对、第 3 行对 → 2 分');
  const b411 = (await jfetch('/api/lesson/4-1-1/sheet', 'GET', null, SD)).j;
  ok(b411.taskFull === 3, '4-1-1 学生端也知道满分是 3（taskCount 不下发，单独给了个数）');
  ok(b411.mark && b411.mark.score === 2 && b411.mark.tasks['2'] === undefined,
    '学生端看到「第1处✓、第3处✓，第2处没判」：' + JSON.stringify(b411.mark.tasks));

  console.log('\n-- 9. 4-1-2：活动一/二 系统判得出、活动三留给老师');
  // 活动一 4 行(_i 0~3) 只填 form；活动二 4 行(_i 4~7) 填 forms；活动三 4 行(_i 8~11) 自由填
  const g412 = [0, 1, 2, 3].map((i) => ({ _i: i, form: ['视频', '文本', '图片', '音频'][i] }))
    .concat([0, 1, 2, 3].map((i) => ({
      _i: 4 + i,
      forms: ['数字、文字', '数字、文本、图片', '声音', '数字、文本、图片、声音、视频'][i],
    })))
    .concat([0, 1, 2].map((i) => ({ _i: 8 + i, data: '成长礼' + (i + 1), form: '文本' })));
  const s412 = (await jfetch('/api/lesson/4-1-2/sheet/submit', 'POST', { rows: g412 }, SA)).j;
  ok(s412.auto && s412.auto.tasks.length === 3, '4-1-2 分三个任务（活动一/二/三）');
  ok(s412.auto && s412.auto.tasks[0].ok === true && s412.auto.tasks[1].ok === true,
    '活动一、活动二都填对 → 两个任务判对');
  ok(s412.auto && s412.auto.tasks[2].graded === false, '活动三没有标准答案 → 系统不判，等老师点');

  console.log('\n== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检脚本异常：', e); process.exit(2); });
