// 只读截图：以真实学生身份登录阅读馆，拍书架/章节/AI伴读/存折/闯关。
// 不点「读完」「提交」，不写任何数据。
const { spawn, execSync } = require('child_process');
const os = require('os'), path = require('path'), fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
const STUDENT = process.env.STUDENT || '周陈尧';
const PW = process.env.PW || 'zqxx2025';
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900);
const TAG = process.env.TAG || 'a';
const OUT = path.join(__dirname, '_shots');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9500 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let msgId = 0;
function mk(ws) {
  const p = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
  return (m, q) => new Promise((res) => { const id = ++msgId; p.set(id, res); ws.send(JSON.stringify({ id, method: m, params: q || {} })); });
}
function compile(expr) { try { new Function('return (' + expr + ')'); return null; } catch (e) { return e.message; } }
(async () => {
  const child = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_cdp_shot_' + PORT),
    '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=' + W + ',' + H,
    BASE + '/reading.html'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);
  let list = [];
  for (let i = 0; i < 40; i++) { await sleep(300); try { list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); if (list.some((x) => x.type === 'page' && x.url.startsWith(BASE))) break; } catch (e) {} }
  const page = list.find((x) => x.type === 'page' && x.url.startsWith(BASE));
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  const send = mk(ws); await send('Runtime.enable'); await send('Page.enable');
  const ev = async (e) => {
    const bad = compile(e);
    if (bad) { console.log('SYNTAX ERROR: ' + bad); return undefined; }
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) console.log('EVAL ERR: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result && r.result.result.value;
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }); 
    fs.writeFileSync(path.join(OUT, TAG + '-' + name + '.png'), Buffer.from(r.result.data, 'base64'));
    console.log('shot', name);
  };
  await sleep(1200);
  const title = await ev('document.title');
  console.log('title:', title);
  // 登录
  await ev(`(function(){ document.getElementById('loginName').value=${JSON.stringify(STUDENT)}; document.getElementById('loginPw').value=${JSON.stringify(PW)}; doLogin(); return 1; })()`);
  for (let i = 0; i < 30; i++) { await sleep(300); const ok = await ev(`!!document.querySelector('#appBox') && !document.querySelector('#appBox').classList.contains('hidden')`); if (ok) break; }
  await sleep(1200);
  await shot('1shelf');
  // 章节 6
  await ev(`document.querySelector('.chapter-card[data-no="6"]').click()`);
  await sleep(1400); await shot('2chapter');
  // 点点
  await ev(`goCompanion(6)`);
  await sleep(1600); await shot('3chat');
  // 存折
  await ev(`switchView('passbook')`);
  await sleep(1400); await shot('4passbook');
  // 闯关
  await ev(`openChapter(6)`); await sleep(1200); await ev(`startQuiz(6)`); await sleep(1400); await shot('5quiz');
  const who = await ev(`document.getElementById('who') && document.getElementById('who').textContent`);
  console.log('who:', who);
  ws.close(); kill(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
