/* 学生证书页：证书墙 + 单课「学业证书」。
   证书整张用 canvas 2D 画出来（不排 DOM）：屏幕上看到的就是下载的 PNG、也是打印的那张，
   一套绘制代码三处一致，且不依赖任何第三方库（本站零依赖、无 CDN）。 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; };
  const ME = {};
  let WALL = null;

  async function api(path, method, body) {
    const opt = { method: method || 'GET', headers: {} };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(path, opt);
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error((j && j.error && j.error.msg) || '请求失败'); e.status = r.status; e.json = j; throw e; }
    return j;
  }
  function show(name) {
    ['login', 'wall', 'one'].forEach((v) => { $('view-' + v).hidden = (v !== name); });
    window.scrollTo(0, 0);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function fmtStars(stars) {
    const n = Math.max(0, Math.min(5, Math.round(stars)));
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }
  const MISS_NAME = { quiz: '课后小测', sheet: '课内任务单' };

  // ================= 登录 =================
  $('sGo').addEventListener('click', doLogin);
  $('sName').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  async function doLogin() {
    const name = $('sName').value.trim(); if (!name) return;
    $('sErr').textContent = '';
    try { await api('/api/student/login', 'POST', { name }); await boot(); }
    catch (e) {
      if (e.status === 409 && e.json && e.json.candidates) {
        $('sCls').hidden = false; const box = $('sClsOpts'); box.innerHTML = '';
        e.json.candidates.forEach((c) => {
          const b = el('div', 'switch', c.className + '（' + c.grade + '年级）');
          b.onclick = async () => {
            try { await api('/api/student/login', 'POST', { name: c.name, className: c.className }); await boot(); }
            catch (err) { $('sErr').textContent = err.message; }
          };
          box.appendChild(b);
        });
        return;
      }
      $('sErr').textContent = e.message;
    }
  }
  $('logoutBtn').addEventListener('click', async () => {
    try { await api('/api/student/logout', 'POST'); } catch (e) {}
    ME.name = ''; WALL = null;
    $('whoBox').hidden = true; $('logoutBtn').hidden = true;
    history.replaceState(null, '', 'cert');
    show('login');
  });
  function applyMe() {
    if (!ME.name) { $('whoBox').hidden = true; $('logoutBtn').hidden = true; return; }
    $('whoBox').hidden = false; $('logoutBtn').hidden = false;
    $('whoBox').textContent = ME.name + (ME.className ? '·' + ME.className : '');
  }

  // ================= 证书墙 =================
  async function renderWall() {
    if (!WALL) {
      try { WALL = await api('/api/student/certs'); }
      catch (e) {
        if (e.status === 401) { show('login'); return; }
        const c = el('div', 'card'); c.appendChild(el('div', 'empty-note', e.message));
        $('wallBody').innerHTML = ''; $('wallBody').appendChild(c); show('wall'); return;
      }
      ME.name = WALL.student.name; ME.grade = WALL.student.grade; ME.className = WALL.student.className;
      applyMe();
    }
    const body = $('wallBody'); body.innerHTML = '';
    const items = WALL.items || [];
    const got = items.filter((x) => x.issued).length;

    const head = el('div', 'card');
    head.appendChild(el('h1', 'screen', ME.name + ' 的证书墙 🎖️'));
    head.appendChild(el('div', 'muted',
      '已完成 ' + got + ' / ' + items.length + ' 课。做完一课的任务（课后小测' +
      (items.some((x) => x.hasSheet) ? ' + 课内任务单' : '') + '）就会颁发这一课的证书；' +
      '综合评价＝自动批改的课后小测 ＋ 老师批阅的课内任务单。'));
    body.appendChild(head);

    if (!items.length) {
      const c = el('div', 'card');
      c.appendChild(el('div', 'empty-note', '🌱 这一年级的课还在准备中，等老师加入课程内容就能答题拿证书啦。'));
      body.appendChild(c);
      show('wall');
      return;
    }

    // 按单元分组（兜底补进来的课没有 unitTitle，归到「其它」）
    const groups = [];
    const idx = {};
    items.forEach((it) => {
      const key = it.unitTitle || '其它';
      if (idx[key] == null) { idx[key] = groups.length; groups.push({ title: key, list: [] }); }
      groups[idx[key]].list.push(it);
    });

    groups.forEach((g) => {
      if (g.title !== '其它') {
        body.appendChild(el('div', 'unit-title', '单元 · ' + g.title + '　（' + g.list.length + ' 课）'));
      }
      const box = el('div', 'certwall');
      g.list.forEach((it) => box.appendChild(wallCard(it)));
      body.appendChild(box);
    });
    show('wall');
  }

  function wallCard(it) {
    const card = el('div', 'cw-card' + (it.issued ? ' done' : ' todo'));
    card.appendChild(el('div', 'cw-ico', it.issued ? '🎖️' : '🔒'));
    const mid = el('div', 'cw-mid');
    mid.appendChild(el('h4', null, it.title));
    if (it.issued) {
      const meta = el('div', 'cw-meta');
      meta.appendChild(el('b', 'cw-stars', fmtStars(it.stars)));
      meta.appendChild(el('b', 'cw-num', it.stars.toFixed(1) + ' 星 · ' + it.pct.toFixed(1) + '%'));
      if (it.pending) meta.appendChild(el('span', 'pill warn', '任务单待老师批阅'));
      mid.appendChild(meta);
      mid.appendChild(el('div', 'cw-cmt', it.comment));
      const sub = el('div', 'cw-sub');
      const parts = ['课后小测 ' + it.quizScore + '/' + it.quizFull + ' 题'];
      if (it.hasSheet) parts.push(it.taskMarked ? ('任务单 ' + it.taskScore + '/10 分') : '任务单 待批阅');
      sub.textContent = parts.join('　·　') + (it.issuedAt ? '　·　' + fmtDate(it.issuedAt) + ' 颁发' : '');
      mid.appendChild(sub);
    } else {
      const miss = (it.missing || []).map((k) => MISS_NAME[k] || k).join('、');
      mid.appendChild(el('div', 'cw-meta', '还差：' + (miss || '—') + '，完成后即可领证'));
      mid.appendChild(el('div', 'cw-cmt muted', it.comment));
    }
    card.appendChild(mid);

    const btn = el('button', 'btn' + (it.issued ? '' : ' ghost'), it.issued ? '查看证书 →' : '去完成 →');
    btn.onclick = () => { if (it.issued) openCert(it.lessonId); else location.href = 'quiz'; };
    card.appendChild(btn);
    return card;
  }

  // ================= 单课证书 =================
  async function openCert(lessonId) {
    let j;
    try { j = await api('/api/student/certs/' + encodeURIComponent(lessonId)); }
    catch (e) {
      if (e.status === 401) { show('login'); return; }
      toast(e.message); return;
    }
    ME.name = j.student.name; ME.className = j.student.className; applyMe();
    const item = j.item;
    history.replaceState(null, '', 'cert?lesson=' + encodeURIComponent(lessonId));
    document.title = '证书 · ' + item.title;

    const body = $('oneBody'); body.innerHTML = '';
    if (!item.issued) {
      // 还没做完：不画证书，告诉他差哪一步
      const c = el('div', 'card');
      c.appendChild(el('h1', 'screen', '🔒 ' + item.title));
      const miss = (item.missing || []).map((k) => MISS_NAME[k] || k).join('、');
      c.appendChild(el('div', 'pill bad', '还差：' + (miss || '—')));
      c.appendChild(el('div', 'muted', item.comment));
      const act = el('div', 'action-row');
      const go = el('button', 'btn', '去完成这一课 →');
      go.onclick = () => { location.href = 'quiz'; };
      const back = el('button', 'btn ghost', '← 返回证书墙');
      back.onclick = () => { history.replaceState(null, '', 'cert'); renderWall(); };
      act.appendChild(go); act.appendChild(back);
      c.appendChild(act);
      body.appendChild(c);
      show('one');
      return;
    }

    const sheet = el('div', 'cert-sheet');
    const cv = document.createElement('canvas');
    cv.id = 'certCv';
    sheet.appendChild(cv);
    body.appendChild(sheet);
    drawCert(cv, item, j.student);

    const tools = el('div', 'action-row no-print');
    const print = el('button', 'btn', '🖨 打印证书');
    print.onclick = () => window.print();
    const save = el('button', 'btn', '保存图片 ⬇');
    save.onclick = () => {
      // toBlob 比 toDataURL 省内存（这张图 2400×3480，dataURL 是好几 MB 的字符串）
      cv.toBlob((b) => {
        if (!b) { toast('图片生成失败，试试「打印证书」'); return; }
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.download = '证书-' + item.title + '-' + j.student.name + '.png';
        a.href = url;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast('证书图片已保存 ✓');
      }, 'image/png');
    };
    const back = el('button', 'btn ghost', '← 返回证书墙');
    back.onclick = () => { history.replaceState(null, '', 'cert'); document.title = '我的证书 · 信息科技'; renderWall(); };
    tools.appendChild(print); tools.appendChild(save); tools.appendChild(back);
    body.appendChild(tools);

    if (item.pending) {
      const note = el('div', 'card no-print');
      note.appendChild(el('div', 'muted', '⏳ 课内任务单已交，等老师批阅后综合评价会自动更新（星级按「课后小测 ＋ 任务单得分」重算）。'));
      body.appendChild(note);
    }
    show('one');
  }

  // ---------- canvas 绘制 ----------
  const FONT = '"Microsoft YaHei","PingFang SC","Hiragino Sans GB",system-ui,sans-serif';
  const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  const F = (size, weight) => (weight || 700) + ' ' + size + 'px ' + FONT;
  const FE = (size) => size + 'px ' + EMOJI;
  const GREEN = '#3A7D44', GREEN_DK = '#2E6234';
  const GOLD = '#C9A227', GOLD_LT = '#E8B93B';
  const INK = '#26332a', INK2 = '#6b7a70';
  const W = 1200, H = 1740, SCALE = 2; // 逻辑尺寸 1200×1740，出图 2400×3480

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function starPath(ctx, cx, cy, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rad = (i % 2) ? r : R;
      const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function drawStars(ctx, cx, cy, R, gap, stars) {
    const n = 5, solid = Math.max(0, Math.min(5, Math.round(stars)));
    const total = n * R * 2 + (n - 1) * gap;
    let x = cx - total / 2 + R;
    for (let i = 0; i < n; i++) {
      starPath(ctx, x, cy, R, R * 0.44);
      if (i < solid) { ctx.fillStyle = GOLD_LT; ctx.fill(); }
      else { ctx.strokeStyle = '#E3D9BC'; ctx.lineWidth = 2.5; ctx.stroke(); }
      x += R * 2 + gap;
    }
  }
  function drawSpaced(ctx, s, cx, y, font, color, gap) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left';
    const chars = Array.from(s);
    const ws = chars.map((c) => ctx.measureText(c).width);
    const total = ws.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    let x = cx - total / 2;
    chars.forEach((c, i) => { ctx.fillText(c, x, y); x += ws[i] + gap; });
  }

  function drawCert(cv, item, stu) {
    cv.width = W * SCALE; cv.height = H * SCALE;
    cv.style.width = '100%'; cv.style.maxWidth = '520px'; cv.style.height = 'auto';
    const ctx = cv.getContext('2d');
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.textBaseline = 'middle';
    const T = (s, x, y, font, color, align) => {
      ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'center';
      ctx.fillText(s, x, y);
    };

    // 底：整张白卡 + 淡绿描边（下载成 PNG 时四周不留透明）
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#DCE9DD'; ctx.lineWidth = 3;
    rr(ctx, 22, 22, W - 44, H - 44, 40); ctx.stroke();

    // 顶部标题
    T('🎉', W / 2, 118, FE(84), '#000');
    T('《' + item.title + '》学习评价完成！', W / 2, 232, F(44), GREEN_DK);
    const CN = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };
    const where = [
      item.grade ? (CN[item.grade] || item.grade) + '年级' : '',
      item.semester ? item.semester + '册' : '',
      item.unitTitle || '',
    ].filter(Boolean).join(' · ');
    T(where, W / 2, 290, F(22, 400), INK2);

    // 证书框
    const FX = 72, FY = 340, FW = W - FX * 2, FH = 880;
    const grad = ctx.createLinearGradient(0, FY, 0, FY + FH);
    grad.addColorStop(0, '#F9FCF9'); grad.addColorStop(1, '#ECF5EE');
    ctx.fillStyle = grad; rr(ctx, FX, FY, FW, FH, 28); ctx.fill();
    ctx.strokeStyle = '#D9C27A'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save();
    ctx.setLineDash([12, 9]); ctx.strokeStyle = 'rgba(201,162,39,.5)'; ctx.lineWidth = 2;
    rr(ctx, FX + 18, FY + 18, FW - 36, FH - 36, 18); ctx.stroke();
    ctx.restore();

    T('⭐', FX + 78, FY + 78, FE(50), '#000');
    T('🌙', FX + FW - 78, FY + 78, FE(50), '#000');
    T('✏️', FX + 78, FY + FH - 78, FE(46), '#000');
    T('📐', FX + FW - 78, FY + FH - 78, FE(46), '#000');

    drawSpaced(ctx, '学业证书', W / 2, FY + 186, F(68), GREEN_DK, 20);
    T('恭喜啦！你顺利完成本课的学习任务！', W / 2, FY + 262, F(30, 400), '#3d4b42');
    T('特发此证，以资鼓励。', W / 2, FY + 312, F(30, 400), '#3d4b42');

    // 获证人
    T('获 证 人', W / 2, FY + 412, F(20, 400), '#8d9a90');
    ctx.font = F(58); ctx.fillStyle = GREEN_DK; ctx.textAlign = 'center';
    ctx.fillText(stu.name, W / 2, FY + 492);
    const nw = Math.max(ctx.measureText(stu.name).width + 90, 300);
    ctx.strokeStyle = 'rgba(58,125,68,.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - nw / 2, FY + 540); ctx.lineTo(W / 2 + nw / 2, FY + 540);
    ctx.stroke();
    T(stu.className || '', W / 2, FY + 590, F(24, 400), INK2);

    // 校徽（与站点顶栏同款：白底绿字圆牌）
    ctx.beginPath(); ctx.arc(W / 2, FY + 726, 60, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = GREEN; ctx.lineWidth = 5; ctx.stroke();
    T('科', W / 2, FY + 730, F(58), GREEN);

    T('证书编号：' + item.serial, W / 2, FY + FH - 48, F(20, 400), '#9aa69c');

    // 综合评价
    const BY = FY + FH + 46, BH = 190;
    ctx.fillStyle = '#FBF4E0'; rr(ctx, FX, BY, FW, BH, 24); ctx.fill();
    ctx.strokeStyle = '#EBD9A6'; ctx.lineWidth = 2; ctx.stroke();
    T('综合评价：' + item.stars.toFixed(1) + ' 星（' + item.pct.toFixed(1) + '%）', W / 2, BY + 52, F(36), INK);
    drawStars(ctx, W / 2, BY + 108, 19, 10, item.stars);
    T(item.comment, W / 2, BY + 158, F(27, 400), item.level === 'perfect' ? GREEN : '#4a5a4f');

    // 得分明细
    const parts = ['课后小测 ' + item.quizScore + ' / ' + item.quizFull + ' 题'];
    if (item.hasSheet) parts.push(item.taskMarked ? ('课内任务单 ' + item.taskScore + ' / 10 分') : '课内任务单 待老师批阅');
    T(parts.join('　·　'), W / 2, BY + BH + 52, F(23, 400), INK2);
    if (item.pending) {
      T('老师批阅任务单后，综合评价会自动更新', W / 2, BY + BH + 94, F(20, 400), '#a3ada5');
    }

    // 落款
    T('颁发日期：' + fmtDate(item.issuedAt), W / 2, H - 150, F(22, 400), INK2);
    T('信息科技 · 分课课堂检测', W / 2, H - 102, F(21, 400), '#a3ada5');

    // 无头验收用：把关键文案与出图尺寸挂到全局，方便断言
    // （刻意不在这里 toDataURL：2400×3480 的 dataURL 是好几 MB 的字符串，手机上会卡；
    //   下载走 toBlob，验收要查图大小就自己调 window.__certBlob()）
    window.__cert = {
      text: [item.title, stu.name, stu.className, item.comment, item.stars.toFixed(1), item.pct.toFixed(1), item.serial].join('|'),
      issued: item.issued, pending: item.pending, w: cv.width, h: cv.height,
    };
    window.__certBlob = () => new Promise((r) => cv.toBlob((b) => r(b), 'image/png'));
  }

  // 与 quiz.js / teacher.js 同一套提示（.toast + 内联 opacity 淡出）
  let toastTimer;
  function toast(msg) {
    clearTimeout(toastTimer);
    let t = document.querySelector('.toast');
    if (!t) { t = el('div', 'toast'); document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = 1;
    toastTimer = setTimeout(() => { t.style.opacity = 0; }, 2200);
  }

  // ================= 启动 =================
  async function boot() {
    const q = new URLSearchParams(location.search).get('lesson');
    if (q) { await openCert(q); return; }
    await renderWall();
  }
  (async () => {
    const q = new URLSearchParams(location.search).get('lesson');
    try { const me = await api('/api/student/me'); ME.name = me.name; ME.grade = me.grade; ME.className = me.className; applyMe(); }
    catch (e) { show('login'); if (q) $('sErr').textContent = '请先选你的名字，再查看证书'; return; }
    await boot();
  })();
})();
