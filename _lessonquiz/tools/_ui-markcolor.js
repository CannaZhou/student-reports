// 赋分台配色与「0 分」自检：红=未交 / 橙=未赋分 / 绿=已赋分；0 分能存、能算进学期累计、能清除回橙。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-markcolor.js
const { spawn, execSync } = require('child_process');
const os = require('os'), path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const CLA = '测试六年级';
const TAG = Date.now().toString(36).slice(-4);
const A = '已交' + TAG, B = '未交' + TAG, C = '零分' + TAG;
const PORT = 9400 + Math.floor(Math.random() * 300);
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
  console.log('== 赋分台配色 / 0 分自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B, C].map((n) => CLA + '，' + n).join('\n') }, T);

  // 只有 A 交任务单；B 没交；C 交了但先不给分
  for (const nm of [A, C]) {
    const S = (await jfetch('/api/student/login', 'POST', { name: nm })).ck;
    await jfetch('/api/lesson/6-1-3/sheet/submit', 'POST', {
      rows: [
        { _i: 0, lab: '鸡的只数', c1: '35' }, { _i: 1, lab: '总脚数', c1: '70' }, { _i: 2, lab: '是否满足正确解条件?', c1: '×' },
        { _i: 3, f1: 'tu < 36 ?', f2: 'ji ← 35 - tu', f3: 'ji × 2 + tu × 4 = 94 ?', f4: 'tu ← tu + 1' },
      ],
    }, S);
  }

  const child = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_mk_' + PORT),
    '--no-first-run', '--disable-gpu', '--window-size=1280,940', BASE + '/teacher.html'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);
  let list = [];
  for (let i = 0; i < 40; i++) { await sleep(300); try { list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); if (list.some((x) => x.type === 'page' && x.url.startsWith(BASE))) break; } catch (e) {} }
  const page = list.find((x) => x.type === 'page' && x.url.startsWith(BASE));
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  const send = mk(ws); await send('Runtime.enable'); await send('Page.enable');
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
  const fs = require('fs');
  const OUT = process.env.OUT || path.join(__dirname, '_tmp', 'ui-markcolor');
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

  // ---- 登录 → 各课完成情况 ----
  await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
  await ev(`(function(){document.getElementById('pw').value='123456';document.getElementById('loginGo').click();return 1;})()`);
  await waitFor(`!document.getElementById('admin').hidden`, 40, 300);
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('.tab[data-tab]')).filter(function(x){return x.dataset.tab==='overview'})[0];t.click();return 1;})()`);
  await waitFor(`!!document.querySelector('#tabBody table')`, 40, 300);

  // ---- 打开第3课「课内任务单」赋分台 ----
  await waitFor(`[].slice.call(document.querySelectorAll('#tabBody tr')).some(function(x){return x.textContent.indexOf('算法设计')>=0})`, 30, 300);
  const go = await ev(`(function(){
    var rs=[].slice.call(document.querySelectorAll('#tabBody tr'));
    var tr=rs.filter(function(x){return x.textContent.indexOf('算法设计')>=0})[0];
    if(!tr) return 'no row';
    var b=[].slice.call(tr.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    if(!b) return 'no btn';
    b.click(); return 'ok';})()`);
  const up = await waitFor(`document.querySelectorAll('#tabBody table.tbl tr').length>=4 && !!document.querySelector('.mark-legend')`, 40, 300);
  ok(go === 'ok' && up, '第3课赋分台打开（' + go + '）');
  ok(!!(await ev(`!!document.querySelector('.mark-legend .lg-miss') && !!document.querySelector('.mark-legend .lg-noscore') && !!document.querySelector('.mark-legend .lg-scored')`)), '图例三色齐全（红未交 / 橙未赋分 / 绿已赋分）');

  const probe = `(function(){
    var out=[];
    [].slice.call(document.querySelectorAll('#tabBody table.tbl tr')).forEach(function(tr){
      if(!tr.querySelector('input.score-in')) return;
      var c0=tr.cells[0], nm;
      (function(){ var c=c0.cloneNode(true); var p=c.querySelector('.pill'); if(p)p.remove(); nm=c.textContent.trim(); })();
      var cls=tr.className.split(' ').filter(function(c){return c.indexOf('row-')===0}).join(',');
      var bg=getComputedStyle(tr.cells[0]).backgroundColor;
      var bl=getComputedStyle(tr.cells[0]).borderLeftColor;
      var pill=tr.querySelector('.pill');
      var inp=tr.querySelector('input.score-in');
      out.push({name:nm,cls:cls,bg:bg,border:bl,pill:pill?pill.textContent:'',val:inp.value});
    });
    return out;})()`;
  let rows = await ev(probe);
  const by = (n) => (rows || []).find((r) => r.name.indexOf(n) === 0) || {};
  console.log('  ℹ ' + JSON.stringify(rows));
  ok(rows && rows.length === 3, '整班 3 人都在表里（含未交）');
  ok(by('未交').cls === 'row-miss', '未交 → 红（' + by('未交').cls + '）');
  ok(by('已交').cls === 'row-noscore', '已交未批 → 橙（' + by('已交').cls + '）');
  ok(/^rgb\(253, 234, 234\)$/.test(by('未交').bg || ''), '未交行底色是浅红（' + by('未交').bg + '）');
  ok(/^rgb\(255, 246, 232\)$/.test(by('已交').bg || ''), '未赋分行底色是浅橙（' + by('已交').bg + '）');
  ok(by('已交').pill === '未赋分', '已交未批的人挂了「未赋分」标签');
  ok(by('未交').pill === '未交', '未交的人也挂了「未交」标签（三种状态都有字）');
  ok(/^rgb\(224, 49, 49\)$/.test(by('未交').border || ''), '未交行左侧红条（' + by('未交').border + '）');
  await shot('#tabBody table.tbl', '赋分台-未批改.png');

  // ---- 给「已交」那个人赋 0 分 ----
  const set0 = await ev(`(function(){
    var rs=[].slice.call(document.querySelectorAll('#tabBody table.tbl tr'));
    var tr=rs.filter(function(x){return x.cells[0].textContent.indexOf(${JSON.stringify(A)})>=0})[0];
    if(!tr) return 'no row';
    var inp=tr.querySelector('input.score-in');
    inp.value='0'; inp.dispatchEvent(new Event('change',{bubbles:true})); return 'ok';})()`);
  await waitFor(`(function(){
    var rs=[].slice.call(document.querySelectorAll('#tabBody table.tbl tr'));
    var tr=rs.filter(function(x){return x.cells[0].textContent.indexOf(${JSON.stringify(A)})>=0})[0];
    return tr && tr.className.indexOf('row-scored')>=0;})()`, 30, 300);
  rows = await ev(probe);
  const a = by('已交');
  ok(set0 === 'ok' && a.cls === 'row-scored', '赋 0 分后 → 绿（' + a.cls + '）');
  ok(a.pill === '已赋分' && a.val === '0', '标签变「已赋分」且输入框留着 0（' + a.pill + '/' + a.val + '）');
  const board = (await jfetch('/api/teacher/sheet-board/6-1-3?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const mine = (board.students || []).find((s) => s.name === A);
  ok(mine && mine.score === 0, '服务端确实存的是 0 分，不是 null（实际 ' + JSON.stringify(mine && mine.score) + '）');
  await shot('#tabBody table.tbl', '赋分台-含0分.png');

  // ---- 清除 → 回橙 ----
  await ev(`window.confirm=function(){return true};1`);
  const clr = await ev(`(function(){
    var rs=[].slice.call(document.querySelectorAll('#tabBody table.tbl tr'));
    var tr=rs.filter(function(x){return x.cells[0].textContent.indexOf(${JSON.stringify(A)})>=0})[0];
    var b=[].slice.call(tr.querySelectorAll('button')).filter(function(x){return x.textContent.trim()==='清除'})[0];
    if(!b) return 'no btn'; b.click(); return 'ok';})()`);
  await waitFor(`(function(){
    var rs=[].slice.call(document.querySelectorAll('#tabBody table.tbl tr'));
    var tr=rs.filter(function(x){return x.cells[0].textContent.indexOf(${JSON.stringify(A)})>=0})[0];
    return tr && tr.className.indexOf('row-noscore')>=0;})()`, 30, 300);
  rows = await ev(probe);
  ok(clr === 'ok' && by('已交').cls === 'row-noscore', '「清除」后 → 回到橙（' + by('已交').cls + '）');
  const b2 = (await jfetch('/api/teacher/sheet-board/6-1-3?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  ok((b2.students || []).find((s) => s.name === A).score === null, '清除后服务端评分确实为空');

  // 页面不横向溢出
  const ov = await ev(`({doc:document.documentElement.scrollWidth,win:window.innerWidth})`);
  ok(ov.doc <= ov.win + 2, '赋分台页不横向溢出（' + ov.doc + ' ≤ ' + ov.win + '）');

  ws.close(); kill(); await sleep(300);
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B, C].map((n) => CLA + '，' + n).join('\n') }, T);
  for (const nm of [A, B, C]) {
    const uid = nm + '｜' + CLA;
    await jfetch('/api/teacher/progress/delete', 'POST', { uid, lessonId: '6-1-3', kind: 'sheet' }, T).catch(() => {});
    await jfetch('/api/teacher/roster/delete', 'POST', { uid }, T).catch(() => {});
  }
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
