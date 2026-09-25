// 第3课《算法设计》界面验收：无头 Edge 真开学生端任务单页，量出「36 列宽表横滑、兔的只数只读行、
// √/× 整行下拉、任务二流程图填空题、页面不横向溢出」，并在界面上真的保存一次再回读。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-6-1-3.js
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const LESSON = '6-1-3';
const CLA = '测试六年级';
const NAME = '界面自检' + Date.now().toString(36).slice(-4);
const PORT = 9500 + Math.floor(Math.random() * 400); // 每次换端口：上一次跑崩留下的 Edge 会占着老端口，害得新的一头连到旧页面上
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = process.env.OUT || path.join(__dirname, '_tmp', 'ui-6-1-3'); // 截图输出目录（人工复核用）

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } }
function cookie(res) { return (res.headers.get('set-cookie') || '').split(';')[0]; }
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { r, j, ck: cookie(r) };
}
let msgId = 0;
function mk(ws) {
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  return (method, params) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

(async () => {
  console.log('== 第3课《算法设计》界面验收 ==');

  // ---- 造一个干净的测试生，并先替他交一次任务单（教师端才有内容可看）----
  const t = await jfetch('/api/teacher/login', 'POST', { password: '123456' });
  const T = t.ck;
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + NAME }, T);
  const s = await jfetch('/api/student/login', 'POST', { name: NAME });
  const S = s.ck;
  ok(s.j.ok, '学生登录（' + NAME + ' → ' + (s.j.className || s.j.error || '?') + '）');
  await jfetch('/api/lesson/' + LESSON + '/sheet/submit', 'POST', {
    rows: [{ _i: 0, lab: '鸡的只数', c1: '35', c2: '34' }],
  }, S);

  // ---- 开无头 Edge ----
  const child = spawn(EDGE, [
    '--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_lq_ui_' + PORT),
    '--no-first-run', '--disable-gpu', '--window-size=520,1000', BASE + '/quiz.html',
  ], { detached: false, stdio: 'ignore' });
  // 无论怎么退出，都把整棵 Edge 进程树带走（留着会在老端口上装死，下次连上去就是旧页面）
  const killEdge = () => { try { require('child_process').execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', killEdge);

  let list = [];
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try {
      list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      if (list.some((x) => x.type === 'page' && x.url.startsWith(BASE))) break;
    } catch (e) {}
  }
  const page = list.find((x) => x.type === 'page' && x.url.startsWith(BASE));
  if (!page) { console.log('NO PAGE'); child.kill(); process.exitCode = 1; return; }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const send = mk(ws);
  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(900);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  // 等某个条件成立（页面渲染是异步的，固定 sleep 会时快时慢地翻车）
  const waitFor = async (expr, tries, ms) => {
    for (let i = 0; i < (tries || 30); i++) { if (await ev(expr)) return true; await sleep(ms || 300); }
    return false;
  };

  // 登录 → 六年级 → 第3课 → 课内任务单（每步都等渲染到位，不靠拍脑袋的 sleep）
  const ready = await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
  ok(ready, '学生端页面已加载');
  await ev(`(function(){var n=document.getElementById('loginName');if(!n)return 0;n.value=${JSON.stringify(NAME)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1;})()`);
  await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];if(t)t.click();return 1;})()`);
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('算法设计')>=0})`, 30, 300);
  const opened = await ev(`(function(){
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('算法设计')>=0})[0];
    if(!c) return 'no card｜err=' + (document.getElementById('loginErr')||{}).textContent + '｜tabs=' + [].slice.call(document.querySelectorAll('#gradeTabs .tab')).map(function(x){return x.textContent.trim()}).join(',');
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    if(!b) return 'no sheet btn:'+[].slice.call(c.querySelectorAll('button')).map(function(x){return x.textContent}).join('|');
    b.click(); return 'ok';})()`);
  ok(opened === 'ok', '从课程地图打开第3课课内任务单（' + opened + '）');
  const sheetUp = await waitFor(`!document.getElementById('view-sheet').hidden && !!document.querySelector('.sheet-flow .fc')`, 40, 300);
  ok(sheetUp, '课内任务单视图渲染完成');

  const f = await ev(`(function(){
    var q=function(x){return document.querySelector(x)};
    var o={};
    o.secs=document.querySelectorAll('#view-sheet .sheet-sec').length;
    var tbl=q('.sheet-table.sheet-wide'), sc=q('.sheet-scroll');
    o.wide=!!tbl; o.minW=tbl?tbl.style.minWidth:''; o.fixed=tbl?getComputedStyle(tbl).tableLayout:'';
    o.scrollW=sc?sc.scrollWidth:0; o.clientW=sc?sc.clientWidth:0;
    var gv=q('.sheet-given');
    o.givenN=gv?[].slice.call(gv.querySelectorAll('th,td')).map(function(c){return c.textContent.trim()}):null;
    o.givenCtl=gv?gv.querySelectorAll('input,select').length:-1;
    var rows=[].slice.call(document.querySelectorAll('#view-sheet table.sheet-table tbody tr'));
    o.fillRows=rows.filter(function(r){return r.querySelector('input,select')}).length;
    var pick=rows[rows.length-1], ss=pick?[].slice.call(pick.querySelectorAll('select')):[];
    o.pickN=ss.length;
    o.pickOpts=ss.length?[].slice.call(ss[0].options).map(function(x){return x.value}).join(','):'';
    o.pickUniq=ss.length?[].slice.call(ss[0].options).slice(1).map(function(x){return x.textContent}).sort().join(''):'';
    o.inputs=document.querySelectorAll('#view-sheet table.sheet-table input').length;
    var fl=q('.sheet-flow'), fc=fl?fl.querySelector('.fc'):null;
    o.flow=!!fl; o.cw=fc?fc.dataset.cw:''; o.ch=fc?fc.dataset.ch:'';
    var svg=fl?fl.querySelector('svg.fc-edges'):null;
    o.svg=!!svg; o.edges=svg?svg.querySelectorAll('path[marker-end]').length:0;
    o.paths=svg?[].slice.call(svg.querySelectorAll('path[marker-end]')).map(function(p){return p.getAttribute('d')}):[];
    o.nodes=fl?fl.querySelectorAll('.fc-node').length:0;
    o.term=fl?fl.querySelectorAll('.fc-shape-term').length:0;
    o.proc=fl?fl.querySelectorAll('.fc-shape-proc').length:0;
    o.dia=fl?fl.querySelectorAll('.fc-shape-diamond').length:0;
    o.io=fl?fl.querySelectorAll('.fc-shape-io').length:0;
    var fs=fl?[].slice.call(fl.querySelectorAll('select')):[];
    o.flowSel=fs.length; o.flowOptCounts=fs.map(function(x){return x.options.length}).join(',');
    o.flowPh=fs.length?fs[0].options[0].value==='':-1;             // 首项应为空占位「请选…」
    o.flowWords=fs.length?[].slice.call(fs[0].options).slice(1).map(function(x){return x.value}).join(' | '):'';
    o.docW=document.documentElement.scrollWidth; o.winW=window.innerWidth;
    return o;})()`);

  ok(f.secs === 2, '任务单 2 个板块（任务一、任务二）（实际 ' + f.secs + '）');
  ok(f.wide === true && f.fixed === 'fixed', '任务一用宽表（table-layout: fixed）');
  ok(f.minW === (126 + 36 * 58) + 'px', '36 列最小宽度 ' + (126 + 36 * 58) + 'px（实际 ' + f.minW + '）');
  ok(f.scrollW > f.clientW + 1000, '宽表在自己的容器里横滑（scrollWidth ' + f.scrollW + ' > clientWidth ' + f.clientW + '）');
  ok(f.docW <= f.winW + 2, '页面本身不横向溢出（doc ' + f.docW + ' ≤ win ' + f.winW + '）');
  ok(Array.isArray(f.givenN) && f.givenN[0] === '兔的只数' && f.givenN[1] === '0' && f.givenN[f.givenN.length - 1] === '35', '兔的只数只读行印好 0~35（首 ' + (f.givenN || []).slice(0, 2) + ' 末 ' + (f.givenN || []).slice(-1) + '）');
  ok(f.givenCtl === 0, '只读行里没有输入框/下拉（实际 ' + f.givenCtl + ' 个控件）');
  ok(f.fillRows === 3 && f.pickN === 36, '3 个可填行，其中 √/× 行 36 个下拉（实际 ' + f.fillRows + ' 行 / ' + f.pickN + ' 个）');
  ok(f.pickOpts === ',√,×' || f.pickOpts === ',×,√', '下拉首项空占位 + 只给 √ ×（词序随机，实际 ' + JSON.stringify(f.pickOpts) + '）');
  ok(f.flow === true && f.cw === '880' && f.ch === '800', '任务二流程图板块已渲染（画布 ' + f.cw + '×' + f.ch + '）');
  ok(f.nodes === 8 && f.term === 2 && f.proc === 3 && f.dia === 2 && f.io === 1, '8 个图形＝起止2 + 处理3 + 判断2 + 输入输出1（实际 ' + f.nodes + '：' + f.term + '/' + f.proc + '/' + f.dia + '/' + f.io + '）');
  ok(f.edges === 9, '9 条流程线（实际 ' + f.edges + '）');
  const bent = (f.paths || []).every((d) => /^(M-?[\d.]+ -?[\d.]+)( L-?[\d.]+ -?[\d.]+)+$/.test(d));
  ok(bent, '流程线全是直线段（只含 M/L 折线，无曲线命令）');
  ok(f.flowSel === 4 && f.flowOptCounts === '5,5,5,5' && f.flowPh === true, '流程图 4 个空、每空 4 个候选词 + 1 个空占位（实际 ' + f.flowSel + ' 空 [' + f.flowOptCounts + '] 占位=' + f.flowPh + '）');
  ok((f.flowWords || '').split(' | ').length === 4, '第 1 个空的候选词 4 个：' + f.flowWords);

  // ---- 界面上真填一次并保存，再从接口回读 ----
  const filled = await ev(`(function(){
    var rows=[].slice.call(document.querySelectorAll('#view-sheet table.sheet-table tbody tr'));
    var r0=rows.filter(function(r){return r.dataset.rowi==='0'})[0] || rows.filter(function(r){return r.querySelector('input')})[0];
    var inp=r0?r0.querySelector('input'):null; if(inp){inp.value='UI36';inp.dispatchEvent(new Event('input',{bubbles:true}));}
    var sel=document.querySelector('.sheet-flow select'); if(sel){sel.selectedIndex=1;sel.dispatchEvent(new Event('change',{bubbles:true}));}
    document.getElementById('sheetSaveBtn').click(); return (inp?1:0)+(sel?2:0);})()`);
  ok(filled === 3, '界面上填了表格第 1 格 + 流程图第 1 空（填到 ' + filled + '/3）');
  await waitFor(`/已保存/.test(document.getElementById('sheetNote').textContent)`, 30, 300);
  const note = await ev(`document.getElementById('sheetNote').textContent`);
  ok(/已保存/.test(String(note)), '界面保存成功提示（' + note + '）');
  const back = (await jfetch('/api/lesson/' + LESSON + '/sheet', 'GET', null, S)).j;
  const r0 = (back.prev || []).find((x) => x._i === 0);
  const fr = (back.prev || []).find((x) => x._i === 3);
  ok(r0 && r0.c1 === 'UI36', '表格第 1 行所填回读成功（c1=' + (r0 && r0.c1) + '）');
  ok(fr && Object.keys(fr).filter((k) => k !== '_i' && fr[k]).length === 1, '流程图所填回读成功（' + JSON.stringify(fr) + '）');

  // ---- 留两张图，便于人工复核（学生端任务一/任务二）----
  fs.mkdirSync(OUT, { recursive: true });
  const shot = async (sel, file) => {
    const box = await ev(`(function(){var n=document.querySelector(${JSON.stringify(sel)});if(!n)return null;var r=n.getBoundingClientRect();return {x:r.x+window.scrollX,y:r.y+window.scrollY,width:Math.min(r.width,1400),height:r.height};})()`);
    if (!box || box.width < 5 || box.height < 5) { console.log('  （截图跳过：' + sel + ' 不可见）'); return; }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 } });
    if (!r.result || !r.result.data) { console.log('  （截图失败：' + sel + '）'); return; }
    fs.writeFileSync(path.join(OUT, file), Buffer.from(r.result.data, 'base64'));
    console.log('  📷 ' + file + '  ' + Math.round(box.width) + '×' + Math.round(box.height));
  };
  await shot('#view-sheet .sheet-sec', '任务一-枚举表.png');
  await shot('.sheet-flow', '任务二-流程图.png');

  // ---- 教师端：赋分台 → 展开该生 → 看流程图是否画回来 ----
  // 老师是在电脑（宽屏）上批的，换上 1440×900 再看，顺便量一下 36 列会不会顶破页面
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + '/teacher' });
  // readyState=complete 才说明页面脚本跑完了、登录按钮挂上了 onclick；只等元素出现会点到「哑」按钮
  await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
  await ev(`(function(){var n=document.getElementById('pw');if(!n)return 0;n.value='123456';document.getElementById('loginGo').click();return 1;})()`);
  // 页签在 HTML 里本来就在，只是登录后才挂上 onclick——得等 #admin 真的显示出来再点
  const tIn = await waitFor(`!document.getElementById('admin').hidden`, 40, 300);
  ok(tIn, '教师端登录成功');
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('.tab[data-tab]')).filter(function(x){return x.textContent.indexOf('各课完成情况')>=0})[0];if(t)t.click();return 1;})()`);
  const ovUp = await waitFor(`[].slice.call(document.querySelectorAll('#tabBody tr')).some(function(x){return x.textContent.indexOf('第3课 算法设计')>=0})`, 40, 300);
  if (!ovUp) console.log('  ℹ 各课完成情况没出来：' + String(await ev(`(document.getElementById('loginErr')||{}).textContent + '｜' + String((document.getElementById('tabBody')||{}).textContent).slice(0,120)`)));
  const tOpen = await ev(`(function(){
    var tr=[].slice.call(document.querySelectorAll('#tabBody tr')).filter(function(x){return x.textContent.indexOf('第3课 算法设计')>=0})[0];
    if(!tr) return 'no row';
    var b=[].slice.call(tr.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    if(!b) return 'no btn';
    b.click(); return 'ok';})()`);
  ok(tOpen === 'ok', '教师端打开第3课课内任务单赋分台（' + tOpen + '）');
  await waitFor(`document.querySelectorAll('#tabBody .cls-chip').length>0`, 40, 300);
  const tCls = await ev(`(function(){
    var c=[].slice.call(document.querySelectorAll('#tabBody .cls-chip')).filter(function(x){return x.textContent.trim().indexOf(${JSON.stringify(CLA)})===0})[0];
    if(!c) return 'chips=' + [].slice.call(document.querySelectorAll('#tabBody .cls-chip')).map(function(x){return x.textContent.trim()}).join('|');
    c.click(); return 'ok';})()`);
  ok(tCls === 'ok', '切到班级 ' + CLA + '（' + tCls + '）');
  await waitFor(`[].slice.call(document.querySelectorAll('#tabBody tr')).some(function(x){return x.textContent.indexOf(${JSON.stringify(NAME)})>=0})`, 40, 300);
  const tView = await ev(`(function(){
    var tr=[].slice.call(document.querySelectorAll('#tabBody tr')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(NAME)})>=0})[0];
    if(!tr) return 'no stu tr';
    var b=[].slice.call(tr.querySelectorAll('button')).filter(function(x){return x.textContent.trim()==='查看'})[0];
    if(!b) return 'no view btn';
    b.click(); return 'ok';})()`);
  ok(tView === 'ok', '展开该生提交内容（' + tView + '）');
  await waitFor(`!!document.querySelector('#tabBody .sheet-detail .sheet-flow .fc')`, 40, 300);
  const td = await ev(`(function(){
    var tr=[].slice.call(document.querySelectorAll('#tabBody tr')).filter(function(x){return x.querySelector('td')&&x.textContent.indexOf(${JSON.stringify(NAME)})===0})[0];
    var d=tr?tr.nextElementSibling:null; d=d?d.querySelector('.sheet-detail'):null; if(!d) return null;
    var o={};
    o.txt=d.textContent.slice(0,80);
    o.tbl=d.querySelectorAll('table').length;
    o.secHead=[].slice.call(d.querySelectorAll('.sheet-sec-head')).map(function(x){return x.textContent.trim()});
    var fl=d.querySelector('.sheet-flow');
    o.flow=!!fl; o.nodes=fl?fl.querySelectorAll('.fc-node').length:0;
    o.edges=fl?fl.querySelectorAll('svg.fc-edges path[marker-end]').length:0;
    var ss=fl?[].slice.call(fl.querySelectorAll('select')):[];
    o.selN=ss.length; o.selVal=ss.map(function(x){return x.value}).join('|');
    o.docW=document.documentElement.scrollWidth; o.winW=window.innerWidth;
    var tb=d.querySelector('table'); var th=tb?tb.querySelector('th'):null;
    o.tblW=tb?Math.round(tb.getBoundingClientRect().width):0;
    o.thW=th?Math.round(th.getBoundingClientRect().width):0;
    var sc=d.querySelector('.sheet-detail-scroll');
    o.sc=!!sc; o.scW=sc?sc.clientWidth:0; o.scContent=sc?sc.scrollWidth:0;
    o.cellW=tb&&tb.querySelectorAll('td')[12]?Math.round(tb.querySelectorAll('td')[12].getBoundingClientRect().width):0;
    o.cellTxt=tb&&tb.querySelectorAll('td')[12]?tb.querySelectorAll('td')[12].textContent:'';
    return o;})()`);
  ok(!!td && td.tbl === 1, '教师端看到学生的表格（' + (td && td.tbl) + ' 张表）');
  ok(!!td && td.secHead.length === 2, '教师端 2 个板块标题：' + (td ? td.secHead.join(' / ') : ''));
  ok(!!td && td.flow === true && td.nodes === 8 && td.edges === 9, '教师端把流程图按学生所填画回来（' + (td && td.nodes) + ' 图形 / ' + (td && td.edges) + ' 条线）');
  ok(!!td && td.selN === 4 && td.selVal.split('|').filter((x) => x).length === 1, '教师端流程图里印着学生选的词（' + (td && td.selVal) + '）');
  ok(!!td && td.docW <= td.winW + 2, '教师端页面不横向溢出（doc ' + (td && td.docW) + ' ≤ win ' + (td && td.winW) + '）');
  console.log('  ℹ 教师端明细表宽 ' + (td && td.tblW) + 'px，首列 ' + (td && td.thW) + 'px，数据列 ' + (td && td.cellW) + 'px，横滑盒 ' + (td && td.scW) + '/' + (td && td.scContent) + '（1440 宽屏）');
  // 全站正文是 880px 窄栏（.wrap max-width:880px），36 列注定放不下——要求是「在这块里横滑」而不是撑破页面
  ok(!!td && td.sc === true && td.scContent > td.scW, '教师端 36 列在自己的盒子里横滑（' + (td && td.scW) + ' 视口 / ' + (td && td.scContent) + ' 内容）');
  ok(!!td && td.cellW >= 30, '教师端数据列宽 ' + (td && td.cellW) + 'px，数字不会被截断');
  await shot('#tabBody .sheet-detail', '教师端-赋分台展开.png');


  // ---- 教师端：赋分台里看这个学生的流程图 ----
  const board = (await jfetch('/api/teacher/sheet-board/' + LESSON + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const me = (board.students || []).find((x) => x.uid === NAME + '｜' + CLA);
  ok(!!me && me.submitted && me.rows.length === 2, '教师端拿到该生所交 2 行');

  ws.close();
  killEdge();
  await sleep(300);

  // 清理
  await jfetch('/api/teacher/progress/delete', 'POST', { uid: NAME + '｜' + CLA, lessonId: LESSON, kind: 'sheet' }, T);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: NAME + '｜' + CLA }, T);
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
