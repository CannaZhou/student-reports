// 无头 Edge CDP 探针：node tools/_cdp.js <url> <loginName> <probeFile>
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const PORT = 9333;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = process.argv[2];
const loginName = process.argv[3] || '';
const probeFile = process.argv[4];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function cdpTargets() {
  const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
  return r.json();
}

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

async function ev(send, expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  if (r.result && r.result.result) return r.result.result.value;
  return undefined;
}

(async () => {
  const child = spawn(EDGE, [
    '--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(require('os').tmpdir(), 'edge_cdp_lq_probe'),
    '--no-first-run', '--disable-gpu', '--window-size=500,900', url,
  ], { detached: false, stdio: 'ignore' });
  let list = [];
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try { list = await cdpTargets(); if (list.some((t) => t.type === 'page' && t.url.includes('127.0.0.1'))) break; } catch (e) {}
  }
  const page = list.find((t) => t.type === 'page' && t.url.startsWith('http'));
  if (!page) { console.log('NO PAGE'); child.kill(); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const send = mk(ws);
  await send('Runtime.enable');
  await send('Page.enable');
  await sleep(600);

  if (loginName) {
    await ev(send, `(function(){var n=document.getElementById('loginName');if(!n)return 'no-login';n.value=${JSON.stringify(loginName)};n.dispatchEvent(new Event('input',{bubbles:true}));var g=document.getElementById('loginGo');if(g)g.click();return 'clicked';})()`);
    await sleep(1200);
  }

  if (probeFile) {
    const expr = fs.readFileSync(probeFile, 'utf8');
    const out = await ev(send, expr);
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  }
  ws.close();
  try { child.kill(); } catch (e) {}
  await sleep(300);
  process.exit(0);
})();
