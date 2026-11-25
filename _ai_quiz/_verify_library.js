// 名家绘本界面验收：隔离实例（8083，临时数据）+ 无头 Edge 截图
// 用法：node _verify_library.js
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');

const ROOT = __dirname;
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, '_shots');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 8083;
const BASE = 'http://127.0.0.1:' + PORT;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 隔离数据 ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'libview-'));
for (const f of ['bank.json', 'books.json']) {
  fs.copyFileSync(path.join(APP, 'data', f), path.join(tmp, f));
}
fs.copyFileSync(path.join(APP, 'content', 'library.json'), path.join(tmp, 'library.json'));
fs.writeFileSync(path.join(tmp, 'library-quizzes.json'), JSON.stringify({ version: 1, quizzes: {} }));

const { Store } = require(path.join(APP, 'core', 'store.js'));
const sessions = require(path.join(APP, 'core', 'sessions.js'));
const bank = require(path.join(APP, 'core', 'bank.js'));
const { hashPassword } = require(path.join(APP, 'core', 'auth.js'));
const { createRouter } = require(path.join(APP, 'routes', 'router.js'));
const studentRoutes = require(path.join(APP, 'routes', 'student.js'));
const teacherRoutes = require(path.join(APP, 'routes', 'teacher.js'));
const readingRoutes = require(path.join(APP, 'routes', 'reading.js'));
const libraryRoutes = require(path.join(APP, 'routes', 'library.js'));
const staticServe = require(path.join(APP, 'routes', 'static.js')).serve;
const { json } = require(path.join(APP, 'routes', 'helpers.js'));

const CONFIG = {
  port: PORT, host: '127.0.0.1',
  dataDir: tmp, contentDir: tmp, mediaDir: path.join(APP, 'media'), publicDir: path.join(APP, 'public'),
  totalDays: 50, daySize: 50, scorePerQuestion: 2,
  defaultStudentPassword: 'test2026',
  maxUploadMB: 20, loginFail: { attempts: 5, lockMinutes: 15 },
  sessionTtlHours: 12, maxQuestionLength: 2000,
};
fs.writeFileSync(path.join(tmp, 'students.json'), JSON.stringify({
  version: 1, studentPassword: hashPassword('test2026'), list: [{ name: '测试小明', active: true }],
}));
fs.writeFileSync(path.join(tmp, 'teacher.json'), JSON.stringify({
  version: 1, passwordHash: hashPassword('admin'), mustChangePassword: false, sessionTtlHours: 12,
}));

const store = new Store(CONFIG).loadAll();
sessions.init(CONFIG);
bank.build(store.bank);
const router = createRouter();
studentRoutes.register(router, { store, config: CONFIG });
teacherRoutes.register(router, { store, config: CONFIG });
readingRoutes.register(router, { store, config: CONFIG });
libraryRoutes.register(router, { store, config: CONFIG });

const server = http.createServer(async (req, res) => {
  try {
    const handled = await router.dispatch(req, res, { store, config: CONFIG });
    if (handled === false) staticServe(req, res, { store, config: CONFIG });
  } catch (e) {
    console.error('ERR', e);
    json(res, 500, { ok: false, error: { msg: String(e.message) } });
  }
});

// ---------- CDP ----------
let msgId = 0;
function mk(ws) {
  const p = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); }
  });
  return (m, q) => new Promise((res) => { const id = ++msgId; p.set(id, res); ws.send(JSON.stringify({ id, method: m, params: q || {} })); });
}
function compile(expr) { try { new Function('return (' + expr + ')'); return null; } catch (e) { return e.message; } }

let ev, shot, send, ws;

async function setViewport(w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false });
}
async function go(url) {
  await send('Page.navigate', { url });
  await sleep(1400);
}

(async () => {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  fs.mkdirSync(OUT, { recursive: true });
  console.log('隔离实例 ' + BASE);

  const cdpPort = 9500 + Math.floor(Math.random() * 300);
  const child = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + cdpPort,
    '--user-data-dir=' + path.join(os.tmpdir(), 'edge_lib_' + cdpPort),
    '--no-first-run', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1200,900', BASE + '/reading.html'], { stdio: 'ignore' });
  const kill = () => { try { execSync('taskkill /PID ' + child.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', kill);

  let list = [];
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try { list = await (await fetch('http://127.0.0.1:' + cdpPort + '/json/list')).json(); if (list.some((x) => x.type === 'page' && x.url.startsWith(BASE))) break; } catch (e) {}
  }
  const page = list.find((x) => x.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  send = mk(ws);
  await send('Runtime.enable');
  await send('Page.enable');

  ev = async (expr) => {
    const bad = compile(expr);
    if (bad) { console.log('SYNTAX ERROR: ' + bad); return undefined; }
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) console.log('EVAL ERR:', JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result && r.result.result && r.result.result.value;
  };
  shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(path.join(OUT, 'lib-' + name + '.png'), Buffer.from(r.result.data, 'base64'));
    console.log('  shot lib-' + name + '.png');
  };
  const waitImg = async () => {
    for (let i = 0; i < 40; i++) {
      const n = await ev(`(function(){var a=[...document.images];return a.length && a.every(function(i){return i.complete && i.naturalWidth>0;});})()`);
      if (n) return true;
      await sleep(250);
    }
    return false;
  };

  try {
    await sleep(1000);
    await setViewport(1200, 1000);

    // 1. 登录并看书架
    await go(BASE + '/reading.html');
    await ev(`(function(){document.getElementById('loginName').value='测试小明';document.getElementById('loginPw').value='test2026';doLogin();return 1;})()`);
    await sleep(1800);
    await waitImg();
    await shot('01-shelf-1200');
    await ev(`window.scrollTo(0, document.querySelector('.shelf-group').offsetTop - 90)`);
    await sleep(700);
    await shot('01b-shelf-books');
    await ev(`switchView('passbook')`);
    await sleep(1400);
    await shot('01c-passbook');
    const bookCount = await ev(`document.querySelectorAll('.book3d').length`);
    const bookTitles = await ev(`[...document.querySelectorAll('.book3d .bt')].map(function(e){return e.textContent;}).join('|')`);
    console.log('  书架名家绘本数 =', bookCount, '｜', bookTitles);

    // 2. 书目页
    await go(BASE + '/library.html?id=fd-ai');
    await sleep(700);
    await waitImg();
    await shot('02-book-1200');
    const chCount = await ev(`document.querySelectorAll('.ch-card').length`);
    const locked = await ev(`document.querySelectorAll('.ch-card.locked').length`);
    console.log('  章节数 =', chCount, '| 锁定 =', locked);

    // 3. 阅读器第 1 页
    await go(BASE + '/reader.html?id=fd-ai&ch=1');
    await sleep(1600);
    await waitImg();
    await shot('03-reader-p1');
    console.log('  页码 =', await ev(`document.getElementById('pageNum').textContent`));
    const imgState = await ev(`(function(){var i=document.querySelector('#layerA img');return {w:i.naturalWidth,h:i.naturalHeight,shown:i.clientWidth+'x'+i.clientHeight,op:i.style.opacity};})()`);
    console.log('  首图 =', JSON.stringify(imgState));

    // 4. 翻两页
    await ev(`document.getElementById('nextBtn').click()`);
    await sleep(900);
    await ev(`document.getElementById('nextBtn').click()`);
    await sleep(900);
    await waitImg();
    await shot('04-reader-p3');
    console.log('  翻页后页码 =', await ev(`document.getElementById('pageNum').textContent`));

    // 5. 目录
    await ev(`document.getElementById('tocBtn').click()`);
    await sleep(600);
    await shot('05-toc');
    console.log('  目录条目 =', await ev(`document.querySelectorAll('.toc-item').length`));
    await ev(`document.getElementById('tocClose').click()`);
    await sleep(500);

    // 6. 跳最后一页 → 打卡卡
    await ev(`document.getElementById('stage').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))`);
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'End'}))`);
    await sleep(1200);
    await waitImg();
    await shot('06-reader-last');
    console.log('  末页页码 =', await ev(`document.getElementById('pageNum').textContent`),
      '| 打卡卡显示 =', await ev(`document.getElementById('checkin').classList.contains('show')`));

    // 7. 打卡
    const noteSet = await ev(`(function(){var t=document.getElementById('ckNote');if(!t)return 'no-ta';t.value='小海会读心，太酷了！';return 'ok';})()`);
    console.log('  感想框 =', noteSet);
    await ev(`document.getElementById('ckSubmit').click()`);
    await sleep(1500);
    await shot('07-reader-checked');
    console.log('  打卡后 =', await ev(`document.getElementById('ckInner').textContent.replace(/\\s+/g,' ').slice(0,80)`));

    // 8. 回书目页看第 2 章解锁
    await go(BASE + '/library.html?id=fd-ai');
    await sleep(700);
    await waitImg();
    await shot('08-book-unlocked');
    console.log('  锁定章节数（应为6）=', await ev(`document.querySelectorAll('.ch-card.locked').length`));

    // 9. 窄屏
    await setViewport(500, 900);
    await go(BASE + '/reading.html');
    await sleep(1400);
    await waitImg();
    await shot('09-shelf-500');
    console.log('  窄屏横向滚动 =', await ev(`document.documentElement.scrollWidth > window.innerWidth + 1`));
    await ev(`window.scrollTo(0, document.querySelector('.shelf-group').offsetTop - 70)`);
    await sleep(700);
    await shot('09b-shelf-500-books');
    await go(BASE + '/library.html?id=fd-data');
    await sleep(900);
    await waitImg();
    await shot('10-book-500');
    console.log('  窄屏书目横向滚动 =', await ev(`document.documentElement.scrollWidth > window.innerWidth + 1`));
    await go(BASE + '/reader.html?id=fd-data&ch=1');
    await sleep(1600);
    await waitImg();
    await shot('11-reader-500');
    console.log('  窄屏阅读器横向滚动 =', await ev(`document.documentElement.scrollWidth > window.innerWidth + 1`));

    // 10. 未登录访问（换个干净浏览器上下文不好搞，直接看 401 跳转逻辑）
    await setViewport(1200, 900);
    await go(BASE + '/reader.html?id=fd-ai&ch=9');
    await sleep(1500);
    await shot('12-reader-bad-ch');
    console.log('  不存在的章 =', await ev(`document.getElementById('errBox') ? document.getElementById('errBox').textContent.slice(0,40) : '无'`));
  } finally {
    ws.close();
    kill();
    server.close();
    setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 300);
  }
})().catch((e) => { console.error(e); process.exit(1); });
