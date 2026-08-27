// 学生端逻辑
const $ = (s) => document.querySelector(s);
const view = $('#view');
const state = { me: null, quiz: null, quizMode: null, quizDay: null, answers: [] };

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

const TYPE_NAME = { single: '单选', judge: '判断', multi: '多选', fill: '填空' };

function setLoggedIn(me) {
  state.me = me;
  $('#loginBox').classList.add('hidden');
  $('#appBox').classList.remove('hidden');
  $('#who').textContent = '👋 ' + me.name;
  $('#who').classList.remove('hidden');
  $('#logoutBtn').classList.remove('hidden');
}

// ---------------- 登录 ----------------
async function doLogin() {
  const name = $('#loginName').value.trim();
  const password = $('#loginPw').value;
  if (!name) return toast('请填写姓名');
  try {
    const r = await api('POST', '/api/student/login', { name, password });
    setLoggedIn({ name: r.name });
    $('#loginPw').value = '';
    switchView('daily');
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
  if (name === 'daily') renderDaily();
  else if (name === 'practice') renderPractice();
  else if (name === 'wrong') renderWrong();
  else if (name === 'board') renderBoard();
}
$('#mainNav').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  switchView(b.dataset.view);
});

// ---------------- 每日打卡 ----------------
async function renderDaily() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/student/daily/status');
    const dayMap = {};
    r.days.forEach((d) => { dayMap[d.day] = d; });
    const nextDay = Math.min(r.nextDay, r.totalDays);
    const doneCount = Object.values(dayMap).filter((d) => d.done).length;

    let html = `<div class="card">
      <div class="row"><div class="grow"><h3>📅 每日打卡闯关</h3>
      <p class="tip">共 ${r.totalDays} 天 · 每天 ${r.daySize} 题 · 每题 ${r.scorePerQuestion} 分</p></div>
      <div><span class="badge info">已完成 ${doneCount} 天</span></div></div>
    </div>`;

    html += `<div class="card"><div class="grid-days">`;
    for (let i = 0; i < r.totalDays; i++) {
      const day = i + 1;
      const d = dayMap[day];
      const done = !!(d && d.done);
      const cls = ['day-cell', done ? 'done' : '', day === nextDay ? 'today' : '', day > nextDay ? 'locked' : ''].join(' ');
      html += `<button class="${cls}" data-day="${day}" data-done="${done ? 1 : 0}">${day}${done ? `<span class="sc">${d.score}分</span>` : ''}</button>`;
    }
    html += `</div></div>`;

    const cur = dayMap[nextDay];
    const curDone = !!(cur && cur.done);
    html += `<div class="card center">
      <h3>${curDone ? '本关已完成' : '今天要挑战'}</h3>
      <p class="tip">第 ${nextDay} 天 · 50 题 · 满分 100</p>
      <button class="accent mt" style="padding:12px 30px; font-size:16px;" data-start="${nextDay}" data-done="${curDone ? 1 : 0}">
        ${curDone ? '查看本关结果' : '开始第 ' + nextDay + ' 天答题'}
      </button>
    </div>`;
    view.innerHTML = html;

    view.querySelectorAll('.day-cell').forEach((c) => {
      c.addEventListener('click', () => openDay(Number(c.dataset.day), Number(c.dataset.done)));
    });
    const start = view.querySelector('[data-start]');
    if (start) start.addEventListener('click', () => openDay(Number(start.dataset.start), Number(start.dataset.done)));
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

async function openDay(day, done) {
  try {
    const r = await api('GET', '/api/student/daily/' + day);
    if (r.done) renderReview(r.questions, { day, back: () => switchView('daily') });
    else renderQuiz(r.questions, { mode: 'daily', day, back: () => switchView('daily') });
  } catch (e) { toast(e.message); }
}

// ---------------- 答题 ----------------
function renderQuiz(questions, ctx) {
  state.quiz = { questions, mode: ctx.mode, day: ctx.day };
  state.answers = questions.map(() => '');

  let html = `<div class="card">
    <div class="row"><button class="sm secondary" data-back>← 返回</button>
    <h3 class="grow">${ctx.mode === 'daily' ? '📅 第 ' + ctx.day + ' 天答题' : '🎯 分类练习'}</h3>
    <span class="badge info">${questions.length} 题</span></div>
    <p class="tip">做完后点击下方"提交"统一批改</p>
  </div>`;

  questions.forEach((q, i) => {
    html += `<div class="card">
      <div class="row"><span class="qnum">${i + 1}</span>
        <span class="badge info">${TYPE_NAME[q.type] || q.type}</span>
        <span class="tip" style="flex:1">${esc(q.section || q.unitTitle || '')}</span></div>
      <p class="mt" style="font-size:16px;">${esc(q.q)}</p>
      ${renderAnswerInputs(q, i)}
    </div>`;
  });

  html += `<div class="card center"><button data-submit style="padding:12px 36px; font-size:16px;">✓ 提交批改</button></div>`;
  view.innerHTML = html;

  view.querySelector('[data-back]').addEventListener('click', () => { if (ctx.back) ctx.back(); });
  view.querySelector('[data-submit]').addEventListener('click', submitQuiz);
}

function renderAnswerInputs(q, i) {
  if (q.type === 'fill') {
    return `<input class="fillAns" data-i="${i}" placeholder="在横线处填写答案" style="margin-top:8px;">`;
  }
  if (q.type === 'multi') {
    return q.options.map((o) =>
      `<label class="option"><input type="checkbox" name="m${i}" value="${o.key}"><span><b>${o.key}.</b> ${esc(o.text)}</span></label>`).join('');
  }
  return q.options.map((o) =>
    `<label class="option"><input type="radio" name="q${i}" value="${o.key}"><span><b>${o.key}.</b> ${esc(o.text)}</span></label>`).join('');
}

function collectAnswers() {
  const qs = state.quiz.questions;
  const out = [];
  qs.forEach((q, i) => {
    if (q.type === 'fill') {
      const v = view.querySelector(`.fillAns[data-i="${i}"]`);
      out.push({ id: q.id, answer: v ? v.value.trim() : '' });
    } else if (q.type === 'multi') {
      const sel = [...view.querySelectorAll(`input[name="m${i}"]:checked`)].map((x) => x.value);
      out.push({ id: q.id, answer: sel.join(',') });
    } else {
      const sel = view.querySelector(`input[name="q${i}"]:checked`);
      out.push({ id: q.id, answer: sel ? sel.value : '' });
    }
  });
  state.answers = out.map((x) => x.answer);
  return out;
}

async function submitQuiz() {
  const answers = collectAnswers();
  const btn = view.querySelector('[data-submit]');
  btn.disabled = true; btn.textContent = '批改中…';
  try {
    const isDaily = state.quiz.mode === 'daily';
    const path = isDaily ? `/api/student/daily/${state.quiz.day}/submit` : '/api/student/practice/submit';
    const body = isDaily ? { answers } : { questions: state.quiz.questions, answers };
    const r = await api('POST', path, body);
    renderResult(r, answers);
  } catch (e) { btn.disabled = false; btn.textContent = '✓ 提交批改'; toast(e.message); }
}

function renderResult(r, answers) {
  const qs = state.quiz.questions;
  const resultMap = {};
  r.results.forEach((x) => { resultMap[x.id] = x; });

  let html = `<div class="result-ok mb">
    <p class="tip">本份成绩</p>
    <div class="score">${r.score}<span style="font-size:16px;">分</span></div>
    <p>答对 ${r.correct} / ${r.total} 题${r.allDone ? ' 🎉 恭喜完成全部 50 天打卡！' : ''}</p>
    <div class="mt"><button data-home class="secondary">← 返回首页</button></div>
  </div>`;

  qs.forEach((q, i) => {
    const g = resultMap[q.id] || {};
    const myAns = answers[i] || '';
    const okFlag = g.correct;
    const ansTxt = q.type === 'fill'
      ? (myAns ? '你的答案：' + esc(myAns) : '未作答')
      : (myAns ? '你的答案：' + esc(myAns) : '未作答');
    html += `<div class="card">
      <div class="row"><span class="qnum">${i + 1}</span>
        <span class="badge ${okFlag ? 'ok' : 'no'}">${okFlag ? '✓ 答对' : '✗ 答错'}</span>
        <span class="tip" style="flex:1">${esc(q.section || '')}</span></div>
      <p class="mt">${esc(q.q)}</p>
      <p class="mt" style="font-size:13px;"><span class="tip">${ansTxt}</span><br>
        <span style="color:var(--success)">正确答案：${esc(g.correctAnswer || '')}</span></p>
      ${g.expl ? `<p class="tip mt" style="color:#555">💡 解析：${esc(g.expl)}</p>` : ''}
    </div>`;
  });

  view.innerHTML = html;
  view.querySelector('[data-home]').addEventListener('click', () => switchView(state.quiz.mode === 'daily' ? 'daily' : 'practice'));
}

// 查看已完成的答题（只读回顾）
function renderReview(questions, ctx) {
  let html = `<div class="card"><div class="row">
    <button class="sm secondary" data-back>← 返回</button>
    <h3 class="grow">📅 第 ${ctx.day} 天 · 回顾</h3>
  </div></div>`;
  questions.forEach((q, i) => {
    const okFlag = q.correct;
    html += `<div class="card">
      <div class="row"><span class="qnum">${i + 1}</span>
        <span class="badge ${okFlag ? 'ok' : 'no'}">${okFlag ? '✓ 答对' : '✗ 答错'}</span></div>
      <p class="mt">${esc(q.q)}</p>
      <p class="mt" style="font-size:13px;"><span class="tip">你的答案：${esc(q.studentAnswer || '未作答')}</span><br>
        <span style="color:var(--success)">正确答案：${esc(q.correctAnswer || '')}</span></p>
      ${q.expl ? `<p class="tip mt" style="color:#555">💡 解析：${esc(q.expl)}</p>` : ''}
    </div>`;
  });
  view.innerHTML = html;
  view.querySelector('[data-back]').addEventListener('click', () => { if (ctx.back) ctx.back(); });
}

// ---------------- 分类练习 ----------------
async function renderPractice() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/student/categories');
    let html = `<div class="card"><h3>🎯 分类练习</h3>
      <p class="tip">选择一个知识单元，练习该分类下的<b>全部题目</b>（不占用每日打卡，做错的题进错题本）</p></div>`;
    r.categories.forEach((ch) => {
      html += `<div class="card">
        <h3>${esc(ch.title)}</h3>
        <p class="tip mb">${esc(ch.intro)}</p>
        <div class="row" style="flex-wrap:wrap; gap:8px;">`;
      ch.units.forEach((u) => {
        html += `<button class="secondary" data-unit="${u.id}" data-title="${esc(ch.title + ' · ' + u.title)}">${esc(u.title)}（${u.count}题）</button>`;
      });
      html += `</div></div>`;
    });
    view.innerHTML = html;
    view.querySelectorAll('[data-unit]').forEach((b) => {
      b.addEventListener('click', async () => {
        const unit = b.dataset.unit;
        try {
          const q = await api('GET', '/api/student/practice?unit=' + encodeURIComponent(unit) + '&all=1');
          if (!q.questions.length) return toast('该单元暂无题目');
          renderQuiz(q.questions, { mode: 'practice', back: () => switchView('practice') });
        } catch (e) { toast(e.message); }
      });
    });
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

// ---------------- 错题本 ----------------
async function renderWrong() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/student/wrong');
    let html = `<div class="card"><div class="row">
      <h3 class="grow">📕 错题本（${r.total} 道）</h3>
      ${r.total ? '<button class="accent" data-redo>重做错题</button>' : ''}
    </div>
    <p class="tip">做错的题都在这里，答对后会自动移出</p></div>`;
    if (!r.total) {
      html += `<div class="card center"><p>暂无错题 🎉</p></div>`;
    }
    r.list.forEach((w, i) => {
      html += `<div class="card">
        <div class="row"><span class="qnum">${i + 1}</span>
          <span class="badge no">错 ${w.count} 次</span>
          <span class="badge info">${TYPE_NAME[w.type] || w.type}</span></div>
        <p class="mt">${esc(w.q)}</p>
        ${w.options.length ? `<p class="tip mt">${w.options.map((o) => o.key + '.' + esc(o.text)).join('　')}</p>` : ''}
        <p class="mt" style="font-size:13px; color:var(--success)">正确答案：${esc(w.answer)}</p>
        ${w.expl ? `<p class="tip mt" style="color:#555">💡 解析：${esc(w.expl)}</p>` : ''}
      </div>`;
    });
    view.innerHTML = html;
    const redo = view.querySelector('[data-redo]');
    if (redo) redo.addEventListener('click', startWrongRedo);
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

async function startWrongRedo() {
  try {
    const r = await api('GET', '/api/student/practice?wrong=1&limit=20');
    if (!r.questions.length) return toast('错题本为空');
    renderQuiz(r.questions, { mode: 'practice', back: () => switchView('wrong') });
  } catch (e) { toast(e.message); }
}

// ---------------- 排行榜 ----------------
async function renderBoard() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/student/leaderboard');
    let html = `<div class="card"><h3>🏆 班级排行榜</h3>
      <p class="tip">按完成天数、总分排名（实时更新）</p></div>
      <div class="card"><table><thead><tr><th>名次</th><th>姓名</th><th>完成天数</th><th>总分</th><th>平均分</th></tr></thead><tbody>`;
    const medal = ['🥇', '🥈', '🥉'];
    r.list.forEach((row) => {
      const mine = r.me && row.name === r.me.name;
      html += `<tr style="${mine ? 'background:#eef5fc; font-weight:600;' : ''}">
        <td>${medal[row.rank - 1] || row.rank}</td>
        <td>${esc(row.name)}${mine ? '（我）' : ''}</td>
        <td>${row.doneDays} 天</td><td>${row.totalScore}</td><td>${row.avg}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    if (!r.list.length) html = `<div class="card center"><p>还没有同学开始打卡</p></div>`;
    view.innerHTML = html;
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

// ---------------- 启动 ----------------
async function init() {
  try {
    const r = await api('GET', '/api/student/me');
    setLoggedIn({ name: r.name, stats: r.stats });
    switchView('daily');
  } catch (e) {
    $('#loginBox').classList.remove('hidden');
  }
}
init();
