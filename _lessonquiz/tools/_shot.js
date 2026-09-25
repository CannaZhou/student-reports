// 截图：无头 Edge 打开学生端 → 四年级第2课课内任务单 → 把课程地图和活动一各截一张图
// 用法：node tools/_shot.js <url> <loginName> <outDir>
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const PORT = 9444;
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
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_lq_shot'),
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
    // 只截某个元素：先取它在页面里的坐标，再按坐标截
    const box = await ev(`(function(){var n=document.querySelector(${JSON.stringify(sel)});if(!n)return null;var r=n.getBoundingClientRect();window.scrollTo(0,Math.max(0,r.top+window.scrollY-12));return new Promise(function(res){requestAnimationFrame(function(){requestAnimationFrame(function(){var b=n.getBoundingClientRect();res({x:Math.max(0,b.x-10),y:Math.max(0,b.y-10),width:Math.min(b.width+20,window.innerWidth),height:b.height+20});});});});})()`);
    if (!box) { console.log('没找到 ' + sel); return; }
    const r = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: box.x, y: box.y + (await ev('window.scrollY')), width: box.width, height: box.height, scale: 2 },
    });
    fs.writeFileSync(path.join(outDir, file), Buffer.from(r.result.data, 'base64'));
    console.log('已保存 ' + file + '  ' + Math.round(box.width) + 'x' + Math.round(box.height));
  };

  if (loginName) {
    await ev(`(function(){var n=document.getElementById('loginName');if(!n)return 'no-login';n.value=${JSON.stringify(loginName)};n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('loginGo').click();return 'ok';})()`);
    await sleep(1500);
  }
  await ev(`(function(){var t=[].slice.call(document.querySelectorAll('#gradeTabs .tab')).filter(function(x){return x.textContent.trim()==='4年级'})[0];if(t)t.click();return 'tab';})()`);
  await sleep(600);
  await shot('#mapBody', '预览-课程地图.png');

  await ev(`(function(){var c=[].slice.call(document.querySelectorAll('#mapBody .lesson')).filter(function(x){return x.textContent.indexOf('多样的数据')>=0})[0];if(!c)return 'no card';var b=[].slice.call(c.querySelectorAll('button')).filter(function(x){return x.textContent.indexOf('课内任务单')>=0})[0];if(b)b.click();return 'ok';})()`);
  await sleep(1500); // 图要加载完
  await shot('#sheetBody .sheet-sec', '预览-活动一.png');

  ws.close();
  try { child.kill(); } catch (e) {}
  await sleep(300);
  process.exit(0);
})();
