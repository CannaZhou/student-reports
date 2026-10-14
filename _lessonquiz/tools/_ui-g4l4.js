// 四上第4课《数据的安全》学生端 / 教师端界面自检：
//   两个板块都是下拉（任务一「哪些行为导致泄漏」、任务二「情境→建议」），
//   任务一**没有标准答案**（老师：不判分）→ 学生端那一条显示「由老师批阅」、赋分台上是一个 ➖ 等老师点；
//   任务二系统判得出。整课任务单满分 2 分。500px 窄屏不撑破（任务二两列、建议列选项文字较长，重点盯这个）。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-g4l4.js   （跑在隔离实例上，别指生产）
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9740 + Math.floor(Math.random() * 200);
const CLA = '四年级数据安全界面班';
const TAG = Date.now().toString(36).slice(-4);
const LID = '4-1-4';
const LESSON_TITLE = '数据的安全';
const A = '安全界面甲' + TAG, B = '安全界面乙' + TAG;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotDir = path.join(__dirname, '_tmp', 'g4l4shot');

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
const ACTS = ['连接不明 WIFI，账号密码被盗', '扫描不明二维码，个人信息泄露',
  '快递盒乱丢弃，泄露了个人信息', '随意透露验证码、点开不明链接'];
const TIPS = ['设成字母、数字、符号混合的密码', '不扫不明二维码、不随便填手机号',
  '快递单撕掉或涂黑个人信息再扔', '不连不明 WIFI，验证码谁都不给'];
const LABELS = ['密码 666888', '抽奖二维码', '快递单', '陌生 WiFi 和验证码'];

(async () => {
  console.log('== 四上第4课《数据的安全》 界面自检 ==');
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'g4l4ui-'));
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
  // 每次求值前先过一遍语法：CDP 的 Runtime.evaluate 遇到语法错的表达式会**静默回 undefined**
  // （不报错），以前就吃过这个亏——某一行“莫名其妙没填上”，其实是表达式少了一个括号。
  const ev = async (expr) => {
    try { new Function('return ' + expr); }
    catch (e) { throw new Error('表达式语法错（' + e.message + '）：' + expr); }
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
  await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf(${JSON.stringify(LESSON_TITLE)})>=0})`, 30, 300);
  await ev(`(function(){
    var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(LESSON_TITLE)})>=0})[0];
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];
    b.click(); return 1;})()`);
  const up = await waitFor(`!document.getElementById('view-sheet').hidden && document.querySelectorAll('tr[data-rowi]').length===8`, 40, 300);
  ok(up, '任务单打开、8 个可填行都在（任务一 4 + 任务二 4）');

  console.log('\n-- 2. 任务一：4 个下拉，都是 7 个候选 + 1 个「请选…」占位');
  const s1 = await ev(`(function(){
    var out=[];
    for(var i=0;i<4;i++){
      var tr=document.querySelector('tr[data-rowi="'+i+'"]'); if(!tr){out.push(null);continue;}
      var sel=tr.querySelector('select'); var inp=tr.querySelector('input[data-col]');
      out.push({ n:sel?sel.options.length:-1, hasSel:!!sel, hasInput:!!inp,
        ph: sel?sel.options[0].textContent:'', phv: sel?sel.options[0].value:'',
        cols: [].slice.call(tr.querySelectorAll('[data-col]')).map(function(x){return x.dataset.col;}) });
    } return out;})()`);
  ok(s1.every((x) => x && x.hasSel && !x.hasInput), '任务一四行都是下拉（没有要打字的输入框）');
  ok(s1.every((x) => x.n === 8), '每个下拉 7 个候选 + 1 个占位（' + s1.map((x) => x.n).join(',') + '）');
  ok(s1.every((x) => x.ph === '▾ 请选…' && x.phv === ''), '占位项是「▾ 请选…」，空值，不会误当成作答');
  ok(s1.every((x) => x.cols.join(',') === 'act'), '每行只有 act 一列（' + s1[0].cols.join(',') + '）');
  const w1 = await ev(`(function(){
    var all=[]; for(var i=0;i<4;i++){ var sel=document.querySelector('tr[data-rowi="'+i+'"] select');
      all=all.concat([].slice.call(sel.options).map(function(o){return o.value;}).filter(Boolean)); }
    var uniq={}; all.forEach(function(w){uniq[w]=1;}); return Object.keys(uniq);})()`);
  ok(w1.length === 7 && ACTS.every((a) => w1.indexOf(a) >= 0), '四行共用同一份 7 条候选词（' + w1.length + ' 条）');
  ok(w1.some((w) => ACTS.indexOf(w) < 0), '候选词里有干扰项：' + w1.filter((w) => ACTS.indexOf(w) < 0).join(' / '));

  console.log('\n-- 3. 任务二：行首是情境、右边是建议下拉（7 候选）');
  const s2 = await ev(`(function(){
    var out=[];
    for(var i=4;i<8;i++){
      var tr=document.querySelector('tr[data-rowi="'+i+'"]');
      var lab=tr.querySelector('td.sheet-rowlabel');
      var sel=tr.querySelector('select');
      out.push({ lab: lab?lab.textContent.trim():'', labCol: lab?lab.dataset.col:'',
        labInput: lab?!!lab.querySelector('input,select'):null,
        n: sel?sel.options.length:-1,
        words: sel?[].slice.call(sel.options).map(function(o){return o.textContent;}).filter(function(t){return t.indexOf('请选')<0;}):[],
        maxw: sel?Math.max.apply(null,[].slice.call(sel.options).map(function(o){return o.textContent.length;})):0 });
    } return out;})()`);
  ok(s2.every((x) => x.labInput === false), '任务二四行的第一列是印好的情境文字，不是输入框');
  ok(s2.map((x) => x.lab).join('|') === LABELS.join('|'), '四行情境依次是：' + s2.map((x) => x.lab).join(' / '));
  ok(s2.every((x) => x.labCol === 'scene'), '情境那一列的 data-col 是 scene（收卷时归位用）');
  ok(s2.every((x) => x.n === 8), '建议下拉 7 个候选 + 1 个占位（' + s2.map((x) => x.n).join(',') + '）');
  const maxw = Math.max.apply(null, s2.map((x) => x.maxw));
  ok(maxw <= 18, '最长的候选词 ' + maxw + ' 字（≤18，够短才不会在 500px 上把表顶出去）');
  await shot(`document.getElementById('sheetBody')`, '01-任务单上半.png');

  console.log('\n-- 4. 填一份全对的，保存 → 系统判分面板');
  const set = async (i, col, v) => `(function(){var f=document.querySelector('tr[data-rowi="${i}"] [data-col="${col}"]');f.value=${JSON.stringify(v)};return 1;})()`;
  for (let i = 0; i < 4; i++) await ev(await set(i, 'act', ACTS[i]));
  for (let i = 0; i < 4; i++) await ev(await set(4 + i, 'tip', TIPS[i]));
  const nFilled = await ev(`[].slice.call(document.querySelectorAll('tr[data-rowi]')).filter(function(tr){
    var f=[].slice.call(tr.querySelectorAll('select,input')).filter(function(x){return x.dataset.col;})[0];
    return f && String(f.value).trim()!=='';}).length`);
  ok(nFilled === 8, '8 行都真的填上了（少一行就是某一处静默没填上：' + nFilled + '/8）');
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const saved = await waitFor(`document.querySelectorAll('#sheetAuto .auto-item').length===2`, 40, 300);
  ok(saved, '保存后「系统判分」面板列出 2 个任务');
  const auto = await ev(`(function(){return [].slice.call(document.querySelectorAll('#sheetAuto .auto-item')).map(function(li){
    return {cls:li.className, mark:(li.querySelector('.auto-mark')||{}).textContent||'',
            name:(li.querySelector('.auto-name')||{}).textContent||'',
            note:(li.querySelector('.auto-note')||{}).textContent||''};});})()`);
  const scoreTxt = await ev(`(document.querySelector('#sheetAuto .auto-score')||{}).textContent||''`);
  ok(auto[0] && auto[0].mark === '➖' && auto[0].note.indexOf('由老师批阅') >= 0,
    '任务一 没有标准答案 → 明说“由老师批阅”，不假装判过：' + (auto[0] || {}).note);
  // 注意：judged=false 的那一条**不带**「（还有 N 处老师看）」那个尾巴（quiz.js：尾巴只挂在 ✅/❌ 上）。
  // 这一条本身就是在说“全归老师”，再加一句“还有 4 处”是废话。
  ok(auto[0] && auto[0].note === '这一任务由老师批阅', '任务一 只写这一句，不画蛇添足');
  ok(auto[1] && auto[1].mark === '✅' && auto[1].note.indexOf('做对了') >= 0,
    '任务二 判对：' + (auto[1] || {}).note);
  ok(scoreTxt.indexOf('得了 1 / 2 分') >= 0, '系统分只算得出 1 分、满分 2 分：' + scoreTxt);
  ok(await ev(`document.querySelectorAll('#sheetBody .sheet-wrong, #sheetBody .bad').length===0`), '全对时没有一格被打红框');
  await shot(`document.getElementById('sheetAuto')`, '02-系统判分面板.png');

  console.log('\n-- 5. 任务二改错一格 → 只有任务二翻 ❌');
  await ev(await set(6, 'tip', '快递单反正是废纸，直接扔'));   // 第 3 行（快递单）选了干扰项
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const back = await waitFor(`(function(){var li=document.querySelectorAll('#sheetAuto .auto-item')[1];return li&&li.className.indexOf('auto-no')>=0;})()`, 40, 300);
  const auto2 = await ev(`(function(){var li=document.querySelectorAll('#sheetAuto .auto-item')[1];
    return {mark:li.querySelector('.auto-mark').textContent, note:li.querySelector('.auto-note').textContent,
            hint:(document.querySelector('#sheetAuto .auto-hint')||{}).textContent||'',
            t1:document.querySelectorAll('#sheetAuto .auto-item')[0].className};})()`);
  ok(back && auto2.mark === '❌', '快递单那格改错 → 任务二 变 ❌（' + auto2.note + '）');
  ok(auto2.note.indexOf('有 1 处不对') >= 0, '说清只有 1 处不对');
  ok(auto2.hint.indexOf('打红框的地方要改一改：1 处') >= 0, '提示“打红框的地方要改一改：1 处”');
  ok(auto2.t1.indexOf('auto-skip') >= 0, '任务一 不受影响，还是 ➖（它压根不判）');
  ok(await ev(`document.querySelectorAll('#sheetBody .sheet-wrong').length`) === 1, '页面上正好一格被标出来');
  await shot(`document.getElementById('sheetBody')`, '03-判错标红.png');

  console.log('\n-- 6. 任务一随便怎么填，系统都不改口');
  await ev(await set(1, 'act', '硬盘坏了，照片读不出来'));
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  await sleep(900);
  const t1b = await ev(`(function(){var li=document.querySelectorAll('#sheetAuto .auto-item')[0];return {cls:li.className, mark:li.querySelector('.auto-mark').textContent, note:li.querySelector('.auto-note').textContent};})()`);
  ok(t1b.mark === '➖' && t1b.cls.indexOf('auto-skip') >= 0, '任务一填了个干扰项，系统照样 ➖：' + t1b.note);
  ok(await ev(`document.querySelectorAll('#sheetBody .sheet-wrong').length`) === 1, '红框还是任务二那一格，没牵连任务一');

  console.log('\n-- 7. 把任务二改回来 → 红框清掉、任务二回到 ✅（任务一那份干扰项留着，两边互不影响）');
  await ev(await set(6, 'tip', TIPS[2]));
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  await waitFor(`document.querySelectorAll('#sheetAuto .auto-item')[1].className.indexOf('auto-ok')>=0`, 40, 300);
  ok(await ev(`document.querySelectorAll('#sheetBody .sheet-wrong').length`) === 0, '改回正确 → 红框清掉');
  const t2c = await ev(`document.querySelectorAll('#sheetAuto .auto-item')[1].querySelector('.auto-mark').textContent`);
  ok(t2c === '✅', '任务二 回到 ✅');
  ok(await ev(`document.querySelectorAll('#sheetAuto .auto-item')[0].querySelector('.auto-mark').textContent`) === '➖',
    '任务一 那份干扰项还在、系统还是 ➖（改任务二不会顺手把任务一判了）');
  // 停在这里交给赋分台：系统分应当是 1/2（任务二 ✅、任务一不判）

  console.log('\n-- 8. 窄屏不撑破');
  const ov = await ev(`({sw:document.documentElement.scrollWidth, iw:window.innerWidth})`);
  ok(ov.sw <= ov.iw + 2, '500px 窄窗下任务单不横向溢出（' + ov.sw + ' ≤ ' + ov.iw + '）');
  await shot(`document.getElementById('view-sheet')`, '04-窄屏全页.png');

  console.log('\n-- 9. 赋分台：两个任务一排按钮（任务一 ➖ 等老师点、任务二 系统预选虚框 ✓）');
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
      var tr=[].slice.call(document.querySelectorAll('tr')).filter(function(r){return r.textContent.indexOf(${JSON.stringify(LESSON_TITLE)})>=0 && r.querySelector('button');})[0];
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
  ok(onBoard, '赋分台打开了本课（数据的安全）');
  const ra = await rowNow(A), rb = await rowNow(B);
  ok(ra && ra.btns.length === 2, '已交的甲那行有 2 个任务按钮（' + ((ra || {}).btns || []).map((b) => b.t).join(' ') + '）');
  ok(ra && ra.btns[0].c.indexOf('st-skip') >= 0 && ra.btns[0].c.indexOf('st-sys') < 0,
    '任务① 系统判不了（自由作答）→ 虚框 ➖，等老师点（' + ((ra || {}).btns[0] || {}).c + '）');
  ok(ra && ra.btns[1].c.indexOf('st-ok') >= 0 && ra.btns[1].c.indexOf('st-sys') >= 0 && ra.btns[1].s === 'dashed',
    '任务② 系统判对 → 虚框 ✓（虚线＝系统判定，老师没改过）');
  ok(ra && ra.sys.indexOf('系统 1/2') >= 0 && ra.sys.indexOf('另有 4 处要老师看') >= 0,
    '行上的系统小条：' + ((ra || {}).sys || '').slice(0, 44));
  ok(ra && ra.fill.indexOf('按系统分填 1') >= 0, '“按系统分填 1”按钮还在：' + (ra || {}).fill);
  ok(rb && rb.btns.length === 2 && rb.btns.every((b) => b.c.indexOf('st-skip') >= 0) && !rb.fill,
    '没交的乙那行两个按钮都是虚框 ➖、没有“按系统分填”（系统无分可填，老师照样能点）');
  // 老师点任务① ✓：总分 = 打勾个数（①老师✓ ②系统✓ = 2 分）
  await ev(`(function(){
    var r=[].filter.call(document.querySelectorAll('.tbl tr'),function(x){return x.textContent.indexOf(${JSON.stringify(A)})>=0 && x.querySelector('input.score-in');})[0];
    r.querySelectorAll('.sys-task')[0].click(); return 1;})()`);
  let ra2 = null;
  for (let i = 0; i < 24; i++) {
    ra2 = await rowNow(A);
    if (ra2 && ra2.score === '2') break;
    await sleep(250);
  }
  ok(ra2 && ra2.score === '2', '老师给任务①点 ✓ → 总分 2（①老师✓ ②系统✓）——满分就是 2，不打 10 分制');
  ok(ra2 && ra2.btns[0].c.indexOf('st-teacher') >= 0 && ra2.btns[0].s === 'solid', '老师点过的按钮变实框、标成老师判（' + ((ra2 || {}).btns[0] || {}).c + '）');
  ok(ra2 && ra2.btns[1].c.indexOf('st-sys') >= 0 && ra2.btns[1].s === 'dashed', '任务② 还是虚框（老师没动它）');
  await shot(`document.querySelector('.tbl-scroll') || document.querySelector('.tbl')`, '05-赋分台两题按钮.png');

  console.log('\n-- 10. 学生端看到老师给的分（2 / 2）');
  const stu = (await jfetch('/api/lesson/' + LID + '/sheet', 'GET', null, SA)).j;
  ok(stu.mark && stu.mark.score === 2 && stu.taskFull === 2, '学生端 mark.score=2、taskFull=2');
  ok(stu.mark && stu.mark.tasks && stu.mark.tasks['1'] === true && stu.mark.tasks['2'] === true,
    '逐题标记都在（任务①老师判对、任务②老师判对）');

  console.log('\n-- 11. 窄屏不撑破（赋分台）');
  const ov2 = await ev(`({sw:document.documentElement.scrollWidth, iw:window.innerWidth})`);
  ok(ov2.sw <= ov2.iw + 2, '500px 窄窗下赋分台不横向溢出（' + ov2.sw + ' ≤ ' + ov2.iw + '）');

  ws.close(); child.kill();
  // uid 的分隔符是全角竖线「｜」（见 core/store.js:82），别写成 @ —— 那就成了「删了个不存在的学号」，
  // 测试生会一轮轮堆在真实名单里。
  for (const n of [A, B]) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: n + '｜' + CLA }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: n + '｜' + CLA }, T);
  }
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  console.log('\n截图在 ' + shotDir);
  console.log('== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检异常：', e); process.exit(1); });
