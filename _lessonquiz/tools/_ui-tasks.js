// 任务单「一题一改赋分」界面自检（2026-09-29）：
//   赋分台每行的逐题「任务①✓/✗」按钮条（系统判得出的先预选成虚框、老师改过的变实框）、
//   点一下总分当场跟着变、系统判不了的课（四上1课三行自由填写）由老师逐题点、
//   学生端「👩🏫 老师的评分」面板（老师只给总分的老记录不假装逐题），以及 500px 窄屏不撑破。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-tasks.js   （跑在隔离实例上，别指生产）
const { spawn, execSync } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9700 + Math.floor(Math.random() * 250);
const TAG = Date.now().toString(36).slice(-4);
const CLA = '六年级逐题界面班' + TAG;
const CLA4 = '四年级逐题界面班' + TAG;
const A = '界甲' + TAG, B = '界乙' + TAG, C = '界丙' + TAG, D = '界丁' + TAG;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotDir = path.join(__dirname, '_tmp', 'tk_shot');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => ({})), ck: cookie(r) };
}

// 第4课任务单的行（板块顺序：任务一 0~3、运算符 4~7、比较 8~11、程序输出 12、算式 13、手工结果 14）
const PROG = {
  '在线打字': ['练打字：照着屏幕上的字打，练速度和正确率', '一开始总要低头看键盘，练多了就能盲打'],
  '画图': ['画画、涂色，还能用各种工具修改画面', '画错了可以撤销重来，比在纸上画省事'],
  'Word': ['写文章、做表格，排版好以后打印出来', '写错了随时能改，还能调字号、插图片'],
  '剪映': ['剪视频，加上字幕、音乐和转场效果', '手机电脑都能剪，加个字幕就有大片的感觉'],
};
function rows614(badLink) {
  const rows = ['在线打字', '画图', 'Word', '剪映'].map((p, i) => ({
    _i: i, prog: p, func: PROG[p][0], feel: PROG[p][1],
  }));
  return rows.concat([
    { _i: 4, sym: '＋ （加）', py: '+' }, { _i: 5, sym: '－ （减）', py: '-' },
    { _i: 6, sym: '× （乘）', py: badLink ? '/' : '*' }, { _i: 7, sym: '÷ （除）', py: '/' },
    { _i: 8, op: '==', mean: '等于' }, { _i: 9, op: '!=', mean: '不等于' },
    { _i: 10, op: '>', mean: '大于' }, { _i: 11, op: '<', mean: '小于' },
    { _i: 12, tou: '35', jiao: '94', ji: '23', tu: '12' },
    { _i: 13, tuExpr: '(94-35×2)÷2=12（只）', jiExpr: '35-12=23（只）' },
    { _i: 14, tou: '35', jiao: '94', ji: '23', tu: '12' },
  ]);
}
const rows411 = [
  { _i: 0, scene: '校门口', data: '上学、放学的时间', impact: '知道什么时候路口最挤' },
  { _i: 1, scene: '教室', data: '温度、湿度', impact: '决定要不要开窗' },
  { _i: 2, scene: '操场', data: '跑步成绩', impact: '知道自己有没有进步' },
];

let msgId = 0;
function mk(ws) {
  const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
  return (method, params) => new Promise((res) => { const id = ++msgId; p.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
}

(async () => {
  console.log('== 任务单「一题一改赋分」界面自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  ok(!!T, '教师登录');
  // 清掉上一轮残留
  const list0 = (await jfetch('/api/teacher/roster', 'GET', null, T)).j.list || [];
  for (const s of list0.filter((x) => x.className === CLA || x.className === CLA4)) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: s.uid }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: s.uid }, T);
  }
  await jfetch('/api/teacher/roster', 'POST', {
    text: [A, B, C].map((n) => CLA + '，' + n).concat([D].map((n) => CLA4 + '，' + n)).join('\n'),
  }, T);
  const SA = (await jfetch('/api/student/login', 'POST', { name: A })).ck;
  const SB = (await jfetch('/api/student/login', 'POST', { name: B })).ck;
  const SD = (await jfetch('/api/student/login', 'POST', { name: D })).ck;
  const ra = (await jfetch('/api/lesson/6-1-4/sheet/submit', 'POST', { rows: rows614(false) }, SA)).j;
  const rb = (await jfetch('/api/lesson/6-1-4/sheet/submit', 'POST', { rows: rows614(true) }, SB)).j;
  await jfetch('/api/lesson/4-1-1/sheet/submit', 'POST', { rows: rows411 }, SD);
  ok(ra.auto && ra.auto.score === 3, '甲交上来 = 系统 3/3');
  ok(rb.auto && rb.auto.score === 2 && rb.auto.tasks[1].ok === false, '乙交上来 = 系统 2/3（任务二符号连线错）');
  // 丙不交，用来验「没交也能逐题赋分」

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tk-'));
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=500,1400', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + child.pid + '/T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);

  let ws, send;
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const page = l.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r)); send = mk(ws); break; }
    } catch (e) {}
    await sleep(250);
  }
  if (!send) { console.error('连不上无头 Edge'); kill(); process.exit(1); }
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const waitFor = async (expr, n, ms) => {
    for (let i = 0; i < (n || 30); i++) { if (await ev(expr)) return true; await sleep(ms || 300); }
    return false;
  };
  const shot = async (name) => {
    fs.mkdirSync(shotDir, { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(shotDir, name + '.png'), Buffer.from(r.result.data, 'base64'));
    console.log('  📷 ' + name + '.png');
  };
  // 打开某课的赋分台：各课完成情况 → 这一课「课内任务单」→ 切到指定班（name 是这一班里的一个学生名）。
  // 三处都得等：①点标签页会同步清空 #tabBody 再去异步取数据，同一段 JS 里「点完立刻找行」必然找不到；
  // ②换班的按钮点下去也是异步重画，不能点完就当作已经换好了（否则读到的是上一个班的行）；
  // ③上一轮可能停在别的课的赋分台里，得先按「返回各课情况」。
  const enterBoard = async (kw, cls, name) => {
    const seen = `[].filter.call(document.querySelectorAll('tr'),function(r){return r.textContent.indexOf(${JSON.stringify(kw)})>=0;}).length>0`;
    for (let i = 0; i < 12; i++) {
      await ev(`(function(){
        var back=[].filter.call(document.querySelectorAll('button'),function(b){return b.textContent.indexOf('返回各课情况')>=0;})[0];
        if(back){ back.click(); return 1; }
        var t=[].filter.call(document.querySelectorAll('.tab'),function(x){return x.dataset.tab==='overview';})[0];
        if(t&&!t.classList.contains('on'))t.click();
        return 1;})()`);
      if (await waitFor(seen, 15, 300)) break;
      await sleep(500);
    }
    const r = await ev(`(function(){
      var tr=[].filter.call(document.querySelectorAll('tr'),function(r){return r.textContent.indexOf(${JSON.stringify(kw)})>=0 && r.querySelector('button');})[0];
      if(!tr) return 'norow';
      var b=[].filter.call(tr.querySelectorAll('.btn'),function(x){return x.textContent.indexOf('课内任务单')>=0;})[0];
      if(!b) return 'nobtn'; b.click(); return 'clicked';})()`);
    if (r !== 'clicked') { console.log('  （进不了 ' + kw + ' 的任务单：' + r + '）'); return false; }
    const chip = `[].filter.call(document.querySelectorAll('.cls-chip'),function(x){return x.textContent.indexOf(${JSON.stringify(cls)})>=0;}).length>0`;
    if (!await waitFor(chip, 25, 300)) { console.log('  （班级胶囊里没有 ' + cls + '）'); return false; }
    await ev(`(function(){var c=[].filter.call(document.querySelectorAll('.cls-chip'),function(x){return x.textContent.indexOf(${JSON.stringify(cls)})>=0;})[0];
      if(c&&!c.classList.contains('on'))c.click(); return 1;})()`);
    // 换班是异步的：必须等到「本班这个学生」的行真的出现，才说明画的是我们要的那个班
    const mine = `[].filter.call(document.querySelectorAll('.tbl tr'),function(r){return r.textContent.indexOf(${JSON.stringify(name)})>=0;}).length>0
      && document.querySelectorAll('.sys-task').length>0`;
    const got = await waitFor(mine, 30, 300);
    if (!got) console.log('  （' + cls + ' 的行没出现）');
    return got;
  };
  // 每一行读回来：姓名/状态标签/输入框的值/逐题按钮 [{txt,cls,title}]
  const readRows = `(function(){
    var out={};
    [].forEach.call(document.querySelectorAll('.tbl tr'),function(r){
      var cb=r.querySelector('td input[type=checkbox]'); if(!cb) return;
      var nm=cb.parentNode.textContent.replace(/\\s+/g,' ').trim();
      out[nm]={ pill:(r.querySelector('.pill')||{}).textContent||'',
        score:(r.querySelector('input.score-in')||{}).value||'',
        sys:(r.querySelector('.sys-line')||{}).textContent.replace(/\\s+/g,' ')||'',
        stamp:[].slice.call(r.querySelectorAll('.muted')).map(function(x){return x.textContent.trim();}).filter(function(x){return /赋分于|已赋分/.test(x);}).join(' '),
        btns:[].slice.call(r.querySelectorAll('.sys-task')).map(function(b){
          return {t:b.textContent, c:b.className.replace('sys-task ',''), s:getComputedStyle(b).borderStyle};}),
        fill:(r.querySelector('.sys-fill')||{}).textContent||'' };
    }); return out;})()`;
  // 按下按钮之后界面是异步重画的（换班、赋分、批量都一样），所以不能「点完 sleep 一下就读」——
  // 那样读到的常常还是上一版的行。统一改成：轮询到这一行真变成预期的样子，再断言。
  const rowNow = async (n) => {
    const r = (await ev(readRows)) || {};
    const k = Object.keys(r).filter((x) => x.indexOf(n) >= 0)[0];
    return k ? r[k] : null;
  };
  const waitRow = async (n, pred, tries) => {
    let last = null;
    for (let i = 0; i < (tries || 24); i++) {
      last = await rowNow(n);
      if (last && pred(last)) return last;
      await sleep(250);
    }
    return last;
  };
  const clickSysTask = (n, i) => `(function(){
    var r=[].filter.call(document.querySelectorAll('.tbl tr'),function(x){return x.textContent.indexOf(${JSON.stringify(n)})>=0 && x.querySelector('input.score-in');})[0];
    if(!r || !r.querySelectorAll('.sys-task')[${i}]) return 0;
    r.querySelectorAll('.sys-task')[${i}].click(); return 1;})()`;

  await send('Page.navigate', { url: BASE + '/teacher' });
  await sleep(1300);
  await ev("document.getElementById('pw').value='123456';document.getElementById('loginGo').click();");
  // 等登录真渲染完（名单里出现刚导入的学生）再动标签页，否则会被登录后的默认渲染拨回「学生名单」
  ok(await waitFor(`document.body.innerText.indexOf(${JSON.stringify(A)})>=0`, 40, 300), '登录后名单渲染出来了');
  const up = await enterBoard('算法的程序体验', CLA, A);
  ok(up, '第4课的赋分台打开了，行里有逐题按钮');

  console.log('\n-- 1. 系统预选：按钮虚框、总分一格都没写');
  const r1 = (await ev(readRows)) || {};
  const keyOf = (n) => Object.keys(r1).filter((k) => k.indexOf(n) >= 0)[0];
  const ka = r1[keyOf(A)] || {}, kb = r1[keyOf(B)] || {}, kc = r1[keyOf(C)] || {};
  ok((ka.btns || []).length === 3 && (kb.btns || []).length === 3, '甲乙两行各有 3 个逐题按钮');
  ok((kc.btns || []).length === 3, '丙从没交过任务单，也有 3 个逐题按钮（没交也要能赋分）');
  ok((ka.btns || []).map((b) => b.t).join('') === '任务①✅任务②✅任务③✅', '甲三题都按系统预选成 ✅：' + (ka.btns || []).map((b) => b.t).join(' '));
  ok((kb.btns || []).map((b) => b.t).join('') === '任务①✅任务②❌任务③✅', '乙的任务②按系统预选成 ❌：' + (kb.btns || []).map((b) => b.t).join(' '));
  ok((ka.btns || []).every((b) => b.c.indexOf('st-sys') >= 0 && b.s === 'dashed'), '系统预选是虚框（还没老师确认过）');
  ok((kc.btns || []).every((b) => b.c.indexOf('st-skip') >= 0), '丙没有系统判分 → 三个按钮都是「未标」➖');
  ok(ka.score === '' && kb.score === '', '预选只是显示，总分框还是空的（没落盘）');
  ok(/系统\s*3\/3/.test(ka.sys) && /系统\s*2\/3/.test(kb.sys), '按钮条上仍带着「系统 x/3」');
  await shot('01-赋分台逐题按钮');

  console.log('\n-- 2. 点一下：整张判定表一次落盘，总分当场跟着变');
  // 甲的系统 3/3，把任务②改成 ✗ → 应当 2 分（不是 0 分）
  await ev(clickSysTask(A, 1));
  const a2 = (await waitRow(A, (r) => r.score === '2')) || {};
  ok(a2.score === '2', '点任务②→✗ 后总分＝2（其余两题按系统的判定一起落下来了，不是 0）');
  ok(((a2.btns || [])[1] || {}).t === '任务②❌' && a2.btns[1].c.indexOf('st-teacher') >= 0 && a2.btns[1].s === 'solid',
    '改过的那一题变实框 st-teacher（一眼看出自己动了哪题）：' + a2.btns[1].t + ' ' + a2.btns[1].c);
  ok(((a2.btns || [])[0] || {}).c.indexOf('st-sys') >= 0 && ((a2.btns || [])[2] || {}).c.indexOf('st-sys') >= 0,
    '没动过的两题还是虚框（＝和系统一致）');
  ok(a2.pill === '已赋分' && /赋分于/.test(a2.stamp || ''), '那一行当场变绿、标「已赋分」并写上赋分时刻（' + a2.pill + ' / ' + a2.stamp + '）');
  const bd1 = (await jfetch('/api/teacher/sheet-board/6-1-4?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const srvA = ((bd1.students || []).find((x) => x.uid === A + '｜' + CLA) || {});
  ok(srvA.score === 2 && srvA.taskMarks['1'] === true && srvA.taskMarks['2'] === false && srvA.taskMarks['3'] === true,
    '落盘的分和逐题判定：' + JSON.stringify(srvA.taskMarks) + ' → ' + srvA.score + ' 分');
  await shot('02-改一题');

  console.log('\n-- 3. 再点一下＝撤销这一题，回到系统的判定');
  await ev(clickSysTask(A, 1));
  const a3 = (await waitRow(A, (r) => /任务②✅/.test(((r.btns || [])[1] || {}).t || ''))) || {};
  ok(a3.score === '2' && /任务②✅/.test(((a3.btns || [])[1] || {}).t || '') && a3.btns[1].c.indexOf('st-sys') >= 0,
    '任务②撤销 → 又按系统判成 ✅（总分仍是 2，因为系统就判它对）');
  // 总分＝打了✓的题数：①改✗（这时②③还是✓ → 仍是 2 分），再把③改✗ → 只剩②一个✓ → 1 分
  await ev(clickSysTask(A, 0));
  const a4a = (await waitRow(A, (r) => /任务①❌/.test(((r.btns || [])[0] || {}).t || ''))) || {};
  ok(a4a.score === '2', '把任务①改成 ✗ → 2 分（②③还是✓，总分＝打✓的题数）');
  await ev(clickSysTask(A, 2));
  const a4 = (await waitRow(A, (r) => r.score === '1')) || {};
  ok(a4.score === '1' && /任务①❌/.test(((a4.btns || [])[0] || {}).t || '') && /任务③❌/.test(((a4.btns || [])[2] || {}).t || ''),
    '再把任务③也改成 ✗ → 1 分（只剩任务②是✓：' + (a4.btns || []).map((b) => b.t).join(' ') + '）');

  console.log('\n-- 4. 「按系统分填」＝一键采纳系统的逐题判定');
  await ev(`(function(){var r=[].filter.call(document.querySelectorAll('.tbl tr'),function(x){return x.textContent.indexOf(${JSON.stringify(B)})>=0 && x.querySelector('input.score-in');})[0];
    if(!r) return 0; r.querySelector('.sys-fill').click(); return 1;})()`);
  const b2 = (await waitRow(B, (r) => r.score === '2')) || {};
  ok(b2.score === '2', '乙一键采纳 → 2 分（任务二就是系统判错的那题）');
  ok((b2.btns || []).length === 3 && (b2.btns || []).every((b) => b.c.indexOf('st-sys') >= 0), '采纳后三个按钮都是「和系统一致」的样子');
  const srvB = ((await jfetch('/api/teacher/sheet-board/6-1-4?class=' + encodeURIComponent(CLA), 'GET', null, T)).j.students || [])
    .find((x) => x.uid === B + '｜' + CLA) || {};
  ok(srvB.taskMarks && srvB.taskMarks['2'] === false && Object.keys(srvB.taskMarks).length === 3,
    '一键采纳落盘的是逐题判定而不是一个光秃秃的总分：' + JSON.stringify(srvB.taskMarks));

  console.log('\n-- 5. 窄屏（500px）：按钮条不撑破版式');
  const ovr = await ev("({sw:document.documentElement.scrollWidth, iw:window.innerWidth})");
  ok(ovr.sw <= ovr.iw + 2, '500px 窄窗下不横向溢出（' + ovr.sw + ' ≤ ' + ovr.iw + '）');

  console.log('\n-- 6. 四上第1课（三行自由填写）：系统不判，老师逐题点');
  const up411 = await enterBoard('身边的数据', CLA4, D);
  ok(up411, '四上第1课的赋分台也打开了');
  const btns0 = await ev(`(function(){var r=[].filter.call(document.querySelectorAll('.tbl tr'),function(x){return x.textContent.indexOf(${JSON.stringify(D)})>=0 && x.querySelector('input.score-in');})[0];
    if(!r) return {};
    return {n:r.querySelectorAll('.sys-task').length, txt:[].slice.call(r.querySelectorAll('.sys-task')).map(function(b){return b.textContent}).join(''),
            hint:(r.querySelector('.sys-line')||{}).textContent||'', fill:!!r.querySelector('.sys-fill')};})()`);
  ok(btns0.n === 3, '四上第1课也是 3 个逐题按钮（一行一题）');
  ok(btns0.txt === '任务①➖任务②➖任务③➖', '系统判不了 → 三题都是「未标」：' + btns0.txt);
  ok(/老师逐题点/.test(btns0.hint), '按钮条上写明「老师逐题点 ✓/✗」（' + btns0.hint + '）');
  ok(!btns0.fill, '没有标准答案的课不显示「按系统分填」（没得填）');
  // 逐题点：①✓ ②✓ ③✓ → 3 分（每点一题都等它真的变过来再点下一题，否则会被 busy 挡掉）
  for (const i of [0, 1, 2]) {
    await ev(clickSysTask(D, i));
    await waitRow(D, (r) => /✅/.test(((r.btns || [])[i] || {}).t || ''));
  }
  const d1 = (await rowNow(D)) || {};
  ok(d1.score === '3' && (d1.btns || []).every((b) => /✅/.test(b.t) && b.s === 'solid'),
    '三行逐题点✓ → 3 分，三个按钮都变实框：' + (d1.btns || []).map((b) => b.t).join(' '));
  await shot('03-四上1课逐题点');
  await ev(clickSysTask(D, 0));
  const d2 = (await waitRow(D, (r) => r.score === '2')) || {};
  ok(d2.score === '2' && /❌/.test(((d2.btns || [])[0] || {}).t || ''), '第①处改成 ✗ → 2 分');
  await ev(clickSysTask(D, 0));
  const d3 = (await waitRow(D, (r) => /➖/.test(((r.btns || [])[0] || {}).t || ''))) || {};
  ok(d3.score === '2' && /➖/.test(((d3.btns || [])[0] || {}).t || ''),
    '再点一下＝撤销这一题（系统判不了的题能真的回到「未标」），总分＝还打勾的②③ 2 分：'
    + (d3.btns || []).map((b) => b.t).join(' '));

  console.log('\n-- 7. 学生端「老师的评分」面板');
  await jfetch('/api/teacher/sheet-board/6-1-4/score', 'POST', { uid: B + '｜' + CLA, score: 2 }, T); // 乙：只给总分的老记录
  await send('Page.navigate', { url: BASE + '/quiz.html' });
  await sleep(1300);
  const openSheet = (me, kw) => `(function(){
    var n=document.getElementById('loginName'); n.value=${JSON.stringify(me)}; n.dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('loginGo').click(); return 1;})()`;
  await waitFor(`!!document.getElementById('loginGo')`, 30, 300);
  await ev(openSheet(A));
  await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 30, 300);
  const goSheet = (kw) => `(function(){
    var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];
    if(t)t.click();
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(kw)})>=0})[0];
    if(!c) return 0;
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    if(!b) return 0; b.click(); return 1;})()`;
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).length>0`, 30, 300);
  await ev(goSheet('算法的程序体验'));
  await waitFor(`!document.getElementById('view-sheet').hidden`, 40, 300);
  const teach1 = await ev(`(function(){var h=document.getElementById('sheetTeach');
    return { shown:!!h && !h.hidden, head:(h.querySelector('.teach-head')||{}).textContent||'',
      items:[].slice.call(h.querySelectorAll('.auto-item')).map(function(x){return x.textContent.replace(/\\s+/g,' ');}) };})()`);
  ok(teach1.shown, '学生端出现「老师的评分」面板');
  ok(/老师的评分/.test(teach1.head) && /得了 1 \/ 3 分/.test(teach1.head),
    '面板头部：「' + teach1.head + '」（甲：任务②③✓、任务①✗ → 1 分）');
  ok(teach1.items.length === 3, '三个任务逐题列出来');
  ok(teach1.items[0] && /❌/.test(teach1.items[0]) && /老师判为还不对/.test(teach1.items[0]),
    '任务①写明老师判错：' + teach1.items[0]);
  ok(teach1.items[1] && /✅/.test(teach1.items[1]) && /老师判为做对/.test(teach1.items[1]),
    '任务②写明老师判对：' + teach1.items[1]);
  await shot('04-学生端老师评分');

  // 乙：老师只填了总分、没逐题标记 → 只说总分，不假装逐题
  await ev(`(function(){document.getElementById('logoutBtn').click(); return 1;})()`);
  await sleep(500);
  await waitFor(`!!document.getElementById('loginGo')`, 20, 300);
  await ev(openSheet(B));
  await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 30, 300);
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).length>0`, 30, 300);
  await ev(goSheet('算法的程序体验'));
  await waitFor(`!document.getElementById('view-sheet').hidden`, 40, 300);
  const teach2 = await ev(`(function(){var h=document.getElementById('sheetTeach');
    return { shown:!!h && !h.hidden, head:(h.querySelector('.teach-head')||{}).textContent||'',
      hint:(h.querySelector('.teach-hint')||{}).textContent||'', items:h.querySelectorAll('.auto-item').length };})()`);
  ok(teach2.shown && /得了 2 \/ 3 分/.test(teach2.head), '乙：面板显示「' + teach2.head + '」');
  ok(teach2.items === 0 && /只给了总分/.test(teach2.hint),
    '只给了总分的老记录 → 只说总分、不假装逐题：' + teach2.hint);
  await shot('05-学生端只有总分');

  ws.close(); kill(); await sleep(300);
  for (const n of [[A, CLA], [B, CLA], [C, CLA], [D, CLA4]]) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: n[0] + '｜' + n[1] }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: n[0] + '｜' + n[1] }, T);
  }
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  console.log('\n截图在 ' + shotDir);
  console.log('== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检异常：', e); process.exit(1); });
