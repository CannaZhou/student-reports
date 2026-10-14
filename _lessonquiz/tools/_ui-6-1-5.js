// 六上第5课《算法的执行》学生端自检：
//   任务单三个程序真的渲染成代码块（程序二那个冒号是全角、程序三那行真没缩进、程序一真是 Tu）、
//   任务一/任务二的下拉候选词个数对、任务三明说“由老师批阅”、窄屏 500px 不撑破；
//   教师端「赋分台」能列出三个任务和交上来的学生。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-6-1-5.js   （跑在隔离实例上，别指生产）
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9740 + Math.floor(Math.random() * 200);
const CLA = '六年级执行界面班';
const TAG = Date.now().toString(36).slice(-4);
const LID = '6-1-5';
const A = '执行甲' + TAG, B = '执行乙' + TAG;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotDir = path.join(__dirname, '_tmp', 'l5shot');

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

// —— 标准答案（与 tools/seed.js 里那几个常量逐字相同；学生端拿不到，测试自己抄一份）——
const ERR_NAME = "NameError: name 'Tu' is not defined";
const ERR_SYN = "SyntaxError: invalid character '：' (U+FF1A)";
const ERR_IND = 'IndentationError: expected an indented block';
const WHY_NAME = '变量名大小写写错了：Tu 应该是 tu';
const WHY_SYN = '冒号用了中文全角「：」，要改成英文冒号';
const WHY_IND = '少了缩进：这一行要缩进到循环体里面';
const RES_A = '23只鸡，12只兔';
const RES_B = '15只鸡，5只兔';
const RES_NONE = '屏幕上什么也没有输出（无解）';
const IDEA_PICK = [
  '把 35、94、36 改成变量，写在程序最前面',
  '用 input() 让用户自己输入头数和脚数',
  '先加一句提示，告诉用户答案大概在什么范围',
  '把程序复制成几份，一份算一道题',
];
const T3_ANSWER = '头数、脚数、循环范围都写在程序里，换题目要改好几个地方';
const T3_WRONG = '算不出答案的时候，程序会一直循环下去、停不下来';

(async () => {
  console.log('== 六上第5课《算法的执行》 学生端界面自检 ==');
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'l5ui-'));
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=500,1600', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, BASE + '/quiz',
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
  const openLesson = async (stu, btnText) => {
    await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(stu)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1;})()`);
    await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
    await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];if(t)t.click();return 1;})()`);
    await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf('算法的执行')>=0})`, 30, 300);
    await ev(`(function(){
      var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf('算法的执行')>=0})[0];
      var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(btnText)})>=0})[0];
      b.click(); return 1;})()`);
  };

  console.log('\n-- 1. 课程地图上多出了第5课');
  await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
  await openLesson(A, '课内任务单');
  const up = await waitFor(`!document.getElementById('view-sheet').hidden && document.querySelectorAll('tr[data-rowi]').length===12`, 40, 300);
  ok(up, '任务单打开、12 个可填行都在（任务一 3 + 运行记录 3 + jie 3 + 改进意见 1 + 任务三 选择/填空 2）');

  console.log('\n-- 2. 任务一：三个程序的代码块真的把 bug 印出来了');
  const codes = await ev(`[].slice.call(document.querySelectorAll('#sheetBody pre.sheet-code')).map(function(p){return p.textContent;})`);
  ok(codes.length >= 4, '代码块共 ' + codes.length + ' 个（任务一三个程序 + 任务二的完善程序）');
  ok(codes[0].indexOf('while Tu < 36:') >= 0, '程序一：第 2 行确实是 while Tu < 36:（大小写 bug 还在）');
  ok(codes[0].indexOf('tu = 0') >= 0 && codes[0].indexOf('ji = 35 - tu') >= 0, '程序一：其余几行是正常的');
  ok(codes[1].indexOf('while tu < 36\uFF1A') >= 0, '程序二：冒号是全角 U+FF1A（不是半角）');
  ok(codes[0].indexOf('\uFF1A') < 0 && codes[2].indexOf('\uFF1A') < 0, '程序一/程序三里没有全角冒号（只有程序二有）');
  ok(codes[2].indexOf('\nji = 35 - tu') >= 0, '程序三：ji = 35 - tu 真的顶格写（行首没有空格）');
  ok(codes[2].indexOf('\n    #如果符合正确解条件') >= 0, '程序三：下面几行仍然缩进着（对比之下那一行特别扎眼）');

  console.log('\n-- 3. 任务一的下拉候选词');
  const p1 = await ev(`(function(){var tr=document.querySelector('tr[data-rowi="0"]');
    var sels=[].slice.call(tr.querySelectorAll('select'));
    return {n:sels.length, opts:sels.map(function(s){return s.options.length;}),
            words:sels.map(function(s){return [].slice.call(s.options).map(function(o){return o.value;}).filter(Boolean);}),
            heads:[].slice.call(document.querySelectorAll('#sheetBody .sheet-sec th')).map(function(t){return t.textContent;})};})()`);
  ok(p1.n === 2, '程序一那行有 2 个下拉（错误提示信息 / 错在哪里、怎么改）');
  ok(p1.opts[0] === 6 && p1.opts[1] === 6, '两个下拉都是 5 条候选 + 1 个“请选…”（' + p1.opts.join('/') + '）');
  ok(p1.words[0].indexOf(ERR_NAME) >= 0 && p1.words[0].indexOf(ERR_SYN) >= 0 && p1.words[0].indexOf(ERR_IND) >= 0,
    '错误提示里三条 Python 报错都在（NameError / SyntaxError / IndentationError）');
  ok(p1.words[0].indexOf('程序没有报错，但屏幕上什么也没有输出') >= 0, '还带了“不报错但没输出”这条（任务二 60/66 那行的答案）');
  ok(p1.heads.indexOf('错误提示信息') >= 0 && p1.heads.indexOf('错在哪里、怎么改') >= 0, '表头就是任务单上的那两列');
  await shot(`document.getElementById('sheetBody')`, '01-任务单全貌.png');

  console.log('\n-- 4. 任务二：运行记录表 + jie 填空');
  const run = await ev(`(function(){var trs=[3,4,5].map(function(i){return document.querySelector('tr[data-rowi="'+i+'"]');});
    return trs.map(function(tr){var r=tr.querySelector('[data-col="res"]');
      return {tou:tr.querySelector('[data-col="tou"]').value, jiao:tr.querySelector('[data-col="jiao"]').value,
      pre:[].slice.call(tr.querySelectorAll('.sheet-pre')).length,
      sel:r.tagName, opts:r.options.length, val:r.value, isPre:!!r.dataset.pre,
      empty:[].slice.call(tr.querySelectorAll('select, input')).filter(function(x){return x.dataset.col && !String(x.value).trim();}).map(function(x){return x.dataset.col;}),
      other:[].slice.call(tr.querySelectorAll('select, input')).filter(function(x){return x.dataset.col && String(x.value).trim() && !x.dataset.pre;}).map(function(x){return x.dataset.col;})};});})()`);
  ok(run.length === 3 && run[0].tou === '35' && run[0].jiao === '94' && run[1].tou === '20' && run[2].tou === '60' && run[2].jiao === '66',
    '三组数据都是题目印好的（35/94、20/50、60/66）');
  ok(run[0].pre === 3, '第一行（35/94）三格全是灰底 preset，学生一格都不用填：' + run[0].pre + ' 格');
  ok(run[0].sel === 'SELECT' && run[0].opts === 5, '运行结果写成下拉：4 条候选 + 1 个“请选…”');
  ok(run[0].val === RES_A && run[0].isPre,
    '老师要求：第一行（35/94）的运行结果直接印出来（' + run[0].val + '）——“不需要选”');
  ok(run[0].other.length === 0, '第一行没有任何一格需要学生填');
  ok(run[1].empty.join(',') === 'res' && run[2].empty.join(',') === 'res',
    '另外两行的运行结果才是空着等学生选（' + run[1].empty.join(',') + ' / ' + run[2].empty.join(',') + '）');
  ok(run[1].opts === 5 && run[2].opts === 5, '这两行的下拉也是 4 条候选 + 1 个“请选…”');
  const jie = await ev(`(function(){var trs=[6,7,8].map(function(i){return document.querySelector('tr[data-rowi="'+i+'"]');});
    return {labels:trs.map(function(t){return t.querySelector('td').textContent;}),
            sels:trs.map(function(t){var s=t.querySelector('select');return {tag:s.tagName, opts:s.options.length};}),
            code:(document.querySelectorAll('#sheetBody pre.sheet-code')[3]||{}).textContent||''};})()`);
  ok(jie.sels.every((s) => s.tag === 'SELECT' && s.opts === 3), 'jie 那三个空各是一个 0/1 二选一下拉（' + jie.sels.map((s) => s.opts).join('/') + '，含“请选…”）');
  ok(jie.labels.join('|') === '① jie 一开始等于|② 找到答案以后 jie 等于|③ 没找到答案时 jie 等于',
    '三行的问题分别写在第一列：' + jie.labels.join(' / '));
  ok(jie.code.indexOf('jie = \u2460') >= 0 || jie.code.indexOf('jie = ①') >= 0, '代码块里用 ①②③ 标出了要补的位置');
  ok(jie.code.indexOf('print("此题无解")') >= 0, '完善后的程序里带着“此题无解”那一句');
  // 老师 2026-10-14：把这张流程图也放进去，给学生作参考
  const fig = await ev(`(function(){var im=document.querySelector('#sheetBody .sheet-figure img');
    return im?{src:im.getAttribute('src'), w:im.naturalWidth, h:im.naturalHeight,
      cap:(im.parentNode.querySelector('.sheet-figure-cap')||{}).textContent||'', iw:im.getBoundingClientRect().width}:null;})()`);
  ok(fig && fig.w > 0, '任务二（2）的流程图真的加载出来了（' + (fig && fig.w) + '×' + (fig && fig.h) + '）');
  ok(fig && fig.src === '/img/g6l5-jie-flow.png', '图就是老师给的那张流程图：' + (fig && fig.src));
  ok(fig && fig.cap.length > 0, '图下面有说明文字：' + (fig && fig.cap));
  ok(fig && fig.iw <= 480, '流程图收在 500px 视口里（' + (fig && Math.round(fig.iw)) + 'px）');

  console.log('\n-- 5. 全填对 → 保存 → 系统判分');
  const setSel = async (i, col, v) => ev(`(function(){var f=document.querySelector('tr[data-rowi="${i}"] [data-col="${col}"]');f.value=${JSON.stringify(v)};return 1;})()`);
  await setSel(0, 'msg', ERR_NAME); await setSel(0, 'why', WHY_NAME);
  await setSel(1, 'msg', ERR_SYN); await setSel(1, 'why', WHY_SYN);
  await setSel(2, 'msg', ERR_IND); await setSel(2, 'why', WHY_IND);
  // 第 3 行（35/94）三格是题目印好的，学生一格都不用填 —— 故意不去动它
  await setSel(4, 'res', RES_B); await setSel(5, 'res', RES_NONE);
  await setSel(6, 'val', '0'); await setSel(7, 'val', '1'); await setSel(8, 'val', '0');
  await setSel(9, 'idea', IDEA_PICK[1]);
  await setSel(10, 'ans', T3_ANSWER);
  await ev(`document.querySelector('tr[data-rowi="11"] [data-col="idea"]').value='让用户自己输入头数和脚数，再判断这两个数能不能配出鸡兔。'`);
  const filled = await ev(`[].slice.call(document.querySelectorAll('tr[data-rowi]')).map(function(tr){
    var fs=[].slice.call(tr.querySelectorAll('select,input')).filter(function(x){return x.dataset.col && !x.dataset.pre;});
    return {i:tr.dataset.rowi, n:fs.length, blank:fs.filter(function(x){return String(x.value).trim()==='';}).map(function(x){return x.dataset.col;})};})`);
  const fillable = filled.filter((r) => r.n > 0);
  const nFilled = fillable.filter((r) => r.blank.length === 0).length;
  if (nFilled !== fillable.length) console.log('    空着的行：' + JSON.stringify(fillable.filter((r) => r.blank.length)));
  ok(fillable.length === 11, '11 行有格子要学生填（第 3 行 35/94 整行是题目印好的）');
  ok(nFilled === 11, '这 11 行都真的填上了（少一行就是某一处静默没填上：' + nFilled + '/' + fillable.length + '）');
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const saved = await waitFor(`document.querySelectorAll('#sheetAuto .auto-item').length===3`, 40, 300);
  ok(saved, '保存后「系统判分」面板列出 3 个任务');
  const auto = await ev(`(function(){return [].slice.call(document.querySelectorAll('#sheetAuto .auto-item')).map(function(li){
    return {mark:(li.querySelector('.auto-mark')||{}).textContent||'', name:(li.querySelector('.auto-name')||{}).textContent||'',
            note:(li.querySelector('.auto-note')||{}).textContent||''};});})()`);
  ok(auto[0] && auto[0].mark === '✅' && auto[0].note.indexOf('做对了') >= 0, '任务一 判对：' + (auto[0] || {}).name + ' → ' + (auto[0] || {}).note);
  ok(auto[1] && auto[1].mark === '✅', '任务二 判对：' + (auto[1] || {}).note);
  ok(auto[1] && auto[1].note.indexOf('还有 1 处老师看') >= 0, '任务二 标出还有 1 处（改进意见）要老师看');
  ok(auto[2] && auto[2].mark === '✅', '任务三 判对（老师 2026-10-14：选择题学生完成就算分）、' + (auto[2] || {}).note);
  ok(auto[2] && auto[2].note.indexOf('还有 1 处老师看') >= 0, '任务三 也标出还有 1 处（新创想那格）要老师看');
  ok(await ev(`document.querySelectorAll('#sheetAuto .auto-item')[2].textContent.indexOf('由老师批阅')<0`),
    '任务三 不再显示“这一任务由老师批阅”（能判了）');
  ok(await ev(`document.querySelectorAll('#sheetBody .sheet-wrong, #sheetBody .bad').length===0`), '全对时没有一格被打红框');
  await shot(`document.getElementById('sheetAuto')`, '02-系统判分面板.png');

  console.log('\n-- 6. 任务一改错一格 → 只任务一翻 ❌');
  await setSel(1, 'why', WHY_IND);
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const back = await waitFor(`(function(){var li=document.querySelectorAll('#sheetAuto .auto-item')[0];return li&&li.className.indexOf('auto-no')>=0;})()`, 40, 300);
  const auto2 = await ev(`(function(){var li=document.querySelectorAll('#sheetAuto .auto-item')[0];return {mark:li.querySelector('.auto-mark').textContent, note:li.querySelector('.auto-note').textContent,
    red:document.querySelectorAll('#sheetBody .sheet-wrong, #sheetBody .bad').length};})()`);
  ok(back && auto2.mark === '❌', '程序二的「错在哪里」改错 → 任务一 变 ❌（' + auto2.note + '）');
  ok(auto2.note.indexOf('有 1 处不对') >= 0, '说清只有 1 处不对，不牵连别的任务');
  ok(auto2.red >= 1, '那一格在学生端被打上红框（' + auto2.red + ' 格）');
  ok(await ev(`document.querySelectorAll('#sheetAuto .auto-item')[1].className.indexOf('auto-ok')>=0`), '任务二 不受影响，仍然是 ✅');

  console.log('\n-- 6b. 任务三那道选择题选错 → 只任务三翻 ❌');
  // 先把任务一改回来，只留任务三错 —— 这样教师端看到的系统分能一路对得上
  await setSel(1, 'why', WHY_SYN);
  await setSel(10, 'ans', T3_WRONG);
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const back3 = await waitFor(`(function(){var li=document.querySelectorAll('#sheetAuto .auto-item')[2];return li&&li.className.indexOf('auto-no')>=0;})()`, 40, 300);
  const a3 = await ev(`(function(){var li=document.querySelectorAll('#sheetAuto .auto-item')[2];return {note:li.querySelector('.auto-note').textContent,
    t1:document.querySelectorAll('#sheetAuto .auto-item')[0].className, red:document.querySelectorAll('#sheetBody tr[data-rowi="10"] .sheet-wrong').length};})()`);
  ok(back3, '任务三选择题选错 → 任务三 变 ❌（' + a3.note + '）');
  ok(a3.t1.indexOf('auto-ok') >= 0, '任务一 改回来就对得上 ✅（老师 2026-10-14：学生完成这个选择就算分）');
  ok(a3.red >= 1, '任务三那一格在学生端被打上红框（' + a3.red + ' 格）');
  ok(await ev(`document.querySelectorAll('#sheetAuto .auto-item')[1].className.indexOf('auto-ok')>=0`), '任务二 不受影响，仍然是 ✅');

  console.log('\n-- 7. 窄屏 500px 不撑破');
  const wide = await ev(`(function(){var t=document.querySelector('#sheetBody table.sheet-table');
    return {w:t?t.getBoundingClientRect().width:0, inner:window.innerWidth, doc:document.documentElement.scrollWidth, body:document.body.scrollWidth};})()`);
  if (wide.doc > wide.inner + 2) {
    const tabs = await ev(`[].slice.call(document.querySelectorAll('#sheetBody table.sheet-table')).map(function(t,i){
      var ths=[].slice.call(t.querySelectorAll('thead th')).map(function(x){return x.textContent+'='+Math.round(x.getBoundingClientRect().width);});
      return {i:i, w:Math.round(t.getBoundingClientRect().width), ths:ths};})`);
    console.log('    各表宽度：' + JSON.stringify(tabs));
  }
  ok(wide.doc <= wide.inner + 2, '页面没有横向溢出（doc ' + wide.doc + ' ≤ 视口 ' + wide.inner + '）');
  ok(wide.w > 0 && wide.w <= wide.inner, '任务单表格宽度收在视口内（' + Math.round(wide.w) + 'px）');
  const codeW = await ev(`(function(){var p=document.querySelector('#sheetBody pre.sheet-code');return {w:p.getBoundingClientRect().width, over:p.scrollWidth>p.clientWidth+1};})()`);
  ok(codeW.w <= wide.inner, '代码块没有超出视口（' + Math.round(codeW.w) + 'px' + (codeW.over ? '，内部可横向滚动' : '') + '）');

  console.log('\n-- 8. 教师端赋分台');
  const board = await jfetch('/api/teacher/sheet-board/' + LID + '?class=' + encodeURIComponent(CLA), 'GET', null, T);
  const tasks = ((board.j.lesson || {}).tasks || []).map((t) => t.no + ':' + t.title);
  ok(tasks.length === 3 && tasks[0].indexOf('调试程序') >= 0 && tasks[1].indexOf('完善算法') >= 0,
    '赋分台列出 3 个任务：' + tasks.join(' / '));
  const rowsAll = board.j.students || [];
  const rowA = rowsAll.filter((s) => s.name === A)[0];
  const rowB = rowsAll.filter((s) => s.name === B)[0];
  ok(!!rowA, '交过的学生 ' + A + ' 出现在名单里（' + rowsAll.length + ' 人）');
  // 第 6b 步把任务三那道选择题故意选错了，所以此刻系统分是 2（任务一、二对，任务三错）。
  ok(rowA && rowA.auto && rowA.auto.score === 2 && rowA.auto.tasks[0].ok === true
     && rowA.auto.tasks[1].ok === true && rowA.auto.tasks[2].ok === false,
    '老师看到的系统分 = 2（任务一 ✅、任务二 ✅、任务三选择题 ❌）');
  ok(rowA && rowA.rows && rowA.rows.length === 11, '收上来 11 行（12 个可填行里，35/94 那一行全是题目印好的，前端不提交）');
  ok(rowA && rowA.auto && rowA.auto.tasks.filter((t) => !t.graded).length === 0, '三个任务都有系统分（这一课不再有“整题归老师批”的任务）');
  ok(rowA && rowA.auto && (rowA.auto.cells || []).length === 12 && rowA.auto.tasks.reduce((n, t) => n + t.manual, 0) === 2,
    '系统判的 12 格（任务一 6 + 任务二运行记录 2 + 任务二补程序 3 + 任务三选择 1）逐格带标准答案给老师看；另有 2 格归老师（改进意见、新创想）');
  ok(!!rowB && !rowB.submitted, '没交的 ' + B + ' 仍然在名单上、也能赋分（不做自动打 0）');
  // 老师逐个任务打勾 → 证书里算的任务单得分（证书只认老师打的勾，不认系统分）
  const m1 = await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: rowA.uid, task: 1, ok: true }, T);
  const m2 = await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: rowA.uid, task: 2, ok: true }, T);
  const m3 = await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: rowA.uid, task: 3, ok: true }, T);
  ok(m1.j.ok !== false && m2.j.ok !== false && m3.j.ok !== false, '赋分台逐题打勾（任务一 ✓、任务二 ✓、任务三 ✓）能落盘');
  const board2 = await jfetch('/api/teacher/sheet-board/' + LID + '?class=' + encodeURIComponent(CLA), 'GET', null, T);
  const rowA2 = (board2.j.students || []).filter((s) => s.name === A)[0];
  ok(rowA2 && rowA2.score === 3, '老师三个都打勾 → 任务单得分 = 3（满分；系统分 2 不影响老师自己判的分）');
  await shot(`document.getElementById('sheetBody')`, '03-任务单下半（完善程序与练习）.png');

  child.kill();
  console.log('\n==== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ====');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试自己崩了：', e); process.exit(2); });
