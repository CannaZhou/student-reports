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
  function sheetDetailCell(s, sheet) {
    const td = el('td'); td.colSpan = 7;
    const box = el('div', 'sheet-detail');
    box.style.padding = '4px 2px 8px';
    // 提交的行按 _i（第几行）归位；老数据没有 _i 就按数组位置
    const byIdx = {};
    (s.rows || []).forEach((r, i) => {
      if (!r) return;
      const k = (r._i === undefined || r._i === null) ? i : r._i;
      if (byIdx[k] === undefined) byIdx[k] = r;
    });
    const blocks = (sheet && Array.isArray(sheet.sections) && sheet.sections.length) ? sheet.sections : [sheet];
    if (!blocks || !blocks.length || !blocks[0]) {
      box.appendChild(el('div', 'muted', s.submitted ? '（空）' : '—'));
      td.appendChild(box); return td;
    }
    // 系统按任务判的结果：哪个任务对、哪一格错、标准答案是什么（这些只给老师看，不下发学生）
    const autoBy = {};
    ((s.auto && s.auto.cells) || []).forEach((c) => { autoBy[c.i + '|' + c.col] = c; });
    if (s.auto && s.auto.graded) {
      const bar = el('div', 'sys-bar');
      bar.appendChild(el('b', null, '系统按任务判分：'));
      (s.auto.tasks || []).forEach((t) => {
        bar.appendChild(el('span', 'sys-task ' + (t.ok === true ? 'st-ok' : (t.ok === false ? 'st-no' : 'st-skip')),
          '任务' + '①②③④⑤⑥⑦⑧⑨'[t.no - 1] + ' ' + (t.title || '')
          + (t.ok === true ? ' ✅ +1' : (t.ok === false ? ' ❌ ' + t.wrong + ' 处不对' : ' ➖ 老师看'))));
      });
      bar.appendChild(el('span', 'muted', '　系统给了 ' + s.auto.score + '/' + s.auto.taskFull + ' 分'
        + (s.auto.manual && s.auto.manual.length ? '；有 ' + s.auto.manual.length + ' 处系统不判（如手工算式），请老师看过再定分' : '')));
      box.appendChild(bar);
    }
    let gi = 0, shown = 0;
    blocks.forEach((b, bi) => {
      // 流程图板块（第3课任务二）：整块算「一行」，把学生选的词填回流程图里给老师看。
      // 一个空都没选的就不画整张图（画布很大，会把赋分台撑得老长），只留一句说明。
      if (b && b.flow) {
        const frow = byIdx[gi];
        const values = {};
        (b.flow.blanks || []).forEach((x) => { if (frow && frow[x.key]) values[x.key] = frow[x.key]; });
        gi += 1;
        if (blocks.length > 1) box.appendChild(el('div', 'sheet-sec-head', (b.heading || ('活动' + (bi + 1)))));
        if (!Object.keys(values).length) {
          box.appendChild(el('div', 'muted', '【流程图】未作答'));
          return;
        }
        const fh = el('div', 'sheet-flow');
        box.appendChild(fh);
        if (window.Flowchart) Flowchart.render(fh, b.flow, { mode: 'result', values, blanksState: [] });
        else box.appendChild(el('div', 'muted', '【流程图】已作答（本页没加载流程图控件）'));
        shown++;
        return;
      }
      const cols = (b && b.cols) || [];
      if (!cols.length) return;
      if (blocks.length > 1) box.appendChild(el('div', 'sheet-sec-head', (b.heading || ('活动' + (bi + 1)))));
      const st = el('table', 'tbl'); st.style.fontSize = '12.5px';
      // 列特别多的表（枚举表 36 列）：给个够读数字的最小宽度，外面套一个「不撑破外层表格」的
      // 横向滚动盒（width:0 + min-width:100%），这样 1440 屏上一屏能看全，窄屏也只在这块里左右滑，
      // 姓名/赋分那几栏始终在屏幕上。
      const wideT = cols.length >= 12;
      if (wideT) { st.classList.add('sheet-wide'); st.style.minWidth = (76 + (cols.length - 1) * 34) + 'px'; }
      // 表头没写字（空表任务单：表头由学生自己填）就不印这一行，免得顶一条空白
      if (cols.some((c) => c.label)) {
        const hr = el('tr');
        cols.forEach((c) => hr.appendChild(el('th', null, c.label)));
        st.appendChild(hr);
      }
      const labels = (b && b.rowLabels) || [];
      const imgs = (b && b.rowImages) || [];
      for (let i = 0; i < (b.rows || 0); i++) {
        const row = byIdx[gi + i];
        // 只印「学生填过的行」和「有行标签的行」（行标签让学生留空的项也看得见）
        if (!row && !labels[i] && !imgs[i]) continue;
        const tr = el('tr');
        cols.forEach((c, ci) => {
          const tc = el('td');
          const v = row ? (row[c.key] || '') : '';
          // 行首是数据图（第2课活动一）时给老师放个小缩略图，省得对着“图①”猜是哪张图。
          // 只认「这次交的」数据（存的是“图①”角标）；改图前交的老数据存的是原来那版题面文字，
          // 配上新图会张冠李戴，所以老数据照旧只印它当时填的那行字。
          if (ci === 0 && imgs[i] && (!v || v === labels[i])) {
            const im = el('img');
            im.src = imgs[i].src;
            im.alt = imgs[i].alt || labels[i] || ('图' + (i + 1));
            im.style.cssText = 'display:block;max-width:110px;max-height:56px;border-radius:4px;border:1px solid var(--line);margin-bottom:3px';
            tc.appendChild(im);
            tc.appendChild(el('span', null, labels[i] || v || '—'));
            if (!row) tc.style.color = 'var(--ink-2)';
          } else if (!v && ci === 0 && labels[i]) { tc.textContent = labels[i]; tc.style.color = 'var(--ink-2)'; }
          else tc.textContent = v || '—';
          // 系统判这一格错的：标红并把标准答案写在旁边（老师改分时心里有数；
          // 系统不判的格子没有这条记录，照旧只显示学生填的内容）
          const ac = autoBy[(gi + i) + '|' + c.key];
          if (ac && !ac.ok) {
            tc.classList.add('td-wrong');
            // want 可能是数组（一格收了多种写法，如「23」「23只」），只印第一个给老师看
            const want = Array.isArray(ac.want) ? ac.want[0] : ac.want;
            if (want != null && want !== '') tc.appendChild(el('span', 'fix-want', '应为 ' + want));
            else if (!v) tc.appendChild(el('span', 'fix-want', '未作答'));
          }
          tr.appendChild(tc);
        });
        st.appendChild(tr); shown++;
      }
      gi += (b.rows || 0);
      if (st.querySelector('tr')) {
        if (!wideT) box.appendChild(st);
        else { const sc = el('div', 'tbl-scroll sheet-detail-scroll'); sc.appendChild(st); box.appendChild(sc); }
      }
    });
    if (!shown) box.appendChild(el('div', 'muted', '（空）'));
    td.appendChild(box);
    return td;
  }
  // 赋分台一眼看出来：红＝还没处理、橙＝交了还没批、绿＝批完了
  // 注意：给「没交」的学生记了分，那一行也算批完（变绿，标签写明「未交·记0分」）——
  // 否则记了 0 分那行还是红的，老师根本看不出自己到底记上没有。
  function markState(s) {
    if (s.score == null) return s.submitted ? { cls: 'row-noscore', text: '未赋分' } : { cls: 'row-miss', text: '未交' };
    return { cls: 'row-scored', text: s.submitted ? '已赋分' : ('未交·记' + s.score + '分') };
  }
  function markLegend() {
    const w = el('div', 'mark-legend');
    [['lg-miss', '红 = 未交未赋分'], ['lg-noscore', '橙 = 交了待赋分'], ['lg-scored', '绿 = 已赋分']].forEach((p) => {
      w.appendChild(el('span', 'lg ' + p[0], p[1]));
    });
    w.appendChild(el('span', 'muted', '　（没交的学生也能赋分，记完即变绿并标「未交·记0分」）'));
    w.appendChild(el('span', 'muted', '　（0 分也是分：输入 0 后按回车或点到别处即保存；「清除」才是撤销评分）'));
    return w;
  }
  // 任务单赋分台：按班看整班（含未交），边看内容边赋分（一题 1 分、做对几题得几分）；另显示【本课小测】【学期累计】两列成绩
  async function lessonSheets(id, clsName) {
    let j = null;
    const q = clsName ? ('?class=' + encodeURIComponent(clsName)) : '';
    try { j = await api('/api/teacher/sheet-board/' + encodeURIComponent(id) + q); }
    catch (e) { toast(e.message); return; }
    const taskFull = j.lesson.taskFull || 1;   // 本课任务单共几题 = 赋分上限
    const body = $('tabBody'); body.innerHTML = '';
    const back = el('button', 'btn ghost', '← 返回各课情况');
    back.onclick = () => { cur = 'overview'; paintTabs(); loadTab(); };
    const card = el('div', 'card');
    const row = el('div', 'row-flex');
    row.appendChild(el('b', null, j.lesson.title + ' · 课内任务单 · 赋分'));
    const gotN = j.students.filter((x) => x.submitted).length;
    row.appendChild(el('span', 'muted', '　' + j.clsName + ' · 已交 ' + gotN + '/' + j.students.length + ' · 本课共 ' + taskFull + ' 题，做对几题填几（0–' + taskFull + '），留空=清除'));
    card.appendChild(row);
    card.appendChild(markLegend());
    const chipsBar = el('div');
    classChips(chipsBar, j.classes, j.clsName, (c) => lessonSheets(id, c));
    card.appendChild(chipsBar);
    if (!j.students.length) {
      card.appendChild(el('div', 'empty-note', '这个班还没有学生。'));
      body.appendChild(back); body.appendChild(card); return;
    }
    // ---- 批量赋分：勾选 ＋ 批量条 ----
    // 老师原话：「能不能批量打分，比如给未提交的学生，或者系统直接打0分也行」。
    // 做法是勾选后统一记分，**不**做自动打 0：今天是没交，明天可能补交，
    // 系统自作主张记下的 0 分是要算进期末积分的，得让老师看着时机自己按。
    const picked = new Set();      // 选中的 uid
    const boxes = [];              // 每行的勾选框，用来同步表头的「全选」
    const byUid = {};              // uid → 就地刷新这一行（分数 / 赋分时间 / 学期累计）
    const allCb = el('input'); allCb.type = 'checkbox'; allCb.title = '全选 / 全不选';
    const bulkBar = el('div', 'bulk-bar');
    const bulkN = el('span', 'bulk-n', '');
    const bulkInp = el('input', 'input score-in');
    bulkInp.type = 'number'; bulkInp.min = '0'; bulkInp.max = String(taskFull); bulkInp.step = '1';
    bulkInp.placeholder = '0–' + taskFull; bulkInp.title = '批量要记的分数（0–' + taskFull + '）';
    // 四个按钮各带一个稳定的 class：验收脚本按 class 找，不按会变的按钮文字找
    const bulkApply = el('button', 'btn bulk-apply', '应用到选中');
    const bulkClear = el('button', 'btn ghost bulk-clear', '清除选中评分');
    const bulkZero = el('button', 'btn ghost bulk-zero', '');
    const bulkNone = el('button', 'btn ghost bulk-none', '取消选择');
    const zeroTargets = () => j.students.filter((x) => !x.submitted && x.score == null).map((x) => x.uid);
    const refreshBulk = () => {
      boxes.forEach((b) => { b.cb.checked = picked.has(b.uid); });
      const n = picked.size;
      allCb.checked = n > 0 && n === boxes.length;
      allCb.indeterminate = n > 0 && n < boxes.length;
      bulkN.textContent = n ? ('已选 ' + n + ' 人') : '勾选姓名前的方框即可批量赋分';
      bulkApply.disabled = !n; bulkClear.disabled = !n; bulkNone.disabled = !n;
      const zn = zeroTargets().length;
      bulkZero.textContent = zn ? ('没交且没赋分的 ' + zn + ' 人 → 一律记 0 分') : '没交且没赋分的：0 个';
      bulkZero.disabled = !zn;
    };
    const applyBatch = async (uids, score) => {
      if (!uids.length) { toast('没有选中学生'); return; }
      try {
        const r = await api('/api/teacher/sheet-board/' + encodeURIComponent(id) + '/score-batch', 'POST', { uids, score });
        (r.rows || []).forEach((x) => { const set = byUid[x.uid]; if (set) set(x.score, x.scoredAt, x.termScore); });
        picked.clear(); refreshBulk();
        let msg = (score === '') ? ('已清除 ' + r.updated + ' 人的评分') : ('已给 ' + r.updated + ' 人记 ' + score + ' 分');
        if (r.skipped) msg += '（' + r.skipped + ' 人不在名单里，已跳过）';
        toast(msg);
      } catch (e) { toast('批量赋分失败：' + e.message); }
    };
    bulkApply.onclick = () => {
      const v = bulkInp.value;
      if (v === '') { toast('先在右边填一个分数（0–' + taskFull + '）'); return; }
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > taskFull) { toast('本课任务单共 ' + taskFull + ' 题，请填 0–' + taskFull + ' 的整数'); return; }
      applyBatch(Array.from(picked), n);
    };
    bulkClear.onclick = () => {
      if (!confirm('清除选中的 ' + picked.size + ' 人在《' + j.lesson.title + '》的评分？')) return;
      applyBatch(Array.from(picked), '');
    };
    bulkZero.onclick = () => {
      const t = zeroTargets();
      if (!t.length) { toast('本班没有「没交任务单且还没赋分」的学生'); return; }
      if (!confirm('给本班 ' + t.length + ' 位没交任务单的学生一律记 0 分？\n（已经交了的、已经赋过分的都不会动）')) return;
      applyBatch(t, 0);
    };
    bulkNone.onclick = () => { picked.clear(); refreshBulk(); };
    allCb.onchange = () => {
      const on = allCb.checked;
      boxes.forEach((b) => { if (on) picked.add(b.uid); else picked.delete(b.uid); });
      refreshBulk();
    };
    bulkBar.appendChild(bulkN);
    bulkBar.appendChild(bulkZero);
    bulkBar.appendChild(bulkNone);
    bulkBar.appendChild(el('span', 'bulk-sp', '批量记分 '));
    bulkBar.appendChild(bulkInp);
    bulkBar.appendChild(bulkApply);
    bulkBar.appendChild(bulkClear);
    card.appendChild(bulkBar);

    const table = el('table', 'tbl');
    const h = el('tr');
    const nameTh = el('th');
    nameTh.appendChild(allCb);
    nameTh.appendChild(el('span', null, ' 姓名'));
    h.appendChild(nameTh);
    ['本课小测', '学期累计', '最近保存', '提交内容', '赋分(0–' + taskFull + ')', ''].forEach((x) => h.appendChild(el('th', null, x)));
    table.appendChild(h);
    const sheetDef = j.sheet || null;
    j.students.forEach((s) => {
      const tr = el('tr');
      let detail = null;                       // 展开的「提交内容」行，跟着一起着色
      // 赋分后当场算出这张证书会变成几%几星（口径同证书页：小测分+任务分 ÷ 题数+任务数）
      // —— 老师以前看不到这个，打了低分也不知道会把学生的证书压下去
      const certHint = el('div', 'muted');
      certHint.style.fontSize = '11px'; certHint.style.marginTop = '2px';
      const paintCert = () => {
        if (s.score == null) { certHint.textContent = ''; return; }
        const total = (s.lessonFull || 0) + taskFull;
        const earned = (s.lessonQuiz || 0) + Math.min(s.score, taskFull);
        const pct = total > 0 ? Math.min(100, Math.round(earned / total * 1000) / 10) : 0;
        const stars = Math.round(pct / 20 * 10) / 10;
        certHint.textContent = '证书 ' + pct.toFixed(1) + '% · ' + stars.toFixed(1) + ' 星';
        certHint.style.color = pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--ink-2)' : 'var(--bad)';
      };
      // 勾选框放在姓名格里（不新开一列），否则会把整行左侧那条状态色条挤到第二格去
      const cb = el('input'); cb.type = 'checkbox'; cb.title = '勾选后可批量赋分';
      cb.style.marginRight = '6px'; cb.style.verticalAlign = 'middle';
      cb.onchange = () => { if (cb.checked) picked.add(s.uid); else picked.delete(s.uid); refreshBulk(); };
      const nameTd = el('td');
      nameTd.appendChild(cb);
      nameTd.appendChild(document.createTextNode(s.name));
      const pill = el('span', 'pill', '');     // 状态标签：未交 / 未赋分 / 已赋分（跟整行底色一个颜色）
      pill.style.marginLeft = '6px'; pill.style.fontSize = '11px';
      nameTd.appendChild(pill);
      tr.appendChild(nameTd);
      boxes.push({ uid: s.uid, cb });
      // 赋分时间：老师按了回车到底记上没有，看一眼这里就知道（以前只有颜色，看不出记录时刻）
      const stamped = el('div', 'muted');
      stamped.style.fontSize = '11px'; stamped.style.marginTop = '2px';
      // 状态配色随时刷新：赋分后橙→绿、清除后绿→橙，不用重开页面
      const paint = () => {
        const mk = markState(s);
        [tr, detail].forEach((n) => {
          if (!n) return;
          n.classList.remove('row-miss', 'row-noscore', 'row-scored');
          n.classList.add(mk.cls);
        });
        pill.className = 'pill ' + (mk.cls === 'row-noscore' ? 'warn' : mk.cls === 'row-scored' ? 'ok' : 'bad');
        pill.textContent = mk.text;
        stamped.textContent = s.score == null ? '' : (s.scoredAt ? ('赋分于 ' + fmtT(s.scoredAt)) : '已赋分');
        paintCert();
      };
      paint();
      const qz = el('td');
      if (s.lessonQuiz != null) { qz.appendChild(el('b', null, String(s.lessonQuiz) + '/' + s.lessonFull)); }
      else qz.textContent = '—';
      tr.appendChild(qz);
      const term = el('td'); term.className = 'sum-cell'; term.textContent = String(s.termScore || 0); tr.appendChild(term);

      // 提交内容（查看/收起）
      const ct = el('td');
      const ctl = el('div', 'row-flex');
      if (s.submitted) {
        let open = false;
        detail = el('tr'); detail.hidden = true; detail.appendChild(sheetDetailCell(s, sheetDef));
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
      inp.type = 'number'; inp.min = '0'; inp.max = String(taskFull); inp.step = '1';
      inp.value = (s.score != null) ? String(s.score) : '';
      inp.placeholder = s.score == null ? ('0–' + taskFull) : '';
      let saving = false;
      // 单人赋分与批量赋分共用的落地点：把分数写回这一行（输入框 / 赋分时间 / 学期累计 / 行底色一起刷）
      const applyScore = (score, scoredAt, termScore) => {
        s.score = score;
        if (scoredAt !== undefined) s.scoredAt = scoredAt;
        inp.value = score == null ? '' : String(score);
        inp.placeholder = score == null ? ('0–' + taskFull) : '';
        if (termScore != null) term.textContent = String(termScore);
        paint();
      };
      byUid[s.uid] = applyScore;
      const commit = async () => {
        if (saving) return; saving = true;
        const v = inp.value;
        const doClear = v === '' && s.score != null;
        if (v === '' && s.score == null) { saving = false; return; }
        try {
          const r = await api('/api/teacher/sheet-board/' + encodeURIComponent(id) + '/score', 'POST', { uid: s.uid, score: doClear ? '' : Number(v) });
          applyScore(r.score, r.scoredAt, r.termScore);
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
      // 系统按任务判的分：老师一眼看出这个学生是哪个任务错了，点一下就按系统的分填上，
      // 觉得系统判得不对（比如任务二的算式写得乱）就自己改，最后仍以老师填的为准。
      if (s.auto && s.auto.graded) {
        const sysLine = el('div', 'sys-line');
        sysLine.appendChild(el('span', 'muted', '系统 '));
        const sysB = el('b', null, s.auto.score + '/' + s.auto.taskFull);
        sysB.style.color = s.auto.score === s.auto.taskFull ? 'var(--ok)' : 'var(--bad)';
        sysLine.appendChild(sysB);
        (s.auto.tasks || []).forEach((t) => {
          const sp = el('span', 'sys-task ' + (t.ok === true ? 'st-ok' : (t.ok === false ? 'st-no' : 'st-skip')),
            '任务' + '①②③④⑤⑥⑦⑧⑨'[t.no - 1] + (t.ok === true ? '✅' : (t.ok === false ? '❌' : '➖')));
          sysLine.appendChild(sp);
        });
        if (s.auto.manual && s.auto.manual.length) {
          sysLine.appendChild(el('span', 'muted', '（另有 ' + s.auto.manual.length + ' 处要老师看）'));
        }
        const fillBtn = el('button', 'btn ghost sys-fill', '按系统分填 ' + s.auto.score);
        fillBtn.style.padding = '1px 6px'; fillBtn.style.fontSize = '11px';
        fillBtn.title = '把系统判的分填进左边的输入框（仍可自己改）';
        fillBtn.onclick = () => { inp.value = String(s.auto.score); commit(); };
        sysLine.appendChild(fillBtn);
        sc.appendChild(sysLine);
      }
      sc.appendChild(stamped);    // 「赋分于 9/22 15:41」
      sc.appendChild(certHint);   // 「证书 X% · Y 星」，赋分后当场出现
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
    // 套一层横向滚动：窄屏（最小 500px）下宁可横着滑，也别把姓名和标签挤成两行一个字
    const scroll = el('div', 'tbl-scroll');
    scroll.appendChild(table);
    card.appendChild(scroll);
    body.appendChild(back);
    body.appendChild(card);
    refreshBulk();   // 行都建好了，这时才数得出「已选几人 / 没交的几人」
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
