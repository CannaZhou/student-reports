// 小AI探险队 · 知识阅读馆 学生端逻辑
const $ = (s) => document.querySelector(s);
const view = $('#view');
const state = { me: null, currentChapterNo: null };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) {
    const msg = (j.error && j.error.msg) || '请求失败';
    if (j.error && j.error.code === 429) { toast(msg); }
    else throw new Error(msg);
  }
  return j;
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------- 登录 ----------------
async function init() {
  try {
    const r = await api('GET', '/api/reading/shelf');
    setLoggedIn(r.name);
    switchView('shelf');
  } catch (e) {
    $('#loginBox').classList.remove('hidden');
    $('#loginName').focus();
  }
}

function setLoggedIn(name) {
  state.me = { name };
  $('#loginBox').classList.add('hidden');
  $('#appBox').classList.remove('hidden');
  $('#who').textContent = '👋 ' + name;
  $('#who').classList.remove('hidden');
  $('#logoutBtn').classList.remove('hidden');
}

async function doLogin() {
  const name = $('#loginName').value.trim();
  const password = $('#loginPw').value;
  if (!name) return toast('请填写姓名');
  try {
    const r = await api('POST', '/api/student/login', { name, password });
    setLoggedIn(r.name);
    $('#loginPw').value = '';
    switchView('shelf');
  } catch (e) { toast(e.message); }
}
$('#loginName').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('#loginPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('#logoutBtn').addEventListener('click', async () => {
  try { await api('POST', '/api/student/logout', {}); } catch (e) {}
  location.reload();
});

// ---------------- 视图切换 ----------------
function switchView(name) {
  document.querySelectorAll('#mainNav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'shelf') renderShelf();
  else if (name === 'companion') renderCompanion();
  else if (name === 'passbook') renderPassbook();
  else if (name === 'board') renderBoard();
}
$('#mainNav').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  switchView(b.dataset.view);
});

// ---------------- 书架 ----------------
async function renderShelf() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/reading/shelf');
    const s = r.shelf;
    let html = `<div class="book-intro">
      <h2>${esc(r.title)}</h2>
      <p>${esc(r.subtitle)}</p>
      <div class="map">🗺️ ${esc(r.map)}</div>
      <div class="row mt" style="gap:8px">
        <span class="badge" style="background:rgba(255,255,255,.2)">📖 完成 ${s.doneChapters}/${s.totalChapters} 章</span>
        <span class="badge" style="background:rgba(255,255,255,.2)">⭐ ${s.points} 分</span>
        <span class="badge" style="background:rgba(255,255,255,.2)">💬 提问 ${s.dialogCount} 次</span>
      </div>
    </div>`;
    html += '<div class="shelf-grid">';
    for (const c of s.chapters) {
      const locked = c.no > s.unlocked;
      let tags = '';
      if (locked) tags += '<span class="badge no">🔒 未解锁</span>';
      if (!locked && c.storyRead) tags += '<span class="badge ok">✅ 已读</span>';
      if (!locked && c.quizDone) tags += `<span class="badge info">🎯 ${c.quizScore}/${c.quizTotal}</span>`;
      const sub = (c.chapterTitle.split('——')[1] || '').trim();
      html += `<button class="chapter-card ${locked ? 'locked' : ''}" data-no="${c.no}" ${locked ? 'disabled' : ''}>
        <span class="no-tag">${c.no}</span>
        <div class="ct">${esc(c.title)}</div>
        <div class="mtip">${esc(sub)}</div>
        <div class="tags">${tags}</div>
      </button>`;
    }
    html += '</div>';
    view.innerHTML = html;
    view.querySelectorAll('.chapter-card:not([disabled])').forEach((b) => {
      b.addEventListener('click', () => openChapter(Number(b.dataset.no)));
    });
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

// ---------------- 章节阅读页 ----------------
async function openChapter(no) {
  state.currentChapterNo = no;
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/reading/chapter/' + no);
    let html = `<button class="back-btn" onclick="renderShelf()">← 返回书架</button>`;
    html += `<div class="chapter-head"><h2>${esc(r.chapterTitle)}</h2></div>`;
    html += `<div class="card"><div class="story-text">${r.story.map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>`;
    html += `<div class="knowledge-box"><h4>🧠 知识加油站</h4><ul>${r.knowledge.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>`;
    html += `<div class="mnemonic-box">💡 记忆口诀：${esc(r.mnemonic)}</div>`;
    if (r.knowledgeCards && r.knowledgeCards.length) {
      html += `<div class="card"><h4>📇 知识卡</h4>`;
      for (const kc of r.knowledgeCards) {
        html += `<div class="kcard"><h5>${esc(kc.id)} ${esc(kc.title)}</h5><p>${esc(kc.summary)}</p>`;
        if (kc.points && kc.points.length) html += `<ul>${kc.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;
        html += `</div>`;
      }
      html += `</div>`;
    }
    const quizLabel = r.quizDone ? `📋 查看闯关结果（${r.quizScore}/${r.quizTotal}）` : '🎯 开始闯关';
    html += `<div class="action-bar">
      ${r.storyRead ? '' : `<button class="accent" onclick="markRead(${no})">✅ 我读完本章了</button>`}
      <button class="secondary" onclick="goCompanion(${no})">💬 和点点聊聊</button>
      <button class="secondary" onclick="startQuiz(${no})">${quizLabel}</button>
    </div>`;
    view.innerHTML = html;
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

async function markRead(no) {
  try {
    await api('POST', '/api/reading/chapter/' + no + '/read', {});
    toast('📖 已记录，你真棒！');
    openChapter(no);
  } catch (e) { toast(e.message); }
}

function goCompanion(no) {
  state.currentChapterNo = no;
  switchView('companion');
}

// ---------------- 闯关 ----------------
async function startQuiz(no) {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/reading/quiz/' + no);
    state.quiz = { no, questions: r.questions };
    renderQuiz();
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

const TYPE_NAME = { single: '单选', judge: '判断', multi: '多选', fill: '填空' };

function renderQuiz() {
  const q = state.quiz;
  let html = `<button class="back-btn" onclick="openChapter(${q.no})">← 返回本章</button>`;
  html += `<div class="card"><h3>🎯 第 ${q.no} 章闯关 · 共 ${q.questions.length} 题</h3><p class="tip">先读故事再闯关，全靠自己动脑筋！</p></div>`;
  html += `<div class="quiz-options">`;
  q.questions.forEach((item, i) => {
    const tn = TYPE_NAME[item.type] || item.type;
    html += `<div class="card"><div class="row"><span class="qnum-badge">${i + 1}</span><span class="badge info">${tn}</span></div>`;
    html += `<p style="margin-top:8px">${esc(item.q)}</p>`;
    if (item.type === 'fill') {
      html += `<input class="fill-input" data-q="${item.id}" placeholder="输入你的答案">`;
    } else {
      for (const o of (item.options || [])) {
        html += `<label class="option" data-q="${item.id}" data-key="${o.key}" data-multi="${item.type === 'multi' ? 1 : 0}">
          <input type="${item.type === 'multi' ? 'checkbox' : 'radio'}" name="q${item.id}" value="${o.key}">
          <span>${o.key}. ${esc(o.text)}</span>
        </label>`;
      }
    }
    html += `</div>`;
  });
  html += `</div>`;
  html += `<div class="center"><button class="accent" style="padding:12px 40px; font-size:16px;" id="submitQuiz">提交闯关</button></div>`;
  view.innerHTML = html;

  view.querySelectorAll('.option').forEach((lab) => {
    lab.addEventListener('click', () => {
      const input = lab.querySelector('input');
      if (lab.dataset.multi === '1') {
        input.checked = !input.checked;
      } else {
        view.querySelectorAll(`input[name="q${lab.dataset.q}"]`).forEach((x) => { x.checked = (x === input); });
        view.querySelectorAll(`.option[data-q="${lab.dataset.q}"]`).forEach((x) => x.classList.remove('chosen'));
      }
      lab.classList.toggle('chosen', input.checked);
    });
  });

  $('#submitQuiz').addEventListener('click', async () => {
    const answers = {};
    for (const item of q.questions) {
      if (item.type === 'fill') {
        const inp = view.querySelector(`.fill-input[data-q="${item.id}"]`);
        if (inp) answers[item.id] = inp.value.trim();
      } else {
        const sel = [...view.querySelectorAll(`input[name="q${item.id}"]:checked`)];
        answers[item.id] = [...new Set(sel.map((x) => x.value))].sort().join('');
      }
    }
    try {
      const r = await api('POST', '/api/reading/quiz/' + q.no + '/submit', { answers });
      renderQuizResult(r);
    } catch (e) { toast(e.message); }
  });
}

function renderQuizResult(r) {
  const q = state.quiz;
  let html = `<button class="back-btn" onclick="renderShelf()">← 返回书架</button>`;
  html += `<div class="score-hero"><div>🎉 闯关完成</div><div class="num">${r.quizScore} / ${r.quizTotal}</div><div>获得 ⭐ ${r.points} 分</div></div>`;
  for (const item of r.results) {
    html += `<div class="card result-item ${item.correct ? 'ok' : 'no'}">
      <p>${esc(item.q)}</p>
      <p class="tip" style="margin-top:6px">${item.correct ? '✅ 答对了！' : '❌ 再想想～'}</p>
      ${item.correct ? '' : `<p class="tip">正确答案：${esc(item.correctAnswer)}</p>`}
      ${item.expl ? `<p class="tip">💡 ${esc(item.expl)}</p>` : ''}
    </div>`;
  }
  html += `<div class="action-bar">
    <button class="secondary" onclick="goCompanion(${q.no})">💬 和点点聊聊</button>
    <button class="secondary" onclick="renderShelf()">📚 继续冒险</button>
  </div>`;
  view.innerHTML = html;
}

// ---------------- AI伴读 ----------------
async function renderCompanion() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/reading/shelf');
    const s = r.shelf;
    const no = state.currentChapterNo && state.currentChapterNo <= s.unlocked ? state.currentChapterNo : s.unlocked;
    state.currentChapterNo = no;
    let html = `<div class="chat-wrap"><div class="chat-head">
      <span>💬 和点点聊</span>
      <select id="chatChapter">${s.chapters.filter((c) => c.no <= s.unlocked).map((c) => `<option value="${c.no}" ${c.no === no ? 'selected' : ''}>${c.no}. ${esc(c.title)}</option>`).join('')}</select>
    </div>
    <div class="chat-body" id="chatBody">
      <div class="chat-msg ai">嗨，我是守护精灵点点！读完故事了吗？有什么不懂的、好奇的AI小秘密，都可以问我哦～😊</div>
    </div>
    <div class="chat-input">
      <input id="chatInput" placeholder="输入你的问题…（比如：为什么数据是粮食？）">
      <button class="accent" id="chatSend">发送</button>
    </div></div>`;
    view.innerHTML = html;

    const body = $('#chatBody');
    const input = $('#chatInput');
    const send = $('#chatSend');
    const sel = $('#chatChapter');

    const sendMsg = async () => {
      const text = input.value.trim();
      if (!text) return;
      body.insertAdjacentHTML('beforeend', `<div class="chat-msg user">${esc(text)}</div>`);
      input.value = '';
      body.scrollTop = body.scrollHeight;
      const typing = document.createElement('div');
      typing.className = 'chat-msg ai typing';
      typing.textContent = '点点正在思考…';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;
      try {
        const rr = await api('POST', '/api/reading/chat', { chapterNo: Number(sel.value), question: text });
        typing.outerHTML = `<div class="chat-msg ai"><div><span class="src-tag">${rr.source === 'llm' ? 'AI伴读' : '离线回答'}</span></div>${esc(rr.reply)}</div>`;
      } catch (e) {
        typing.outerHTML = `<div class="chat-msg ai">${esc(e.message)}</div>`;
      }
      body.scrollTop = body.scrollHeight;
    };
    send.addEventListener('click', sendMsg);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

// ---------------- 存折 ----------------
async function renderPassbook() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/reading/passbook');
    const ALL_BADGES = [
      { id: 'starter', em: '🚀', name: '启程之星', ds: '闯过第一关' },
      { id: 'reader', em: '📚', name: '阅读新星', ds: '完成3章冒险' },
      { id: 'storyking', em: '👑', name: '故事大王', ds: '读完全部冒险' },
      { id: 'master', em: '🎯', name: '闯关达人', ds: '一章全对' },
      { id: 'asker', em: '💬', name: '追问小能手', ds: '问AI 10个问题' },
    ];
    let html = `<div class="stats-row">
      <div class="stat-card"><div class="n">${r.points}</div><div class="l">⭐ 阅读积分</div></div>
      <div class="stat-card"><div class="n">${r.doneChapters}/${r.totalChapters}</div><div class="l">📖 闯关完成</div></div>
      <div class="stat-card"><div class="n">${r.dialogCount}</div><div class="l">💬 提问次数</div></div>
      <div class="stat-card"><div class="n">${r.badges.length}/${ALL_BADGES.length}</div><div class="l">🏅 获得徽章</div></div>
    </div>`;
    html += `<div class="badge-grid">`;
    const got = new Set(r.badges.map((b) => b.id));
    for (const b of ALL_BADGES) {
      const has = got.has(b.id);
      html += `<div class="badge-card ${has ? 'got' : 'locked'}"><div class="em">${has ? b.em : '🔒'}</div><div class="nm">${b.name}</div><div class="ds">${b.ds}</div></div>`;
    }
    html += `</div>`;
    html += `<div class="card"><h4>📖 冒险进度</h4><table><tr><th>章节</th><th>故事</th><th>闯关</th><th>得分</th></tr>`;
    for (const c of r.chapters) {
      html += `<tr><td>${c.no}. ${esc(c.title)}</td><td>${c.storyRead ? '✅' : '—'}</td><td>${c.quizDone ? '✅' : '—'}</td><td>${c.quizDone ? c.quizScore + '/' + c.quizTotal : '—'}</td></tr>`;
    }
    html += `</table></div>`;
    view.innerHTML = html;
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

// ---------------- 排行榜 ----------------
async function renderBoard() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/reading/leaderboard');
    let html = `<div class="card"><h3>🏆 阅读之星排行榜</h3><p class="tip">按闯关完成的章节数排名，同数比积分</p></div>`;
    html += `<div class="card"><table><tr><th>名次</th><th>探险家</th><th>完成章节</th><th>积分</th></tr>`;
    for (const row of r.list) {
      const me = r.me && row.name === r.me.name;
      const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank;
      html += `<tr class="${me ? 'rank-me' : ''}"><td>${medal}</td><td>${esc(row.name)}${me ? '（我）' : ''}</td><td>${row.doneChapters}</td><td>${row.points}</td></tr>`;
    }
    html += `</table></div>`;
    view.innerHTML = html;
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

init();
