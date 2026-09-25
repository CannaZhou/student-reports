// 回归：改过 .fc-scroll 宽度后，老课的「课后小测」流程图（第1课、第2课、4年级）在新窗口里还画得出来、
// 且不把整页撑宽。用法：BASE=http://127.0.0.1:7099 node tools/_ui-flow-regress.js
const { spawn, execSync } = require('child_process');
const os = require('os'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const CLA = '测试六年级';
const NAME = '回归自检' + Date.now().toString(36).slice(-4);
const PORT = 9300 + Math.floor(Math.random() * 400);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return { j: await r.json().catch(() => ({})), ck: cookie(r) };
}
let msgId = 0;
function mk(ws) {
  const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
  return (m, q) => new Promise((res) => { const id = ++msgId; p.set(id, res); ws.send(JSON.stringify({ id, method: m, params: q || {} })); });
}

(async () => {
  console.log('== 老课流程图回归 ==');
  const t = await jfetch('/api/teacher/login', 'POST', { password: '123456' });
  const T = t.ck;
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + NAME }, T);
  const s = await jfetch('/api/student/login', 'POST', { name: NAME });
  const S = s.ck;
  ok(s.j.ok, '学生登录');

  const child = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_lq_rg_' + PORT),
    // 教室里的实际屏幕（≥1024）：这一档必须缩到一屏、不用左右滑
    '--no-first-run', '--disable-gpu', '--window-size=1024,900', BASE + '/quiz.html'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);
  let list = [];
  for (let i = 0; i < 40; i++) { await sleep(300); try { list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); if (list.some((x) => x.type === 'page' && x.url.startsWith(BASE))) break; } catch (e) {} }
  const page = list.find((x) => x.type === 'page' && x.url.startsWith(BASE));
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  const send = mk(ws); await send('Runtime.enable'); await send('Page.enable');
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  const fs = require('fs');
  const OUT = process.env.OUT || path.join(__dirname, '_tmp', 'ui-6-1-3');
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

  await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
  await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(NAME)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1;})()`);
  await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];if(t)t.click();return 1;})()`);

  // 老课 6-1-1 的流程图 + 新课 6-1-3 的课后小测（5 题，末题是流程图填空）
  const cases = [['第1课 算法与问题解决', '6-1-1'], ['第3课 算法设计', '6-1-3']];
  for (const [title, id] of cases) {
    await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf(${JSON.stringify(title)})>=0})`, 30, 300);
    const go = await ev(`(function(){
      var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(title)})>=0})[0];
      if(!c) return 'no card';
      var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课后小测')>=0})[0];
      if(b){ b.click(); return 'ok'; }
      c.click(); return 'ok-card';   // 没任务单的老课：整张卡片可点，直接进小测
      })()`);
    const up = await waitFor(`!document.getElementById('view-quiz').hidden && !!document.querySelector('.fc-scroll .fc')`, 40, 300);
    const f = await ev(`(function(){
      var w=document.querySelector('.fc-scroll'); if(!w) return null;
      var h=w.querySelector('.fc');
      return { cards:document.querySelectorAll('#quizBody .qcard').length,
               blanks:document.querySelectorAll('#quizBody .fc-node select').length,
               optCounts:[].slice.call(document.querySelectorAll('#quizBody .fc-node select')).map(function(s){return s.options.length}).join(','),
               nodes:w.querySelectorAll('.fc-node').length,
               edges:w.querySelectorAll('svg.fc-edges path[marker-end]').length,
               cw:h.dataset.cw, k:h.style.transform, wrapW:Math.round(w.getBoundingClientRect().width),
               visW:Math.round(h.getBoundingClientRect().width), canScroll:getComputedStyle(w).overflowX!=='hidden',
               docW:document.documentElement.scrollWidth, winW:window.innerWidth };})()`);
    ok(String(go).indexOf('ok')===0 && up && !!f, title + ' 课后小测流程图已渲染（' + go + '）');
    if (f) {
      console.log('  ℹ ' + title + '：' + f.cards + ' 题，' + f.nodes + ' 图形 / ' + f.edges + ' 条线 / ' + f.blanks + ' 个空（' + f.optCounts + '），画布 ' + f.cw + '，容器 ' + f.wrapW + '，缩放后 ' + f.visW + '（' + f.k + '），页面 ' + f.docW + '/' + f.winW);
      ok(f.nodes > 0 && f.edges > 0, title + ' 图形与连线都在');
      ok(f.wrapW <= f.winW, title + ' 流程图容器没超出窗口（' + f.wrapW + ' ≤ ' + f.winW + '）');
      ok(f.visW <= f.wrapW + 2, title + ' 流程图已缩放塞进容器、不用左右滑（' + f.visW + ' ≤ ' + f.wrapW + '）');
      ok(f.docW <= f.winW + 2, title + ' 页面不横向溢出（' + f.docW + ' ≤ ' + f.winW + '）');
      if (id === '6-1-3') {
        ok(f.cards === 5, '第3课课后小测 5 题（实际 ' + f.cards + '）');
        ok(f.blanks === 5 && f.optCounts === '6,6,6,6,6', '末题流程图 5 个空、每空 5 个标准词 + 占位（实际 ' + f.blanks + ' 空 [' + f.optCounts + ']）');
        await shot('#quizBody .qcard:last-child .fc-scroll', '课后小测-百钱买百鸡流程图.png');
      }
    }
    await ev(`(function(){var b=document.getElementById('backBtn')||document.querySelector('#quizHead button, .btn.ghost');if(b)b.click();return 1;})()`);
    await sleep(900);
  }

  // ---- 老任务单（4年级第2课：3 个板块、带 4 张数据图、有 example）改动后还正常吗 ----
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='4年级'})[0];if(t)t.click();return 1;})()`);
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('多样的数据')>=0})`, 30, 300);
  const go4 = await ev(`(function(){
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('多样的数据')>=0})[0];
    if(!c) return 'no card';
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    if(!b) return 'no sheet btn';
    b.click(); return 'ok';})()`);
  const up4 = await waitFor(`!document.getElementById('view-sheet').hidden && document.querySelectorAll('#sheetBody .sheet-sec').length>0`, 40, 300);
  ok(go4 === 'ok' && up4, '4年级第2课课内任务单（多板块+数据图）打开（' + go4 + '）');
  await waitFor(`[].slice.call(document.querySelectorAll('#sheetBody img.sheet-rowimg-pic')).every(function(im){return im.complete && im.naturalWidth>0})`, 30, 300);
  const g4 = await ev(`(function(){
    var o={secs:document.querySelectorAll('#sheetBody .sheet-sec').length,
           tbls:document.querySelectorAll('#sheetBody table.sheet-table').length,
           imgs:document.querySelectorAll('#sheetBody img.sheet-rowimg-pic').length,
           broken:0, cells:document.querySelectorAll('#sheetBody table.sheet-table [data-col]').length,
           wide:document.querySelectorAll('#sheetBody table.sheet-table.sheet-wide').length,
           scrolls:document.querySelectorAll('#sheetBody .sheet-scroll').length,
           docW:document.documentElement.scrollWidth, winW:window.innerWidth};
    [].slice.call(document.querySelectorAll('#sheetBody img.sheet-rowimg-pic')).forEach(function(im){ if(!im.complete||!im.naturalWidth) o.broken++; });
    return o;})()`);
  ok(g4.secs >= 1 && g4.tbls >= 1, '老任务单的表格还在（' + g4.secs + ' 板块 / ' + g4.tbls + ' 张表）');
  ok(g4.imgs >= 1 && g4.broken === 0, '数据图都加载出来了（' + g4.imgs + ' 张，坏图 ' + g4.broken + '）');
  ok(g4.wide === 0 && g4.scrolls === 0, '老任务单没被当成宽表处理（wide=' + g4.wide + '）');
  ok(g4.docW <= g4.winW + 2, '老任务单页不横向溢出（' + g4.docW + ' ≤ ' + g4.winW + '）');
  const save4 = await ev(`(function(){
    var inp=document.querySelector('#sheetBody table.sheet-table input');
    if(!inp) return 'no input';
    inp.value='RG'; inp.dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('sheetSaveBtn').click(); return 'ok';})()`);
  await waitFor(`/已保存/.test(document.getElementById('sheetNote').textContent)`, 30, 300);
  ok(save4 === 'ok' && /已保存/.test(String(await ev(`document.getElementById('sheetNote').textContent`))), '老任务单还能存（' + save4 + '）');
  const b4 = (await jfetch('/api/lesson/4-1-2/sheet', 'GET', null, S)).j;
  const saved = (b4.prev || []).some((r) => Object.keys(r).some((k) => k !== '_i' && r[k] === 'RG'));
  ok(saved, '老任务单所填回读成功');

  // ---- 窄窗口（平板竖屏 / 500px 最小窗宽）：不要求整图塞得下（缩到 0.5 倍字就看不清了，宁可横滑），
  //      但页面本身绝不能横向溢出，而且横向滚动条必须只出现在流程图容器里。----
  await send('Emulation.setDeviceMetricsOverride', { width: 520, height: 900, deviceScaleFactor: 1, mobile: false });
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];if(t)t.click();return 1;})()`);
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('算法设计')>=0})`, 30, 300);
  await ev(`(function(){
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('算法设计')>=0})[0];
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课后小测')>=0})[0];
    if(b)b.click(); return 1;})()`);
  await waitFor(`!document.getElementById('view-quiz').hidden && !!document.querySelector('.fc-scroll .fc')`, 40, 300);
  await sleep(600);
  const n = await ev(`(function(){var w=document.querySelector('.fc-scroll');var h=w.querySelector('.fc');
    return {k:w.dataset.k, visW:Math.round(h.getBoundingClientRect().width), wrapW:Math.round(w.getBoundingClientRect().width),
            scrollable:getComputedStyle(w).overflowX!=='hidden',
            docW:document.documentElement.scrollWidth, winW:window.innerWidth};})()`);
  console.log('  ℹ 窄窗口 520：缩放 ' + n.k + '，图 ' + n.visW + ' / 容器 ' + n.wrapW + '，页面 ' + n.docW + '/' + n.winW);
  ok(n.docW <= n.winW + 2, '窄窗口下页面不横向溢出（' + n.docW + ' ≤ ' + n.winW + '）');
  ok(n.visW > n.wrapW ? n.scrollable : true, '窄窗口下图放不下时，横滑只发生在流程图容器里（容器可滚动=' + n.scrollable + '）');
  await send('Emulation.clearDeviceMetricsOverride');

  ws.close(); kill(); await sleep(300);
  await jfetch('/api/teacher/progress/delete', 'POST', { uid: NAME + '｜' + CLA, lessonId: '4-1-2', kind: 'sheet' }, T);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: NAME + '｜' + CLA }, T);
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
