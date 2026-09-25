// 一课一证书 · 无头 Edge 界面自检：证书页/证书墙/画布非空/打印态/课程地图徽章/结果页入口
// 用法：APP=绝对路径/tools/_tmp/certtest/app BASE=http://127.0.0.1:7099 node tools/_ui-cert.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const APP = process.env.APP || path.join(__dirname, '..', 'app');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9500 + Math.floor(Math.random() * 300);
const CLA = '六年级UI证书班';
const TAG = Date.now().toString(36).slice(-4);
const NAME = '界面证书' + TAG;
const LID = '6-1-3';            // 有任务单：小测 + 任务单都交 → 发证（待老师批阅）
const LID2 = '6-1-1';           // 无任务单、一点没做 → 墙上显示「还差」
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotDir = path.join(__dirname, '_tmp', 'certshot');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => ({})), ck: cookie(r) };
}
const CONTENT = JSON.parse(fs.readFileSync(path.join(APP, 'data', 'content.json'), 'utf8'));
function findLesson(id) {
  for (const g of CONTENT.grades || []) for (const u of g.units || []) for (const l of u.lessons || []) if (l.id === id) return l;
  return null;
}
function fullAnswers(lesson) {
  const out = {};
  for (const q of lesson.questions || []) {
    const blanks = q.type === 'flow' ? (q.flow && q.flow.blanks) : (q.type === 'fill' && q.blanks ? q.blanks : null);
    if (blanks) { const b = {}; blanks.forEach((x) => { b[x.key] = (x.accepts && x.accepts[0]) || x.show || ''; }); out[q.id] = { blanks: b }; }
    else if (q.type === 'fill') out[q.id] = { ans: (q.answers && q.answers[0]) || q.answer || '' };
    else out[q.id] = { ans: q.answer || '' };
  }
  return out;
}

let msgId = 0;
function mk(ws) {
  const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
  return (method, params) => new Promise((res) => { const id = ++msgId; p.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
}

(async () => {
  console.log('== 一课一证书 · 界面自检 ==');

  // ---- 先造数据：一个学生做掉 6-1-3（小测满分 + 交任务单）----
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + NAME }, T);
  const S = (await jfetch('/api/student/login', 'POST', { name: NAME })).ck;
  await jfetch('/api/lesson/' + LID + '/submit', 'POST', { answers: fullAnswers(findLesson(LID)) }, S);
  await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: [{ _i: 0, lab: '自检', c1: '1', f1: 'x' }] }, S);
  ok(true, '测试数据已备好（' + NAME + '，' + LID + ' 已发证）');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'certui-'));
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=500,1000', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore' });

  let ws, send;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r)); send = mk(ws); break; }
    } catch (e) {}
    await sleep(250);
  }
  if (!send) { console.error('连不上无头 Edge'); child.kill(); process.exit(1); }
  await send('Page.enable'); await send('Runtime.enable');
  const go = async (url) => { await send('Page.navigate', { url }); await sleep(900); };
  const ev = async (expr, awaitP) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitP });
    if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const shot = async (name) => {
    fs.mkdirSync(shotDir, { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(shotDir, name + '.png'), Buffer.from(r.result.data, 'base64'));
  };

  // ---- 1. /cert 别名生效（无扩展名路径不列白名单会 403）----
  await go(BASE + '/cert');
  const loginShown = await ev("!document.getElementById('view-login').hidden && document.getElementById('sName') !== null");
  ok(loginShown, '/cert 打开是登录卡（说明别名没被 403 挡掉）');

  // ---- 2. 页内登录 → 证书墙 ----
  await ev("document.getElementById('sName').value=" + JSON.stringify(NAME) + ";document.getElementById('sGo').click();");
  await sleep(900);
  const wall = await ev("(function(){var t=document.getElementById('wallBody').textContent;return {shown:!document.getElementById('view-wall').hidden,text:t,cards:document.querySelectorAll('.cw-card').length,done:document.querySelectorAll('.cw-card.done').length,todo:document.querySelectorAll('.cw-card.todo').length};})()");
  ok(wall.shown, '证书墙已渲染');
  ok(wall.done >= 1, '有 ' + wall.done + ' 张已发证卡');
  ok(wall.todo >= 1, '未完成的课也列在墙上（' + wall.todo + ' 张）');
  ok(/已完成\s*1\s*\/\s*4\s*课/.test(wall.text), '墙头显示 已完成 1 / 4 课');
  ok(wall.text.indexOf('还差：课后小测') >= 0, '未完成卡写明「还差：课后小测」');
  ok(wall.text.indexOf('任务单待老师批阅') >= 0, '待批阅有橙色提示');
  await shot('01-证书墙');

  // ---- 3. 进单课证书：画布画出来了、内容对 ----
  await ev("(function(){var b=[].filter.call(document.querySelectorAll('.cw-card .btn'),function(x){return x.textContent.indexOf('查看证书')>=0;})[0];b.click();})()");
  await sleep(900);
  const c = await ev("(function(){var cv=document.getElementById('certCv');return {view:!document.getElementById('view-one').hidden,cv:!!cv,w:cv&&cv.width,h:cv&&cv.height,text:window.__cert&&window.__cert.text,pending:window.__cert&&window.__cert.pending};})()");
  ok(c.view && c.cv, '单课证书页打开且画了 canvas');
  ok(c.w === 2400 && c.h === 3480, '画布尺寸 2400×3480（2 倍超采样）');
  ok(c.text && c.text.indexOf(NAME) >= 0, '证书上有学生姓名');
  ok(c.text && c.text.indexOf('第3课') >= 0, '证书上有课名');
  ok(c.text && c.text.indexOf('作业做得很棒') >= 0, '证书上评价语正确（客观题满分口径）');
  ok(c.text && /LXQ-6-1-3-[0-9A-F]{6}/.test(c.text), '证书上有编号');
  ok(c.pending === true, '待老师批阅标记为 true');
  const png = await ev("window.__certBlob().then(function(b){return b?b.size:0;})", true);
  ok(png > 20000, '导出的 PNG 非空（' + png + ' 字节）');
  await shot('02-证书');

  // ---- 4. 窄屏不顶破版式 / 打印态 ----
  const ov = await ev("({sw:document.documentElement.scrollWidth, iw:window.innerWidth, cw:document.getElementById('certCv').clientWidth})");
  ok(ov.sw <= ov.iw + 2, '500px 窄窗下页面不横向溢出（' + ov.sw + ' ≤ ' + ov.iw + '）');
  ok(ov.cw >= 400, '证书宽度自适应容器（' + ov.cw + 'px）');
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await sleep(200);
  const pr = await ev("(function(){var tb=document.querySelector('.topbar'),ar=document.querySelector('.action-row.no-print'),cv=document.getElementById('certCv');return {top:getComputedStyle(tb).display,act:getComputedStyle(ar).display,minw:getComputedStyle(cv).minWidth};})()");
  ok(pr.top === 'none', '打印时顶栏隐藏');
  ok(pr.act === 'none', '打印时按钮行隐藏');
  ok(pr.minw === '0px' || pr.minw === '0', '打印时画布 min-width 已复位（' + pr.minw + '）');
  await send('Emulation.setEmulatedMedia', { media: 'screen' });

  // ---- 5. 课程地图上的证书徽章 ----
  await go(BASE + '/quiz');
  await ev("document.getElementById('loginName').value=" + JSON.stringify(NAME) + ";document.getElementById('loginGo').click();");
  await sleep(1100);
  const map = await ev("(function(){var p=document.querySelector('.pill.cert');return {n:document.querySelectorAll('.pill.cert').length,t:p&&p.textContent,clip:document.documentElement.scrollWidth<=window.innerWidth+2};})()");
  ok(map.n === 1, '课程地图上只有已发证的那一课带徽章（' + map.n + ' 枚）');
  ok(map.t && map.t.indexOf('5.0 星') >= 0, '徽章显示星级：' + map.t);
  ok(map.clip, '地图页没有横向溢出');
  await shot('03-课程地图');

  // 点徽章应进证书页，而不是被整卡点击带去答题
  await ev("document.querySelector('.pill.cert').click()");
  await sleep(1000);
  ok(/cert\?lesson=/.test(await ev('location.href')), '点徽章跳到证书页（没被整卡点击吃掉）');
  ok(await ev("!!document.getElementById('certCv')"), '二次进入也能画出证书');

  // ---- 6. 交卷结果页的证书入口 ----
  await go(BASE + '/quiz');
  await sleep(700);
  // 无头模式下 window.confirm 会弹出「还有 N 题没做」对话框把页面卡死 —— 导航之后再接管，
  // 后面切答题页/交卷都是页内操作，不会把覆盖冲掉
  await ev('window.confirm=function(){return true;}');
  // 挑「第3课」那张卡（本课任务已交齐）再交一次小测 → 结果页应给出证书入口
  await ev("(function(){var card=[].filter.call(document.querySelectorAll('.lesson'),function(c){return c.textContent.indexOf('第3课')>=0;})[0];var a=[].filter.call(card.querySelectorAll('.lesson-actions .btn'),function(x){return x.textContent.indexOf('课后小测')>=0;})[0];a.click();})()");
  await sleep(1200);
  const quizOpen = await ev("!document.getElementById('view-quiz').hidden");
  ok(quizOpen, '进入答题页');
  await ev("document.getElementById('submitBtn').click()");
  await sleep(1600);
  const cta = await ev("(function(){var c=document.querySelector('#resultBody .cert-cta');return c?c.textContent:'';})()");
  ok(cta.indexOf('本课证书') >= 0, '交卷结果页显示已颁发证书：' + cta.slice(0, 40));
  const jump = await ev("(function(){var b=[].filter.call(document.querySelectorAll('.cert-cta .btn'),function(x){return x.textContent.indexOf('证书')>=0;})[0];return b?b.textContent:'';})()");
  ok(jump.indexOf('证书') >= 0, '结果页有「' + jump + '」按钮');
  // 还没做任务单的课，结果页要给「还差什么」的指引
  await go(BASE + '/quiz');
  await sleep(700);
  await ev('window.confirm=function(){return true;}');
  await ev("(function(){var card=[].filter.call(document.querySelectorAll('.lesson'),function(c){return c.textContent.indexOf('第2课')>=0;})[0];var a=[].filter.call(card.querySelectorAll('.lesson-actions .btn'),function(x){return x.textContent.indexOf('课后小测')>=0;})[0];a.click();})()");
  await sleep(1200);
  await ev("document.getElementById('submitBtn').click()");
  await sleep(1600);
  const cta2 = await ev("(function(){var c=document.querySelector('#resultBody .cert-cta');return c?c.textContent:'';})()");
  ok(cta2.indexOf('还差') >= 0, '任务单没交时结果页提示：' + cta2.slice(0, 40));

  // ---- 7. 老师赋分台：打"做对几题"，并当场显示证书结果 ----
  // 以前老师看不到分数对证书的影响，给 1 分（1 题任务单的满分）却以为学生没做好
  await go(BASE + '/teacher');
  await ev("document.getElementById('pw').value='123456';document.getElementById('loginGo').click();");
  await sleep(1000);
  await ev("document.querySelector('.tab[data-tab=\"overview\"]').click()");
  await sleep(1200);
  await ev("(function(){var tr=[].filter.call(document.querySelectorAll('tr'),function(r){return r.textContent.indexOf('第3课')>=0;})[0];var b=[].filter.call(tr.querySelectorAll('.btn'),function(x){return x.textContent.indexOf('课内任务单')>=0;})[0];b.click();})()");
  await sleep(1200);
  // 切到本测试学生所在的班（默认可能是别的班）
  await ev("(function(){var c=[].filter.call(document.querySelectorAll('.cls-chip'),function(x){return x.textContent.indexOf('六年级UI证书班')>=0;})[0];if(c&&!c.classList.contains('on'))c.click();})()");
  await sleep(1200);
  const board = await ev("(function(){var b=document.getElementById('tabBody');var th=[].map.call(b.querySelectorAll('th'),function(x){return x.textContent;});var inp=b.querySelector('input.score-in');return {head:th.join('|'),max:inp&&inp.max,ph:inp&&inp.placeholder,has:!!inp};})()");
  ok(board.has, '赋分台打开，有分数输入框');
  ok(board.head.indexOf('赋分(0–2)') >= 0, '表头写着本课任务单共 2 题：' + board.head);
  ok(board.max === '2', '输入框上限 = 任务数（' + board.max + '）');
  ok(board.ph === '0–2', '占位提示 0–2：' + board.ph);
  // 给测试学生打满分（2 题全对）→ 该行应出现「证书 100.0% · 5.0 星」
  const hint = await ev("(function(){var tr=[].filter.call(document.querySelectorAll('tr'),function(r){return r.textContent.indexOf(" + JSON.stringify(NAME) + ")>=0;})[0];var i=tr.querySelector('input.score-in');i.value='2';i.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  ok(hint === true, '给 ' + NAME + ' 打 2 分（做对 2/2 题）');
  await sleep(1400);
  const after = await ev("(function(){var tr=[].filter.call(document.querySelectorAll('tr'),function(r){return r.textContent.indexOf(" + JSON.stringify(NAME) + ")>=0;})[0];return tr?tr.textContent:'';})()");
  ok(after.indexOf('证书 100.0% · 5.0 星') >= 0, '赋分台当场显示证书结果：' + (after.match(/证书[^\n]{0,16}/) || [''])[0]);
  // 学生端证书也应立刻变成 100%（老师批完自动更新）
  // 注意：刚才在同一个浏览器里登了教师端，会话 cookie 已被换成教师的 —— 直接把开头的学生会话注回去，
  // 别再走一遍表单登录（表单登录会被教师会话挡着，页面停在登录卡上，__cert 根本没画出来）
  const [cn, cv] = [S.split('=')[0], S.split('=').slice(1).join('=')];
  await send('Network.enable');
  await send('Network.setCookie', { name: cn, value: cv, url: BASE });
  await go(BASE + '/cert?lesson=' + LID);
  await sleep(900);
  const after2 = await ev("window.__cert ? window.__cert.text : ''");
  const afterMeta = await ev("window.__cert ? {quiz:window.__cert.quiz,task:window.__cert.task} : null");
  ok(after2.indexOf('|100.0|') >= 0, '老师批完后学生证书即时变为 100%（__cert=' + after2 + '）');
  ok(afterMeta && afterMeta.quiz === '5/5', '明细：小测 5/5 题');
  ok(afterMeta && afterMeta.task === '2/2', '明细：课内任务单 2/2 题（分母是任务数，不是 10）');

  // ---- 清理 ----
  ws.close(); child.kill();
  await jfetch('/api/teacher/progress/delete', 'POST', { uid: NAME + '｜' + CLA }, T);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: NAME + '｜' + CLA }, T);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}

  console.log('\n截图在 ' + shotDir);
  console.log('== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检异常：', e); process.exit(1); });
