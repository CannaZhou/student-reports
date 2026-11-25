// 名家绘本：章节列表页
const $ = (s) => document.querySelector(s);
const BOOK_ID = new URLSearchParams(location.search).get('id') || '';
let toastTimer = null;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

async function api(method, path, body, quiet) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) {
    const err = new Error((j.error && j.error.msg) || '请求失败');
    err.status = res.status;
    if (!quiet) toast(err.message);
    throw err;
  }
  return j;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// ---------------- 登录 ----------------
function showLogin() {
  $('#loginBox').classList.remove('hidden');
  $('#bookBox').classList.add('hidden');
  setTimeout(() => $('#loginName').focus(), 30);
}

async function doLogin() {
  const name = $('#loginName').value.trim();
  const password = $('#loginPw').value;
  if (!name) return toast('请填写姓名');
  try {
    await api('POST', '/api/student/login', { name, password });
    $('#loginPw').value = '';
    load();
  } catch (e) { /* toast 已提示 */ }
}
$('#loginBtn').addEventListener('click', doLogin);
$('#loginName').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('#loginPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
$('#logoutBtn').addEventListener('click', async () => {
  try { await api('POST', '/api/student/logout', {}, true); } catch (e) {}
  location.reload();
});

// ---------------- 加载 ----------------
async function load() {
  if (!BOOK_ID) { $('#chapterList').innerHTML = '<p class="tip">链接里缺少书名参数</p>'; return; }
  try {
    const [r, me] = await Promise.all([
      api('GET', '/api/library/book/' + encodeURIComponent(BOOK_ID), null, true),
      api('GET', '/api/student/me', null, true).catch(() => null),
    ]);
    renderBook(r.book, me && me.name);
  } catch (e) {
    if (e.status === 401) return showLogin();
    $('#bookBox').classList.remove('hidden');
    $('#chapterList').innerHTML = '<div class="card center tip">' + esc(e.message) + '</div>';
  }
}

function renderBook(b, name) {
  $('#loginBox').classList.add('hidden');
  $('#bookBox').classList.remove('hidden');
  if (name) { $('#who').textContent = name; $('#who').classList.remove('hidden'); }
  $('#logoutBtn').classList.remove('hidden');
  document.title = b.title + ' · 名家绘本';

  $('#bookCover').src = b.cover;
  $('#bookCover').alt = b.title;
  $('#bookTitle').textContent = b.title;
  $('#bookSub').textContent = b.subtitle ? '《' + b.subtitle + '》' : '';
  const meta = [];
  if (b.author) meta.push(b.author);
  if (b.publisher) meta.push(b.publisher);
  if (b.isbn) meta.push('ISBN ' + b.isbn);
  $('#bookMeta').textContent = meta.join(' · ');
  const pct = b.chapterCount ? Math.round((b.checkedCount / b.chapterCount) * 100) : 0;
  $('#bookBar').style.width = pct + '%';
  $('#bookCount').innerHTML = b.completed
    ? '🎉 全书读完啦！共 ' + b.chapterCount + ' 章'
    : '已读 <b>' + b.checkedCount + '</b> / ' + b.chapterCount + ' 章 · 可读至第 ' + b.unlockedNo + ' 章';

  const html = b.chapters.map((c) => {
    const locked = !c.unlocked;
    const status = locked
      ? '<span class="badge no">🔒 未解锁</span>'
      : c.checked
        ? '<span class="badge ok">✅ 已读完 ' + fmtDate(c.readAt) + '</span>'
        : '<span class="badge info">📖 可以读</span>';
    const quiz = (!locked && c.quizCount) ? '<span class="badge info">🎯 小测 ' + c.quizCount + ' 题</span>' : '';
    const note = (!locked && c.note) ? '<div class="ch-note">💭 ' + esc(c.note) + '</div>' : '';
    const btn = locked ? '' : '<span class="ch-go">' + (c.checked ? '重读 ›' : '开始读 ›') + '</span>';
    return `<div class="ch-card${locked ? ' locked' : ''}" ${locked ? '' : 'data-no="' + c.no + '" tabindex="0" role="button"'}>
      <div class="ch-no">${c.no}</div>
      <div class="ch-main">
        <div class="ch-title">${esc(c.chapterTitle || c.title)}</div>
        <div class="ch-sub">${c.pageCount} 页 · ${status}${quiz}</div>
        ${note}
      </div>
      ${btn}
    </div>`;
  }).join('');
  $('#chapterList').innerHTML = html;

  document.querySelectorAll('.ch-card[data-no]').forEach((el) => {
    const go = () => {
      location.href = '/reader.html?id=' + encodeURIComponent(b.id) + '&ch=' + el.dataset.no;
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  // 自动跳到「上次读到的那一章」：有未读完的可读章时滚动到它
  const next = b.chapters.find((c) => c.unlocked && !c.checked);
  if (next) {
    const el = document.querySelector('.ch-card[data-no="' + next.no + '"]');
    if (el) el.classList.add('ch-next');
  }
}

load();
