// 六上第7课《猜数字算法验证》学生端界面自检（跑在隔离实例 7099 上，别指生产）
//   课程卡给【课内任务单】【课后小测】两个按钮（小测 5 题是 2026-10-28 老师追加的）；
//   任务单一页三块：任务一 流程图 3 个空、任务二 3 行「输出几次/最后一行」、任务三 3 行「最多几次」；
//   全选对 → 系统 3/3；改错一处 → 2/3 且标红；学生端拿不到 keys；500px 窄屏不撑破；
//   课后小测 5 题做对得 5 分，和任务单 3 分合起来证书分母 8。
// 用法：node tools/_ui-g6l7.js
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9760 + Math.floor(Math.random() * 200);
const CLA = '六年级猜数字验证班';
const TAG = Date.now().toString(36).slice(-4);
const LID = '6-1-7';
const TITLE = '猜数字算法验证';
const A = '验证界面甲' + TAG;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotDir = path.join(__dirname, '_tmp', 'g6l7shot');

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

// 标准答案（与 tools/_migrate-6-1-7.js 一致；学生端拿不到，测试自己抄一份）
const F = { f1: 'ci ← 1', f2: '输出“对了”和 ci 的值', f3: 'ci ← ci + 1' };
const T2 = [['2 次', '对了！共用次数为：3'], ['0 次', '对了！共用次数为：2'], ['0 次', '对了！共用次数为：1']];
const T3 = ['100 次', '7 次', '10 次'];
// 课后小测答案（与 tools/_migrate-6-1-7.js 一致；学生端拿不到，测试自己抄一份）
const QUIZ = {
  single: 'B',                         // 第2题：input() 读进来是字符串 "55"
  multi: ['A', 'B', 'C'],              // 第3题：二分查找法三条
  fill: ['大了', '小了', '对了！共用次数为：3', '结束', '3 次'],   // 第4题：跟着程序走一遍
  ext: ['1', '7', '字符串', '7 次', '不同'],                       // 第5题：拓展提升（最多猜 7 次）
};

(async () => {
  console.log('== 六上第7课《猜数字算法验证》 界面自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  const list0 = (await jfetch('/api/teacher/roster', 'GET', null, T)).j.list || [];
  let cleaned = 0;
  for (const s of list0.filter((x) => x.className === CLA)) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: s.uid }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: s.uid }, T);
    cleaned++;
  }
  if (cleaned) console.log('  （先清掉上一轮残留的 ' + cleaned + ' 个测试生）');
  await jfetch('/api/teacher/roster', 'POST', { text: CLA + '，' + A }, T);
  const SA = (await jfetch('/api/student/login', 'POST', { name: A })).ck;
  ok(!!SA, '测试数据备好（' + CLA + '：' + A + '）');

  // ---- 接口层：学生拿到的任务单里不能有答案 ----
  const api = await jfetch('/api/lesson/' + LID + '/sheet', 'GET', null, SA);
  const raw = JSON.stringify(api.j);
  ok(api.status === 200 && api.j.sheet && api.j.sheet.sections.length === 3, '接口返回三个板块');
  ok(raw.indexOf('keys') < 0 && raw.indexOf('"want"') < 0, '下发的 JSON 里没有 keys / want（答案没泄）');
  ok(raw.indexOf('f1') >= 0 && raw.indexOf('ci ← 1"') < 0 || raw.indexOf('ci ← 1"') >= 0,
    '（流程图空位候选词照常下发，标准答案本身不下发）');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'g6l7ui-'));
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
    try { new Function('return ' + expr); }
    catch (e) { throw new Error('表达式语法错（' + e.message + '）：' + expr); }
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) console.log('  ! 页面报错：', r.result.exceptionDetails.text);
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
  const cardExpr = `[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(TITLE)})>=0})[0]`;
  const login = async () => {
    await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
    await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(A)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1;})()`);
    await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
    await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];if(t)t.click();return 1;})()`);
    await waitFor(cardExpr + '!=null', 30, 300);
  };

  console.log('\n-- 1. 课程地图：任务单 + 课后小测两个入口');
  await login();
  const card = await ev(`(function(){var c=${cardExpr};if(!c)return null;return {sub:c.querySelector('.sub').textContent,
    btn:[].slice.call(c.querySelectorAll('button')).map(function(b){return b.textContent;}),
    right:(c.querySelector('.r')||{}).textContent||''};})()`);
  ok(!!card, '课程地图上出现了《' + TITLE + '》');
  ok(card && card.sub.indexOf('课后小测 5 题') >= 0 && card.sub.indexOf('含课内任务单') >= 0,
    '副标题写着课后小测 5 题 · 含课内任务单：' + (card && card.sub));
  ok(card && card.btn.length === 2 && card.btn[0].indexOf('课内任务单') >= 0 && card.btn[1].indexOf('课后小测') >= 0,
    '卡片给两个按钮（课内任务单 / 课后小测）：' + (card && card.btn.join(' / ')));
  // 有课后小测以后，课卡右边显示的是「小测」的状态（任务单状态在按钮上）
  ok(card && card.right.indexOf('未做') >= 0, '右边显示小测还没做（「未做」）：' + (card && card.right));
  ok(card && card.btn[0].indexOf('未填') >= 0, '课内任务单按钮上是「未填」：' + (card && card.btn[0]));
  await shot(cardExpr, '00-课程卡.png');

  console.log('\n-- 2. 打开任务单：三个板块、7 个可填行');
  await ev(`(function(){var c=${cardExpr};[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0].click();return 1;})()`);
  const up = await waitFor(`!document.getElementById('view-sheet').hidden && document.querySelectorAll('#sheetBody tr[data-rowi]').length===6`, 40, 300);
  ok(up, '任务单打开、6 个表格行都在（任务二 3 + 任务三 3），流程图另占 1 行');
  const flowRow = await ev(`!!document.querySelector('#sheetBody .sheet-flow[data-rowi="0"]')`);
  ok(flowRow, '任务一的流程图是 _i=0 那一块');
  const heads = await ev(`[].slice.call(document.querySelectorAll('#sheetBody .sheet-sec-head')).map(function(x){return x.textContent;})`);
  ok(heads.length === 3 && heads[0].indexOf('学习任务一') >= 0 && heads[1].indexOf('学习任务二') >= 0 && heads[2].indexOf('学习任务三') >= 0,
    '三个板块标题：' + heads.join(' | '));

  console.log('\n-- 3. 任务一：流程图上三个下拉');
  const fl = await ev(`(function(){var f=document.querySelector('#sheetBody .sheet-flow[data-rowi="0"]');
    if(!f)return null;
    var svg=f.querySelector('svg');var nodes=f.querySelectorAll('.fc-node');
    return {svgW:svg?+svg.getAttribute('viewBox').split(' ')[2]:0,
      nodes:nodes.length, sels:[].slice.call(f.querySelectorAll('select')).map(function(s){return {k:s.dataset.key,n:s.options.length,ph:s.options[0].textContent,phv:s.options[0].value};}),
      shapes:{diamond:f.querySelectorAll('polygon').length,rect:f.querySelectorAll('rect').length},
      k:f.dataset.k};})()`);
  ok(fl && fl.sels.length === 3, '流程图里有 3 个空位下拉：' + (fl && fl.sels.map((s) => s.k).join(',')));
  ok(fl && fl.sels.every((s) => s.n === 5 && s.phv === ''), '每个下拉 4 个候选 + 1 个空占位（' + (fl && fl.sels.map((s) => s.n).join(',')) + '）');
  ok(fl && fl.sels[0].ph === '▾ 请选…', '占位是「▾ 请选…」');
  ok(fl && fl.nodes === 12, '12 个节点都渲染出来了（开始/da/ci/输入/判断/输出/结束/判断/两个提示/输入/加1）');
  const words = await ev(`[].slice.call(document.querySelectorAll('#sheetBody .sheet-flow select[data-key="f1"] option')).slice(1).map(function(o){return o.value;}).sort().join('|')`);
  ok(words === ['ci ← 1', 'ci ← 0', 'da ← 1', 'ci ← ci + 1'].sort().join('|'), 'f1 四个候选：' + words);

  console.log('\n-- 4. 任务二 / 任务三：六行下拉');
  const rows = await ev(`(function(){var out=[];for(var i=1;i<=6;i++){var tr=document.querySelector('tr[data-rowi="'+i+'"]');if(!tr){out.push(null);continue;}
    out.push({label:tr.querySelector('.sheet-rowlabel')?tr.querySelector('.sheet-rowlabel').textContent:'',
      sels:[].slice.call(tr.querySelectorAll('select')).map(function(s){return {c:s.dataset.col,n:s.options.length};}),
      inputs:tr.querySelectorAll('input[data-col]').length});}
    return out;})()`);
  ok(rows.every((r) => r && r.inputs === 0 && r.sels.length === (r.sels[0].c === 'n' ? 1 : 2)), '六行都是下拉，没有要打字的地方');
  ok(rows[0] && rows[0].sels.length === 2 && rows[0].sels[0].c === 'small' && rows[0].sels[1].c === 'last', '任务二每行两列：小了几次 + 最后一行');
  ok(rows[3] && rows[3].sels.length === 1 && rows[3].sels[0].c === 'n', '任务三每行一列：最多几次');
  ok(rows.map((r) => r && r.label).join('|') === ['① 依次输入 30、40、55', '② 依次输入 60、55', '③ 第一次就输入 55',
    '① 从 1 开始，一个一个往上猜：1~100', '② 每次都猜剩余范围的中间数：1~100', '③ 每次都猜剩余范围的中间数：1~1000'].join('|'),
    '六行行首文字就是任务单原文');
  const code = await ev(`(function(){var p=document.querySelector('#sheetBody pre.sheet-code');return p?p.textContent:'';})()`);
  ok(code.indexOf('while cai != da:') >= 0 && code.indexOf('ci = ci + 1') >= 0, '任务二把程序原样显示出来（代码块在）');

  console.log('\n-- 5. 500px 窄屏不撑破');
  const wide = await ev(`({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth,
    tbl:[].slice.call(document.querySelectorAll('#sheetBody table')).map(function(t){return Math.round(t.getBoundingClientRect().width);}),
    sel:[].slice.call(document.querySelectorAll('#sheetBody select')).map(function(s){return Math.round(s.getBoundingClientRect().width);})})`);
  ok(wide.sw <= wide.cw + 1, '整页没有横向溢出（scrollWidth ' + wide.sw + ' ≤ ' + wide.cw + '）');
  ok(wide.tbl.every((w) => w <= 500), '表格宽度都在 500 以内：' + wide.tbl.join('/'));
  ok(Math.max.apply(null, wide.sel) <= 260, '最宽的下拉 ' + Math.max.apply(null, wide.sel) + 'px（不会被候选词撑爆）');
  await shot(`document.getElementById('sheetBody')`, '01-任务单全貌.png');

  console.log('\n-- 6. 全选对 → 保存 → 系统判分 3/3');
  const fill = async (vals) => ev(`(function(){
    var v=${JSON.stringify(vals)};
    Object.keys(v.f).forEach(function(k){var s=document.querySelector('#sheetBody .sheet-flow select[data-key="'+k+'"]');if(s){s.value=v.f[k];s.dispatchEvent(new Event('change',{bubbles:true}));}});
    v.r.forEach(function(p){var tr=document.querySelector('tr[data-rowi="'+p[0]+'"]');if(!tr)return;
      p[1].forEach(function(x){var s=tr.querySelector('select[data-col="'+x[0]+'"]');if(s){s.value=x[1];s.dispatchEvent(new Event('change',{bubbles:true}));}});});
    return 1;})()`);
  await fill({
    f: F,
    r: [[1, [['small', T2[0][0]], ['last', T2[0][1]]]], [2, [['small', T2[1][0]], ['last', T2[1][1]]]],
      [3, [['small', T2[2][0]], ['last', T2[2][1]]]],
      [4, [['n', T3[0]]]], [5, [['n', T3[1]]]], [6, [['n', T3[2]]]]],
  });
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  await waitFor(`document.querySelectorAll('#sheetAuto .auto-item').length===3`, 40, 300);
  const auto = await ev(`[].slice.call(document.querySelectorAll('#sheetAuto .auto-item')).map(function(li){return li.className+' :: '+li.querySelector('.auto-note').textContent;})`);
  const score = await ev(`(document.querySelector('#sheetAuto .auto-score')||{}).textContent`);
  ok(auto && auto.length === 3, '系统判分面板列出 3 个任务');
  ok(auto && auto.every((s) => s.indexOf('auto-ok') >= 0), '三个任务都 ✅：' + auto.join(' | '));
  ok(score && score.indexOf('3 / 3') >= 0, '得分 3 / 3');
  const wrongMarks = await ev(`document.querySelectorAll('#sheetBody .sheet-wrong, #sheetBody .fc-node.wrong').length`);
  ok(wrongMarks === 0, '没有标红的格子');
  await shot(`document.getElementById('sheetAuto')`, '02-系统判分全对.png');

  console.log('\n-- 7. 改错几处 → 重交 → 只掉对应任务');
  await fill({ f: { f1: F.f1, f2: F.f2, f3: 'ci ← 1' }, r: [[2, [['small', '1 次']]], [4, [['n', '50 次']]]] });
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  await sleep(1200);
  const auto2 = await ev(`[].slice.call(document.querySelectorAll('#sheetAuto .auto-item')).map(function(li){return li.className;})`);
  const score2 = await ev(`(document.querySelector('#sheetAuto .auto-score')||{}).textContent`);
  const reds = await ev(`({cell:document.querySelectorAll('#sheetBody .sheet-wrong').length, node:document.querySelectorAll('#sheetBody .fc-node.wrong').length})`);
  ok(auto2 && auto2[0].indexOf('auto-no') >= 0 && auto2[1].indexOf('auto-no') >= 0 && auto2[2].indexOf('auto-no') >= 0,
    '三处都改错 → 三个任务都 ❌');
  ok(score2 && score2.indexOf('0 / 3') >= 0, '得分 0 / 3');
  ok(reds.node === 1 && reds.cell === 2, '流程图那格标红 1 个框（f3），表格标红 2 格（任务二第2行 + 任务三第1行）：' + JSON.stringify(reds));
  await shot(`document.getElementById('sheetAuto')`, '03-系统判分有错.png');

  console.log('\n-- 8. 学生端不显示老师评分 / 证书状态');
  const cert = await ev(`(function(){var h=document.getElementById('sheetTeach');return {hidden:h?h.hidden:null,auto:!!document.getElementById('sheetAuto')};})()`);
  ok(cert.auto, '系统判分面板在学生端可见');
  ok(cert.hidden !== false, '「老师的评分」还没赋分时是隐藏的');

  console.log('\n-- 9. 课后小测：5 题；交卷 5/5 → 证书分母 8');
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('返回课程地图')>=0})[0];if(b)b.click();return 1;})()`);
  await waitFor(`document.querySelectorAll('.lesson').length>0`, 40, 300);
  await ev(`(function(){var c=${cardExpr};
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课后小测')>=0})[0];b.click();return 1;})()`);
  const quizOpen = await waitFor(`!document.getElementById('view-quiz').hidden && document.querySelectorAll('#quizBody .qcard').length===5`, 40, 300);
  ok(quizOpen, '课后小测打开：5 道题');
  const qtypes = await ev(`[].slice.call(document.querySelectorAll('#quizBody .qcard')).map(function(c){return c.querySelector('.qhead .pill').textContent;})`);
  ok(qtypes.length === 5 && qtypes[0].indexOf('判断') >= 0 && qtypes[1].indexOf('单选') >= 0 &&
    qtypes[2].indexOf('多选') >= 0 && qtypes[3].indexOf('填空') >= 0 && qtypes[4].indexOf('填空') >= 0,
    '题型就是判断 / 单选 / 多选 / 填空 / 填空：' + qtypes.join(' / '));
  const ans = await ev(`(function(){
    var cards=[].slice.call(document.querySelectorAll('#quizBody .qcard'));
    function clickOpt(ci,key){var o=[].slice.call(cards[ci].querySelectorAll('.opt')).filter(function(x){return x.querySelector('.k') && x.querySelector('.k').textContent===key;})[0];if(o)o.click();}
    var sw=[].slice.call(cards[0].querySelectorAll('.switch')).filter(function(x){return x.textContent.indexOf('错误')>=0})[0];if(sw)sw.click();
    clickOpt(1,${JSON.stringify(QUIZ.single)});
    ${JSON.stringify(QUIZ.multi)}.forEach(function(k){clickOpt(2,k);});
    function setSels(ci,vals){var sels=[].slice.call(cards[ci].querySelectorAll('select'));sels.forEach(function(s,j){if(vals[j]!=null){s.value=vals[j];s.dispatchEvent(new Event('change',{bubbles:true}));}});}
    setSels(3,${JSON.stringify(QUIZ.fill)});
    setSels(4,${JSON.stringify(QUIZ.ext)});
    return {
      cards:cards.length,
      judge:cards[0].querySelectorAll('.switch.on').length,
      single:cards[1].querySelectorAll('.opt.on').length,
      multi:cards[2].querySelectorAll('.opt.on').length,
      fill:[].slice.call(cards[3].querySelectorAll('select')).map(function(s){return s.value;}),
      ext:[].slice.call(cards[4].querySelectorAll('select')).map(function(s){return s.value;})
    };
  })()`);
  ok(ans && ans.cards === 5 && ans.judge === 1 && ans.single === 1 && ans.multi === 3, '第1-3题都选上了（判断/单选/多选）');
  ok(ans && JSON.stringify(ans.fill) === JSON.stringify(QUIZ.fill), '第4题 5 个空都填上了：' + (ans && ans.fill.join(' / ')));
  ok(ans && JSON.stringify(ans.ext) === JSON.stringify(QUIZ.ext), '第5题 5 个空都填上了：' + (ans && ans.ext.join(' / ')));
  await shot(`document.getElementById('quizBody')`, '04-课后小测5题.png');
  await ev(`document.getElementById('submitBtn').click()`);
  const done = await waitFor(`!document.getElementById('view-result').hidden`, 40, 300);
  const scoreTxt = await ev(`(function(){var n=document.querySelector('#resultBody .big-score');return n?n.textContent:'';})()`);
  ok(done && scoreTxt.indexOf('5 / 5') >= 0, '交卷得分 5 / 5：' + scoreTxt);
  await shot(`document.getElementById('resultBody')`, '05-小测满分.png');

  const cert1 = (await jfetch('/api/student/certs', 'GET', null, SA)).j;
  const it1 = (cert1.items || []).filter((x) => x.lessonId === LID)[0] || {};
  ok(it1.pending === true && it1.total === 5 && it1.pct === 100,
    '任务单还没批 → 先按小测口径发证（' + it1.earned + '/' + it1.total + '，' + it1.pct + '%）');
  const board = (await jfetch('/api/teacher/sheet-board/' + LID + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const rowMe = (board.students || []).filter((r) => r.name === A)[0];
  await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: rowMe.uid, tasks: { 1: true, 2: true, 3: true } }, T);
  const cert2 = (await jfetch('/api/student/certs', 'GET', null, SA)).j;
  const it2 = (cert2.items || []).filter((x) => x.lessonId === LID)[0] || {};
  ok(it2.total === 8, '证书分母 = 小测 5 + 任务单 3 = 8（不是 10 分制）');
  ok(it2.earned === 8 && it2.pct === 100 && it2.stars === 5, '老师批完 3 题 → 8/8、100%、5 星');
  ok(it2.issued === true && it2.pending === false, '证书颁发、不再是待批状态');

  child.kill();
  console.log('\n==== ' + (fail ? '有 ' + fail + ' 项没过' : '全部通过') + '（' + pass + ' 项）====');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
