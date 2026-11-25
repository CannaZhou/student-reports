// 名家绘本 · 翻页阅读器
const $ = (s) => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const BOOK_ID = qs.get('id') || '';

const state = {
  bookId: BOOK_ID,
  book: null,        // {id,title,subtitle}
  chapters: [],      // 章节列表（目录用，来自 /api/library/book/:id）
  chapter: null,     // 当前章元信息
  pages: [],
  idx: 0,
  animating: false,
  checked: false,
  readAt: null,
  note: '',
  nextChapterNo: null,
  unlockedNo: 1,
};

const layerA = $('#layerA');
const layerB = $('#layerB');
let front = layerA;
let back = layerB;

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
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) {
    const err = new Error((j.error && j.error.msg) || '请求失败');
    err.status = res.status;
    throw err;
  }
  return j;
}

function backToBook() {
  return '/library.html?id=' + encodeURIComponent(state.bookId || BOOK_ID);
}

function showError(msg, withLogin) {
  $('#loading').classList.add('hidden');
  const box = $('#errBox');
  box.classList.remove('hidden');
  box.innerHTML = '<div style="margin-bottom:12px">' + esc(msg || '这一章还打不开') + '</div>' +
    (withLogin
      ? '<a class="btnlike" href="' + esc(backToBook()) + '">去登录</a>'
      : '<a class="btnlike" href="' + esc(backToBook()) + '">← 返回本书目录</a>');
}

// ---------------- 载入 ----------------
async function boot() {
  if (!BOOK_ID) return showError('链接里缺少书名参数');
  try {
    const detail = await api('GET', '/api/library/book/' + encodeURIComponent(BOOK_ID));
    state.book = detail.book;
    state.chapters = detail.book.chapters || [];
    $('#backLink').href = backToBook();
    await openChapter(Number(qs.get('ch')) || 1);
  } catch (e) {
    if (e.status === 401) return showError('请先登录再读书', true);
    showError(e.message);
  }
}

async function openChapter(no) {
  if (state.animating) return;
  try {
    const r = await api('GET', '/api/library/book/' + encodeURIComponent(state.bookId) + '/chapter/' + no);
    state.book = r.book;
    state.chapter = r.chapter;
    state.pages = r.pages || [];
    state.checked = !!r.readAt;
    state.readAt = r.readAt;
    state.note = r.note || '';
    state.nextChapterNo = r.nextChapterNo;
    state.unlockedNo = r.unlockedNo;
    state.idx = 0;

    document.title = (r.chapter.chapterTitle || r.chapter.title) + ' · ' + r.book.title;
    $('#rTitle').textContent = r.chapter.chapterTitle || r.chapter.title;

    // 目录里的解锁/已读状态以最新返回为准
    const cur = state.chapters.find((c) => c.no === r.chapter.no);
    if (cur) { cur.unlocked = true; cur.checked = state.checked; cur.readAt = state.readAt; }
    for (const c of state.chapters) c.unlocked = c.no <= r.unlockedNo || c.no === r.chapter.no;

    if (!state.pages.length) return showError('这一章还没有内容');

    $('#errBox').classList.add('hidden');
    $('#loading').classList.remove('hidden');
    hideCheckin();

    // 首屏
    front.style.transition = 'none';
    front.style.transform = 'none';
    front.style.opacity = '1';
    front.style.zIndex = 2;
    back.style.transition = 'none';
    back.style.opacity = '0';
    back.style.transform = 'none';
    back.style.zIndex = 1;

    await loadInto(front, state.pages[0].url);
    $('#loading').classList.add('hidden');
    updateChrome();
    renderToc();
    preloadNear();
    renderCheckin();
    maybeCheckin();
    history.replaceState(null, '', '/reader.html?id=' + encodeURIComponent(state.bookId) + '&ch=' + r.chapter.no);
  } catch (e) {
    if (e.status === 403) {
      toast('这一章还没解锁，先读完上一章吧');
      setTimeout(() => { location.href = backToBook(); }, 900);
      return;
    }
    if (e.status === 401) return showError('请先登录再读书', true);
    showError(e.message);
  }
}

// ---------------- 图片层 ----------------
function loadInto(layer, url) {
  const img = layer.querySelector('img');
  return new Promise((resolve) => {
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    img.onload = () => { if (img.decode) img.decode().then(fin, fin); else fin(); };
    img.onerror = fin;
    img.src = url;
    if (img.complete && img.naturalWidth > 0) fin();
    setTimeout(fin, 12000); // 网络特别慢也别把阅读卡死
  });
}

function animate(outEl, inEl, dir) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = reduce ? 140 : 380;
  const ease = 'cubic-bezier(.22,.61,.36,1)';

  inEl.style.transition = 'none';
  inEl.style.zIndex = 3;
  inEl.style.transform = dir > 0 ? 'translateX(62%) rotateY(-10deg)' : 'translateX(-62%) rotateY(10deg)';
  inEl.style.opacity = '0';
  void inEl.offsetWidth; // 强制回流，让起始状态生效

  inEl.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + dur + 'ms ' + ease;
  outEl.style.transition = 'transform ' + dur + 'ms ' + ease + ', opacity ' + dur + 'ms ' + ease;

  inEl.style.transform = 'translateX(0) rotateY(0)';
  inEl.style.opacity = '1';
  outEl.style.transform = dir > 0 ? 'translateX(-20%) rotateY(8deg)' : 'translateX(20%) rotateY(-8deg)';
  outEl.style.opacity = '0';

  return new Promise((r) => setTimeout(r, dur + 40));
}

async function goTo(target, dir) {
  if (state.animating || !state.pages.length) return;
  const max = state.pages.length - 1;
  target = Math.max(0, Math.min(max, target));
  if (target === state.idx) return;
  const d = dir != null ? dir : (target > state.idx ? 1 : -1);

  state.animating = true;
  hideCheckin();
  await loadInto(back, state.pages[target].url);
  await animate(front, back, d);
  const t = front; front = back; back = t;
  front.style.zIndex = 2;
  front.style.transition = '';
  front.style.transform = 'translateX(0) rotateY(0)';
  front.style.opacity = '1';
  back.style.zIndex = 1;
  back.style.transition = '';
  back.style.opacity = '0';
  state.idx = target;
  state.animating = false;

  updateChrome();
  preloadNear();
  maybeCheckin();
}

function preloadNear() {
  const list = [state.idx + 1, state.idx + 2, state.idx - 1];
  for (const i of list) {
    if (i < 0 || i >= state.pages.length) continue;
    const im = new Image();
    im.decoding = 'async';
    im.src = state.pages[i].url;
  }
}

function updateChrome() {
  const total = state.pages.length;
  $('#pageNum').textContent = (state.idx + 1) + ' / ' + total;
  $('#progBar').style.width = ((state.idx + 1) / total * 100) + '%';
  $('#prevBtn').disabled = state.idx <= 0;
  $('#nextBtn').disabled = state.idx >= total - 1;
}

// ---------------- 目录 ----------------
function renderToc() {
  const body = $('#tocBody');
  body.innerHTML = state.chapters.map((c) => {
    const locked = !c.unlocked;
    const cur = state.chapter && c.no === state.chapter.no;
    const cls = ['toc-item'];
    if (locked) cls.push('locked');
    if (cur) cls.push('cur');
    if (c.checked) cls.push('done');
    const sub = locked ? '🔒 读完上一章解锁'
      : c.checked ? '已读 ' + fmtDate(c.readAt)
        : c.pageCount + ' 页 · 可读';
    return '<button class="' + cls.join(' ') + '" ' + (locked ? 'disabled' : '') + ' data-no="' + c.no + '">' +
      '<span class="n">' + c.no + '</span>' +
      '<span class="t">' + esc(c.title) + '<span class="s">' + esc(sub) + '</span></span>' +
      '</button>';
  }).join('');
  body.querySelectorAll('.toc-item:not([disabled])').forEach((el) => {
    el.addEventListener('click', () => {
      closeToc();
      const no = Number(el.dataset.no);
      if (state.chapter && no === state.chapter.no) return;
      openChapter(no);
    });
  });
  const done = state.chapters.filter((c) => c.checked).length;
  $('#tocFoot').textContent = '全书进度 ' + done + ' / ' + state.chapters.length + ' 章';
}

function openToc() {
  $('#tocDrawer').classList.add('open');
  $('#tocMask').classList.add('open');
  $('#tocDrawer').setAttribute('aria-hidden', 'false');
}
function closeToc() {
  $('#tocDrawer').classList.remove('open');
  $('#tocMask').classList.remove('open');
  $('#tocDrawer').setAttribute('aria-hidden', 'true');
}

// ---------------- 打卡 ----------------
function maybeCheckin() {
  if (state.idx === state.pages.length - 1) {
    renderCheckin();
    $('#stage').classList.add('ck');
    $('#checkin').classList.add('show');
  } else {
    hideCheckin();
  }
}
function hideCheckin() {
  $('#checkin').classList.remove('show');
  $('#stage').classList.remove('ck');
}

function renderCheckin() {
  const box = $('#ckInner');
  if (state.checked) {
    box.innerHTML =
      '<div class="ck-title">✅ 本章已打卡</div>' +
      '<div class="ck-sub">' + esc(fmtDate(state.readAt)) + ' 读完</div>' +
      (state.note ? '<div class="ck-note">💭 ' + esc(state.note) + '</div>' : '') +
      '<div class="ck-row">' +
      '<button class="secondary sm" id="ckEdit">' + (state.note ? '改感想' : '补一句感想') + '</button>' +
      (state.nextChapterNo
        ? '<button class="accent" id="ckNext">继续读第 ' + state.nextChapterNo + ' 章 ›</button>'
        : '<span class="tip">这是最后一章啦 🎉</span>') +
      '</div>';
  } else {
    box.innerHTML =
      '<div class="ck-title">🎉 本章读完啦！</div>' +
      '<div class="ck-sub">写一句感想（可以不写），点「我读完啦」开启下一章</div>' +
      '<textarea id="ckNote" rows="2" maxlength="200" placeholder="比如：我最喜欢小海做的机器人，因为它会读心…"></textarea>' +
      '<div class="ck-row"><button class="accent" id="ckSubmit">✅ 我读完啦</button></div>';
  }
  bindCheckin();
}

function renderCheckinEdit() {
  $('#ckInner').innerHTML =
    '<div class="ck-title">✍️ 改一下感想</div>' +
    '<div class="ck-sub">改完点保存，下一章已经打开了</div>' +
    '<textarea id="ckNote" rows="2" maxlength="200">' + esc(state.note) + '</textarea>' +
    '<div class="ck-row"><button class="secondary sm" id="ckCancel">取消</button><button class="accent" id="ckSubmit">保存感想</button></div>';
  bindCheckin();
  const ta = $('#ckNote');
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}

function bindCheckin() {
  const submit = $('#ckSubmit');
  if (submit) submit.addEventListener('click', doCheckin);
  const edit = $('#ckEdit');
  if (edit) edit.addEventListener('click', renderCheckinEdit);
  const cancel = $('#ckCancel');
  if (cancel) cancel.addEventListener('click', renderCheckin);
  const next = $('#ckNext');
  if (next) next.addEventListener('click', () => {
    const no = state.nextChapterNo;
    closeToc();
    openChapter(no);
  });
}

async function doCheckin() {
  const btn = $('#ckSubmit');
  const ta = $('#ckNote');
  const note = ta ? ta.value.trim() : state.note;
  if (btn) { btn.disabled = true; btn.textContent = '记录中…'; }
  try {
    const r = await api('POST',
      '/api/library/book/' + encodeURIComponent(state.bookId) + '/chapter/' + state.chapter.no + '/checkin',
      { lastPage: state.pages.length, note });
    state.checked = true;
    state.readAt = r.readAt;
    state.note = r.note || '';
    state.nextChapterNo = r.nextChapterNo;
    state.unlockedNo = r.unlockedNo;
    const ch = state.chapters.find((c) => c.no === state.chapter.no);
    if (ch) { ch.checked = true; ch.readAt = r.readAt; ch.note = state.note; }
    for (const c of state.chapters) if (c.no <= state.unlockedNo) c.unlocked = true;
    if (!r.replay) toast(r.nextChapterNo ? '🎉 打卡成功，第 ' + r.nextChapterNo + ' 章已解锁！' : '🎉 打卡成功，这本书读完啦！');
    else toast('已保存');
    renderCheckin();
    renderToc();
  } catch (e) {
    toast(e.message);
    if (btn) { btn.disabled = false; btn.textContent = '✅ 我读完啦'; }
  }
}

// ---------------- 事件 ----------------
$('#prevBtn').addEventListener('click', () => goTo(state.idx - 1, -1));
$('#nextBtn').addEventListener('click', () => goTo(state.idx + 1, 1));
$('#tocBtn').addEventListener('click', openToc);
$('#tocClose').addEventListener('click', closeToc);
$('#tocMask').addEventListener('click', closeToc);

// 点图片左右两侧翻页
$('#stage').addEventListener('click', (e) => {
  if (e.target.closest('.rnav') || e.target.closest('a')) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pos = (e.clientX - rect.left) / rect.width;
  if (pos < 0.33) goTo(state.idx - 1, -1);
  else if (pos > 0.67) goTo(state.idx + 1, 1);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return closeToc();
  if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goTo(state.idx - 1, -1); }
  else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goTo(state.idx + 1, 1); }
  else if (e.key === 'Home') { e.preventDefault(); goTo(0, -1); }
  else if (e.key === 'End') { e.preventDefault(); goTo(state.pages.length - 1, 1); }
});

// 触屏滑动
let touch = null;
$('#stage').addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
$('#stage').addEventListener('touchend', (e) => {
  if (!touch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touch.x;
  const dy = t.clientY - touch.y;
  const dt = Date.now() - touch.t;
  touch = null;
  if (dt > 900) return;
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    if (dx < 0) goTo(state.idx + 1, 1);
    else goTo(state.idx - 1, -1);
  }
}, { passive: true });

// 横竖屏切换后重算布局（图片按 CSS 自适应，这里只是清掉残留 transform）
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    front.style.transition = 'none';
    front.style.transform = 'none';
    front.style.opacity = '1';
  }, 120);
});

boot();
