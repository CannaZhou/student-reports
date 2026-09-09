/* 学生答题页：登录(选名) → 课程地图 → 答题(含流程图填空) → 结果 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; };
  function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = x[i]; x[i] = x[j]; x[j] = t; } return x; }
  let toastTimer;

  async function api(path, method, body) {
    const opt = { method: method || 'GET', headers: {} };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(path, opt);
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) { const m = (j && j.error && j.error.msg) || ('请求失败(' + r.status + ')'); const e = new Error(m); e.status = r.status; e.json = j; throw e; }
    return j;
  }
  function toast(msg) {
    clearTimeout(toastTimer);
    let t = document.querySelector('.toast');
    if (!t) { t = el('div', 'toast'); document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = 1;
    toastTimer = setTimeout(() => { t.style.opacity = 0; }, 2200);
  }
  function show(v) {
    ['login', 'map', 'quiz', 'sheet', 'result'].forEach((x) => { $('view-' + x).hidden = (x !== v); });
    window.scrollTo(0, 0);
    // 视图可见后再校准流程图缩放（构建时可能处于隐藏态，clientWidth 为 0）
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('section:not([hidden]) .fc-scroll').forEach((w) => {
        if (Flowchart.fit && w.parentElement) Flowchart.fit(w.parentElement);
      });
    }));
  }

  // ---------- 状态 ----------
  let ME = null;            // {name,className,grade,uid}
  let CATALOG = null;       // [{grade,semester,units:[{id,title,lessons:[…]}]}]
  let LESSON = null;        // 正在作答的卷 {id,title,full,questions}
  let SHEET = null;         // 正在打开的课内任务单 {lessonId,title,sheet,prev,lastAt}
  let curGrade = 0;         // 地图当前年级
  const DOMV = {};          // 作答控件引用（用于提交时取值）key = qid -> {collect:fn}

  // ================= 登录 =================
  async function onLoad() {
    try { ME = await api('/api/student/me'); applyMe(); renderMap(); show('map'); }
    catch (e) { show('login'); }
  }

  function applyMe() {
    $('topSub').textContent = (ME ? ME.className + ' · ' + ME.name : '');
    $('whoBox').textContent = ME ? (ME.name + '（' + ME.grade + '年级）') : '';
    $('whoBox').hidden = !ME;
    $('logoutBtn').hidden = !ME;
  }

  $('logoutBtn').addEventListener('click', async () => {
    try { await api('/api/student/logout', 'POST', {}); } catch (e) {}
    ME = null; CATALOG = null; SHEET = null; DOMV.length = 0; applyMe(); show('login'); $('loginName').value = '';
  });

  // 同名班级选择
  let pend = null; // {name, candidates}
  function showCls(candidates) {
    pend = { candidates };
    $('clsBox').hidden = false;
    const box = $('clsOpts'); box.innerHTML = '';
    candidates.forEach((c) => {
      const b = el('div', 'switch', c.className + '（' + c.grade + '年级）');
      b.onclick = async () => {
        try {
          ME = await api('/api/student/login', 'POST', { name: c.name, className: c.className });
          applyMe(); $('clsBox').hidden = true; await renderMap(); show('map');
        } catch (err) { $('loginErr').textContent = err.message; }
      };
      box.appendChild(b);
    });
  }

  $('loginGo').addEventListener('click', doLogin);
  $('loginName').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  async function doLogin() {
    const name = $('loginName').value.trim();
    if (!name) return;
    $('loginErr').textContent = '';
    try {
      ME = await api('/api/student/login', 'POST', { name });
      applyMe(); await renderMap(); show('map');
    } catch (e) {
      if (e.status === 409 && e.json && e.json.candidates) { showCls(e.json.candidates); return; }
      $('loginErr').textContent = e.message;
    }
  }

  // ================= 课程地图 =================
  async function renderMap() {
    try { const j = await api('/api/catalog'); CATALOG = j.catalog; if (j.name) { ME.name = j.name; ME.grade = j.grade; } applyMe(); }
    catch (e) { CATALOG = null; }
    if (!CATALOG) { show('login'); return; }

    const byGrade = {};
    CATALOG.forEach((g) => { byGrade[g.grade] = g; });
    const grades = Object.keys(byGrade).map(Number).sort((a, b) => a - b);
    curGrade = (grades.includes(ME.grade)) ? ME.grade : (grades[0] || 0);

    const tabs = $('gradeTabs'); tabs.innerHTML = '';
    const allGrades = [3, 4, 5, 6];
    allGrades.forEach((g) => {
      const t = el('div', 'tab' + (g === curGrade ? ' on' : ''), g + '年级');
      t.onclick = () => { curGrade = g; paintTabs(); paintMap(byGrade); };
      tabs.appendChild(t);
    });
    paintTabs();
    $('mapHeader').innerHTML = '';
    $('mapHeader').appendChild(el('h1', 'screen', ME.name + '，欢迎回来 🌟'));
    $('mapHeader').appendChild(el('div', 'muted', '点下面的课卡就能开始答题；做过的会显示你的最高积分。'));
    paintMap(byGrade);
  }

  function paintTabs() {
    [...$('gradeTabs').children].forEach((c) => c.classList.toggle('on', Number(c.textContent) === curGrade));
  }

  function paintMap(byGrade) {
    const body = $('mapBody'); body.innerHTML = '';
    const g = byGrade[curGrade];
    if (!g || !g.units.length) {
      body.appendChild(el('div', 'empty-note', '🌱 这一年级的内容还在准备中，先由老师加入新课内容后就能答题啦。'));
      return;
    }
    g.units.forEach((u) => {
      body.appendChild(el('div', 'unit-title', '单元 · ' + u.title + '　（' + (u.lessons || []).length + ' 课）'));
      const grid = el('div', 'lessons');
      (u.lessons || []).forEach((l) => {
        // 有课内任务单 → 卡片底部给【课内任务单】【课后小测】两个按钮；无 → 整卡点击进小测（老行为）
        const withSheet = !!l.hasSheet;
        const card = el('div', 'lesson' + (withSheet ? ' with-sheet' : ''));
        const ico = el('div', 'l-ico', l.hasFlow ? '🔀' : '✏️');
        const mid = el('div');
        mid.appendChild(el('h4', null, l.title));
        const subTxt = '课后小测 ' + l.num + ' 题 · 每题答对得 1 积分' + (l.hasFlow ? ' · 含流程图填空' : '') + (withSheet ? ' · 含课内任务单' : '');
        mid.appendChild(el('div', 'sub', subTxt));
        const right = el('div', 'r');
        if (l.done) {
          const s = el('div', 'score', l.best + '');
          s.appendChild(el('span', 'sub', '　最高'));
          right.appendChild(s);
          const bd = el('div', 'badges');
          bd.appendChild(el('span', 'pill ok', '已做 ' + l.attempts + ' 次'));
          bd.appendChild(el('span', 'pill', '最近 ' + (l.last == null ? '—' : l.last)));
          right.appendChild(bd);
        } else {
          right.appendChild(el('div', 'score none', '未做'));
          const bd2 = el('div', 'badges'); bd2.appendChild(el('span', 'pill', '可点开始'));
          right.appendChild(bd2);
        }
        card.appendChild(ico); card.appendChild(mid); card.appendChild(right);
        if (withSheet) {
          const mkBtn = (txt, solid, note, fn) => {
            const b = el('button', 'btn' + (solid ? '' : ' ghost'), txt);
            b.appendChild(el('span', 'la-note', note));
            b.onclick = (e) => { e.stopPropagation(); fn(); };
            return b;
          };
          const strip = el('div', 'lesson-actions');
          strip.appendChild(mkBtn('课内任务单', l.sheetDone, l.sheetDone ? '已交 ✓' : '未填', () => openSheet(l.id)));
          strip.appendChild(mkBtn('课后小测', l.done, l.done ? ('最高 ' + l.best + ' 积分') : '未做', () => openLesson(l.id)));
          card.appendChild(strip);
        } else {
          card.onclick = () => openLesson(l.id);
        }
        grid.appendChild(card);
      });
      body.appendChild(grid);
    });
  }

  // ================= 答题 =================
  async function openLesson(id) {
    try {
      const j = await api('/api/lesson/' + encodeURIComponent(id));
      LESSON = j.lesson;
      for (const k of Object.keys(DOMV)) delete DOMV[k];
      document.querySelectorAll('#quizBody .qcard').forEach((n) => n.remove());
      renderQuiz();
      show('quiz');
    } catch (e) { toast(e.message); }
  }

  function renderQuiz() {
    const head = $('quizHeader'); head.innerHTML = '';
    head.appendChild(el('h2', null, LESSON.title));
    const meta = el('div', 'muted', '共 ' + LESSON.questions.length + ' 题 · 每题整题答对得 1 积分 · 交卷后自动批改并记录');
    head.appendChild(meta);
    if (LESSON.questions.some((x) => x.type === 'flow')) {
      head.appendChild(el('div', 'muted', '🔀 含流程图填空题：看清题意后，在流程图的空格里点“▾ 请选”选词填入。'));
    }

    const body = $('quizBody'); body.innerHTML = '';
    LESSON.questions.forEach((q, i) => {
      const card = buildQuestionCard(q, i + 1);
      body.appendChild(card);
    });
    updateSubmitNote();
  }

  function cardOf() { return el('div', 'card qcard'); }
  function headRow(card, q, idx) {
    const h = el('div', 'qhead');
    h.appendChild(el('span', 'qidx', '第 ' + idx + ' 题'));
    h.appendChild(el('span', 'pill', q.typeName));
    h.appendChild(el('span', 'pill', q.levelName));
    // 不显示分值数字，只保留题型 + 难度星；整题全对得 1 积分
    card.appendChild(h);
    const t = el('div', 'qtext', q.q);
    card.appendChild(t);
  }

  function buildQuestionCard(q, idx) {
    const card = cardOf();
    headRow(card, q, idx);
    const collect = {}; // 供提交取值

    if (q.type === 'judge') {
      const row = el('div', 'switch-row');
      const mk = (val, txt, tip) => {
        const b = el('div', 'switch', txt);
        b.appendChild(el('span', 'v', tip || ''));
        b.onclick = () => {
          row.querySelectorAll('.switch').forEach((x) => x.classList.remove('on'));
          b.classList.add('on'); collect.value = val;
          updateSubmitNote();
        };
        row.appendChild(b);
      };
      mk('A', '√ 正确', '说法对');
      mk('B', '× 错误', '说法错');
      card.appendChild(row);
    } else if (q.type === 'single' || q.type === 'multi') {
      if (q.type === 'multi') card.appendChild(el('div', 'muted', '（多选题：可点选多个）'));
      const grid = el('div', 'opts');
      const sel = [];
      (q.options || []).forEach((o) => {
        const b = el('div', 'opt');
        const k = el('span', 'k', o.key);
        const tx = el('span', null, o.text);
        b.appendChild(k); b.appendChild(tx);
        b.onclick = () => {
          if (q.type === 'multi') {
            const i = sel.indexOf(o.key);
            if (i >= 0) { sel.splice(i, 1); b.classList.remove('on'); }
            else { sel.push(o.key); b.classList.add('on'); }
          } else {
            grid.querySelectorAll('.opt').forEach((x) => x.classList.remove('on'));
            b.classList.add('on'); sel.length = 0; sel.push(o.key);
          }
          collect.value = sel.join(',');
          updateSubmitNote();
        };
        grid.appendChild(b);
      });
      card.appendChild(grid);
    } else if (q.type === 'fill') {
      if (q.blanks && q.blanks.length) {
        // 多空填空：mode='pick' 且有候选词 → 下拉选词（降难度）；否则文本输入
        const bl = {};
        q.blanks.forEach((b, bi) => {
          const row = el('div', 'fill-row');
          row.appendChild(el('span', 'fl', b.label || ('空' + (bi + 1))));
          if (b.mode === 'pick' && b.words && b.words.length) {
            const sel = el('select', 'input fill');
            const ph = el('option'); ph.value = ''; ph.textContent = '▾ 请选…'; ph.selected = true;
            sel.appendChild(ph);
            shuffle(b.words).forEach((w) => {
              const o = el('option'); o.value = w; o.textContent = w; sel.appendChild(o);
            });
            sel.addEventListener('change', () => { bl[b.key] = sel.value; updateSubmitNote(); });
            row.appendChild(sel);
          } else {
            const inp = el('input', 'input fill');
            inp.placeholder = '请填写';
            inp.addEventListener('input', () => { bl[b.key] = inp.value.trim(); updateSubmitNote(); });
            row.appendChild(inp);
          }
          card.appendChild(row);
        });
        collect.get = () => bl;
      } else {
        const inp = el('input', 'input');
        inp.style.maxWidth = '420px'; inp.placeholder = '请输入答案';
        inp.addEventListener('input', () => { collect.value = inp.value.trim(); updateSubmitNote(); });
        card.appendChild(inp);
      }
    } else if (q.type === 'flow') {
      const host = el('div');
      host.style.marginTop = '4px';
      const flowBlanks = {}; // 只记录已填写的空（key→词）
      collect.map = flowBlanks;
      const holderEl = el('div');
      host.appendChild(holderEl);
      Flowchart.render(holderEl, q.flow, {
        mode: 'answer',
        values: {},
        onChange: (k, v) => { if (v) flowBlanks[k] = v; else delete flowBlanks[k]; updateSubmitNote(); },
      });
      card.appendChild(host);
      card.appendChild(el('div', 'fc-caption', '↔ 图较宽时可左右滑动查看；点击空格里的“▾ 请选”从中选词。'));
    }
    DOMV[q.id] = collect;
    return card;
  }

  function blanksOfQ(q) {
    if (q.type === 'flow') return (q.flow && q.flow.blanks) || [];
    if (q.type === 'fill' && q.blanks) return q.blanks;
    return null;
  }
  function filledMapOf(q, c) {
    if (!c) return {};
    if (q.type === 'flow') return c.map || {};
    if (q.type === 'fill' && q.blanks) return c.get ? c.get() : {};
    return null;
  }
  function unansweredCount() {
    let n = 0;
    LESSON.questions.forEach((q) => {
      const c = DOMV[q.id]; if (!c) { n++; return; }
      const blanks = blanksOfQ(q);
      if (blanks) {
        const fm = filledMapOf(q, c);
        if (!blanks.every((b) => fm[b.key] && String(fm[b.key]).trim())) n++;
      } else if (!c.value) {
        n++;
      }
    });
    return n;
  }
  function updateSubmitNote() {
    const n = unansweredCount();
    $('submitNote').textContent = n ? ('还有 ' + n + ' 题没做完（也可直接交卷）') : '全部完成，可以交卷啦 ✓';
    $('submitBtn').disabled = false;
  }

  function collectAnswers() {
    const answers = {};
    LESSON.questions.forEach((q) => {
      const c = DOMV[q.id]; if (!c) return;
      if (blanksOfQ(q)) { answers[q.id] = { blanks: filledMapOf(q, c) }; return; }
      answers[q.id] = { ans: c.value || '' };
    });
    return answers;
  }

  $('submitBtn').addEventListener('click', submit);
  async function submit() {
    const n = unansweredCount();
    if (n > 0 && !confirm('还有 ' + n + ' 题没有作答，确认现在交卷吗？（未作答部分不计分）')) return;
    $('submitBtn').disabled = true; $('submitBtn').textContent = '批改中…';
    try {
      const j = await api('/api/lesson/' + encodeURIComponent(LESSON.id) + '/submit', 'POST', { answers: collectAnswers() });
      renderResult(j);
      show('result');
    } catch (e) { toast('交卷失败：' + e.message); }
    $('submitBtn').disabled = false; $('submitBtn').textContent = '交卷批改';
  }

  // ================= 课内任务单（开放表：不判分，只记录所填） =================
  function fmtHm(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (x) => String(x).padStart(2, '0');
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  async function openSheet(id) {
    try {
      const j = await api('/api/lesson/' + encodeURIComponent(id) + '/sheet');
      SHEET = j; // {lessonId,title,sheet,prev,lastAt}
      renderSheet();
      show('sheet');
    } catch (e) { toast(e.message); }
  }

  function renderSheet() {
    const s = SHEET.sheet;
    const head = $('sheetHeader'); head.innerHTML = '';
    const bar = el('div', 'row-flex');
    const back = el('button', 'btn ghost', '← 返回课程地图');
    back.onclick = () => { SHEET = null; renderMap(); show('map'); };
    bar.appendChild(back);
    head.appendChild(bar);

    const card = el('div', 'card');
    const h2 = el('h2', null, SHEET.title);
    h2.appendChild(el('small', null, ' · ' + (s.title || '课内任务单')));
    card.appendChild(h2);
    if (s.heading) card.appendChild(el('div', 'sheet-heading', s.heading));
    if (s.caption) card.appendChild(el('div', 'sheet-caption', s.caption));
    if (s.intro) card.appendChild(el('p', 'muted', s.intro));

    const cols = s.cols || [];
    const table = el('table', 'tbl sheet-table');
    const thead = el('thead');
    const hr = el('tr');
    cols.forEach((c) => hr.appendChild(el('th', null, c.label)));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tb = el('tbody');

    // 示例行（只读，置灰）
    if (s.example) {
      const exr = el('tr', 'sheet-example');
      cols.forEach((c, i) => {
        const td = el('td');
        td.textContent = (i === 0 ? '例：' : '') + (s.example[c.key] || '');
        exr.appendChild(td);
      });
      tb.appendChild(exr);
    }

    // 可填行：rows 行，先按上次所填预填，其余留空
    const n = s.rows || 3;
    for (let i = 0; i < n; i++) {
      const tr = el('tr');
      const prev = (SHEET.prev && SHEET.prev[i]) || {};
      cols.forEach((c) => {
        const td = el('td');
        const inp = el('input', 'input sheet-cell');
        inp.placeholder = '填写' + c.label;
        inp.value = prev[c.key] || '';
        td.appendChild(inp);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    table.appendChild(tb);
    card.appendChild(table);

    if (s.remind) {
      const rem = el('div', 'sheet-remind');
      rem.appendChild(el('b', null, '💡 温馨提醒：'));
      rem.appendChild(document.createTextNode(s.remind));
      card.appendChild(rem);
    }
    $('sheetBody').innerHTML = '';
    $('sheetBody').appendChild(card);

    const note = $('sheetNote');
    if (SHEET.lastAt) {
      note.textContent = '上次保存 ' + fmtHm(SHEET.lastAt) + ' · 老师能看到，可继续修改后再保存';
      note.style.color = '';
    } else {
      note.textContent = '填好 2~3 处后点“保存任务单”，可反复修改';
    }
  }

  function collectSheetRows() {
    const cols = (SHEET.sheet.cols || []).map((c) => c.key);
    const rows = [];
    document.querySelectorAll('#sheetBody table.sheet-table tbody tr').forEach((tr) => {
      if (tr.classList.contains('sheet-example')) return;
      const ins = tr.querySelectorAll('input.sheet-cell');
      if (!ins.length) return;
      const row = {};
      ins.forEach((inp, i) => { row[cols[i]] = inp.value.replace(/\s+/g, ' ').trim(); });
      if (cols.some((k) => row[k])) rows.push(row);
    });
    return rows;
  }

  async function saveSheet() {
    if (!SHEET) return;
    const rows = collectSheetRows();
    if (!rows.length) { toast('请先至少填一行内容'); return; }
    const btn = $('sheetSaveBtn'); btn.disabled = true;
    try {
      const j = await api('/api/lesson/' + encodeURIComponent(SHEET.lessonId) + '/sheet/submit', 'POST', { rows });
      SHEET.prev = j.rows; SHEET.lastAt = j.savedAt;
      $('sheetNote').textContent = '已保存 ' + fmtHm(j.savedAt) + ' ✓ 老师能看到，还可继续修改';
      toast('任务单已保存 ✓');
    } catch (e) { toast('保存失败：' + e.message); }
    btn.disabled = false;
  }
  $('sheetSaveBtn').addEventListener('click', saveSheet);

  // ================= 结果 =================
  function renderResult(j) {
    const body = $('resultBody'); body.innerHTML = '';
    const perQ = {};
    j.perQ.forEach((p) => { perQ[p.id] = p; });
    const qBy = {};
    LESSON.questions.forEach((q) => { qBy[q.id] = q; });

    // 积分卡：答对 X / Y 题 → X 积分
    const hero = el('div', 'card result-hero');
    const score = el('div', 'big-score');
    score.appendChild(el('span', null, j.score));
    score.appendChild(el('small', null, ' / ' + j.full + ' 题'));
    hero.appendChild(score);
    const pct = j.full ? Math.round(j.score / j.full * 100) : 0;
    let lvl = '再接再厉 💪', tone = 'bad';
    if (pct >= 90) { lvl = '答对 ' + j.score + ' 题，得到 ' + j.score + ' 积分，真棒！🌟'; tone = 'ok'; }
    else if (pct >= 75) { lvl = '答对 ' + j.score + ' 题，得到 ' + j.score + ' 积分，很不错！👍'; tone = 'ok'; }
    else if (pct >= 60) { lvl = '答对 ' + j.score + ' 题，得到 ' + j.score + ' 积分，通过啦 ✍️'; tone = 'warn'; }
    else { lvl = '答对 ' + j.score + ' 题，得到 ' + j.score + ' 积分，别灰心，看讲解再练一次吧 💪'; tone = 'bad'; }
    hero.appendChild(el('div', 'pill ' + tone, lvl));
    hero.appendChild(el('div', 'muted', '每题整题全对得 1 积分 · 已自动记录到“我的成绩”，老师也能看到。'));
    body.appendChild(hero);

    // 逐题
    j.detail.forEach((d) => {
      const q = qBy[d.id];
      if (!q) return;
      const card = el('div', 'perq ' + (d.ok ? 'ok-line' : 'bad-line'));
      const ph = el('div', 'ph');
      ph.appendChild(el('span', 'pill ' + (d.ok ? 'ok' : 'bad'), d.ok ? '✓ 对' : '✗ 错'));
      const name = q.typeName + (q.levelName ? ' · ' + q.levelName : '');
      ph.appendChild(el('span', 'muted', name));
      ph.appendChild(el('span', 'gained', d.ok ? '+1 积分' : '不得分'));
      card.appendChild(ph);

      const pb = el('div', 'pb');
      pb.appendChild(el('div', null, q.q));
      // 作答详情
      const al = el('div', 'blank-zone');
      if (q.type === 'flow' || (q.type === 'fill' && d.blanks)) {
        const host = el('div');
        if (q.type === 'flow') {
          al.appendChild(el('div', 'sec-title', '流程图回看'));
          const wrap = el('div');
          al.appendChild(wrap);
          const values = {};
          (q.flow.blanks || []).forEach((b) => { const st = (d.blanks || []).find((x) => x.key === b.key); if (st) values[b.key] = st.got || ''; });
          Flowchart.render(wrap, q.flow, { mode: 'result', values, blanksState: d.blanks || [] });
        }
        (d.blanks || []).forEach((b) => {
          const row = el('div', 'blank-line');
          const dot = el('span', 'dot ' + (b.ok ? 'ok' : 'bad'));
          row.appendChild(dot);
          if (b.ok) {
            row.appendChild(el('span', null, '你填的「' + (b.got || '') + '」正确'));
            row.appendChild(el('span', 'corr', '√'));
          } else {
            row.appendChild(el('span', null, '你填「' + (b.got || '未作答') + '」'));
            row.appendChild(el('span', 'corr', '→ 应为「' + b.correct + '」'));
          }
          if (b.expl) row.appendChild(el('span', 'small', b.expl));
          al.appendChild(row);
        });
        pb.appendChild(al);
      } else {
        const yours = el('div');
        const my = yoursAns(q, DOMV[q.id]);
        yours.appendChild(el('span', null, '你的答案：'));
        yours.appendChild(el('span', d.ok ? 'corr' : 'col-bad', my || '（未作答）'));
        al.appendChild(yours);
        const corr = el('div');
        corr.appendChild(el('span', null, '正确答案：'));
        corr.appendChild(el('span', 'corr', d.correct || ''));
        al.appendChild(corr);
        pb.appendChild(al);
      }
      if (d.expl) pb.appendChild(el('div', 'expl', '💡 讲解：' + d.expl));
      card.appendChild(pb);
      body.appendChild(card);
    });

    // 操作
    const act = el('div', 'action-row');
    const back = el('button', 'btn ghost', '← 返回课程地图');
    back.onclick = async () => { LESSON = null; await renderMap(); show('map'); };
    const again = el('button', 'btn ghost', '再做一次');
    again.onclick = () => { DOMV.length = 0; openLesson(LESSON.id); };
    const mine = el('button', 'btn', '看我的成绩 →');
    mine.onclick = () => { location.href = 'scores'; };
    act.appendChild(back); act.appendChild(again); act.appendChild(mine);
    body.appendChild(act);
  }

  function yoursAns(q, c) {
    if (!c) return '';
    if (q.type === 'judge') return c.value === 'A' ? '√ 正确' : (c.value === 'B' ? '× 错误' : '');
    if (q.type === 'single' || q.type === 'multi') {
      if (!c.value) return '';
      return c.value.split(',').filter(Boolean).map((k) => {
        const o = (q.options || []).find((x) => x.key === k);
        return o ? (k + '.' + o.text) : k;
      }).join('　');
    }
    return c.value;
  }

  onLoad();
})();
