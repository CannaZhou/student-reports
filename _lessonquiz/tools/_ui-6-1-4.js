// 第4课《算法的程序体验》课内任务单界面自检：
// 六个板块出得来、程序代码块按行显示不乱、灰底 preset 格（头 35 / 脚 94）填好且不算“学生填过”
// （空手点保存 → 提示“请先至少填一行内容”，不能算已交）、连线下拉各 4 个选项、窄屏不撑破页面。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-6-1-4.js
const { spawn, execSync } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const CLA = '测试六年级';
const TAG = Date.now().toString(36).slice(-4);
const ME = '甲生' + TAG, B = '乙生' + TAG;
const PORT = 9600 + Math.floor(Math.random() * 300);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return { j: await r.json().catch(() => ({})), ck: cookie(r), status: r.status };
}
let msgId = 0;
function mk(ws) {
  const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
  return (m, q) => new Promise((res) => { const id = ++msgId; p.set(id, res); ws.send(JSON.stringify({ id, method: m, params: q || {} })); });
}

(async () => {
  console.log('== 第4课 任务单界面自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  await jfetch('/api/teacher/roster', 'POST', { text: [ME, B].map((n) => CLA + '，' + n).join('\n') }, T);
  // 乙交过本课任务单，用来验证左栏名单（与 _ui-mates 同一口径）
  const SB = (await jfetch('/api/student/login', 'POST', { name: B })).ck;
  await jfetch('/api/lesson/6-1-4/sheet/submit', 'POST', { rows: [{ _i: 0, prog: '计算器', func: '算数', feel: '很快' }] }, SB);

  const S = (await jfetch('/api/student/login', 'POST', { name: ME })).ck;

  const child = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_l4_' + PORT),
    '--no-first-run', '--disable-gpu', '--window-size=1280,960', BASE + '/quiz.html'], { stdio: 'ignore' });
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
    // 固定/粘性定位的元素（底部保存条、toast）在 captureBeyondViewport 的整页截图里会飘到页面中间，
    // 正好盖住要拍的内容（代码块的头两行就被这样盖掉过）。截图期间先把它们藏起来。
    // 注意用 querySelectorAll：#view-quiz 里也有一个 .submit-bar，它在 DOM 里排在前面，
    // 只取第一个会藏错人，任务单那条照样盖在代码块上。
    await ev(`(function(){[].slice.call(document.querySelectorAll('.submit-bar, .toast')).forEach(function(n){
      n.dataset.sh=1; n.style.visibility='hidden';}); return 1;})()`);
    const box = await ev(`(function(){var n=${expr};if(!n)return null;var r=n.getBoundingClientRect();return {x:r.x+window.scrollX,y:r.y+window.scrollY,width:r.width,height:r.height};})()`);
    if (!box || box.width < 5) { console.log('  （截图跳过）'); return; }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 } });
    await ev(`(function(){[].slice.call(document.querySelectorAll('[data-sh]')).forEach(function(n){n.style.visibility='';delete n.dataset.sh;});return 1;})()`);
    if (!r.result || !r.result.data) return console.log('  （截图失败）');
    const OUT = process.env.OUT || path.join(__dirname, '_tmp');
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, file), Buffer.from(r.result.data, 'base64'));
    console.log('  📷 ' + file);
  };
  const openSheet = `(function(){
    var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];
    if(t)t.click();
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('算法的程序体验')>=0})[0];
    if(!c) return 0;
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    if(!b) return 0; b.click(); return 1;})()`;

  await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
  await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(ME)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1;})()`);
  await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
  ok(await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('算法的程序体验')>=0})`, 30, 300)
    || (await ev(openSheet)) === 1, '课程地图上能看到「第4课 算法的程序体验」');
  await ev(openSheet);
  const up = await waitFor(`!document.getElementById('view-sheet').hidden && document.querySelectorAll('#sheetBody .sheet-sec').length===6`, 40, 300);
  ok(up, '任务单页出来了，共 6 个板块');

  // ---- 程序代码块 ----
  const c = await ev(`(function(){
    var p=document.querySelector('#sheetBody .sheet-code'); if(!p) return null;
    var cs=getComputedStyle(p);
    return { text:p.textContent, lines:p.textContent.split('\\n').length,
             font:cs.fontFamily, white:cs.whiteSpace, scrollW:p.scrollWidth, clientW:p.clientWidth,
             bg:cs.backgroundColor, borderL:cs.borderLeftWidth };})()`);
  ok(!!c, '任务二里出现了程序代码块');
  ok(c && c.lines === 6, '代码按 6 行显示（实际 ' + (c && c.lines) + ' 行）');
  ok(c && c.white === 'pre' && /Consolas|monospace|Courier/i.test(c.font), '代码块用等宽字体、保留换行缩进');
  ok(c && /print\(ji, "只鸡", tu, "只兔"\)/.test(c.text), '屏幕上能看到完整的 print 语句');
  ok(c && c.borderL !== '0px', '代码块左侧有绿色色条，一眼认出是程序');
  console.log('  ℹ 代码块：' + (c ? c.scrollW + '/' + c.clientW + 'px，' + c.lines + ' 行' : '—'));

  // ---- 六个板块的表头对得上 ----
  const heads = await ev(`[].slice.call(document.querySelectorAll('#sheetBody .sheet-sec-head')).map(function(x){return x.textContent})`);
  ok(heads.length === 6 && /学习任务一/.test(heads[0]) && /学习任务二/.test(heads[1]) && /学习任务三/.test(heads[4]),
    '板块标题＝任务一 / 任务二×3 / 任务三×2');

  // ---- 灰底 preset 格：头 35、脚 94 已经填好 ----
  const pre = await ev(`(function(){
    var out=[];
    [].slice.call(document.querySelectorAll('#sheetBody td.sheet-pre')).forEach(function(td){
      var i=td.querySelector('input');
      out.push({ col:i.dataset.col, val:i.value, pre:i.dataset.pre,
                 bg:getComputedStyle(i).backgroundColor, color:getComputedStyle(i).color });
    });
    return out;})()`);
  ok(pre.length === 4, '两张表各有「头/脚」两格灰底（共 4 格，实际 ' + pre.length + '）');
  const byCol = (k) => pre.filter((x) => x.col === k);
  ok(byCol('tou').every((x) => x.val === '35') && byCol('jiao').every((x) => x.val === '94'),
    '灰底格已经填好头 35、脚 94（学生不用再抄一遍）');
  ok(pre.length && pre[0].pre === '1' && /^rgb\(241, 243, 244\)$/.test(pre[0].bg), '灰底格有专门底色（' + (pre[0] || {}).bg + '）');
  ok(pre.every((x) => x.color !== 'rgb(36, 51, 42)'), '灰底格的文字是浅色，和可填格区分得开');

  // ---- 关键：只带着 preset 空手点保存，不能算已交 ----
  const before = await ev(`document.querySelector('.side-count') ? document.querySelector('.side-count').textContent : ''`);
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  await waitFor(`!!document.querySelector('.toast') && document.querySelector('.toast').textContent.length>0`, 20, 200);
  const tmsg = await ev(`document.querySelector('.toast') ? document.querySelector('.toast').textContent : ''`);
  ok(/至少填一行/.test(tmsg), '空手点保存 → 提示「' + tmsg + '」');
  const st = (await jfetch('/api/lesson/6-1-4/sheet', 'GET', null, S)).j;
  const meMate = (st.mates.list || []).find((r) => r.me);
  ok(meMate && meMate.done === false, '空手保存没有产生提交记录（自己那格仍是未交）');
  ok(!st.prev || st.prev.length === 0, '灰底格没有被当成“学生填过”的内容存下来');
  const after = await ev(`document.querySelector('.side-count').textContent`);
  ok(after === before, '左栏「已交」计数没变（' + before + ' → ' + after + '）');

  // ---- 连线下拉：各 4 个选项、选项被打乱 ----
  const sels = await ev(`(function(){
    var out=[];
    [].slice.call(document.querySelectorAll('#sheetBody select.sheet-pick')).forEach(function(s){
      out.push({ col:s.dataset.col, opts:[].slice.call(s.options).filter(function(o){return o.value}).map(function(o){return o.value}) });
    });
    return out;})()`);
  ok(sels.length === 8, '连线一共 8 个下拉框（运算符 4 + 比较运算符 4，实际 ' + sels.length + '）');
  const set = (a) => a.slice().sort().join(',');
  const sym = sels.filter((x) => x.col === 'py'), mean = sels.filter((x) => x.col === 'mean');
  ok(sym.length === 4 && sym.every((x) => set(x.opts) === '*,+,-,/'), '运算符下拉＝+ - * /（顺序打乱）');
  ok(mean.length === 4 && mean.every((x) => set(x.opts) === '不等于,大于,小于,等于'), '比较运算符下拉＝等于/不等于/大于/小于');
  // 选项每次渲染都打乱：4 个下拉的顺序全撞成一样的概率约 1/24³，可以稳稳当当地测
  const orders = sym.map((x) => x.opts.join('|'));
  ok(new Set(orders).size > 1, '4 个运算符下拉的选项顺序不都一样（每次渲染都打乱，学生没法靠位置蒙）');
  ok(await ev(`[].slice.call(document.querySelectorAll('#sheetBody .sheet-rowlabel')).map(function(x){return x.textContent}).join('|')==='＋ （加）|－ （减）|× （乘）|÷ （除）|==|!=|>|<'`),
    '行标签＝加减乘除 + == != > <');
  // 每个板块都要有能填的格子（「1 列 + 行标签」会让标签把唯一一列占掉，学生一个框都看不到）
  const secFields = await ev(`[].slice.call(document.querySelectorAll('#sheetBody .sheet-sec')).map(function(s){
    return s.querySelectorAll('input.sheet-cell, select.sheet-pick').length;})`);
  ok(secFields.length === 6 && secFields.every((n) => n > 0), '6 个板块都有可填的格子（' + secFields.join('/') + '）');
  ok(await ev(`[].slice.call(document.querySelectorAll('#sheetBody .sheet-sec'))[2].querySelectorAll('input.sheet-cell').length === 2`),
    '手工算式板块：兔、鸡各有一个填写框');
  // 截图前把 toast 摘掉：fixed 定位的元素在 captureBeyondViewport 的整页截图里会飘到中间，
  // 正好盖住代码块的头两行（虚惊一场，跟功能无关）
  await ev(`(function(){var t=document.querySelector('.toast'); if(t) t.remove(); return 1;})()`);
  await shot(`document.querySelectorAll('#sheetBody .sheet-sec')[1]`, '第4课-程序代码块与输出表.png');
  await shot(`document.querySelectorAll('#sheetBody .sheet-sec')[4]`, '第4课-符号连线.png');

  // ---- 真填一行 → 能保存、自己变绿、灰底值跟着存下来 ----
  const sv = await ev(`(function(){
    var trs=[].slice.call(document.querySelectorAll('#sheetBody table.sheet-table tbody tr'));
    var tr=trs.filter(function(x){return !x.classList.contains('sheet-given') && !x.classList.contains('sheet-example') && x.querySelector('input[data-col]:not([data-pre])')})[0];
    if(!tr) return 'no fillable row';
    tr.querySelectorAll('input').forEach(function(i){ if(!i.dataset.pre){ i.value='计算器'; i.dispatchEvent(new Event('input',{bubbles:true})); } });
    // 顺手把「程序输出」表的鸡/兔填对，验证预设值 + 学生值一起存
    var tr2=trs.filter(function(x){return [].slice.call(x.querySelectorAll('input[data-col]')).some(function(i){return i.dataset.col==='ji'})})[0];
    if(tr2) tr2.querySelectorAll('input').forEach(function(i){
      if(i.dataset.col==='ji'){i.value='23';i.dispatchEvent(new Event('input',{bubbles:true}));}
      if(i.dataset.col==='tu'){i.value='12';i.dispatchEvent(new Event('input',{bubbles:true}));}
    });
    document.getElementById('sheetSaveBtn').click(); return 'ok';})()`);
  await waitFor(`!document.getElementById('sheetSaveBtn').disabled`, 40, 300);
  const st2 = (await jfetch('/api/lesson/6-1-4/sheet', 'GET', null, S)).j;
  ok(sv === 'ok' && st2.mates && (st2.mates.list || []).find((r) => r.me).done === true, '填了内容后保存成功，自己那格变已交');
  const rowOut = (st2.prev || []).find((r) => r.ji === '23');
  ok(rowOut && rowOut.tou === '35' && rowOut.jiao === '94', '保存的内容里，灰底的头 35、脚 94 和学生填的鸡 23、兔 12 在一起');
  // 用「相对」判断，别写死人数：这份名单是隔离测试库里累积出来的，绝对数会随重跑变化
  ok(st2.mates.submitted === st.mates.submitted + 1 && st2.mates.total === st.mates.total,
    '左栏「已交」正好 +1（' + st.mates.submitted + ' → ' + st2.mates.submitted + '），总人数不变（' + st2.mates.total + '）');
  await shot(`document.querySelector('.sheet-layout')`, '第4课-任务单全貌.png');

  // ---- 窄屏（800px）不撑破整页 ----
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  const n8 = await ev(`(function(){var p=document.querySelector('#sheetBody .sheet-code');
    return { docW:document.documentElement.scrollWidth, winW:window.innerWidth,
             codeScroll:p?p.scrollWidth:0, codeVis:p?Math.round(p.getBoundingClientRect().width):0 };})()`);
  ok(n8.docW <= n8.winW + 2, '窄屏下页面不横向溢出（' + n8.docW + ' ≤ ' + n8.winW + '）');
  ok(n8.codeScroll > 0 && n8.codeVis > 0 && n8.codeVis <= n8.winW, '代码块窄屏下在块内横滑，不顶破页面（' + n8.codeScroll + ' / 可见 ' + n8.codeVis + '）');
  await shot(`document.querySelectorAll('#sheetBody .sheet-sec')[1]`, '第4课-窄屏代码块.png');
  await send('Emulation.clearDeviceMetricsOverride');

  ws.close(); kill(); await sleep(300);
  for (const nm of [ME, B]) {
    const uid = nm + '｜' + CLA;
    await jfetch('/api/teacher/progress/delete', 'POST', { uid, lessonId: '6-1-4', kind: 'sheet' }, T).catch(() => {});
    await jfetch('/api/teacher/roster/delete', 'POST', { uid }, T).catch(() => {});
  }
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
