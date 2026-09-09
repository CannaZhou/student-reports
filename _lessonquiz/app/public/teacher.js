/* 教师管理页 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; };
  let toastTimer;
  function toast(msg) {
    clearTimeout(toastTimer);
    let t = document.querySelector('.toast');
    if (!t) { t = el('div', 'toast'); document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = 1;
    toastTimer = setTimeout(() => { t.style.opacity = 0; }, 2400);
  }
  async function api(path, method, body) {
    const opt = { method: method || 'GET', headers: {} };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(path, opt);
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error((j && j.error && j.error.msg) || ('请求失败(' + r.status + ')')); e.status = r.status; e.json = j; throw e; }
    return j;
  }

  let cur = 'roster';

  async function onLoad() {
    try { await api('/api/teacher/me'); enter(); }
    catch (e) { $('login').hidden = false; $('admin').hidden = true; }
  }
  function enter() {
    $('login').hidden = true; $('admin').hidden = false; $('logoutBtn').hidden = false;
    paintTabs(); loadTab();
  }
  $('logoutBtn').addEventListener('click', async () => {
    try { await api('/api/teacher/logout', 'POST', {}); } catch (e) {}
    $('admin').hidden = true; $('login').hidden = false; $('logoutBtn').hidden = true; $('pw').value = '';
  });

  $('loginGo').addEventListener('click', doLogin);
  $('pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  async function doLogin() {
    $('loginErr').textContent = '';
    try { await api('/api/teacher/login', 'POST', { password: $('pw').value }); enter(); }
    catch (e) { $('loginErr').textContent = e.message; }
  }

  // ---------- 页签 ----------
  function paintTabs() {
    [...document.querySelectorAll('.tab[data-tab]')].forEach((x) => {
      x.classList.toggle('on', x.dataset.tab === cur);
      x.onclick = () => { cur = x.dataset.tab; paintTabs(); loadTab(); };
    });
  }
  function loadTab() {
    const body = $('tabBody'); body.innerHTML = '<div class="empty-note">加载中…</div>';
    if (cur === 'roster') renderRoster();
    else if (cur === 'overview') renderOverview();
    else if (cur === 'summary') renderSummary();
    else renderPassword();
  }

  // 班级胶囊（当前班高亮；onPick 换班重画本页）
  function classChips(container, classes, sel, onPick) {
    const bar = el('div', 'cls-chips');
    if (!classes || !classes.length) { container.appendChild(el('div', 'muted', '暂无可选班级。')); return; }
    classes.forEach((c) => {
      const b = el('button', 'cls-chip' + (c.name === sel ? ' on' : ''), c.name);
      if (c.count) { b.appendChild(el('span', null, ' ')); b.appendChild(el('small', null, String(c.count) + '人')); }
      b.onclick = () => { if (c.name !== sel) onPick(c.name); };
      bar.appendChild(b);
    });
    container.appendChild(bar);
  }

  // ---------- 名单 ----------
  async function renderRoster() {
    const body = $('tabBody'); body.innerHTML = '';
    let list = [];
    try { list = (await api('/api/teacher/roster')).list; }
    catch (e) { body.appendChild(el('div', 'empty-note', e.message)); return; }

    // 导入
    const imp = el('div', 'card');
    imp.appendChild(el('h3', null, '导入学生名单'));
    imp.appendChild(el('div', 'muted', '每行一个：<b>班级，姓名</b>（也支持“2023级6班，张三”按年份自动识别年级）。可一次粘贴整班。'));
    const ta = el('textarea', 'input'); ta.id = 'impText'; ta.placeholder = '例如：\n2023级1班，王小明\n2023级1班，李小红\n六（2）班，陈雨';
    imp.appendChild(ta);
    const row = el('div', 'action-row');
    const add = el('button', 'btn', '追加到名单');
    add.onclick = () => doImport(false, ta);
    const rep = el('button', 'btn ghost', '清空并重新导入');
    rep.onclick = () => doImport(true, ta);
    row.appendChild(add); row.appendChild(rep);
    imp.appendChild(row);
    imp.appendChild(el('div', 'muted', '当前共 <b id="cnt"></b> 人'));
    body.appendChild(imp);

    // 分组
    const groups = {};
    list.forEach((s) => { (groups[s.className] = groups[s.className] || []).push(s); });
    const sortedCls = Object.keys(groups).sort((a, b) => (a.includes('未分班') ? 1 : 0) - (b.includes('未分班') ? 1 : 0) || a.localeCompare(b, 'zh'));
    let total = 0;
    sortedCls.forEach((cn) => {
      const g = groups[cn];
      const card = el('div', 'card');
      card.appendChild(el('div', 'unit-title', cn + '（' + g.length + ' 人）'));
      const t = el('table', 'tbl');
      const h = el('tr'); ['姓名', '年级', '操作'].forEach((x) => h.appendChild(el('th', null, x))); t.appendChild(h);
      g.forEach((s) => {
        total++;
        const tr = el('tr');
        tr.appendChild(el('td', null, s.name));
        tr.appendChild(el('td', null, s.grade ? s.grade + '年级' : '—'));
        const td = el('td');
        const b = el('button', 'btn ghost', '移出');
        b.style.padding = '2px 8px'; b.style.fontSize = '12px';
        b.onclick = async () => { if (!confirm('确定把 ' + s.name + ' 移出名单？其成绩记录会保留。')) return; try { await api('/api/teacher/roster/delete', 'POST', { uid: s.uid }); renderRoster(); toast('已移出 ' + s.name); } catch (e) { toast(e.message); } };
        td.appendChild(b);
        tr.appendChild(td);
        t.appendChild(tr);
      });
      card.appendChild(t);
      body.appendChild(card);
    });
    const c = $('cnt'); if (c) c.textContent = String(list.length);
    if (!list.length) body.appendChild(el('div', 'empty-note', '名单为空，请在上方粘贴导入。'));
    void total;
  }
  async function doImport(replace, ta) {
    const text = ta.value.trim();
    if (!text) return toast('请先粘贴名单内容');
    if (replace && !confirm('将清空当前全部名单再导入，确定吗？')) return;
    try {
      const j = await api('/api/teacher/roster', 'POST', { text, replace });
      toast('导入成功：新增 ' + j.added + ' 人，名单共 ' + j.total + ' 人');
      ta.value = ''; renderRoster();
    } catch (e) { toast(e.message); }
  }

  // ---------- 完成情况 ----------
  async function renderOverview() {
    const body = $('tabBody'); body.innerHTML = '';
    let ov = null;
    try { ov = (await api('/api/teacher/overview')).lessons; }
    catch (e) { body.appendChild(el('div', 'empty-note', e.message)); return; }
    const card = el('div', 'card');
    card.appendChild(el('div', 'unit-title', '各课完成情况'));
    if (!ov.length) { card.appendChild(el('div', 'empty-note', '还没有任何课程内容，请先运行 seed。')); body.appendChild(card); return; }
    const t = el('table', 'tbl');
    const hasAnySheet = ov.some((x) => x.hasSheet);
    const head = ['年级', '课程', '已完成', '总人次', '平均最高积分'];
    if (hasAnySheet) head.push('课内任务单');
    head.push('');
    const h = el('tr'); head.forEach((x) => h.appendChild(el('th', null, x))); t.appendChild(h);
    ov.forEach((l) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, l.grade + '年级'));
      tr.appendChild(el('td', null, l.title));
      tr.appendChild(el('td', null, l.doneCount + ' 人'));
      tr.appendChild(el('td', null, String(l.attempts)));
      tr.appendChild(el('td', null, l.avgBest == null ? '—' : String(l.avgBest)));
      if (hasAnySheet) tr.appendChild(el('td', null, l.hasSheet ? (l.sheetDone + ' 人') : '—'));
      const td = el('td');
      const wrap = el('div', 'row-flex');
      if (l.hasSheet) {
        const bS = el('button', 'btn ghost', '课内任务单');
        bS.style.padding = '2px 8px'; bS.style.fontSize = '12px';
        bS.onclick = () => lessonSheets(l.lessonId);
        wrap.appendChild(bS);
      }
      const b = el('button', 'btn', l.hasSheet ? '小测·看明细' : '看明细');
      b.style.padding = '2px 10px'; b.style.fontSize = '12px';
      b.onclick = () => lessonScores(l.lessonId);
      wrap.appendChild(b);
      td.appendChild(wrap);
      tr.appendChild(td);
      t.appendChild(tr);
    });
    card.appendChild(t);
    body.appendChild(card);
  }

  // 单课小测明细：按班级分开查看（只列该课年级下的班）
  async function lessonScores(id, clsName) {
    let j = null;
    try { j = await api('/api/teacher/lesson-scores/' + encodeURIComponent(id)); }
    catch (e) { toast(e.message); return; }
    const body = $('tabBody'); body.innerHTML = '';
    const back = el('button', 'btn ghost', '← 返回各课情况');
    back.onclick = () => { cur = 'overview'; paintTabs(); loadTab(); };
    const card = el('div', 'card');
    const row = el('div', 'row-flex');
    row.appendChild(el('b', null, j.lesson.title + ' · 课后小测'));
    row.appendChild(el('span', 'muted', '　每题整题答对得 1 积分 · 满分 ' + j.lesson.full));
    card.appendChild(row);
    const grade = j.lesson.grade || 0;
    const seen = {}, classes = [];
    j.rows.forEach((s) => { if (s.grade === grade && !seen[s.className]) { seen[s.className] = 1; classes.push({ name: s.className }); } });
    if (!clsName) clsName = classes.length ? classes[0].name : '';
    const chipsBar = el('div');
    classChips(chipsBar, classes, clsName, (c) => lessonScores(id, c));
    card.appendChild(chipsBar);
    const studs = j.rows.filter((s) => s.grade === grade && s.className === clsName);
    if (!studs.length) { card.appendChild(el('div', 'empty-note', '这个班还没有学生。')); body.appendChild(back); body.appendChild(card); return; }
    const table = el('table', 'tbl');
    const h = el('tr'); ['姓名', '最高积分', '最近', '次数', '操作'].forEach((x) => h.appendChild(el('th', null, x))); table.appendChild(h);
    studs.forEach((s) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, s.name));
      tr.appendChild(el('td', null, s.best == null ? '—' : String(s.best)));
      tr.appendChild(el('td', null, s.lastScore == null ? '—' : String(s.lastScore)));
      tr.appendChild(el('td', null, String(s.attempts)));
      const td = el('td');
      const b = el('button', 'btn ghost', '重置本课');
      b.style.padding = '2px 8px'; b.style.fontSize = '12px';
      b.onclick = async () => { if (!confirm('重置 ' + s.name + ' 在本课的成绩？')) return; try { await api('/api/teacher/progress/delete', 'POST', { uid: s.uid, lessonId: j.lesson.id }); toast('已重置'); lessonScores(id, clsName); } catch (e) { toast(e.message); } };
      td.appendChild(b);
      const b2 = el('button', 'btn ghost', '清全部');
      b2.style.padding = '2px 8px'; b2.style.fontSize = '12px'; b2.style.marginLeft = '4px';
      b2.onclick = async () => { if (!confirm('清空 ' + s.name + ' 的全部成绩？（含任务单评分）')) return; try { await api('/api/teacher/progress/delete', 'POST', { uid: s.uid }); toast('已清空'); lessonScores(id, clsName); } catch (e) { toast(e.message); } };
      td.appendChild(b2);
      tr.appendChild(td);
      table.appendChild(tr);
    });
    card.appendChild(table);
    body.appendChild(back);
    body.appendChild(card);
  }

  // ---------- 课内任务单（查看学生填写） ----------
  function fmtT(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const p = (x) => String(x).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function sheetDetailCell(s, cols) {
    const td = el('td'); td.colSpan = 7;
    const box = el('div', 'sheet-detail');
    box.style.padding = '4px 2px 8px';
    const st = el('table', 'tbl'); st.style.fontSize = '12.5px';
    const hr = el('tr');
    (cols || []).forEach((c) => hr.appendChild(el('th', null, c.label)));
    st.appendChild(hr);
    (s.rows || []).forEach((row) => {
      const tr = el('tr');
      (cols || []).forEach((c) => {
        const tc = el('td'); tc.textContent = row[c.key] || '—'; tr.appendChild(tc);
      });
      st.appendChild(tr);
    });
    if (!(s.rows || []).length) st.appendChild(el('tr')).appendChild(el('td', null, '（空）'));
    box.appendChild(st);
    td.appendChild(box);
    return td;
  }
  // 任务单赋分台：按班看整班（含未交），边看内容边赋 0–10 分；另显示【本课小测】【学期累计】两列成绩
  async function lessonSheets(id, clsName) {
    let j = null;
    const q = clsName ? ('?class=' + encodeURIComponent(clsName)) : '';
    try { j = await api('/api/teacher/sheet-board/' + encodeURIComponent(id) + q); }
    catch (e) { toast(e.message); return; }
    const body = $('tabBody'); body.innerHTML = '';
    const back = el('button', 'btn ghost', '← 返回各课情况');
    back.onclick = () => { cur = 'overview'; paintTabs(); loadTab(); };
    const card = el('div', 'card');
    const row = el('div', 'row-flex');
    row.appendChild(el('b', null, j.lesson.title + ' · 课内任务单 · 赋分'));
    const gotN = j.students.filter((x) => x.submitted).length;
    row.appendChild(el('span', 'muted', '　' + j.clsName + ' · 已交 ' + gotN + '/' + j.students.length + ' · 赋 0–10 分，0 分也算，留空=清除'));
    card.appendChild(row);
    const chipsBar = el('div');
    classChips(chipsBar, j.classes, j.clsName, (c) => lessonSheets(id, c));
    card.appendChild(chipsBar);
    if (!j.students.length) {
      card.appendChild(el('div', 'empty-note', '这个班还没有学生。'));
      body.appendChild(back); body.appendChild(card); return;
    }
    const table = el('table', 'tbl');
    const h = el('tr');
    ['姓名', '本课小测', '学期累计', '最近保存', '提交内容', '赋分(0–10)', ''].forEach((x) => h.appendChild(el('th', null, x)));
    table.appendChild(h);
    const cols = (j.sheet && j.sheet.cols) || [];
    j.students.forEach((s) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, s.name));
      const qz = el('td');
      if (s.lessonQuiz != null) { qz.appendChild(el('b', null, String(s.lessonQuiz) + '/' + s.lessonFull)); }
      else qz.textContent = '—';
      tr.appendChild(qz);
      const term = el('td'); term.className = 'sum-cell'; term.textContent = String(s.termScore || 0); tr.appendChild(term);

      // 提交内容（查看/收起）
      let detail = null;
      const ct = el('td');
      const ctl = el('div', 'row-flex');
      if (s.submitted) {
        let open = false;
        detail = el('tr'); detail.hidden = true; detail.appendChild(sheetDetailCell(s, cols));
        const v = el('button', 'btn ghost', '查看');
        v.style.padding = '2px 8px'; v.style.fontSize = '12px';
        v.onclick = () => { open = !open; detail.hidden = !open; v.textContent = open ? '收起' : '查看'; };
        const savedAt = el('span', 'muted', fmtT(s.lastAt));
        ctl.appendChild(v); ctl.appendChild(savedAt);
      } else {
        ctl.appendChild(el('span', 'muted', '未提交'));
      }
      ct.appendChild(ctl);
      tr.appendChild(ct);

      // 赋分输入
      const sc = el('td');
      const scWrap = el('div', 'row-flex');
      const inp = el('input', 'input score-in');
      inp.type = 'number'; inp.min = '0'; inp.max = '10'; inp.step = '1'; inp.value = (s.score != null) ? String(s.score) : '';
      inp.placeholder = s.score == null ? '0–10' : '';
      let saving = false;
      const commit = async () => {
        if (saving) return; saving = true;
        const v = inp.value;
        const doClear = v === '' && s.score != null;
        if (v === '' && s.score == null) { saving = false; return; }
        try {
          const r = await api('/api/teacher/sheet-board/' + encodeURIComponent(id) + '/score', 'POST', { uid: s.uid, score: doClear ? '' : Number(v) });
          s.score = r.score;
          term.textContent = String(r.termScore || 0);
          inp.value = r.score == null ? '' : String(r.score);
          toast(r.score == null ? '已清除 ' + s.name + ' 的评分' : '已给 ' + s.name + ' 记 ' + r.score + ' 分');
        } catch (e) {
          inp.value = (s.score != null) ? String(s.score) : '';
          toast('赋分失败：' + e.message);
        }
        saving = false;
      };
      inp.addEventListener('change', commit);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { inp.blur(); commit(); } });
      const clearBtn = el('button', 'btn ghost', '清除');
      clearBtn.style.padding = '2px 8px'; clearBtn.style.fontSize = '12px';
      clearBtn.onclick = async () => {
        if (s.score == null) return toast('还没有评分，无需清除');
        if (!confirm('清除 ' + s.name + ' 在本课任务单的评分？')) return;
        inp.value = '';
        await commit();
      };
      scWrap.appendChild(inp); scWrap.appendChild(clearBtn);
      sc.appendChild(scWrap);
      tr.appendChild(sc);

      // 删除该生提交内容（不影响评分）
      const op = el('td');
      if (s.submitted) {
        const del = el('button', 'btn ghost', '删提交');
        del.style.padding = '2px 8px'; del.style.fontSize = '12px';
        del.onclick = async () => {
          if (!confirm('删除 ' + s.name + ' 在《' + j.lesson.title + '》交的任务单内容？\n（不会清除你已给的评分）')) return;
          try { await api('/api/teacher/progress/delete', 'POST', { uid: s.uid, lessonId: j.lesson.id, kind: 'sheet' }); toast('已删除提交内容'); lessonSheets(id, clsName); }
          catch (e) { toast(e.message); }
        };
        op.appendChild(del);
      }
      tr.appendChild(op);
      table.appendChild(tr);
      if (detail) table.appendChild(detail);
    });
    card.appendChild(table);
    body.appendChild(back);
    body.appendChild(card);
  }

  // ---------- 期末汇总（按班：每课两格 + 三合计，0 分照常计入） ----------
  async function renderSummary(clsName, sortBy) {
    let j = null;
    try { j = await api('/api/teacher/term' + (clsName ? '?class=' + encodeURIComponent(clsName) : '')); }
    catch (e) { toast(e.message); return; }
    const body = $('tabBody'); body.innerHTML = '';
    const card = el('div', 'card');
    const row = el('div', 'row-flex');
    row.appendChild(el('b', null, '🗂 期末汇总 · ' + j.clsName));
    row.appendChild(el('span', 'muted', '　每课：小测(自动判分) + 任务单(教师赋分) · 3 个合计列 · 0 分照常计入'));
    card.appendChild(row);
    const chipsBar = el('div');
    classChips(chipsBar, j.classes, j.clsName, (c) => renderSummary(c, sortBy || 'name'));
    card.appendChild(chipsBar);
    if (!j.students.length) {
      card.appendChild(el('div', 'empty-note', '这个班还没有学生。'));
      body.appendChild(card); return;
    }
    const sort = sortBy === 'total' ? 'total' : 'name';
    const studs = j.students.slice();
    studs.sort((a, b) => (sort === 'total' ? (b.total - a.total || a.name.localeCompare(b.name, 'zh')) : a.name.localeCompare(b.name, 'zh')));
    const lessons = j.lessons || [];
    const scroll = el('div', 'tbl-scroll');
    const table = el('table', 'tbl sum-table');
    const thead = el('thead');
    const tr1 = el('tr');
    const nameTh = el('th', 'cnt'); nameTh.textContent = '姓名'; nameTh.rowSpan = 2; tr1.appendChild(nameTh);
    lessons.forEach((ls) => { const th = el('th', 'cnt'); th.textContent = ls.title; th.colSpan = 2; tr1.appendChild(th); });
    ['小测合计', '任务单合计', '总分'].forEach((t) => { const th = el('th', 'cnt sum'); th.textContent = t; th.rowSpan = 2; tr1.appendChild(th); });
    thead.appendChild(tr1);
    const tr2 = el('tr');
    lessons.forEach(() => {
      tr2.appendChild(el('th', 'cnt', '小测'));
      tr2.appendChild(el('th', 'cnt', '任务单'));
    });
    thead.appendChild(tr2);
    table.appendChild(thead);

    studs.forEach((s) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, s.name));
      const per = s.per || [];
      lessons.forEach((ls, i) => {
        const c = per[i] || {};
        const qz = el('td');
        qz.textContent = (c.quiz == null) ? '—' : String(c.quiz) + '/' + (ls.full || c.quiz);
        qz.style.textAlign = 'center';
        const tk = el('td');
        tk.textContent = (c.task == null) ? '—' : String(c.task);
        tk.style.textAlign = 'center';
        tr.appendChild(qz); tr.appendChild(tk);
      });
      const a = el('td', 'sum-cell'); a.textContent = String(s.quizSum); tr.appendChild(a);
      const b = el('td', 'sum-cell'); b.textContent = String(s.taskSum); tr.appendChild(b);
      const t = el('td', 'sum-total'); t.textContent = String(s.total); tr.appendChild(t);
      table.appendChild(tr);
    });
    scroll.appendChild(table);
    card.appendChild(scroll);
    const foot = el('div', 'muted');
    const st = j.stats || {};
    foot.textContent = '全班 ' + st.count + ' 人 · 平均总分 ' + (st.avg == null ? '—' : st.avg) + ' · 最高 ' + (st.maxT == null ? '—' : st.maxT) + '　（每人总分 = 小测积分合计 + 任务单评分合计；未评/未做显示 —、不计分，评了 0 分则计 0）';
    card.appendChild(foot);
    const tools = el('div', 'row-flex');
    const byName = el('button', 'btn' + (sort === 'name' ? '' : ' ghost'), '按姓名');
    byName.style.padding = '4px 12px'; byName.onclick = () => renderSummary(clsName || j.clsName, 'name');
    const byTotal = el('button', 'btn' + (sort === 'total' ? '' : ' ghost'), '按总分降序');
    byTotal.style.padding = '4px 12px'; byTotal.onclick = () => renderSummary(clsName || j.clsName, 'total');
    const pr = el('button', 'btn ghost', '🖨 打印 / 存 PDF');
    pr.style.padding = '4px 12px'; pr.onclick = () => window.print();
    tools.appendChild(byName); tools.appendChild(byTotal); tools.appendChild(pr);
    card.appendChild(tools);
    body.appendChild(card);
  }

  // ---------- 改密码 ----------
  function renderPassword() {
    const body = $('tabBody'); body.innerHTML = '';
    const card = el('div', 'card');
    card.appendChild(el('h3', null, '修改教师密码'));
    const box = el('div'); box.style.maxWidth = '360px';
    const mk = (id, lab) => { box.appendChild(el('label', 'f', lab)); const inp = el('input', 'input'); inp.id = id; inp.type = 'password'; box.appendChild(inp); };
    mk('fPwOld', '原密码');
    mk('fPwN1', '新密码（至少4位）');
    mk('fPwN2', '再输一次新密码');
    const go = el('button', 'btn big', '保存新密码');
    go.style.marginTop = '14px';
    go.onclick = async () => {
      const o = $('fPwOld').value, n1 = $('fPwN1').value, n2 = $('fPwN2').value;
      if (n1 !== n2) return toast('两次输入的新密码不一致');
      if (n1.length < 4) return toast('新密码至少 4 位');
      try { await api('/api/teacher/password', 'POST', { old: o, password: n1 }); toast('密码已修改 ✓'); ['fPwOld', 'fPwN1', 'fPwN2'].forEach((x) => { $(x).value = ''; }); }
      catch (e) { toast(e.message); }
    };
    box.appendChild(go);
    card.appendChild(box);
    body.appendChild(card);
  }

  onLoad();
})();
