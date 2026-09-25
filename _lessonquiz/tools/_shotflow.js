// 截流程图：无头 Edge 打开学生端 → 6年级第1课 → 答到流程图那题 → 把 SVG 整块截下来
// 用法：node tools/_shotflow.js <url> <loginName> <outDir>
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const PORT = 9446;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = process.argv[2];
const loginName = process.argv[3] || '';
const outDir = process.argv[4] || '.';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
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
  const child = spawn(EDGE, [
    '--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_lq_flow'),
    '--no-first-run', '--disable-gpu', '--force-device-scale-factor=2', '--window-size=520,1000', url,
  ], { detached: false, stdio: 'ignore' });

  let list = [];
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try { list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); if (list.some((t) => t.type === 'page' && t.url.startsWith('http'))) break; } catch (e) {}
  }
  const page = list.find((t) => t.type === 'page' && t.url.startsWith('http'));
  if (!page) { console.log('NO PAGE'); child.kill(); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const send = mk(ws);
  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(700);

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const shot = async (sel, file) => {
    const box = await ev(`(function(){var n=document.querySelector(${JSON.stringify(sel)});if(!n)return null;var r=n.getBoundingClientRect();window.scrollTo(0,Math.max(0,r.top+window.scrollY-12));return new Promise(function(res){requestAnimationFrame(function(){requestAnimationFrame(function(){var b=n.getBoundingClientRect();res({x:Math.max(0,b.x-10),y:Math.max(0,b.y-10),width:b.width+20,height:b.height+20});});});});})()`);
    if (!box) { console.log('没找到 ' + sel); return; }
    const sy = await ev('window.scrollY');
    const r = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: box.x, y: box.y + sy, width: box.width, height: box.height, scale: 2 },
    });
    fs.writeFileSync(path.join(outDir, file), Buffer.from(r.result.data, 'base64'));
    console.log('已保存 ' + file + '  ' + Math.round(box.width) + 'x' + Math.round(box.height));
  };

  await ev(`(function(){var n=document.getElementById('loginName');if(!n)return 'no-login';n.value=${JSON.stringify(loginName)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 'ok';})()`);
  await sleep(1600);
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='6年级'})[0];if(t)t.click();return 'tab';})()`);
  await sleep(700);
  await ev(`(function(){var c=[].slice.call(document.querySelectorAll('#mapBody .lesson')).filter(function(x){return x.textContent.indexOf('算法与问题解决')>=0})[0];if(c)c.click();return 'ok';})()`);
  await sleep(2000);

  await shot('#quizBody', '预览-六年级第1课.png');
  await shot('.fc', '预览-流程图.png');

  ws.close();
  try { child.kill(); } catch (e) {}
  await sleep(300);
  process.exit(0);
})();
