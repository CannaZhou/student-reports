// 赋分台「批量赋分」界面自检：勾选框 / 全选 / 批量条 / 一键给没交的记 0 分 / 绿行「未交·记0分」/ 赋分时间
// 用法：node tools/_ui-bulk.js   （跑在 7099 那台独立数据目录的实例上，别指生产）
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.env.BASE || 'http://127.0.0.1:7099';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9600 + Math.floor(Math.random() * 300);
const CLA = '六年级批量界面班';
const TAG = Date.now().toString(36).slice(-4);
const LID = '6-1-3';                       // 任务单 2 题
const A = '界甲' + TAG, B = '界乙' + TAG, C = '界丙' + TAG, D = '界丁' + TAG;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotDir = path.join(__dirname, '_tmp', 'bulkshot');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const cookie = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
async function jfetch(p, method, body, ck) {
  const h = {}; if (body) h['Content-Type'] = 'application/json'; if (ck) h.Cookie = ck;
  const r = await fetch(BASE + p, { method: method || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => ({})), ck: cookie(r) };
}

// 先把本测试班清空：脚本中途崩过会留下上一轮的学生，
// 脏数据会把「全选 / 已选几人」这类计数断言撑大，也会让「应用到选中」误伤别人。
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
  console.log('== 赋分台批量赋分 · 界面自检 ==');
  const T = (await jfetch('/api/teacher/login', 'POST', { password: '123456' })).ck;
  const cleaned = await purge(T);
  if (cleaned) console.log('  （先清掉上一轮残留的 ' + cleaned + ' 个测试生）');
  await jfetch('/api/teacher/roster', 'POST', { text: [A, B, C, D].map((n) => CLA + '，' + n).join('\n') }, T);
  const S = {};
  for (const n of [A, B, C, D]) S[n] = (await jfetch('/api/student/login', 'POST', { name: n })).ck;
  // 甲交了任务单；乙、丙没交；丁没交但先手工记了 1 分 —— 一键记 0 分不该动丁
  await jfetch('/api/lesson/' + LID + '/sheet/submit', 'POST', { rows: [{ _i: 0, lab: '界面自检', c1: '1', f1: 'x' }] }, S[A]);
  await jfetch('/api/teacher/sheet-board/' + LID + '/score', 'POST', { uid: D + '｜' + CLA, score: 1 }, T);
  ok(true, '测试数据已备好：' + A + ' 已交，' + B + '/' + C + ' 未交，' + D + ' 未交但已记 1 分');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bulkui-'));
  const child = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=500,1200', '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore' });

  let ws, send;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r)); send = mk(ws); break; }
    } catch (e) {}
    await sleep(250);
  }
  if (!send) { console.error('连不上无头 Edge'); child.kill(); process.exit(1); }
  await send('Page.enable'); await send('Runtime.enable');
  const ev = async (expr, awaitP) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitP });
    if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const shot = async (name) => {
    fs.mkdirSync(shotDir, { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(shotDir, name + '.png'), Buffer.from(r.result.data, 'base64'));
  };

  // 打开赋分台并切到本测试班
  await send('Page.navigate', { url: BASE + '/teacher' });
  await sleep(1200);
  await ev("document.getElementById('pw').value='123456';document.getElementById('loginGo').click();");
  await sleep(1400);
  await ev("window.confirm=function(){return true;}");   // 一键记 0 分有确认框，无头模式会卡住
  await ev("document.querySelector('.tab[data-tab=\"overview\"]').click()");
  await sleep(1400);
  await ev("(function(){var tr=[].filter.call(document.querySelectorAll('tr'),function(r){return r.textContent.indexOf('第3课')>=0;})[0];var b=[].filter.call(tr.querySelectorAll('.btn'),function(x){return x.textContent.indexOf('课内任务单')>=0;})[0];b.click();})()");
  await sleep(1400);
  await ev("(function(){var c=[].filter.call(document.querySelectorAll('.cls-chip'),function(x){return x.textContent.indexOf('六年级批量界面班')>=0;})[0];if(c&&!c.classList.contains('on'))c.click();})()");
  await sleep(1400);

  console.log('\n-- 1. 批量条与勾选框都在，初始没选中');
  const init = await ev("(function(){var bar=document.querySelector('.bulk-bar');var allCb=document.querySelector('.tbl th input[type=checkbox]');var cbs=document.querySelectorAll('.tbl tr td input[type=checkbox]');return {bar:!!bar,text:bar?bar.textContent:'',allCb:!!allCb,n:cbs.length,apply:document.querySelector('.bulk-apply').disabled,zeroTxt:document.querySelector('.bulk-zero').textContent,zeroDis:document.querySelector('.bulk-zero').disabled};})()");
  ok(init.bar, '批量条已渲染');
  ok(init.allCb, '表头有全选框');
  ok(init.n === 4, '每行一个勾选框（' + init.n + ' 个，本班 4 人）');
  ok(init.apply === true, '没选中时「应用到选中」是灰的');
  ok(init.text.indexOf('勾选姓名前的方框') >= 0, '提示文案：' + init.text.slice(0, 24));
  ok(init.zeroTxt.indexOf('2 人') >= 0 && init.zeroDis === false, '一键按钮只数「没交且没赋分」的 2 人（丁已记分不算）：' + init.zeroTxt);
  await shot('01-初始');

  console.log('\n-- 2. 全选 → 批量条亮起、计数正确');
  await ev("document.querySelector('.tbl th input[type=checkbox]').click()");
  await sleep(300);
  const sel = await ev("(function(){var bar=document.querySelector('.bulk-bar');var cbs=document.querySelectorAll('.tbl tr td input[type=checkbox]');return {txt:bar.querySelector('.bulk-n').textContent,apply:document.querySelector('.bulk-apply').disabled,checked:[].filter.call(cbs,function(c){return c.checked;}).length};})()");
  ok(sel.checked === 4, '4 行都被勾上');
  ok(sel.txt.indexOf('已选 4 人') >= 0, '计数正确：' + sel.txt);
  ok(sel.apply === false, '「应用到选中」可点了');
  await ev("document.querySelector('.bulk-none').click()");
  await sleep(300);
  const off = await ev("(function(){var cbs=document.querySelectorAll('.tbl tr td input[type=checkbox]');return [].filter.call(cbs,function(c){return c.checked;}).length;})()");
  ok(off === 0, '「取消选择」把勾都清掉');

  console.log('\n-- 3. 一键给没交的记 0 分');
  await ev("document.querySelector('.bulk-zero').click()");
  await sleep(1600);
  const rows = await ev("(function(){var out={};[].forEach.call(document.querySelectorAll('.tbl tr'),function(r){var cbs=r.querySelector('td input[type=checkbox]');if(!cbs)return;var nm=r.querySelector('td').textContent.replace(/\s+/g,' ').trim();out[nm]={cls:r.className,text:r.textContent.replace(/\s+/g,' ')};});return out;})()");
  const key = (n) => Object.keys(rows).filter((k) => k.indexOf(n) >= 0)[0];
  const rb = rows[key(B)] || {}, rc = rows[key(C)] || {}, ra = rows[key(A)] || {}, rd = rows[key(D)] || {};
  ok(/row-scored/.test(rb.cls || ''), '未交但记了 0 分 → 变绿（' + (rb.cls || '') + '）');
  ok((rb.text || '').indexOf('未交·记0分') >= 0, '标签写明「未交·记0分」');
  ok((rb.text || '').indexOf('赋分于') >= 0, '显示赋分时间：' + ((rb.text || '').match(/赋分于[\d\/ :]*/) || [''])[0]);
  ok(/row-scored/.test(rc.cls || '') && (rc.text || '').indexOf('未交·记0分') >= 0, '同为「没交且没赋分」的丙也被记 0 分（一键按钮打的是全集）');
  ok(/row-scored/.test(rd.cls || '') && (rd.text || '').indexOf('未交·记1分') >= 0, '丁未交但已有 1 分 → 保持 1 分不变、也是绿行');
  ok((rd.text || '').indexOf('未交·记1分') >= 0 && (rd.text || '').indexOf('记0分') < 0, '一键记 0 分没有误伤丁的 1 分');
  ok(/row-noscore/.test(ra.cls || ''), '已交未赋分的（' + A + '）仍是橙行');
  const zeroAfter = await ev("(function(){var b=document.querySelector('.bulk-zero');return {txt:b.textContent,dis:b.disabled};})()");
  ok(zeroAfter.dis === true && zeroAfter.txt.indexOf('0 个') >= 0, '记完后按钮自己变灰：' + zeroAfter.txt);
  await shot('02-一键零分后');

  console.log('\n-- 4. 批量按选中记分 / 批量清除');
  await ev("(function(){var cs=document.querySelectorAll('.tbl tr td input[type=checkbox]');cs[0].click();cs[1].click();})()");
  await sleep(300);
  await ev("document.querySelector('.bulk-bar input.score-in').value='2'");
  await ev("document.querySelector('.bulk-apply').click()");
  await sleep(1600);
  const after = await ev("(function(){var out=[];[].forEach.call(document.querySelectorAll('.tbl tr'),function(r){var cbs=r.querySelector('td input[type=checkbox]');if(!cbs)return;out.push({name:cbs.parentNode.textContent.replace(/\s+/g,' ').trim(),v:r.querySelector('input.score-in').value,cls:r.className});});return out;})()");
  const withV = after.filter((x) => x.v === '2');
  ok(withV.length === 2, '选中 2 人统一记 2 分（实际 ' + withV.length + ' 人）：' + withV.map((x) => x.name.slice(0, 6)).join(' '));
  ok(withV.every((x) => /row-scored/.test(x.cls)), '记完都变绿');
  const cleared = await ev("(function(){var cbs=document.querySelectorAll('.tbl tr td input[type=checkbox]');return [].filter.call(cbs,function(c){return c.checked;}).length;})()");
  ok(cleared === 0, '批量应用后自动取消勾选');
  // 清除：重新勾上刚记分的人 → 清除选中评分
  await ev("(function(){var cs=document.querySelectorAll('.tbl tr td input[type=checkbox]');cs[0].click();cs[1].click();})()");
  await sleep(300);
  await ev("document.querySelector('.bulk-clear').click()");
  await sleep(1600);
  const after2 = await ev("(function(){return [].map.call(document.querySelectorAll('.tbl tr td input.score-in'),function(i){return i.value;});})()");
  ok(after2.filter((v) => v === '2').length === 0, '清除选中后那 2 人的 2 分没了');
  await shot('03-批量记分后');

  console.log('\n-- 5. 窄屏不撑破版式');
  const ov = await ev("({sw:document.documentElement.scrollWidth, iw:window.innerWidth})");
  ok(ov.sw <= ov.iw + 2, '500px 窄窗下页面不横向溢出（' + ov.sw + ' ≤ ' + ov.iw + '）');

  ws.close(); child.kill();
  for (const n of [A, B, C, D]) {
    await jfetch('/api/teacher/progress/delete', 'POST', { uid: n + '｜' + CLA }, T);
    await jfetch('/api/teacher/roster/delete', 'POST', { uid: n + '｜' + CLA }, T);
  }
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  console.log('\n截图在 ' + shotDir);
  console.log('== 通过 ' + pass + ' 项，失败 ' + fail + ' 项 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('自检异常：', e); process.exit(1); });
