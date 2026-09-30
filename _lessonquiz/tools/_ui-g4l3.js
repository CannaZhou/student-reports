// 四上第3课《数据的价值》学生端界面自检：
//   任务一四张图真的渲染出来（含图里自带的标题）、下拉候选词个数对、保存后
//   「系统判分」面板按三个任务给结果（任务一/二 做对了、任务三 由老师批阅）、500px 窄屏不撑破。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-g4l3.js   （跑在隔离实例上，别指生产）
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9740 + Math.floor(Math.random() * 200);
const CLA = '四年级价值界面班';
const TAG = Date.now().toString(36).slice(-4);
const LID = '4-1-3';
const A = '价值甲' + TAG, B = '价值乙' + TAG;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotDir = path.join(__dirname, '_tmp', 'g4l3shot');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => ({})), ck: cookie(r) };
}
let msgId = 0;
function mk(ws) {
  const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
  return (method, params) => new Promise((res) => { const id = ++msgId; p.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
}

// 正确答案（和 tools/seed.js 一致；学生端拿不到，测试自己抄一份）
const V1 = ['记录事实、传播信息', '了解其承载的历史', '了解不同鸟类的特征', '帮助警察破案'];
const V2 = ['根据天气决定是否需要带雨具上学', '根据天气安排播种等农事', '根据天气决定上班的出行方式',
  '根据天气决定是否要出海捕鱼', '根据天气预测、发布天气预报'];

(async () => {
  console.log('== 四上第3课《数据的价值》 学生端界面自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  const list0 = (await jfetch('/api/teacher/roster', 'GET', null, T)).j.list || [];
  let cleaned = 0;
  for (const s of list0.filter((x) => x.className === CLA)) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: s.uid }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: s.uid }, T);
    cleaned++;
  }
  if (cleaned) console.log('  （先清掉上一轮残留的 ' + cleaned + ' 个测试生）');
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B].map((n) => CLA + '，' + n).join('\n') }, T);
  const SA = (await jfetch('/api/student/login', 'POST', { name: A })).ck;
  ok(!!SA, '测试数据备好（' + CLA + '：' + A + ' / ' + B + '）');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'g4l3ui-'));
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=500,1400', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, BASE + '/quiz',
  ], { stdio: 'ignore' });
  let ws, send;
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const page = l.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r)); send = mk(ws); break; }
    } catch (e) {}
    await sleep(250);
  }
  if (!send) { console.error('连不上无头 Edge'); child.kill(); process.exit(1); }
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const waitFor = async (expr, n, ms) => { for (let i = 0; i < (n || 30); i++) { if (await ev(expr)) return true; await sleep(ms || 300); } return false; };
  const shot = async (expr, file) => {
    const box = await ev(`(function(){var n=${expr};if(!n)return null;var r=n.getBoundingClientRect();return {x:r.x+window.scrollX,y:r.y+window.scrollY,width:r.width,height:r.height};})()`);
    if (!box || box.width < 5) return console.log('  （截图跳过）');
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 } });
    if (!r.result || !r.result.data) return console.log('  （截图失败）');
    fs.mkdirSync(shotDir, { recursive: true });
    fs.writeFileSync(path.join(shotDir, file), Buffer.from(r.result.data, 'base64'));
    console.log('  📷 ' + file);
  };

  console.log('\n-- 1. 打开本课任务单');
  await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
  await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(A)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1;})()`);
  await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='4年级'})[0];if(t)t.click();return 1;})()`);
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('数据的价值')>=0})`, 30, 300);
  await ev(`(function(){
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('数据的价值')>=0})[0];
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    b.click(); return 1;})()`);
  const up = await waitFor(`!document.getElementById('view-sheet').hidden && document.querySelectorAll('tr[data-rowi]').length===16`, 40, 300);
  ok(up, '任务单打开、16 个可填行都在（四张图 4 + 我还知道 1 + 五个角色 5 + 感想 1 + 勾一勾 4 + 体验 1）');

  console.log('\n-- 2. 任务一：四张图 + 下拉候选词');
  const s1 = await ev(`(function(){
    var imgs=[].slice.call(document.querySelectorAll('#sheetBody img.sheet-rowimg-pic'));
    var secs=document.querySelectorAll('#sheetBody .sheet-sec, #sheetBody table.sheet-table').length;
    var first=document.querySelector('tr[data-rowi="0"]');
    var sel=first.querySelector('select');
    return {n:imgs.length, loaded:imgs.filter(function(x){return x.naturalWidth>0;}).length,
            srcs:imgs.map(function(x){return x.getAttribute('src');}),
            alts:imgs.map(function(x){return x.alt;}),
            opts:sel?sel.options.length:0, hasSel:!!sel, tabs:secs};})()`);
  ok(s1.n === 4, '四张数据图片都渲染了');
  ok(s1.loaded === 4, '四张图都真的加载出来了（naturalWidth>0，404 会是 0）');
  ok(s1.srcs.join(',') === '/img/g4l3-a1.png,/img/g4l3-a2.png,/img/g4l3-a3.png,/img/g4l3-a4.png', '顺序就是任务单上的顺序：结绳记事→甲骨文→鸟类→指纹');
  ok(s1.alts[3] === '指纹', '图都带 alt 给读屏（第4张 = ' + s1.alts[3] + '）');
  ok(s1.opts === 7, '「数据的价值」下拉是 6 个候选词 + 1 个“请选…”（' + s1.opts + '）');
  const s2 = await ev(`(function(){var tr=document.querySelector('tr[data-rowi="5"]');var sel=tr.querySelector('select');return {opts:sel.options.length, words:[].slice.call(sel.options).map(function(o){return o.value;}).filter(Boolean)};})()`);
  ok(s2.opts === 6, '任务二「天气数据对他的作用」下拉是 5 个候选 + 占位（' + s2.opts + '）');
  ok(s2.words.length === 5 && s2.words.indexOf('根据天气决定是否要出海捕鱼') >= 0, '候选词就是那五条作用（顺序打乱）');
  const s3 = await ev(`(function(){var tr=document.querySelector('tr[data-rowi="11"]');var sel=tr.querySelector('select');return [].slice.call(sel.options).map(function(o){return o.value;}).filter(Boolean).join('|');})()`);
  ok(s3 === '✓ 我经历过|没经历过' || s3 === '没经历过|✓ 我经历过', '任务三“勾一勾”是二选一下拉：' + s3);
  await shot(`document.getElementById('sheetBody')`, '01-任务单上半（含四张图）.png');

  console.log('\n-- 3. 填一份全对的，保存 → 系统判分面板');
  const set = async (i, col, v) => `document.querySelector('tr[data-rowi="${i}"] [data-col="${col}"]')`;
  for (let i = 0; i < 4; i++) await ev(`(function(){var f=${await set(i, 'value')};f.value=${JSON.stringify(V1[i])};return 1;})()`);
  await ev(`(function(){var t=document.querySelector('tr[data-rowi="4"] [data-col="data"]');t.value='教室里的温度计';
    var v=document.querySelector('tr[data-rowi="4"] [data-col="value"]');v.value='知道今天要不要开窗、开空调';return 1;})()`);
  for (let i = 0; i < 5; i++) await ev(`(function(){var f=${await set(5 + i, 'use')};f.value=${JSON.stringify(V2[i])};return 1;})()`);
  await ev(`document.querySelector('tr[data-rowi="10"] [data-col="thought"]').value='不一样，同一份天气数据，学生用它决定带不带伞，渔民用它决定出不出海。'`);
  // 注意：值一定要 JSON.stringify 再拼进表达式（直接拼 '✓ 我经历过' 会变成非法 JS，
  //       Runtime.evaluate 只回 undefined、不报错，表现就是「这一列静默没填上」）。
  for (let i = 0; i < 4; i++) await ev(`(function(){var f=${await set(11 + i, 'tick')};f.value=${JSON.stringify(i === 2 ? '没经历过' : '✓ 我经历过')};return 1;})()`);
  await ev(`document.querySelector('tr[data-rowi="15"] [data-col="exp"]').value='天气预报说明天有雨，妈妈提前把雨伞放进了我的书包。'`);
  ok(await ev(`document.querySelector('tr[data-rowi="0"] select').value===${JSON.stringify(V1[0])}`), '下拉框已按正确答案选好');
  const nFilled = await ev(`[].slice.call(document.querySelectorAll('tr[data-rowi]')).filter(function(tr){
    var f=[].slice.call(tr.querySelectorAll('select,input')).filter(function(x){return x.dataset.col;})[0];
    return f && String(f.value).trim()!=='';}).length`);
  ok(nFilled === 16, '16 行都真的填上了（少一行就是某一处静默没填上：' + nFilled + '/16）');
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const saved = await waitFor(`document.querySelectorAll('#sheetAuto .auto-item').length===3`, 40, 300);
  ok(saved, '保存后「系统判分」面板列出 3 个任务');
  const auto = await ev(`(function(){return [].slice.call(document.querySelectorAll('#sheetAuto .auto-item')).map(function(li){
    return {cls:li.className, mark:(li.querySelector('.auto-mark')||{}).textContent||'',
            name:(li.querySelector('.auto-name')||{}).textContent||'',
            note:(li.querySelector('.auto-note')||{}).textContent||''};});})()`);
  ok(auto[0] && auto[0].mark === '✅' && auto[0].note.indexOf('做对了') >= 0,
    '任务一 判对：' + (auto[0] || {}).name + ' → ' + (auto[0] || {}).note);
  ok(auto[1] && auto[1].mark === '✅' && auto[1].note.indexOf('做对了') >= 0,
    '任务二 判对：' + (auto[1] || {}).note);
  ok(auto[2] && auto[2].mark === '➖' && auto[2].note === '这一任务由老师批阅',
    '任务三 没有标准答案 → 明说“由老师批阅”，不假装判过');
  ok(auto[0].note.indexOf('还有 2 处老师看') >= 0, '任务一 标注还有 2 处要老师看（“我还知道”那一行）');
  ok(await ev(`document.querySelectorAll('#sheetBody .sheet-wrong, #sheetBody .bad').length===0`), '全对时没有一格被打红框');
  ok(await ev(`document.querySelector('tr[data-rowi="11"] [data-col="tick"]').value==='✓ 我经历过'`),
    '勾一勾那几行的选择保存后还在（重新渲染也不丢）');
  await shot(`document.getElementById('sheetAuto')`, '02-系统判分面板.png');

  console.log('\n-- 4. 改错一格 → 任务一翻成 ❌');
  await ev(`(function(){var f=document.querySelector('tr[data-rowi="1"] [data-col="value"]');f.value='帮助警察破案';return 1;})()`);
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const back = await waitFor(`(function(){var li=document.querySelectorAll('#sheetAuto .auto-item')[0];return li&&li.className.indexOf('auto-no')>=0;})()`, 40, 300);
  const auto2 = await ev(`(function(){var li=document.querySelectorAll('#sheetAuto .auto-item')[0];return {mark:li.querySelector('.auto-mark').textContent, note:li.querySelector('.auto-note').textContent, hint:(document.querySelector('#sheetAuto .auto-hint')||{}).textContent||''};})()`);
  ok(back && auto2.mark === '❌', '甲骨文那格改错 → 任务一 变 ❌（' + auto2.note + '）');
  ok(auto2.note.indexOf('有 1 处不对') >= 0, '说清只有 1 处不对，不牵连别的任务');
  ok(auto2.hint.indexOf('打红框的地方要改一改：1 处') >= 0, '提示“打红框的地方要改一改：1 处”');
  const painted = await ev(`document.querySelectorAll('#sheetBody .sheet-wrong').length`);
  ok(painted === 1, '页面上正好一格被标出来（' + painted + '）');
  await shot(`document.getElementById('sheetBody')`, '03-判错标红.png');

  console.log('\n-- 5. 窄屏不撑破');
  const ov = await ev(`({sw:document.documentElement.scrollWidth, iw:window.innerWidth})`);
  ok(ov.sw <= ov.iw + 2, '500px 窄窗下任务单页不横向溢出（' + ov.sw + ' ≤ ' + ov.iw + '）');
  await shot(`document.getElementById('view-sheet')`, '04-窄屏全页.png');

  console.log('\n-- 6. 赋分台：一排三个任务按钮，系统预选虚框、老师点的实框');
  // 三处都是异步重画（点标签页会先清空 #tabBody、换班要等表格回来），所以每一步都等到真的画出来再读
  const readRows = `(function(){
    var out={};
    [].forEach.call(document.querySelectorAll('.tbl tr'),function(r){
      var cb=r.querySelector('td input[type=checkbox]'); if(!cb) return;
      var nm=cb.parentNode.textContent.replace(/\\s+/g,' ').trim();
      out[nm]={ score:(r.querySelector('input.score-in')||{}).value||'',
        sys:(r.querySelector('.sys-line')||{}).textContent.replace(/\\s+/g,' ')||'',
        fill:(r.querySelector('.sys-fill')||{}).textContent||'',
        btns:[].slice.call(r.querySelectorAll('.sys-task')).map(function(b){
          return {t:b.textContent, c:b.className.replace('sys-task ',''), s:getComputedStyle(b).borderStyle};}) };
    }); return out;})()`;
  const rowNow = async (n) => {
    const r = (await ev(readRows)) || {};
    const k = Object.keys(r).filter((x) => x.indexOf(n) >= 0)[0];
    return k ? r[k] : null;
  };
  await send('Page.navigate', { url: BASE + '/teacher' });
  await sleep(1300);
  await ev("document.getElementById('pw').value='123456';document.getElementById('loginGo').click();");
  await waitFor(`document.body.innerText.indexOf(${JSON.stringify(A)})>=0`, 40, 300);
  let onBoard = false;
  for (let i = 0; i < 12 && !onBoard; i++) {
    await ev(`(function(){
      var back=[].slice.call(document.querySelectorAll('button')).filter(function(b){return b.textContent.indexOf('返回各课情况')>=0;})[0];
      if(back){ back.click(); return 1; }
      var t=document.querySelector('.tab[data-tab="overview"]'); if(t&&!t.classList.contains('on'))t.click();
      return 1;})()`);
    await sleep(600);
    const hit = await ev(`(function(){
      var tr=[].slice.call(document.querySelectorAll('tr')).filter(function(r){return r.textContent.indexOf('数据的价值')>=0 && r.querySelector('button');})[0];
      if(!tr) return 0;
      var b=[].slice.call(tr.querySelectorAll('.btn')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0;})[0];
      if(!b) return 0; b.click(); return 1;})()`);
    if (!hit) continue;
    await sleep(800);
    await ev(`(function(){var c=[].slice.call(document.querySelectorAll('.cls-chip')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(CLA)})>=0;})[0];
      if(c&&!c.classList.contains('on'))c.click(); return 1;})()`);
    for (let k = 0; k < 14 && !onBoard; k++) {
      onBoard = await ev(`[].filter.call(document.querySelectorAll('.tbl tr'),function(r){return r.textContent.indexOf(${JSON.stringify(A)})>=0 && r.querySelector('input.score-in');}).length>0`);
      if (!onBoard) await sleep(300);
    }
  }
  ok(onBoard, '赋分台打开了本课（数据的价值）');
  const ra = await rowNow(A), rb = await rowNow(B);
  ok(ra && ra.btns.length === 3, '已交的甲那行有 3 个任务按钮（' + ((ra || {}).btns || []).map((b) => b.t).join(' ') + '）');
  ok(ra && ra.btns[0].c.indexOf('st-no') >= 0 && ra.btns[0].c.indexOf('st-sys') >= 0 && ra.btns[0].s === 'dashed',
    '任务① 系统判错 → 虚框 ✗（' + ((ra || {}).btns[0] || {}).c + '）');
  ok(ra && ra.btns[1].c.indexOf('st-ok') >= 0 && ra.btns[1].s === 'dashed', '任务② 系统判对 → 虚框 ✓');
  ok(ra && ra.btns[2].c.indexOf('st-skip') >= 0, '任务③ 系统判不了 → 虚框 ➖，等老师点');
  // 分母是这一课的任务数（3），任务③ 判不了就显示 ➖ —— 和四年级第2课（活动三老师判）一个口径
  ok(ra && ra.sys.indexOf('系统 1/3') >= 0 && ra.sys.indexOf('另有 8 处要老师看') >= 0,
    '行上的系统小条：' + ra.sys.slice(0, 46));
  ok(ra && ra.fill.indexOf('按系统分填 1') >= 0, '“按系统分填 1”按钮还在：' + ra.fill);
  ok(rb && rb.btns.length === 3 && rb.btns.every((b) => b.c.indexOf('st-skip') >= 0) && !rb.fill,
    '没交的乙那行三个按钮都是虚框 ➖、没有“按系统分填”（系统无分可填，老师照样能点）');
  // 老师点任务③ ✓：总分 = 打勾个数（①系统✗ ②系统✓ ③老师✓ = 2 分）
  await ev(`(function(){
    var r=[].filter.call(document.querySelectorAll('.tbl tr'),function(x){return x.textContent.indexOf(${JSON.stringify(A)})>=0 && x.querySelector('input.score-in');})[0];
    r.querySelectorAll('.sys-task')[2].click(); return 1;})()`);
  let ra2 = null;
  for (let i = 0; i < 24; i++) {
    ra2 = await rowNow(A);
    if (ra2 && ra2.score === '2') break;
    await sleep(250);
  }
  ok(ra2 && ra2.score === '2', '老师给任务③点 ✓ → 总分 2（①✗ ②✓ ③✓）');
  ok(ra2 && ra2.btns[2].c.indexOf('st-teacher') >= 0 && ra2.btns[2].s === 'solid', '老师点过的按钮变实框、标成老师判（' + ra2.btns[2].c + '）');
  await shot(`document.querySelector('.tbl-scroll') || document.querySelector('.tbl')`, '05-赋分台三题按钮.png');

  console.log('\n-- 7. 窄屏不撑破（赋分台）');
  const ov2 = await ev(`({sw:document.documentElement.scrollWidth, iw:window.innerWidth})`);
  ok(ov2.sw <= ov2.iw + 2, '500px 窄窗下赋分台不横向溢出（' + ov2.sw + ' ≤ ' + ov2.iw + '）');

  ws.close(); child.kill();
  for (const n of [A, B]) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: n + '｜' + CLA }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: n + '｜' + CLA }, T);
  }
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  console.log('\n截图在 ' + shotDir);
  console.log('== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检异常：', e); process.exit(1); });
