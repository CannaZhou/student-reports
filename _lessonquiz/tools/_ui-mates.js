// 学生端「课内任务单」页左侧本班名单自检：口径=这一课任务单交没交，红未交/绿已交，
// 只给姓名不给分数，自己那行标「我」，保存后自己当场变绿；不在任务单页时不显示。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-mates.js
const { spawn, execSync } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const CLA = '测试六年级';
const TAG = Date.now().toString(36).slice(-4);
const ME = '甲生' + TAG, B = '乙生' + TAG, C = '丙生' + TAG;
const PORT = 9600 + Math.floor(Math.random() * 300);
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
  console.log('== 任务单页·本班名单自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  await jfetch('/api/teacher/roster', 'POST', { text: [ME, B, C].map((n) => CLA + '，' + n).join('\n') }, T);

  // 乙交了这一课的任务单（应显示绿色），丙没交，甲（当前登录者）也没交
  const SB = (await jfetch('/api/student/login', 'POST', { name: B })).ck;
  await jfetch('/api/lesson/6-1-3/sheet/submit', 'POST', { rows: [{ _i: 0, lab: '鸡的只数', c1: '35' }] }, SB);
  // 丙交的是「另一课」的任务单——不该让本课变绿（口径检查）
  await jfetch('/api/lesson/6-1-1/sheet/submit', 'POST', { rows: [{ _i: 0, c1: 'X' }] }, (await jfetch('/api/student/login', 'POST', { name: C })).ck);

  const S = (await jfetch('/api/student/login', 'POST', { name: ME })).ck;
  const sheet = (await jfetch('/api/lesson/6-1-3/sheet', 'GET', null, S)).j;
  const m = sheet.mates;
  ok(!!m && Array.isArray(m.list), '任务单接口带回了本班名单');
  ok(m.clsName === CLA && m.total === 3, '班级＝' + m.clsName + '，3 人（实际 ' + m.total + '）');
  const g = (n) => (m.list || []).find((r) => r.name === n) || {};
  ok(g(B).done === true, '乙（交过本课）＝已交');
  ok(g(C).done === false, '丙（只交了别的课）＝未交，口径是「这一课」不是「任意一课」');
  ok(g(ME).me === true && g(B).me === false, '只有自己那行 me=true');
  ok(m.submitted === 1, '已交人数 1（实际 ' + m.submitted + '）');
  ok(!JSON.stringify(m).match(/score|mark|rows|answer/i), '名单里没有分数、也没有别人填的内容');

  const child = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_mt_' + PORT),
    '--no-first-run', '--disable-gpu', '--window-size=1280,940', BASE + '/quiz.html'], { stdio: 'ignore' });
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
    if (!box || box.width < 5) { console.log('  （截图跳过）'); return; }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 } });
    if (!r.result || !r.result.data) return console.log('  （截图失败）');
    const OUT = process.env.OUT || path.join(__dirname, '_tmp');
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, file), Buffer.from(r.result.data, 'base64'));
    console.log('  📷 ' + file);
  };

  await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
  await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(ME)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1;})()`);
  await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);

  ok(await ev(`document.getElementById('sheetSide').hidden === true || document.getElementById('view-sheet').hidden`), '课程地图页看不到名单栏');
  const wrapMap = await ev(`document.querySelector('.wrap').className`);

  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];if(t)t.click();return 1;})()`);
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('算法设计')>=0})`, 30, 300);
  await ev(`(function(){
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('算法设计')>=0})[0];
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    b.click(); return 1;})()`);
  const up = await waitFor(`!document.getElementById('view-sheet').hidden && !document.getElementById('sheetSide').hidden && document.querySelectorAll('.mate').length===3`, 40, 300);
  ok(up, '打开任务单后左侧名单出现了（3 人）');

  const probe = `(function(){
    var side=document.getElementById('sheetSide'); if(!side) return null;
    var c=side.querySelector('.side-card'); if(!c) return null;
    var out=[];
    [].slice.call(side.querySelectorAll('.mate')).forEach(function(li){
      var d=li.querySelector('.dot');
      out.push({name:li.querySelector('.mate-name').textContent, cls:li.className, me:!!li.querySelector('.mate-me'),
                dotBg:getComputedStyle(d).backgroundColor, nameColor:getComputedStyle(li.querySelector('.mate-name')).color});
    });
    return { cls:c.querySelector('.side-cls').textContent, hint:c.querySelector('.side-hint').textContent,
             count:c.querySelector('.side-count').textContent, rows:out,
             sideLeft:Math.round(side.getBoundingClientRect().left),
             mainLeft:Math.round(document.querySelector('.sheet-main').getBoundingClientRect().left),
             docW:document.documentElement.scrollWidth, winW:window.innerWidth,
             wrapCls:document.querySelector('.wrap').className };})()`;
  let p = await ev(probe);
  const r = (n) => (p.rows || []).find((x) => x.name === n) || {};
  ok(p.cls === CLA, '左栏标题＝班级名（' + p.cls + '）');
  ok(/红色＝未提交/.test(p.hint) && /绿色＝已提交/.test(p.hint), '顶部提示两种颜色都写清楚了');
  ok(p.count === '已交 1 / 3 人', '进度「' + p.count + '」');
  ok(r(B).cls.indexOf('done') >= 0 && /^rgb\(47, 158, 68\)$/.test(r(B).dotBg), '乙（已交）圆点是绿的（' + r(B).dotBg + '）');
  ok(r(C).cls.indexOf('todo') >= 0 && /^rgb\(224, 49, 49\)$/.test(r(C).dotBg), '丙（未交）圆点是红的（' + r(C).dotBg + '）');
  ok(r(ME).me === true && r(ME).cls.indexOf('todo') >= 0, '自己在名单里且标了「我」（当前未交＝红）');
  ok(p.sideLeft < p.mainLeft, '名单栏在页面左侧（' + p.sideLeft + ' < ' + p.mainLeft + '）');
  ok(p.wrapCls.indexOf('wide') >= 0, '任务单页整页放宽了（' + p.wrapCls + '）');
  ok(p.docW <= p.winW + 2, '任务单页不横向溢出（' + p.docW + ' ≤ ' + p.winW + '）');
  await shot(`document.querySelector('.sheet-layout')`, '任务单-左侧名单.png');

  // ---- 保存后自己当场变绿 ----
  // 挑一行「学生真能填」的：只读的 sheet-given / 示例行没有输入框，第一行往往是它们
  const sv = await ev(`(function(){
    var trs=[].slice.call(document.querySelectorAll('#sheetBody table.sheet-table tbody tr'));
    var tr=trs.filter(function(x){
      return !x.classList.contains('sheet-given') && !x.classList.contains('sheet-example') && x.querySelector('input[data-col]');
    })[0];
    if(!tr) return 'no fillable row';
    var inp=tr.querySelector('input[data-col]');
    inp.value='35'; inp.dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('sheetSaveBtn').click(); return 'ok';})()`);
  await waitFor(`(function(){
    var li=[].slice.call(document.querySelectorAll('.mate')).filter(function(x){return x.classList.contains('me')})[0];
    return li && li.classList.contains('done');})()`, 40, 300);
  p = await ev(probe);
  ok(sv === 'ok' && r(ME).cls.indexOf('done') >= 0, '保存后自己那行当场变绿（不用重开页面）');
  ok(p.count === '已交 2 / 3 人', '进度同步更新为「' + p.count + '」');
  await shot(`document.querySelector('.sheet-layout')`, '任务单-保存后自己变绿.png');

  // ---- 回课程地图：名单栏收起、整页恢复单列 ----
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('#sheetHeader button')).filter(function(x){return x.textContent.indexOf('返回')>=0})[0];if(b)b.click();return 1;})()`);
  await waitFor(`!document.getElementById('view-map').hidden`, 30, 300);
  await sleep(300);
  const back = await ev(`({wide:document.querySelector('.wrap').className, sheetHidden:document.getElementById('view-sheet').hidden, docW:document.documentElement.scrollWidth, winW:window.innerWidth})`);
  ok(back.wide === wrapMap && back.sheetHidden === true, '返回课程地图后名单栏收起、整页恢复单列（' + back.wide + '）');
  ok(back.docW <= back.winW + 2, '课程地图页不横向溢出（' + back.docW + ' ≤ ' + back.winW + '）');

  // ---- 窄屏（平板竖屏 800px）：名单栏换到正文上方，不挤坏版面 ----
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];if(t)t.click();return 1;})()`);
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('算法设计')>=0})`, 30, 300);
  await ev(`(function(){
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('算法设计')>=0})[0];
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    b.click(); return 1;})()`);
  await waitFor(`!document.getElementById('view-sheet').hidden && !document.getElementById('sheetSide').hidden`, 40, 300);
  await sleep(500);
  const n8 = await ev(`(function(){var s=document.getElementById('sheetSide'),mn=document.querySelector('.sheet-main');
    var sc=document.querySelector('#sheetBody .sheet-scroll');
    var tb=sc?sc.querySelector('table'):null;
    var fc=document.querySelector('#sheetBody .fc-scroll .fc');
    return {sideTop:Math.round(s.getBoundingClientRect().top), mainTop:Math.round(mn.getBoundingClientRect().top),
            sideW:Math.round(s.getBoundingClientRect().width), winW:window.innerWidth,
            docW:document.documentElement.scrollWidth,
            scrollW:sc?Math.round(sc.getBoundingClientRect().width):0,
            tableW:tb?Math.round(tb.getBoundingClientRect().width):0,
            flowVis:fc?Math.round(fc.getBoundingClientRect().width):0,
            flowWrap:fc?Math.round(fc.parentElement.getBoundingClientRect().width):0};})()`);
  ok(n8.sideTop <= n8.mainTop, '窄屏下名单栏挪到正文上方（' + n8.sideTop + ' ≤ ' + n8.mainTop + '）');
  ok(n8.docW <= n8.winW + 2, '窄屏下页面不横向溢出（' + n8.docW + ' ≤ ' + n8.winW + '）');
  console.log('  ℹ 窄屏：名单宽 ' + n8.sideW + '，36 列表容器 ' + n8.scrollW + '/表 ' + n8.tableW + '，流程图 ' + n8.flowVis + '/' + n8.flowWrap);
  ok(n8.tableW > n8.scrollW && n8.scrollW <= n8.winW, '窄屏下 36 列表是「容器内部横滑」，不是撑破整页（' + n8.tableW + ' > ' + n8.scrollW + ' ≤ ' + n8.winW + '）');
  await shot(`document.querySelector('.sheet-layout')`, '任务单-窄屏.png');
  await send('Emulation.clearDeviceMetricsOverride');

  ws.close(); kill(); await sleep(300);
  for (const nm of [ME, B, C]) {
    const uid = nm + '｜' + CLA;
    await jfetch('/api/teacher/progress/delete', 'POST', { uid, lessonId: '6-1-3', kind: 'sheet' }, T).catch(() => {});
    await jfetch('/api/teacher/progress/delete', 'POST', { uid, lessonId: '6-1-1', kind: 'sheet' }, T).catch(() => {});
    await jfetch('/api/teacher/roster/delete', 'POST', { uid }, T).catch(() => {});
  }
  console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
