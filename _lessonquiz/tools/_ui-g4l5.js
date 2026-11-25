// 四上第5课《数据的获取》学生端 / 教师端界面自检：
//   课程卡两个按钮；任务单一页三个板块：任务一 4 行下拉、任务二 4 行下拉（因素印在行首，选调查问题）、
//   任务三只有题目文字（lines），不给任何可填格，也不占任务分；
//   两个任务都系统判得出（任务一教案两份预设答案都算对；任务二 4 个候选＝4 个答案，不放无关选项）；
//   500px 窄屏不撑破；小测 5 题交卷 5/5，加上任务单 2 分 → 证书 7/7、5 星。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-g4l5.js   （跑在隔离实例上，别指生产）
const { spawn } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9740 + Math.floor(Math.random() * 200);
const CLA = '四年级数据获取界面班';
const TAG = Date.now().toString(36).slice(-4);
const LID = '4-1-5';
const TITLE = '数据的获取';
const A = '获取界面甲' + TAG, B = '获取界面乙' + TAG;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotDir = path.join(__dirname, '_tmp', 'g4l5shot');

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

// 正确答案（与 tools/seed.js 一致；学生端拿不到，测试自己抄一份）
const WAYS = ['网络获取', '现场记录', '设备采集', '问卷调查']; // 任务一 4 行（天气用另一份预设也测）
const T2 = [                        // 任务二 4 个因素对应的正确调查问题（行首因素已印好，只选问题）
  '你现在读几年级？',
  '你是男生还是女生？',
  '你每天使用数字设备大约多长时间？',
  '你的家长支持你使用数字设备吗？',
];
const T2LABELS = ['年级', '性别', '每天使用时长', '家长的态度'];
const T2PICK = ['你现在读几年级？', '你是男生还是女生？', '你每天使用数字设备大约多长时间？',
  '你的家长支持你使用数字设备吗？'];
const QUIZ = {
  judge: 'B',                       // 第1题：小智说得不对
  single: 'B',                      // 第2题：问卷调查
  multi: ['A', 'B', 'C', 'D'],      // 第3题：四种方法全选
  fill: ['设计调查问题', '制作调查问卷', '开展问卷调查', '调查目的', '调查说明', '调查内容'],
  ext: ['收集速度快', '具体', '明确'],
};

(async () => {
  console.log('== 四上第5课《数据的获取》 界面自检 ==');
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

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'g4l5ui-'));
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
  // 每次求值前先过一遍语法：CDP 遇到语法错的表达式会静默回 undefined（不报错）
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
  const login = async () => {
    await waitFor(`document.readyState==='complete' && !!document.getElementById('loginGo')`, 40, 300);
    await ev(`(function(){var n=document.getElementById('loginName');n.value=${JSON.stringify(A)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 1;})()`);
    await waitFor(`document.querySelectorAll('#gradeTabs .tab').length>0`, 40, 300);
    await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='4年级'})[0];if(t)t.click();return 1;})()`);
    await waitFor(`[].slice.call(document.querySelectorAll('.lesson')).some(function(x){return x.textContent.indexOf(${JSON.stringify(TITLE)})>=0})`, 30, 300);
  };
  const setSheet = async (vals) => {
    const r = await ev(`(function(){
      var vals=${JSON.stringify(vals)};
      vals.sel.forEach(function(p){var tr=document.querySelector('tr[data-rowi="'+p[0]+'"]');if(!tr)return;var s=tr.querySelector('select');if(!s)return;s.value=p[1];s.dispatchEvent(new Event('change',{bubbles:true}));});
      vals.txt.forEach(function(p){var tr=document.querySelector('tr[data-rowi="'+p[0]+'"]');if(!tr)return;var n=tr.querySelector('input[data-col="'+p[1]+'"]');if(!n)return;n.value=p[2];n.dispatchEvent(new Event('input',{bubbles:true}));});
      return 1;})()`);
    return r;
  };

  console.log('\n-- 1. 课程地图：任务单 + 课后小测两个入口');
  await login();
  const card = await ev(`(function(){var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(TITLE)})>=0})[0];
    if(!c)return null;return {sub:c.querySelector('.sub').textContent,btn:[].slice.call(c.querySelectorAll('button')).map(function(b){return b.textContent;}),right:c.querySelector('.r').textContent};})()`);
  ok(!!card, '课程地图上出现了《' + TITLE + '》');
  ok(card && card.sub.indexOf('课后小测 5 题') >= 0, '副标题写着课后小测 5 题：' + (card && card.sub));
  ok(card && card.sub.indexOf('含课内任务单') >= 0, '副标题同时注明含课内任务单');
  ok(card && card.btn.length === 2 && card.btn[0].indexOf('课内任务单') >= 0 && card.btn[1].indexOf('课后小测') >= 0,
    '卡片给两个按钮（课内任务单 / 课后小测）：' + (card && card.btn.join(' / ')));
  ok(card && card.right.indexOf('未做') >= 0, '小测还没做，右边显示“未做”');
  await shot(`[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(TITLE)})>=0})[0]`, '00-课程卡.png');

  console.log('\n-- 2. 打开任务单：三个板块、8 个可填行');
  await ev(`(function(){var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(TITLE)})>=0})[0];
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];b.click();return 1;})()`);
  const up = await waitFor(`!document.getElementById('view-sheet').hidden && document.querySelectorAll('tr[data-rowi]').length===8`, 40, 300);
  ok(up, '任务单打开、8 个可填行都在（任务一 4 + 任务二 4）');
  const heads = await ev(`[].slice.call(document.querySelectorAll('#sheetBody .sheet-sec-head')).map(function(x){return x.textContent;})`);
  ok(heads.length === 3 && heads[0].indexOf('学习任务一') >= 0 && heads[1].indexOf('学习任务二') >= 0 && heads[2].indexOf('学习任务三') >= 0,
    '三个板块标题就是任务一 / 任务二 / 任务三：' + heads.join(' | '));

  console.log('\n-- 3. 任务一：4 行下拉');
  const s1 = await ev(`(function(){var out=[];
    for(var i=0;i<4;i++){var tr=document.querySelector('tr[data-rowi="'+i+'"]');if(!tr){out.push(null);continue;}
      var sel=tr.querySelector('select');var inp=tr.querySelector('input[data-col]');
      out.push({n:sel?sel.options.length:-1,hasSel:!!sel,hasInput:!!inp,ph:sel?sel.options[0].textContent:'',phv:sel?sel.options[0].value:'',cols:[].slice.call(tr.querySelectorAll('[data-col]')).map(function(x){return x.dataset.col;})});}
    return out;})()`);
  ok(s1.every((x) => x && x.hasSel && !x.hasInput), '任务一四行都是下拉（没有要打字的输入框）');
  ok(s1.every((x) => x.n === 5), '每个下拉 4 个候选 + 1 个占位（' + s1.map((x) => x.n).join(',') + '）');
  ok(s1.every((x) => x.ph === '▾ 请选…' && x.phv === ''), '占位项是「▾ 请选…」，空值，不会误当成作答');
  ok(s1.every((x) => x.cols.join(',') === 'scene,way'), '每行两列：场景（只读）+ 方法（下拉）');
  const words = await ev(`[].slice.call(document.querySelectorAll('tr[data-rowi="0"] select option')).slice(1).map(function(o){return o.value;}).sort().join('|')`);
  ok(words === WAYS.slice().sort().join('|'), '四个候选就是现场记录/问卷调查/网络获取/设备采集：' + words);

  console.log('\n-- 4. 任务二：4 行下拉（因素印在行首）');
  const s2 = await ev(`(function(){var out=[];
    for(var i=4;i<8;i++){var tr=document.querySelector('tr[data-rowi="'+i+'"]');if(!tr){out.push(null);continue;}
      var sel=tr.querySelector('select');var cells=[].slice.call(tr.querySelectorAll('td,th')).map(function(x){return x.textContent.trim();});
      out.push({label:cells[0],inputs:[].slice.call(tr.querySelectorAll('input[data-col]')).map(function(x){return x.dataset.col;}),
        sels:tr.querySelectorAll('select').length,n:sel?sel.options.length:-1,phv:sel?sel.options[0].value:''});}
    var ex=document.querySelector('#sheetBody tr.sheet-example');
    return {rows:out,ex:ex?ex.textContent:''};})()`);
  ok(s2.rows.every((x) => x && x.inputs.length === 0 && x.sels === 1), '任务二四行都是下拉（没有一个要打字的输入框）');
  ok(s2.rows.every((x, i) => x && x.label === T2LABELS[i]), '四个因素印在行首：' + (s2.rows || []).map((x) => x && x.label).join(' / '));
  ok(s2.rows.every((x) => x && x.n === 5 && x.phv === ''), '每个下拉 4 个候选问题 + 1 个占位');
  const words2 = await ev(`[].slice.call(document.querySelectorAll('tr[data-rowi="4"] select option')).slice(1).map(function(o){return o.value;}).sort().join('|')`);
  ok(words2 === T2PICK.slice().sort().join('|'), '候选问题就是四个因素各自对应的答案：' + words2);
  ok(!s2.ex, '没有范例行（因素已印好，不用再示范）');

  console.log('\n-- 5. 任务三：只有题目，没有任何可填格');
  const s3 = await ev(`(function(){
    var secs=document.querySelectorAll('#sheetBody .sheet-sec');var h=secs[2];
    return {lines:[].slice.call(h.querySelectorAll('.sheet-lines li')).map(function(x){return x.textContent;}),
      ctrl:h.querySelectorAll('input,select,textarea,button').length,
      rows:h.querySelectorAll('tr[data-rowi]').length,
      table:h.querySelectorAll('table').length};})()`);
  ok(s3 && s3.lines.length === 2, '任务三列出两道小题：' + (s3 && s3.lines.join(' / ')));
  ok(s3 && s3.lines[0].indexOf('下载调查问卷样例') >= 0 && s3.lines[1].indexOf('复制粘贴') >= 0, '题目文字就是任务单原文（下载样例 → 复制粘贴补充）');
  ok(s3 && s3.ctrl === 0 && s3.rows === 0 && s3.table === 0, '任务三没有任何输入框/下拉/表格——学生不用在平台上作答');
  await shot(`document.getElementById('sheetBody')`, '01-任务单全貌.png');

  console.log('\n-- 6. 全选对 → 保存 → 系统判分 2/2');
  await setSheet({ sel: [[0, WAYS[0]], [1, WAYS[1]], [2, WAYS[2]], [3, WAYS[3]],
    [4, T2[0]], [5, T2[1]], [6, T2[2]], [7, T2[3]]], txt: [] });
  const filled = await ev(`(function(){var out=[];for(var i=0;i<8;i++){var tr=document.querySelector('tr[data-rowi="'+i+'"]');out.push([].slice.call(tr.querySelectorAll('select,input')).map(function(x){return x.value;}));}return out;})()`);
  ok(filled[0][0] === WAYS[0] && filled[3][0] === WAYS[3], '任务一四行都选上了');
  ok(filled.slice(4).every((r, i) => r[0] === T2[i]), '任务二四行都选上了：' + filled.slice(4).map((r) => r[0]).join(' / '));
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const saved = await waitFor(`document.querySelectorAll('#sheetAuto .auto-item').length===2`, 40, 300);
  const auto = await ev(`[].slice.call(document.querySelectorAll('#sheetAuto .auto-item')).map(function(li){return {cls:li.className,note:li.querySelector('.auto-note').textContent};})`);
  ok(saved, '保存后「系统判分」面板列出 2 个任务');
  ok(auto && auto[0].cls.indexOf('auto-ok') >= 0, '任务一四行全对 → ✅（' + (auto && auto[0].note) + '）');
  ok(auto && auto[1].cls.indexOf('auto-ok') >= 0, '任务二四个问题全选对 → ✅（' + (auto && auto[1].note) + '）');
  const autoScore = await ev(`document.querySelector('#sheetAuto .auto-score').textContent`);
  ok(autoScore.indexOf('2 / 2') >= 0, '系统分显示“得了 2 / 2 分”：' + autoScore);
  await shot(`document.getElementById('sheetAuto')`, '02-系统判分2分.png');

  console.log('\n-- 7. 两个任务各自翻 ❌');
  await setSheet({ sel: [[0, '现场记录']], txt: [] });
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const back = await waitFor(`document.querySelectorAll('#sheetAuto .auto-item')[0].className.indexOf('auto-no')>=0`, 40, 300);
  const a2 = await ev(`[].slice.call(document.querySelectorAll('#sheetAuto .auto-item')).map(function(li){return {cls:li.className,note:li.querySelector('.auto-note').textContent};})`);
  ok(back, '天气那行选“现场记录” → 任务一变 ❌（' + (a2 && a2[0].note) + '）');
  ok(a2 && a2[1].cls.indexOf('auto-ok') >= 0, '任务二没动 → 照样 ✅，不被任务一连累');
  const sc1 = await ev(`document.querySelector('#sheetAuto .auto-score').textContent`);
  ok(sc1.indexOf('1 / 2') >= 0, '系统分掉成 1 / 2：' + sc1);
  await shot(`document.querySelector('#sheetBody .sheet-table')`, '03-任务一判错.png');
  // 把任务一改回来、只把任务二某一行选成干扰项
  await setSheet({ sel: [[0, WAYS[0]], [4, '你是男生还是女生？']], txt: [] });
  await ev(`document.getElementById('sheetSaveBtn').click()`);
  const back2 = await waitFor(`document.querySelectorAll('#sheetAuto .auto-item')[1].className.indexOf('auto-no')>=0`, 40, 300);
  const a3 = await ev(`[].slice.call(document.querySelectorAll('#sheetAuto .auto-item')).map(function(li){return {cls:li.className,note:li.querySelector('.auto-note').textContent};})`);
  ok(back2, '“年级”那行错选成“你是男生还是女生？” → 任务二变 ❌（' + (a3 && a3[1].note) + '）');
  ok(a3 && a3[0].cls.indexOf('auto-ok') >= 0, '任务一改回来 → ✅，不受任务二牵连');
  const sc2 = await ev(`document.querySelector('#sheetAuto .auto-score').textContent`);
  ok(sc2.indexOf('1 / 2') >= 0, '系统分仍是 1 / 2：' + sc2);

  console.log('\n-- 8. 窄屏 500px 不撑破');
  const wide = await ev(`(function(){var t=document.querySelector('#sheetBody table.sheet-table');
    return {w:t?t.getBoundingClientRect().width:0,inner:window.innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth};})()`);
  ok(wide.doc <= wide.inner + 2, '页面没有横向溢出（doc ' + wide.doc + ' ≤ 视口 ' + wide.inner + '）');
  ok(wide.w > 0 && wide.w <= wide.inner, '任务一表格收在视口内（' + Math.round(wide.w) + 'px）');
  const t2w = await ev(`(function(){var t=document.querySelectorAll('#sheetBody table.sheet-table')[1];
    return t?{w:t.getBoundingClientRect().width,right:t.getBoundingClientRect().right}:null;})()`);
  ok(t2w && t2w.w > 0 && t2w.right <= wide.inner + 1, '任务二表格也收在视口内（' + (t2w && Math.round(t2w.w)) + 'px）');
  const s3w = await ev(`(function(){var secs=document.querySelectorAll('#sheetBody .sheet-sec');var r=secs[2].getBoundingClientRect();return {w:r.width,right:r.right};})()`);
  ok(s3w.w > 0 && s3w.right <= wide.inner + 1, '任务三文字块也收在视口内（' + Math.round(s3w.w) + 'px）');
  await shot(`document.body`, '04-窄屏整页.png');

  console.log('\n-- 9. 教师端赋分台：2 个任务；小测 + 任务单齐了才发证');
  const board = await jfetch('/api/teacher/sheet-board/' + LID + '?class=' + encodeURIComponent(CLA), 'GET', null, T);
  const tasks = ((board.j.lesson || {}).tasks || []).map((t) => t.no + ':' + t.title);
  ok(tasks.length === 2 && tasks[0].indexOf('任务一') >= 0 && tasks[1].indexOf('任务二') >= 0, '赋分台列出 2 个任务：' + tasks.join(' / '));
  const rowA = (board.j.students || []).filter((s) => s.name === A)[0];
  const rowB = (board.j.students || []).filter((s) => s.name === B)[0];
  ok(!!rowA, '交过的 ' + A + ' 出现在名单里');
  ok(rowA && rowA.rows && rowA.rows.length === 8, '收上来 8 行（任务三没有行）');
  ok(rowA && rowA.auto && rowA.auto.tasks[0].ok === true, '老师看到的系统分：任务一 ✅（刚改回来了）');
  ok(rowA && rowA.auto && rowA.auto.tasks[1].ok === false, '任务二 ❌（有一行选成了别的问题）');
  ok(!!rowB && !rowB.submitted, '没交的 ' + B + ' 也在名单上、可以赋分（不自动打 0）');
  const m1 = await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: rowA.uid, task: 1, ok: true }, T);
  const m2 = await jfetch('/api/teacher/sheet-board/' + LID + '/task', 'POST', { uid: rowA.uid, task: 2, ok: true }, T);
  ok(m1.j.ok !== false && m2.j.ok !== false, '老师逐题打勾（任务一 ✓、任务二 ✓）能落盘');
  const cat = await jfetch('/api/catalog', 'GET', null, SA);
  const g4cat = (cat.j.catalog || []).filter((g) => g.grade === 4)[0];
  const l5 = g4cat.units[0].lessons.find((x) => x.id === LID);
  ok(l5 && l5.cert && l5.cert.issued === false && (l5.cert.missing || []).indexOf('quiz') >= 0,
    '只批了任务单、小测还没做 → 还不发证（差小测）');

  console.log('\n-- 10. 课后小测：5 题；交卷 5/5 → 证书 7/7');
  await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('返回课程地图')>=0})[0];if(b)b.click();return 1;})()`);
  await waitFor(`document.querySelectorAll('.lesson').length>0`, 20, 300);
  await ev(`(function(){var c=[].slice.call(document.querySelectorAll('.lesson')).filter(function(x){return x.textContent.indexOf(${JSON.stringify(TITLE)})>=0})[0];
    var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课后小测')>=0})[0];b.click();return 1;})()`);
  const quizOpen = await waitFor(`!document.getElementById('view-quiz').hidden && document.querySelectorAll('#quizBody .qcard').length===5`, 40, 300);
  ok(quizOpen, '课后小测打开：5 道题');
  const qtypes = await ev(`[].slice.call(document.querySelectorAll('#quizBody .qcard')).map(function(c){return c.querySelector('.qhead .pill').textContent;})`);
  ok(qtypes.length === 5 && qtypes[0].indexOf('判断') >= 0 && qtypes[1].indexOf('单选') >= 0 && qtypes[2].indexOf('多选') >= 0 && qtypes[3].indexOf('填空') >= 0 && qtypes[4].indexOf('填空') >= 0,
    '题型就是判断 / 单选 / 多选 / 填空 / 填空：' + qtypes.join(' / '));
  const ans = await ev(`(function(){
    var cards=[].slice.call(document.querySelectorAll('#quizBody .qcard'));
    function clickOpt(ci,key){var o=[].slice.call(cards[ci].querySelectorAll('.opt')).filter(function(x){return x.querySelector('.k')&&x.querySelector('.k').textContent===key;})[0];if(o)o.click();}
    var sw=[].slice.call(cards[0].querySelectorAll('.switch')).filter(function(x){return x.textContent.indexOf('错误')>=0})[0];if(sw)sw.click();
    clickOpt(1,${JSON.stringify(QUIZ.single)});
    ${JSON.stringify(QUIZ.multi)}.forEach(function(k){clickOpt(2,k);});
    function setSels(ci,vals){var sels=[].slice.call(cards[ci].querySelectorAll('select'));sels.forEach(function(s,j){if(vals[j]!=null){s.value=vals[j];s.dispatchEvent(new Event('change',{bubbles:true}));}});}
    setSels(3,${JSON.stringify(QUIZ.fill)});
    setSels(4,${JSON.stringify(QUIZ.ext)});
    return {cards:cards.length,judge:cards[0].querySelectorAll('.switch.on').length,single:cards[1].querySelectorAll('.opt.on').length,multi:cards[2].querySelectorAll('.opt.on').length,
      fill:[].slice.call(cards[3].querySelectorAll('select')).map(function(s){return s.value;}),ext:[].slice.call(cards[4].querySelectorAll('select')).map(function(s){return s.value;})};
  })()`);
  ok(ans && ans.cards === 5 && ans.judge === 1 && ans.single === 1 && ans.multi === 4, '第1-3题都选上了（判断/单选/多选）');
  ok(ans && JSON.stringify(ans.fill) === JSON.stringify(QUIZ.fill), '第4题 6 个空都填上了：' + (ans && ans.fill.join(' / ')));
  ok(ans && JSON.stringify(ans.ext) === JSON.stringify(QUIZ.ext), '第5题 3 个空都填上了：' + (ans && ans.ext.join(' / ')));
  await ev(`document.getElementById('submitBtn').click()`);
  const done = await waitFor(`!document.getElementById('view-result').hidden`, 40, 300);
  const scoreTxt = await ev(`(function(){var n=document.querySelector('#resultBody .big-score');return n?n.textContent:'';})()`);
  ok(done && scoreTxt.indexOf('5 / 5') >= 0, '交卷得分 5 / 5：' + scoreTxt);
  await shot(`document.getElementById('resultBody')`, '05-小测5题满分.png');
  const cat2 = await jfetch('/api/catalog', 'GET', null, SA);
  const g4cat2 = (cat2.j.catalog || []).filter((g) => g.grade === 4)[0];
  const l5b = g4cat2.units[0].lessons.find((x) => x.id === LID);
  ok(l5b && l5b.cert && l5b.cert.issued === true, '小测 5/5 + 任务单 2/2 → 本课证书颁发');
  ok(l5b && l5b.cert && l5b.cert.pct === 100 && l5b.cert.stars === 5,
    '证书分母 = 5 + 2 = 7，满分 100% → 5 星（' + (l5b && l5b.cert && l5b.cert.stars) + ' 星 / ' + (l5b && l5b.cert && l5b.cert.pct) + '%）');

  // 收尾：删掉测试生
  await jfetch('/api/teacher/progress/delete', 'POST', { uid: rowA.uid }, T);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: rowA.uid }, T);
  await jfetch('/api/teacher/roster/delete', 'POST', { uid: rowB.uid }, T);

  child.kill();
  console.log('\n==== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ====');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试自己崩了：', e); process.exit(2); });
