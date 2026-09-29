// 赋分台「系统按任务判分」界面自检：
// 每行的「系统 x/y + 任务①②③✅❌」小条、「按系统分填 N」一键填分、
// 展开提交内容后的判定条与判错标红（含标准答案），以及 500px 窄屏不撑破。
// 用法：BASE=http://127.0.0.1:7099 node tools/_ui-sheetgrade.js   （跑在隔离实例上，别指生产）
const { spawn, execSync } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9670 + Math.floor(Math.random() * 300);
const CLA = '六年级判分界面班';
const TAG = Date.now().toString(36).slice(-4);
const LID = '6-1-4';
const A = '判甲' + TAG, B = '判乙' + TAG;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotDir = path.join(__dirname, '_tmp', 'sgsht');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => ({})), ck: cookie(r) };
}

// 第4课的正确答案（与 tools/seed.js 里那份一致；学生端拿不到，这里是测试脚本自己抄的）
const PROG = {
  '在线打字': ['练打字：照着屏幕上的字打，练速度和正确率', '一开始总要低头看键盘，练多了就能盲打'],
  '画图': ['画画、涂色，还能用各种工具修改画面', '画错了可以撤销重来，比在纸上画省事'],
  'Word': ['写文章、做表格，排版好以后打印出来', '写错了随时能改，还能调字号、插图片'],
  '剪映': ['剪视频，加上字幕、音乐和转场效果', '手机电脑都能剪，加个字幕就有大片的感觉'],
};
// feel 给错的那一格：第几行换成谁的「使用体会」
function sheetRows(feelSwapRow) {
  const order = ['在线打字', '画图', 'Word', '剪映'];
  const rows = order.map((p, i) => ({
    _i: i, prog: p, func: PROG[p][0],
    feel: (i === feelSwapRow) ? PROG['剪映'][1] : PROG[p][1],
  }));
  return rows.concat([
    // 板块与行号（2026-09-29 任务二/三 对调后）：任务一 0~3、运算符 4~7、比较运算符 8~11、
    // 程序输出 12、手工算式 13、手工结果 14
    { _i: 4, sym: '＋ （加）', py: '+' }, { _i: 5, sym: '－ （减）', py: '-' },
    { _i: 6, sym: '× （乘）', py: '*' }, { _i: 7, sym: '÷ （除）', py: '/' },
    { _i: 8, op: '==', mean: '等于' }, { _i: 9, op: '!=', mean: '不等于' },
    { _i: 10, op: '>', mean: '大于' }, { _i: 11, op: '<', mean: '小于' },
    { _i: 12, tou: '35', jiao: '94', ji: '23', tu: '12' },
    { _i: 13, tuExpr: '(94-35×2)÷2=12（只）', jiExpr: '35-12=23（只）' },
    { _i: 14, tou: '35', jiao: '94', ji: '23', tu: '12' },
  ]);
}

async function purge(T) {
  const list = (await jfetch('/api/teacher/roster', 'GET', null, T)).j.list || [];
  const junk = list.filter((s) => s.className === CLA);
  for (const s of junk) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: s.uid }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: s.uid }, T);
  }
  return junk.length;
}

let msgId = 0;
function mk(ws) {
  const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
  return (method, params) => new Promise((res) => { const id = ++msgId; p.set(id, res); ws.send(JSON.stringify({ id, method, params: params || {} })); });
}

(async () => {
  console.log('== 赋分台「系统按任务判分」界面自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  ok(!!T, '教师登录');
  const cleaned = await purge(T);
  if (cleaned) console.log('  （先清掉上一轮残留的 ' + cleaned + ' 个测试生）');
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B].map((n) => CLA + '，' + n).join('\n') }, T);
  const SA = (await jfetch('/api/student/login', 'POST', { name: A })).ck;
  const SB = (await jfetch('/api/student/login', 'POST', { name: B })).ck;
  // 甲全对；乙把第 1 行的「使用体会」选错了（任务一应当判错，任务二三照旧对）
  const ra = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: sheetRows(-1) }, SA)).j;
  const rb = (await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: sheetRows(0) }, SB)).j;
  ok(ra.auto && ra.auto.score === 3, '甲交上来 = 系统 3/3');
  ok(rb.auto && rb.auto.score === 2 && rb.auto.tasks[0].ok === false, '乙交上来 = 系统 2/3（任务一错）');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsht-'));
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=500,1400', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);

  let ws, send;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r)); send = mk(ws); break; }
    } catch (e) {}
    await sleep(250);
  }
  if (!send) { console.error('连不上无头 Edge'); kill(); process.exit(1); }
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const shot = async (name) => {
    fs.mkdirSync(shotDir, { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(shotDir, name + '.png'), Buffer.from(r.result.data, 'base64'));
  };

  await send('Page.navigate', { url: BASE + '/teacher' });
  await sleep(1200);
  await ev("document.getElementById('pw').value='123456';document.getElementById('loginGo').click();");
  await sleep(1400);
  await ev("window.confirm=function(){return true;}");
  await ev("document.querySelector('.tab[data-tab=\"overview\"]').click()");
  await sleep(1400);
  // 第4课 → 课内任务单 → 切到本测试班
  await ev("(function(){var tr=[].filter.call(document.querySelectorAll('tr'),function(r){return r.textContent.indexOf('第4课')>=0;})[0];var b=[].filter.call(tr.querySelectorAll('.btn'),function(x){return x.textContent.indexOf('课内任务单')>=0;})[0];b.click();})()");
  await sleep(1400);
  await ev("(function(){var c=[].filter.call(document.querySelectorAll('.cls-chip'),function(x){return x.textContent.indexOf('六年级判分界面班')>=0;})[0];if(c&&!c.classList.contains('on'))c.click();})()");
  await sleep(1500);

  console.log('\n-- 1. 每行的「系统 x/y + 任务①②③」小条');
  const lines = await ev(`(function(){
    var out={};
    [].forEach.call(document.querySelectorAll('.tbl tr'),function(r){
      var cb=r.querySelector('td input[type=checkbox]'); if(!cb) return;
      var nm=cb.parentNode.textContent.replace(/\\s+/g,' ').trim();
      var sl=r.querySelector('.sys-line');
      out[nm]={ sys: sl?sl.textContent.replace(/\\s+/g,' '):'', tasks:[].slice.call(r.querySelectorAll('.sys-task')).map(function(x){return x.className.replace('sys-task ','')+':'+x.textContent}) };
    }); return out;})()`);
  const key = (n) => Object.keys(lines).filter((k) => k.indexOf(n) >= 0)[0];
  const la = lines[key(A)] || {}, lb = lines[key(B)] || {};
  ok(/系统\s*3\/3/.test(la.sys || ''), '甲那行写着「' + (la.sys || '') + '」');
  ok((la.tasks || []).join(' ').indexOf('st-ok') >= 0 && (la.tasks || []).join(' ').indexOf('st-no') < 0, '甲三个任务都是绿的：' + la.tasks.join(' '));
  ok(/系统\s*2\/3/.test(lb.sys || ''), '乙那行写着「' + (lb.sys || '') + '」');
  ok((lb.tasks || []).length === 3 && /st-no/.test(lb.tasks[0]) && /st-ok/.test(lb.tasks[1]) && /st-ok/.test(lb.tasks[2]),
    '乙只有任务①是红的：' + lb.tasks.join(' '));
  await shot('01-赋分台系统分');

  console.log('\n-- 2. 「按系统分填 N」一键填分');
  await ev(`(function(){
    var cbs=document.querySelectorAll('.tbl tr td input[type=checkbox]');
    [].forEach.call(cbs,function(cb){ var r=cb.closest('tr'); if(r.textContent.indexOf(${JSON.stringify(A)})>=0||r.textContent.indexOf(${JSON.stringify(B)})>=0) cb.click(); });
  })()`);
  await sleep(300);
  // 逐行点「按系统分填」：等价于老师认可系统的判分
  await ev("(function(){[].forEach.call(document.querySelectorAll('.sys-fill'),function(b){b.click();});})()");
  await sleep(1800);
  // 用「名字包含」去认行，不要拿整格文字当 key：赋完分那一格会多出「已赋分/赋分于…」，文字变了
  const filled = await ev("(function(){var o=[];[].forEach.call(document.querySelectorAll('.tbl tr'),function(r){var cb=r.querySelector('td input[type=checkbox]');if(!cb)return;o.push({t:cb.parentNode.textContent.replace(/\\s+/g,' '),v:r.querySelector('input.score-in').value});});return o;})()");
  const valOf = (n) => { const x = filled.filter((r) => r.t.indexOf(n) >= 0)[0]; return x ? x.v : '查无此人'; };
  ok(valOf(A) === '3' && valOf(B) === '2', '一键填分：甲 ' + valOf(A) + ' 分、乙 ' + valOf(B) + ' 分');
  const board = (await jfetch('/api/teacher/sheet-board/' + LID + '?class=' + encodeURIComponent(CLA), 'GET', null, T)).j;
  const rowOf = (n) => (board.students || []).find((x) => x.name === n) || {};
  ok(rowOf(A).score === 3 && rowOf(B).score === 2, '老师端落盘的分就是 3 和 2（采纳系统评分＝一次点击）');

  console.log('\n-- 3. 展开「提交内容」：判定条 + 判错标红 + 标准答案');
  const det = await ev(`(function(){
    var r=[].filter.call(document.querySelectorAll('.tbl tr'),function(x){return x.textContent.indexOf(${JSON.stringify(B)})>=0 && x.querySelector('td input[type=checkbox]');})[0];
    var v=[].filter.call(r.querySelectorAll('.btn'),function(x){return x.textContent==='查看';})[0];
    if(v) v.click();
    var d=r.nextElementSibling;
    if(!d) return null;
    return { bar: (d.querySelector('.sys-bar')||{}).textContent||'',
      wrong: [].slice.call(d.querySelectorAll('td.td-wrong')).map(function(td){return td.textContent.replace(/\\s+/g,' ');}),
      want: [].slice.call(d.querySelectorAll('.fix-want')).map(function(x){return x.textContent;}) };})()`);
  ok(det && /系统按任务判分/.test(det.bar), '展开后有判定条：' + ((det && det.bar) || '').slice(0, 60));
  ok(det && /任务①.*❌ 1 处不对/.test(det.bar), '判定条点名任务①错了 1 处');
  ok(det && det.wrong.length === 1 && /应为/.test(det.want.join('')), '判错的那一格标红并写出标准答案：' + (det && det.want.join(' ')));
  // 判定条是老师端专有的；学生端拿到的 auto 里没有 want/keys（那条在 _smoke-6-1-4.js 里断言）。
  // 这里只确认渲染出来的 DOM 上没有把内部字段当文本印出来。
  const leak = await ev(`(function(){var t=document.body.innerText;return /matchBy|"want"|\\bkeys\\b/.test(t)?t.match(/matchBy|"want"|\\bkeys\\b/)[0]:'';})()`);
  ok(leak === '', '页面上没有把内部字段名当文本印出来（实际 ' + JSON.stringify(leak) + '）');
  await shot('02-展开判错');

  console.log('\n-- 4. 窄屏不撑破版式');
  const ov = await ev("({sw:document.documentElement.scrollWidth, iw:window.innerWidth})");
  ok(ov.sw <= ov.iw + 2, '500px 窄窗下页面不横向溢出（' + ov.sw + ' ≤ ' + ov.iw + '）');

  ws.close(); kill(); await sleep(300);
  for (const n of [A, B]) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: n + '｜' + CLA }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: n + '｜' + CLA }, T);
  }
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  console.log('\n截图在 ' + shotDir);
  console.log('== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检异常：', e); process.exit(1); });
