// 【问问】界面自检（无头 Edge，只打隔离实例 7099）
//   教师端：第 5 个页签「💬 学生提问」——一课一行、按人归并、点开看原话与问问的回答、开/停开关。
//   学生端（Phase 3）：任务单页右下角的悬浮按钮 + 面板。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-agent.js
//       （只跑教师端：PART=teacher；只跑学生端：PART=student）
const { spawn, execSync } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const PART = process.env.PART || 'all';
// PART=pilot 要往隔离实例的 agent.config.json 里塞试用班名单（不放 key），所以要拿到那份 app 目录
const APP = path.resolve(process.env.APP || path.join(__dirname, '_tmp', 'certtest', 'app'));
const CFG_PATH = path.join(APP, 'agent.config.json');
const TAG = Date.now().toString(36).slice(-4);
// 班名里必须带年级字样：4-1-4 是四年级的课
const CLA = '四年级问答界面' + TAG;
const S1 = '界面甲' + TAG, S2 = '界面乙' + TAG, S3 = '界面丙' + TAG;
const LID = '4-1-4';
const PORT = 9600 + Math.floor(Math.random() * 300);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = process.env.OUT || path.join(__dirname, '_tmp', 'askshot');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  const raw = await r.text();
  let j = {}; try { j = JSON.parse(raw); } catch (e) {}
  return { r, j, raw, ck: cookie(r) };
}
let msgId = 0;
function mk(ws) {
  const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
  return (m, q) => new Promise((res) => { const id = ++msgId; p.set(id, res); ws.send(JSON.stringify({ id, method: m, params: q || {} })); });
}

// CDP 内嵌表达式写坏了只会静默返回 undefined（踩过），所以 ev() 先 new Function 验一遍语法
function compile(expr) { try { new Function('return (' + expr + ')'); return null; } catch (e) { return e.message; } }

(async () => {
  console.log('== 【问问】界面自检（' + BASE + '，' + PART + '）==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  ok(!!T, '教师登录拿到会话');

  // ---- 造数据：3 个学生（都没交过任务单），两个提问 ----
  const seed = await jfetch('/api/teacher/roster', 'POST', { text: [S1, S2, S3].map((n) => CLA + '，' + n).join('\n') }, T);
  ok(!!seed.r.ok, '测试班三个学生已入库');
  const ck1 = (await jfetch('/api/student/login', 'POST', { name: S1 })).ck;
  const ck2 = (await jfetch('/api/student/login', 'POST', { name: S2 })).ck;
  const Q1 = '这个下拉该选哪一个？', Q1b = '我还是不太懂，再具体一点', Q2 = '什么是验证码？';
  await jfetch('/api/ask', 'POST', { lessonId: LID, question: Q1 }, ck1);
  await jfetch('/api/ask', 'POST', { lessonId: LID, question: Q1 }, ck1);   // 连点：同一条不重复记账
  await jfetch('/api/ask', 'POST', { lessonId: LID, question: Q1b }, ck1);
  await jfetch('/api/ask', 'POST', { lessonId: LID, question: Q2 }, ck2);

  const al = (await jfetch('/api/teacher/agent-log?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const it = (al.items || []).find((x) => x.lessonId === LID) || {};
  ok(it.askers === 2 && it.total === 3, '接口口径：2 人提问 / 3 条（实际 ' + it.askers + '/' + it.total + '）');
  ok(!!(it.list || []).find((x) => x.uid === S1 + '｜' + CLA), '清单按 uid 归并（' + (S1 + '｜' + CLA) + '）');

  // ---- 打开无头 Edge ----
  const child = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_ask_' + PORT),
    '--no-first-run', '--disable-gpu', '--window-size=1280,940', BASE + '/teacher.html'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);
  let list = [];
  for (let i = 0; i < 40; i++) { await sleep(300); try { list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); if (list.some((x) => x.type === 'page' && x.url.startsWith(BASE))) break; } catch (e) {} }
  const page = list.find((x) => x.type === 'page' && x.url.startsWith(BASE));
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  const send = mk(ws); await send('Runtime.enable'); await send('Page.enable');
  const ev = async (e) => {
    const bad = compile(e);
    if (bad) { console.log('  ✗ 表达式语法错：' + bad + '\n    ' + e.slice(0, 160)); fail++; return undefined; }
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) { console.log('  ✗ 表达式抛错：' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description)); fail++; return undefined; }
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const shot = async (sel, file) => {
    const box = await ev(`(function(){var n=document.querySelector(${JSON.stringify(sel)});if(!n)return null;var r=n.getBoundingClientRect();return {x:r.x+window.scrollX,y:r.y+window.scrollY,width:r.width,height:r.height};})()`);
    if (!box || box.width < 5) { console.log('  （截图跳过 ' + sel + '）'); return; }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 } });
    if (!r.result || !r.result.data) { console.log('  （截图失败 ' + sel + '）'); return; }
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, file), Buffer.from(r.result.data, 'base64'));
    console.log('  📷 ' + file);
  };
  const waitFor = async (e, n, ms) => { for (let i = 0; i < (n || 30); i++) { if (await ev(e)) return true; await sleep(ms || 300); } return false; };
  // ⚠ position:fixed 的元素 offsetParent 恒为 null，别用它判"看不看得见"——量一下盒子尺寸才算数
  const visExpr = (sel) => `(function(){var n=document.querySelector(${JSON.stringify(sel)});if(!n)return false;var r=n.getBoundingClientRect();return r.width>1&&r.height>1;})()`;
  const vis = (sel) => ev(visExpr(sel));

  // ---- 教师端：第 5 个页签 ----
  if (PART === 'all' || PART === 'teacher') {
    console.log('\n-- 教师端「💬 学生提问」--');
    await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
    await ev(`(function(){document.getElementById('pw').value='123456';document.getElementById('loginGo').click();return 1;})()`);
    ok(await waitFor(`!document.getElementById('admin').hidden`, 40, 300), '教师登录进管理页');

    const tabs = await ev(`[].slice.call(document.querySelectorAll('.tab[data-tab]')).map(function(x){return x.dataset.tab})`);
    ok(Array.isArray(tabs) && tabs.indexOf('ask') >= 0, '页签里有 ask（' + JSON.stringify(tabs) + '）');

    // ⚠ loadTab() 末尾那个 else 会把没登记的页签静默丢进「修改密码」——这里专门盯它
    const noHref = await ev(`(function(){var t=[].slice.call(document.querySelectorAll('.tab[data-tab]')).filter(function(x){return x.dataset.tab==='ask'})[0];t.click();return 1;})()`);
    ok(noHref === 1, '点了「学生提问」页签');
    await waitFor(`!!document.querySelector('#tabBody .card')`, 40, 300);
    ok(!(await ev(`!!document.getElementById('fPwOld')`)), '没有掉进「修改密码」面板（loadTab 分派正确）');

    // 切到测试班
    const pick = await ev(`(function(){
      var cs=[].slice.call(document.querySelectorAll('#tabBody .cls-chip'));
      var c=cs.filter(function(x){return x.textContent.indexOf(${JSON.stringify(CLA)})>=0})[0];
      if(!c) return 'no chip'; c.click(); return 'ok';})()`);
    ok(pick === 'ok', '班级胶囊里有测试班');
    ok(await waitFor(`!!document.querySelector('#tabBody table.qa-table')`, 40, 300), '切到测试班后表格出来了');

    const head = await ev(`[].slice.call(document.querySelectorAll('#tabBody .qa-table thead th')).map(function(x){return x.textContent.trim()})`);
    ok(JSON.stringify(head) === JSON.stringify(['课', '提问人数', '提问条数']), '表头三列（' + JSON.stringify(head) + '）');

    const rows = await ev(`[].slice.call(document.querySelectorAll('#tabBody tr.qa-row')).map(function(tr){
      return { t: tr.cells[0].textContent.trim(), n: tr.cells[1].textContent.trim(), q: tr.cells[2].textContent.trim() };})`);
    console.log('  ℹ ' + JSON.stringify(rows));
    ok(rows && rows.length === 1, '只有一课有提问记录（' + (rows || []).length + ' 行）');
    ok(!!(rows || []).find((r) => r.t.indexOf('数据的安全') >= 0), '那一课是《数据的安全》');
    ok(rows[0] && rows[0].n === '2' && rows[0].q === '3', '人数 2 / 条数 3（' + (rows[0] && rows[0].n + '/' + rows[0].q) + '）');
    ok(!!(await ev(`(function(){var m=document.querySelector('#tabBody .qa-note');return m && m.textContent.indexOf('还没放密钥')>=0;})()`)),
      '出厂状态（没放 key）提示「还没放密钥…只能离线指路」');
    ok(!!(await ev(`(function(){var b=document.querySelector('#tabBody .card .row-flex .btn');return b && b.textContent.indexOf('暂停问问')>=0;})()`)),
      '开关按钮初始是「⏸ 暂停问问」');

    // 展开那一行
    const open = await ev(`(function(){var tr=document.querySelector('#tabBody tr.qa-row');tr.click();return 1;})()`);
    ok(await waitFor(`(function(){var d=document.querySelector('#tabBody tr.qa-detail');return d && !d.hidden;})()`, 30, 300), '点一行 → 展开问题清单（' + open + '）');
    const det = await ev(`(function(){
      var d=document.querySelector('#tabBody tr.qa-detail');
      var names=[].slice.call(d.querySelectorAll('.qa-name b')).map(function(x){return x.textContent});
      var qs=[].slice.call(d.querySelectorAll('.qa-q')).map(function(x){return x.textContent});
      var meta=d.querySelector('.qa-meta') ? d.querySelector('.qa-meta').textContent : '';
      return {names:names,qs:qs,meta:meta,hasA:!!d.querySelector('details.qa-a'),stus:d.querySelectorAll('.qa-stu').length};})()`);
    ok(det && det.stus === 2, '清单按人分成 2 组（' + (det && det.stus) + '）');
    ok(det && det.names.indexOf(S1) >= 0 && det.names.indexOf(S2) >= 0, '两个学生的真实姓名都在（' + JSON.stringify(det && det.names) + '）');
    ok(det && det.qs.indexOf(Q1) >= 0 && det.qs.indexOf(Q2) >= 0 && det.qs.indexOf(Q1b) >= 0, '三条原话一条不漏');
    ok(det && det.qs.filter((q) => q === Q1).length === 1, '连点两次的同一条问题只记一条');
    ok(det && /\d+月\d+日 \d\d:\d\d/.test(det.meta || ''), '每条带提问时间（' + (det && det.meta) + '）');
    ok(det && det.hasA, '每问都能展开看问问怎么答的（details.qa-a）');
    await ev(`(function(){var d=document.querySelector('#tabBody details.qa-a');if(d)d.open=true;return 1})()`);
    const abody = await ev(`(function(){var d=document.querySelector('#tabBody details.qa-a .qa-a-body');return d?d.textContent:''})()`);
    ok(!!abody && abody.length > 10, '展开后能看到回答正文（' + String(abody).length + ' 字）');
    ok(!!(await ev(`(function(){var m=document.querySelector('#tabBody .qa-foot');return m && m.textContent.indexOf('本班共 2 人次提问')>=0;})()`)),
      '底部小字合计「本班共 2 人次提问 · 3 条」');
    await shot('#tabBody .card', '教师端-学生提问-展开.png');

    // 收起
    await ev(`(function(){document.querySelector('#tabBody tr.qa-row').click();return 1})()`);
    ok(await waitFor(`(function(){var d=document.querySelector('#tabBody tr.qa-detail');return d && d.hidden;})()`, 20, 200), '再点一下 → 收起来');

    // 班级胶囊换班（只验胶囊能切，不去断言别的班的内容）
    const other = await ev(`(function(){
      var cs=[].slice.call(document.querySelectorAll('#tabBody .cls-chip'));
      var c=cs.filter(function(x){return x.textContent.indexOf(${JSON.stringify(CLA)})<0})[0];
      if(!c) return 'no other'; c.click(); return c.textContent;})()`);
    if (other === 'no other') console.log('  （只有一个班，跳过换班检查）');
    else {
      ok(await waitFor(`(function(){var h=document.querySelector('#tabBody .card b');return h && h.textContent.indexOf(${JSON.stringify(CLA)})<0;})()`, 30, 300), '点别的班 → 页头跟着换（' + other + '）');
      await ev(`(function(){var cs=[].slice.call(document.querySelectorAll('#tabBody .cls-chip'));var c=cs.filter(function(x){return x.textContent.indexOf(${JSON.stringify(CLA)})>=0})[0];if(c)c.click();return 1})()`);
      ok(await waitFor(`!!document.querySelector('#tabBody table.qa-table')`, 30, 300), '切回测试班，表格还在');
    }

    // ---- 开 / 停开关 ----
    const ck3 = (await jfetch('/api/student/login', 'POST', { name: S3 })).ck;
    console.log('\n-- 开 / 停开关 --');
    const before = (await jfetch('/api/ask/hello?lessonId=' + LID, 'GET', null, ck3)).j;
    ok(before.off === false && (before.chips || []).length >= 2, '开关点之前：学生能问、有快捷问法（chips ' + (before.chips || []).length + '）');
    const tgl = await ev(`(function(){var b=document.querySelector('#tabBody .card .row-flex .btn');b.click();return 1})()`);
    ok(tgl === 1, '点了「暂停问问」');
    const offed = await waitFor(`(function(){var b=document.querySelector('#tabBody .card .row-flex .btn');return b && b.textContent.indexOf('打开问问')>=0;})()`, 40, 300);
    ok(offed, '按钮变成「▶ 打开问问」');
    const after = (await jfetch('/api/ask/hello?lessonId=' + LID, 'GET', null, ck3)).j;
    ok(after.off === true, '服务端确实记下了暂停（agentOff=true）');
    ok((after.chips || []).length === 0 && after.greeting.indexOf('暂时关掉') >= 0, '学生那边：问候语换成「被老师暂时关掉啦」、快捷问法不再给');
    const ask1 = (await jfetch('/api/ask', 'POST', { lessonId: LID, question: '关了还能问吗？' }, ck3)).j;
    ok(ask1.source === 'limit' && ask1.reply.indexOf('暂时关掉') >= 0, '暂停期间提问 → 只回「被老师暂时关掉」，不烧模型');
    ok(!!(await ev(`(function(){var m=document.querySelector('#tabBody .qa-note');return m && m.textContent.indexOf('学生打开面板只会看到')>=0;})()`)),
      '老师这边提示语也换成「学生打开面板只会看到…」');
    await shot('#tabBody .card', '教师端-学生提问-已暂停.png');

    const on = await ev(`(function(){var b=document.querySelector('#tabBody .card .row-flex .btn');b.click();return 1})()`);
    const back = await waitFor(`(function(){var b=document.querySelector('#tabBody .card .row-flex .btn');return b && b.textContent.indexOf('暂停问问')>=0;})()`, 40, 300);
    const after2 = (await jfetch('/api/ask/hello?lessonId=' + LID, 'GET', null, ck3)).j;
    ok(on === 1 && back && after2.off === false, '再点一次 → 打开（学生那边 off=false）');
    ok(after2.greeting.indexOf('我是') >= 0, '问候语回到「嗨，我是问问」');

    // ---- 500px 窄屏不横向溢出 ----
    await send('Emulation.setDeviceMetricsOverride', { width: 500, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(400);
    const ov = await ev(`({doc:document.documentElement.scrollWidth,win:window.innerWidth})`);
    ok(ov.doc <= ov.win + 2, '500px 窄屏不横向溢出（' + ov.doc + ' ≤ ' + ov.win + '）');
    await shot('#tabBody .card', '教师端-学生提问-500px.png');
    await send('Emulation.clearDeviceMetricsOverride');
  }

  // ---- 学生端：任务单页的悬浮按钮 + 面板 ----
  if (PART === 'all' || PART === 'student') {
    console.log('\n-- 学生端【问问】--');
    await send('Page.navigate', { url: BASE + '/quiz' });
    await sleep(600);
    await waitFor(`document.readyState==='complete' && !!document.getElementById('loginName')`, 40, 300);
    // 用刚建的那个学生登录（还没到收尾删除那一步）
    await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(S3)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1})()`);
    ok(await waitFor(`!document.getElementById('view-map').hidden`, 40, 300), '学生登录进课程地图');

    // 课程地图上不该有问问
    ok(!(await vis('#askShell .ask-fab')) && !(await vis('#askShell .ask-panel')), '课程地图页看不见问问');

    // 进「第4课 数据的安全」的课内任务单
    await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
    await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='4年级'})[0];if(t)t.click();return 1})()`);
    await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('数据的安全')>=0})`, 30, 300);
    const goSheet = await ev(`(function(){
      var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('数据的安全')>=0})[0];
      if(!c) return 'no lesson';
      var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
      if(!b) return 'no btn'; b.click(); return 'ok';})()`);
    const sheetUp = await waitFor(`!document.getElementById('view-sheet').hidden && !!document.querySelector('#sheetBody table.sheet-table')`, 40, 300);
    ok(goSheet === 'ok' && sheetUp, '打开第4课的课内任务单（' + goSheet + '）');

    // 悬浮按钮出现，且不压住「保存任务单」
    ok(await waitFor(visExpr('#askShell .ask-fab'), 30, 300), '任务单页右下角出现「💬 问问」');
    const geo = await ev(`(function(){
      var f=document.querySelector('#askShell .ask-fab').getBoundingClientRect();
      var b=document.getElementById('sheetSaveBtn').getBoundingClientRect();
      var cross = !(f.right<b.left||f.left>b.right||f.bottom<b.top||f.top>b.bottom);
      return {cross:cross, gap:Math.round(b.top-f.bottom), zf:getComputedStyle(document.querySelector('#askShell .ask-fab')).zIndex};})()`);
    ok(geo && !geo.cross && geo.gap >= 4, '悬浮按钮没压住「保存任务单」（间隙 ' + (geo && geo.gap) + 'px）');
    ok(geo && Number(geo.zf) < 60, '悬浮按钮层级低于 .toast 的 60（z-index ' + (geo && geo.zf) + '）');

    // 点开面板
    await ev(`(function(){document.querySelector('#askShell .ask-fab').click();return 1})()`);
    ok(await waitFor(`!document.querySelector('#askShell .ask-panel').hidden`, 20, 200), '点一下打开面板');
    const hd = await ev(`(function(){
      var p=document.querySelector('#askShell .ask-panel');
      return {left:(p.querySelector('.ask-left')||{}).textContent||'',
              greet:(p.querySelector('.chat-msg.ai .chat-text')||{}).textContent||'',
              tag:(p.querySelector('.chat-msg.ai .src-tag')||{}).textContent||'',
              chips:[].slice.call(p.querySelectorAll('.ask-chip')).map(function(x){return x.textContent})};})()`);
    ok(hd && hd.greet.indexOf('问问') >= 0 && hd.tag === '问问', '问候语气泡带「问问」标签（' + hd.tag + '）');
    ok(hd && /今天还能问 \d+ 次/.test(hd.left), '头部显示「今天还能问 N 次」（' + hd.left + '）');
    ok(hd && hd.chips.length >= 2, '有快捷问法 chips（' + JSON.stringify(hd.chips) + '）');
    await shot('#askShell .ask-panel', '学生端-问问-刚打开.png');

    // 点一个 chip 问一句。
    // ⚠ 别写死"第一个 chip 是「这一步该怎么想？」"——本课一有 knowledge.words，
    //    排在前面的就变成「什么是××？」了（服务端就是这么排的）。所以点之前先把它记下来。
    ok(hd && hd.chips.some((x) => x.indexOf('什么是') === 0),
      '本课有知识点时，chips 里有「什么是××？」（' + JSON.stringify(hd && hd.chips) + '）');
    const l0 = Number((hd.left.match(/(\d+)/) || [])[1]);
    const chip0 = hd.chips[0];
    await ev(`(function(){document.querySelector('#askShell .ask-chip').click();return 1})()`);
    await waitFor(`document.querySelectorAll('#askShell .chat-msg.user').length===1 && !document.querySelector('#askShell .chat-msg.typing')`, 40, 300);
    const a1 = await ev(`(function(){
      var us=document.querySelectorAll('#askShell .chat-msg.user');
      var ms=document.querySelectorAll('#askShell .chat-msg.ai');
      var last=ms[ms.length-1];
      return {q:us[0].textContent,
              a:(last.querySelector('.chat-text')||{}).textContent||'',
              tag:(last.querySelector('.src-tag')||{}).textContent||'',
              left:(document.querySelector('#askShell .ask-left')||{}).textContent||''};})()`);
    ok(a1 && a1.q.length > 2, 'chip 的问题渲染成我的气泡（' + a1.q + '）');
    ok(a1 && a1.a.length > 20 && a1.tag === '离线回答', '离线路径：回答带「离线回答」标签（' + a1.tag + '）');
    ok(a1 && a1.a.indexOf('任务') >= 0, '离线回答确实指到了任务单上的位置');
    ok(a1 && Number((a1.left.match(/(\d+)/) || [])[1]) === l0 - 1, '「还能问 N 次」跟着响应减 1（' + l0 + '→' + (a1 && a1.left) + '）');
    // 离线话术只复述屏幕上本来就有的话：不许出现任务单下拉里的候选答案
    const picks = await ev(`(function(){
      var out=[];
      [].slice.call(document.querySelectorAll('#sheetBody select.sheet-pick')).forEach(function(s){
        [].slice.call(s.options).forEach(function(o){ var t=o.textContent.trim(); if(t && t.length>3) out.push(t); });
      });
      return out.slice(0,40);})()`);
    const leaked = (picks || []).filter((p) => (a1.a + a1.q).indexOf(p) >= 0);
    ok(leaked.length === 0, '离线回答里没有冒出下拉里的候选答案（查了 ' + (picks || []).length + ' 条）' + (leaked.length ? '：' + leaked[0] : ''));
    await shot('#askShell .ask-panel', '学生端-问问-问了一句.png');

    // 打字发送
    await ev(`(function(){var i=document.querySelector('#askShell .ask-input input');i.value='我还是不太懂，再具体一点';i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return 1})()`);
    ok(await waitFor(`document.querySelectorAll('#askShell .chat-msg.user').length===2 && !document.querySelector('#askShell .chat-msg.typing')`, 40, 300), '打字回车也能问（第二次）');
    const a2 = await ev(`(function(){var ms=document.querySelectorAll('#askShell .chat-msg.ai');return {n:ms.length, a:(ms[ms.length-1].querySelector('.chat-text')||{}).textContent||''}})()`);
    ok(a2 && a2.n === 3 && a2.a.length > 20, '第二次追问也有回答（气泡 ' + (a2 && a2.n) + ' 个）');

    // 收起 → 按钮回来
    await ev(`(function(){document.querySelector('#askShell .ask-x').click();return 1})()`);
    ok(await waitFor(`document.querySelector('#askShell .ask-panel').hidden && ${visExpr('#askShell .ask-fab')}`, 20, 200), '点 ✕ 收起来，悬浮按钮回来');

    // ---- 500px 窄屏（把面板重新打开量一遍：投影/分屏上不能横向溢出、也不能顶出屏幕）----
    await send('Emulation.setDeviceMetricsOverride', { width: 500, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(400);
    const ov2 = await ev(`({doc:document.documentElement.scrollWidth,win:window.innerWidth})`);
    ok(ov2.doc <= ov2.win + 2, '500px 窄屏任务单页不横向溢出（' + ov2.doc + ' ≤ ' + ov2.win + '）');
    await ev(`(function(){var f=document.querySelector('#askShell .ask-fab');if(f&&f.getBoundingClientRect().width>1)f.click();return 1})()`);
    await sleep(400);
    const pb = await ev(`(function(){
      var p=document.querySelector('#askShell .ask-panel');
      if(!p||p.hidden) return null;
      var r=p.getBoundingClientRect();
      return {x:Math.round(r.x), right:Math.round(r.right), top:Math.round(r.top), bottom:Math.round(r.bottom), win:window.innerWidth, vh:window.innerHeight};})()`);
    ok(pb && pb.x >= 0 && pb.right <= pb.win + 1, '500px 下面板不横向溢出（' + (pb && pb.x + '…' + pb.right) + ' / ' + (pb && pb.win) + '）');
    ok(pb && pb.top >= 0 && pb.bottom <= pb.vh + 1, '500px 下面板不顶出屏幕（' + (pb && pb.top + '…' + pb.bottom) + ' / ' + (pb && pb.vh) + '）');
    await shot('#askShell .ask-panel', '学生端-问问-500px.png');
    await send('Emulation.clearDeviceMetricsOverride');
    await sleep(300);
    await ev(`(function(){document.querySelector('#askShell .ask-x').click();return 1})()`);

    // ---- 回课程地图，再进同一课的任务单：聊过的还在（面板 DOM 挂在 #sheetBody 外面，没被重建）----
    const back2 = await ev(`(function(){
      var b=[].slice.call(document.querySelectorAll('#sheetHeader button')).filter(function(x){return x.textContent.indexOf('返回')>=0})[0];
      if(!b) return 'no back'; b.click(); return 'ok';})()`);
    if (back2 === 'ok') {
      await waitFor(`!document.getElementById('view-map').hidden`, 30, 300);
      await ev(`(function(){
        var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('数据的安全')>=0})[0];
        var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
        b.click(); return 1;})()`);
      await waitFor(`!document.getElementById('view-sheet').hidden`, 30, 300);
      await sleep(500);
      const keep = await ev(`(function(){
        var us=document.querySelectorAll('#askShell .chat-msg.user');
        return {n:us.length, first:us.length?us[0].textContent:'', hidden:document.querySelector('#askShell .ask-panel').hidden};})()`);
      ok(keep && keep.n === 2, '重新进任务单：之前聊过的还在，不用重问（' + (keep && keep.n) + ' 条我的提问）');
      ok(keep && keep.first === chip0, '第一条还是刚才那句（' + (keep && keep.first) + '）');
      ok(keep && keep.hidden, '面板默认是收起的（悬浮按钮等着）');
    } else console.log('  （没找到返回按钮，跳过"聊过的还在"这一条）');

    // ---- 切到课后小测页 → 问问必须消失（小测是测评，AI 在旁边等于开卷）----
    const toQuiz = await ev(`(function(){
      var b=[].slice.call(document.querySelectorAll('#sheetHeader button')).filter(function(x){return x.textContent.indexOf('返回')>=0})[0];
      if(b) b.click(); return 1})()`);
    void toQuiz;
    await waitFor(`!document.getElementById('view-map').hidden`, 30, 300);
    await sleep(300);
    const inQuiz = await ev(`(function(){
      var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('数据的安全')>=0})[0];
      if(!c) return 'no lesson';
      var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课后小测')>=0})[0];
      if(!b) return 'no btn'; b.click(); return 'ok';})()`);
    if (inQuiz === 'ok') {
      await waitFor(`!document.getElementById('view-quiz').hidden`, 30, 300);
      ok(!(await vis('#askShell .ask-fab')) && !(await vis('#askShell .ask-panel')), '切到课后小测页，问问不见了');
    } else console.log('  （没找到小测入口，跳过"小测页没有问问"这一条）');
  }

  // ---- 试用班（PART=pilot）：名单外的班，屏幕上连着落都没有 ----
  // 老师 2026-10-16 要"先给 2023级5班用"，所以这里验的就是"别的班看不见"。
  // ⚠️ 这一档自己往 agent.config.json 里塞试用班名单（**不放 key**，全程走离线，不花钱），
  //    跟 PART=all 那两档不能同时跑（那两档的前提是出厂状态）。
  if (PART === 'pilot') {
    console.log('\n-- 试用班：只有名单里的班看得见问问 --');
    const otherCls = '四年级别班' + TAG, otherName = '别班甲' + TAG;
    await jfetch('/api/teacher/roster', 'POST', { text: otherCls + '，' + otherName }, T);
    const setPilot = (v) => fs.writeFileSync(CFG_PATH, JSON.stringify(v, null, 2));
    const gone = () => { try { fs.unlinkSync(CFG_PATH); } catch (e) {} };

    const openSheetFor = async (name) => {
      await send('Page.navigate', { url: BASE + '/quiz' });
      await sleep(700);
      await waitFor(`document.readyState==='complete' && !!document.getElementById('loginName')`, 40, 300);
      await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(name)};
        n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1})()`);
      await waitFor(`!document.getElementById('view-map').hidden`, 40, 300);
      await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
      await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='4年级'})[0];if(t)t.click();return 1})()`);
      await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('数据的安全')>=0})`, 30, 300);
      await ev(`(function(){var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('数据的安全')>=0})[0];
        var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
        if(!b) return 'no btn'; b.click(); return 'ok';})()`);
      await waitFor(`!document.getElementById('view-sheet').hidden`, 40, 300);
      await sleep(500);   // hello 是异步拉到才决定露不露面，给它一拍
      return ev(`(function(){var n=document.querySelector('#askShell .ask-fab');
        if(!n) return {fab:false, shell:document.getElementById('askShell')?document.getElementById('askShell').hidden:null};
        var r=n.getBoundingClientRect();
        return {fab:r.width>1&&r.height>1, shell:document.getElementById('askShell').hidden};})()`);
    };

    setPilot({ pilotClasses: [CLA] });
    const inList = await openSheetFor(S3);
    ok(inList && inList.fab, '名单里的班（' + CLA + '）看得到「💬 问问」');
    const notInList = await openSheetFor(otherName);
    ok(notInList && !notInList.fab, '名单外的班（' + otherCls + '）看不见悬浮按钮');
    ok(notInList && notInList.shell === true, '名单外的班连 #askShell 都还是收着的（不是画出来再藏）');

    gone();
    const back = await openSheetFor(otherName);
    ok(back && back.fab, '名单去掉（热重载）之后，别班立刻又看得见了');

    await jfetch('/api/teacher/progress/delete', 'POST', { uid: otherName + '｜' + otherCls }, T).catch(() => {});
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: otherName + '｜' + otherCls }, T).catch(() => {});
    const afterPilot = (await jfetch('/api/teacher/agent-log?class=' + encodeURIComponent(otherCls), 'GET', null, T)).j;
    ok((afterPilot.classes || []).indexOf(otherCls) < 0, '试用班测试用的临时班也清掉了');
  }

  ws.close(); kill(); await sleep(300);

  // ---- 收尾：删干净（记录随学生数据一起删，别在隔离库里留测试生） ----
  for (const nm of [S1, S2, S3]) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: nm + '｜' + CLA, lessonId: LID, kind: 'sheet' }, T).catch(() => {});
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: nm + '｜' + CLA }, T).catch(() => {});
  }
  const afterClean = (await jfetch('/api/teacher/agent-log?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok((afterClean.items || []).length === 0, '删掉学生后，提问记录也一起没了');

  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
