// 第3课「课内任务单·任务二」流程图自检：8 图 4 空、
// 而且「输出 ji、tu 的值」的箭头发往「tu←tu+1」而不是「结束」（教材原图如此），截图存证。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-task2.js
const { spawn, execSync } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const CLA = '测试六年级';
const TAG = Date.now().toString(36).slice(-4);
const NAME = '任务二' + TAG;
const PORT = 9500 + Math.floor(Math.random() * 300);
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
  console.log('== 第3课 任务二流程图自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + NAME }, T);
  const S = (await jfetch('/api/student/login', 'POST', { name: NAME })).ck;

  // 取卷（学生视角）里的任务二定义：节点/连线坐标都在，答案不在
  const sheet = (await jfetch('/api/lesson/6-1-3/sheet', 'GET', null, S)).j.sheet;
  const t2 = sheet.sections[1].flow;
  const out = t2.nodes.find((x) => x.id === 'nOut');
  const inc = t2.nodes.find((x) => x.id === 'nInc');
  const end = t2.nodes.find((x) => x.id === 'nEnd');
  const fromOut = t2.edges.filter((x) => x.from === 'nOut');
  console.log('  ℹ 「' + out.text + '」出发的线 ' + fromOut.length + ' 条 → ' + fromOut.map((x) => x.to).join(','));
  ok(t2.nodes.length === 8 && t2.edges.length === 9 && t2.blanks.length === 4, '任务二 8 个图形 / 9 条线 / 4 个空');
  ok(fromOut.length === 1 && fromOut[0].to === 'nInc', '「输出 ji、tu 的值」的线指向 tu←tu+1（' + (fromOut[0] || {}).to + '）');
  ok(!t2.edges.some((x) => x.from === 'nOut' && x.to === 'nEnd'), '不再有一条线从「输出」直接连到「结束」');
  ok(t2.edges.some((x) => x.to === 'nEnd'), '「结束」仍由「枚举完（否）」那条线接入');
  ok(inc.y > out.y && fromOut[0].pts.length === 3, '这条线只有 1 个直角拐点（' + fromOut[0].pts.length + ' 个点）');

  const child = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_t2_' + PORT),
    '--no-first-run', '--disable-gpu', '--window-size=1024,940', BASE + '/quiz.html'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);
  let list = [];
  for (let i = 0; i < 40; i++) { await sleep(300); try { list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); if (list.some((x) => x.type === 'page' && x.url.startsWith(BASE))) break; } catch (e) {} }
  const page = list.find((x) => x.type === 'page' && x.url.startsWith(BASE));
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  const send = mk(ws); await send('Runtime.enable'); await send('Page.enable');
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  const waitFor = async (e, n, ms) => { for (let i = 0; i < (n || 30); i++) { if (await ev(e)) return true; await sleep(ms || 300); } return false; };
  const shot = async (expr, file) => {
    const box = await ev(`(function(){var n=${expr};if(!n)return null;var r=n.getBoundingClientRect();return {x:r.x+window.scrollX,y:r.y+window.scrollY,width:r.width,height:r.height};})()`);
    if (!box || box.width < 5) { console.log('  （截图跳过 ' + expr + '）'); return; }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 } });
    if (!r.result || !r.result.data) return console.log('  （截图失败 ' + expr + '）');
    const OUT = process.env.OUT || path.join(__dirname, '_tmp');
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, file), Buffer.from(r.result.data, 'base64'));
    console.log('  📷 ' + file);
  };

  await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
  await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(NAME)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1;})()`);
  await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];if(t)t.click();return 1;})()`);
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('算法设计')>=0})`, 30, 300);
  await ev(`(function(){
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('算法设计')>=0})[0];
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    b.click(); return 1;})()`);
  const up = await waitFor(`!document.getElementById('view-sheet').hidden && document.querySelectorAll('#sheetBody .sheet-sec').length>=2`, 40, 300);
  await waitFor(`document.querySelectorAll('#sheetBody .fc-node').length>=8`, 40, 300);
  await sleep(500);
  const f = await ev(`(function(){
    var secs=document.querySelectorAll('#sheetBody .sheet-sec');
    var s2=secs[1]; if(!s2) return null;
    var w=s2.querySelector('.fc-scroll'), h=w.querySelector('.fc');
    return { nodes:w.querySelectorAll('.fc-node').length, edges:w.querySelectorAll('svg.fc-edges path[marker-end]').length,
             blanks:w.querySelectorAll('.fc-node select').length,
             optCounts:[].slice.call(w.querySelectorAll('.fc-node select')).map(function(s){return s.options.length}).join(','),
             cw:h.dataset.cw, ch:h.dataset.ch, transform:h.style.transform,
             visW:Math.round(h.getBoundingClientRect().width), wrapW:Math.round(w.getBoundingClientRect().width),
             curves:[].slice.call(w.querySelectorAll('svg.fc-edges path[marker-end]')).filter(function(p){return /[CQSA]/.test(p.getAttribute('d'))}).length,
             docW:document.documentElement.scrollWidth, winW:window.innerWidth};})()`);
  ok(up && !!f, '任务二流程图在任务单里画出来了');
  if (f) {
    console.log('  ℹ ' + JSON.stringify(f));
    ok(f.nodes === 8 && f.edges === 9, '页面上 8 个图形 / 9 条线（' + f.nodes + '/' + f.edges + '）');
    ok(f.blanks === 4 && f.optCounts === '5,5,5,5', '4 个空、每空 4 词 + 占位（' + f.optCounts + '）');
    ok(f.curves === 0, '连线全是直线、没有弯曲（曲线段 ' + f.curves + '）');
    ok(f.visW <= f.wrapW + 2, '整图缩进容器、不用左右滑（' + f.visW + ' ≤ ' + f.wrapW + '，' + f.transform + '）');
    ok(f.docW <= f.winW + 2, '任务单页不横向溢出（' + f.docW + ' ≤ ' + f.winW + '）');
  }
  await shot(`document.querySelectorAll('#sheetBody .sheet-sec')[1]`, '任务二-流程图.png');

  ws.close(); kill(); await sleep(300);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: NAME + '｜' + CLA }, T);
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
