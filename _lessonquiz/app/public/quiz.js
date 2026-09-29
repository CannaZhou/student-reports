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
    // 任务单页左侧多一列名单，整页放宽一点，免得把表格/流程图挤窄；其它页维持 880 的单列
    const wrap = document.querySelector('.wrap');
    if (wrap) wrap.classList.toggle('wide', v === 'sheet');
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
  const FLOWROWS = [];      // 任务单里流程图板块所填：{_i:第几行, values:{空位key:所选词}}
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
        let badges;
        if (l.done) {
          const s = el('div', 'score', l.best + '');
          s.appendChild(el('span', 'sub', '　最高'));
          right.appendChild(s);
          badges = el('div', 'badges');
          badges.appendChild(el('span', 'pill ok', '已做 ' + l.attempts + ' 次'));
          badges.appendChild(el('span', 'pill', '最近 ' + (l.last == null ? '—' : l.last)));
          right.appendChild(badges);
        } else {
          right.appendChild(el('div', 'score none', '未做'));
          badges = el('div', 'badges'); badges.appendChild(el('span', 'pill', '可点开始'));
          right.appendChild(badges);
        }
        // 已发证的课挂一枚可点胶囊（放徽章行里，不塞进下面的按钮条——窄屏塞三个按钮会挤破版式）
        if (l.cert && l.cert.issued) {
          const cb = el('span', 'pill cert', '🎖️ ' + l.cert.stars.toFixed(1) + ' 星');
          cb.appendChild(el('span', 'sub', ' 证书'));
          cb.title = l.cert.pending
            ? '本课证书已颁发；课内任务单待老师批阅，批完综合评价会自动更新'
            : '本课证书已颁发，点开查看';
          cb.onclick = (e) => { e.stopPropagation(); location.href = 'cert?lesson=' + encodeURIComponent(l.id); };
          badges.appendChild(cb);
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

  // ================= 课内任务单（开放表；带标准答案的课按任务判分） =================
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

    // 老的单表任务单：sections 里只有一张表；多板块任务单：每板块一张表（活动一/二/三…）
    const blocks = (Array.isArray(s.sections) && s.sections.length) ? s.sections : [s];
    const multi = blocks.length > 1;
    const prevMap = prevRowMap();
    const gi = { v: 0 }; // 全局可填行序号，与后端 sheetRowSpecs 的顺序一一对应
    FLOWROWS.length = 0;

    if (multi) {
      if (s.heading) card.appendChild(el('div', 'sheet-heading', s.heading));
      if (s.caption) card.appendChild(el('div', 'sheet-caption', s.caption));
      if (s.intro) card.appendChild(el('p', 'muted', s.intro));
      if (s.image && s.image.src) card.appendChild(sheetFigure(s.image));
      if (s.code) card.appendChild(sheetCode(s.code));
    }

    blocks.forEach((b, bi) => {
      const host = multi ? el('div', 'sheet-sec') : card;
      if (multi) {
        host.appendChild(el('div', 'sheet-sec-head', b.heading || ('活动' + (bi + 1))));
        if (b.caption) host.appendChild(el('div', 'sheet-caption', b.caption));
        if (b.intro) host.appendChild(el('p', 'muted', b.intro));
        if (b.image && b.image.src) host.appendChild(sheetFigure(b.image));
        if (b.code) host.appendChild(sheetCode(b.code));
      } else {
        if (b.heading) host.appendChild(el('div', 'sheet-heading', b.heading));
        if (b.caption) host.appendChild(el('div', 'sheet-caption', b.caption));
        if (b.intro) host.appendChild(el('p', 'muted', b.intro));
        if (b.image && b.image.src) host.appendChild(sheetFigure(b.image));
        if (b.code) host.appendChild(sheetCode(b.code));
      }
      // 板块可以是一整张流程图（任务二）：不判分，选完跟着任务单一起存给老师看
      if (b.flow) host.appendChild(buildSheetFlow(b, prevMap, gi));
      else host.appendChild(buildSheetTable(b, prevMap, gi));
      if (multi) card.appendChild(host);
    });

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
      note.textContent = '填写完成后点“保存任务单”，可反复修改';
    }
    renderSheetSide();
    renderSheetAuto();
  }

  // 系统判分结果：一个任务 1 分，做对得 1 分、做错不得分。
  // 后端只告诉学生「哪个任务对、哪一格错」，不给标准答案（给了就能照着抄）。
  // 这一块只是给学生自己看的，证书/积分里的任务单得分仍然以老师赋的分为准。
  function renderSheetAuto() {
    const host = $('sheetAuto');
    if (!host) return;
    const a = SHEET && SHEET.auto;
    host.innerHTML = '';
    if (!a) { host.hidden = true; return; } // 没判分的课（或还没交过）就不显示
    host.hidden = false;

    const card = el('div', 'card auto-card');
    const h = el('div', 'auto-head');
    h.appendChild(el('b', null, '📋 系统判分'));
    h.appendChild(el('span', 'auto-score', '得了 ' + a.score + ' / ' + a.taskFull + ' 分'));
    h.appendChild(el('span', 'muted', '一个任务 1 分，整个任务全做对才得分'));
    card.appendChild(h);

    const ul = el('ul', 'auto-list');
    (a.tasks || []).forEach((t) => {
      const li = el('li', 'auto-item ' + (t.ok === true ? 'auto-ok' : (t.ok === false ? 'auto-no' : 'auto-skip')));
      li.appendChild(el('span', 'auto-mark', t.ok === true ? '✅' : (t.ok === false ? '❌' : '➖')));
      li.appendChild(el('span', 'auto-name', '任务' + '①②③④⑤⑥⑦⑧⑨'[t.no - 1] + ' ' + (t.title || '')));
      let s;
      // 系统只判有标准答案的格子；任务二里的手工算式没答案，系统判不了，
      // 所以「✅」也要注明还有几处等老师看，别让学生以为这一任务全查过了。
      const tail = t.manual ? '（还有 ' + t.manual + ' 处老师看）' : '';
      if (t.ok === true) s = '做对了，+1 分' + tail;
      else if (t.ok === false) s = '有 ' + t.wrong + ' 处不对，要改' + tail;
      else s = '这一任务由老师批阅';
      li.appendChild(el('span', 'auto-note', s));
      ul.appendChild(li);
    });
    card.appendChild(ul);

    const wrong = (a.wrong || []).length;
    if (wrong) {
      card.appendChild(el('div', 'auto-hint',
        '打红框的地方要改一改：' + wrong + ' 处。改完再点一次「保存任务单」，系统会重新判一遍。'));
    } else if (a.allGraded && a.score === a.taskFull) {
      card.appendChild(el('div', 'auto-hint auto-hint-ok', '全部做对啦！等着老师批完，就能在「我的证书」里看到这一课的综合评价。'));
    }
    host.appendChild(card);
    paintSheetWrong(a);
  }

  // 把判错的格子标红（按提交时的行号 _i + 列 key 找回来）
  function paintSheetWrong(a) {
    document.querySelectorAll('#sheetBody .sheet-wrong').forEach((n) => n.classList.remove('sheet-wrong'));
    ((a && a.wrong) || []).forEach((w) => {
      const tr = document.querySelector('#sheetBody tr[data-rowi="' + w.i + '"]');
      if (!tr) return;
      const c = tr.querySelector('[data-col="' + w.col + '"]');
      if (c) c.classList.add('sheet-wrong');
    });
  }

  // 左侧「本班这一课交没交」名单：只列姓名 + 一个红/绿圆点，不显示分数和别人填的内容
  function renderSheetSide() {
    const host = $('sheetSide'); host.innerHTML = '';
    const m = SHEET && SHEET.mates;
    if (!m || !m.list || !m.list.length) { host.hidden = true; return; }
    host.hidden = false;
    const card = el('div', 'card side-card');

    card.appendChild(el('div', 'side-cls', m.clsName || '本班'));
    const hint = el('div', 'side-hint');
    [['dot-no', '红色＝未提交'], ['dot-yes', '绿色＝已提交']].forEach((p) => {
      const line = el('div', 'hint-line');
      line.appendChild(el('span', 'dot ' + p[0]));
      line.appendChild(document.createTextNode(p[1]));
      hint.appendChild(line);
    });
    card.appendChild(hint);
    card.appendChild(el('div', 'side-count', '已交 ' + m.submitted + ' / ' + m.total + ' 人'));

    const ul = el('ul', 'mate-list');
    m.list.forEach((r) => {
      const li = el('li', 'mate ' + (r.done ? 'done' : 'todo') + (r.me ? ' me' : ''));
      li.appendChild(el('span', 'dot ' + (r.done ? 'dot-yes' : 'dot-no')));
      li.appendChild(el('span', 'mate-name', r.name));
      if (r.me) li.appendChild(el('span', 'mate-me', '我'));
      ul.appendChild(li);
    });
    card.appendChild(ul);
    host.appendChild(card);
    // 自己在名单里可能排得很靠后，进页面先滚到自己那行
    const meLi = ul.querySelector('.mate.me');
    if (meLi && ul.scrollHeight > ul.clientHeight) ul.scrollTop = Math.max(0, meLi.offsetTop - ul.clientHeight / 2);
  }

  // 题图：教材/练习册上的原图（学生照着图填表）
  function sheetFigure(im) {
    const fig = el('div', 'sheet-figure');
    const img = el('img');
    img.src = im.src;
    img.alt = im.alt || '题目图片';
    fig.appendChild(img);
    if (im.caption) fig.appendChild(el('div', 'sheet-figure-cap', im.caption));
    return fig;
  }

  // 板块里带的一段程序（第4课“鸡兔同笼.py”）：按原样保留换行和缩进，等宽字体显示。
  // 用 textContent 塞进 <pre>，不是 HTML，所以程序里的 < > 不会被当成标签。
  function sheetCode(code) {
    const pre = el('pre', 'sheet-code');
    pre.textContent = String(code).replace(/\t/g, '    ').replace(/\s+$/, '');
    return pre;
  }

  // 预填：新数据带 _i（第几行），老数据没 _i 就按数组位置
  function prevRowMap() {
    const m = {};
    (SHEET.prev || []).forEach((r, i) => {
      if (!r) return;
      const k = (r._i === undefined || r._i === null) ? i : r._i;
      if (m[k] === undefined) m[k] = r;
    });
    return m;
  }

  // 任务单里的流程图板块：和“课后小测”的流程图填空同一个渲染器，只是不判分
  // 整块算「一行」（_i 与后端 sheetRowSpecs 对齐），选中的词按空位 key 存下来
  function buildSheetFlow(b, prevMap, gi) {
    const rowIdx = gi.v++;
    const prev = prevMap[rowIdx] || {};
    const values = {};
    (b.flow.blanks || []).forEach((x) => { if (prev[x.key]) values[x.key] = prev[x.key]; });
    const host = el('div', 'sheet-flow');
    const rec = { _i: rowIdx, values };
    FLOWROWS.push(rec);
    if (window.Flowchart) {
      Flowchart.render(host, b.flow, {
        mode: 'answer', values,
        onChange: (k, v) => { if (v) rec.values[k] = v; else delete rec.values[k]; },
      });
    }
    return host;
  }

  // 一张表：cols/rows/example/rowLabels/given/givenTop/rowPick/noHead/center
  // 列带 pick 的格子渲染成下拉选择（连线题、表格填空都用它，比手打简单）；
  // rowPick 是「按行」给整行套下拉（如“是否满足正确解条件?”那一行整行选 √/×）。
  function buildSheetTable(b, prevMap, gi) {
    const cols = b.cols || [];
    const table = el('table', 'tbl sheet-table' + (b.center ? ' sheet-center' : ''));
    // 列特别多的表（如枚举表 36 列）用固定列宽 + 外层横向滚动，否则会被挤成一团看不清
    const wide = cols.length >= 12;
    if (wide) {
      table.classList.add('sheet-wide');
      table.style.minWidth = (126 + (cols.length - 1) * 58) + 'px';
    }
    // noHead：整张表就是一格格白格，不印表头（表头文字由学生自己写，如“只数/头数/脚数”）
    if (!b.noHead) {
      const thead = el('thead');
      const hr = el('tr');
      cols.forEach((c) => hr.appendChild(el('th', null, c.label || '')));
      thead.appendChild(hr);
      table.appendChild(thead);
    }
    const tb = el('tbody');
    const rowPick = b.rowPick || {};

    // 已知行（只读）：givenTop 印在表头下面第一行（如枚举表的“兔的只数 0~35”），given 印在最下面
    const renderGiven = (g) => {
      const tr = el('tr', 'sheet-given');
      cols.forEach((c) => {
        const td = el('td');
        td.dataset.col = c.key;
        td.textContent = g[c.key] == null ? '' : g[c.key];
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    };
    (b.givenTop ? (Array.isArray(b.givenTop) ? b.givenTop : [b.givenTop]) : []).forEach(renderGiven);

    // 示例行（只读，置灰）
    if (b.example) {
      const exr = el('tr', 'sheet-example');
      cols.forEach((c, i) => {
        const td = el('td');
        td.textContent = (i === 0 ? '例：' : '') + (b.example[c.key] || '');
        exr.appendChild(td);
      });
      tb.appendChild(exr);
    }

    // 可填行：rows 行，先按上次所填预填，其余留空
    // rowLabels 给了，就只给“有标签的行”做样子：第一列印好标签不可改，其余格给提示；
    // 没给 rowLabels 的老任务单（如四年级第1课）照旧每行都给“填写X”提示。
    // rowImages 给了，第一列就只摆图（如第2课活动一的四张数据图），学生端不印任何文字——
    // 学生要自己看图判断形式，印了“图①”只是噪声。行标签 rowLabels[i] 仍要写：它不在学生端显示，
    // 只给教师端当行号用（学生交上来这一格是空的，教师端就拿 rowLabels[i] 兜底印“图①”）。
    // 万一以后要印角标，给 rowImages[i] 加个 tag 字段即可。
    const n = b.rows || 0;
    const labels = b.rowLabels || [];
    const imgs = b.rowImages || [];
    const hasLabels = labels.length > 0;
    for (let i = 0; i < n; i++) {
      const tr = el('tr');
      tr.dataset.rowi = gi.v; // 这一行是「第几个可填行」，收卷时按它归位（流程图板块也占一个号）
      const prev = prevMap[gi.v] || {};
      const hint = hasLabels ? !!labels[i] : true; // 这一行要不要给提示文字
      cols.forEach((c, ci) => {
        const td = el('td');
        if (ci === 0 && (imgs[i] || labels[i])) {
          td.className = 'sheet-rowlabel' + (imgs[i] ? ' sheet-rowimg' : '');
          td.dataset.col = c.key;
          if (imgs[i]) {
            const im = el('img', 'sheet-rowimg-pic');
            im.src = imgs[i].src;
            im.alt = imgs[i].alt || labels[i] || ('图' + (i + 1)); // 图没了文字，alt 留给读屏
            td.appendChild(im);
            if (imgs[i].tag) td.appendChild(el('span', 'sheet-rowimg-tag', imgs[i].tag));
          } else {
            td.textContent = labels[i];
          }
        } else if ((c.pick && c.pick.length) || (rowPick[i] && rowPick[i].length)) {
          // 候选词：列自己的 pick 优先，其次看这一行有没有 rowPick（如 √/× 那一行）
          const words = (c.pick && c.pick.length) ? c.pick : rowPick[i];
          const sel = el('select', 'input sheet-cell sheet-pick');
          sel.dataset.col = c.key;
          const ph = el('option'); ph.value = ''; ph.textContent = '▾ 请选…'; ph.selected = true;
          sel.appendChild(ph);
          shuffle(words).forEach((w) => {
            const o = el('option'); o.value = w; o.textContent = w; sel.appendChild(o);
          });
          sel.value = prev[c.key] || '';
          td.appendChild(sel);
        } else {
          const inp = el('input', 'input sheet-cell');
          inp.dataset.col = c.key;
          // 题目已经印好的数据（preset，如「头 35、脚 94」）：先填好、置灰，学生不用再抄一遍。
          // 打上 data-pre，收卷时这一格不算“学生填过”——否则学生只点一下保存就算交了。
          const pre = (b.preset && b.preset[i] && b.preset[i][c.key] != null) ? String(b.preset[i][c.key]) : '';
          if (pre) { inp.dataset.pre = '1'; td.classList.add('sheet-pre'); }
          // 表头没写字就不给占位提示；宽表（36 列枚举表）格子窄，也不给长占位文字
          if (hint && c.label && !wide) inp.placeholder = '填写' + c.label;
          inp.value = prev[c.key] || pre;
          td.appendChild(inp);
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
      gi.v++;
    }

    // 已知行（只读，印在下面，如合计行“鸡和兔 35 35 94”）：内容由图/题干给定，学生不用填
    (b.given ? (Array.isArray(b.given) ? b.given : [b.given]) : []).forEach(renderGiven);
    table.appendChild(tb);
    if (!wide) return table;
    const scroll = el('div', 'tbl-scroll sheet-scroll');
    scroll.appendChild(table);
    return scroll;
  }

  function collectSheetRows() {
    const rows = [];
    // 表格行：行号取自渲染时写在 tr 上的 data-rowi（跨板块连续编号，流程图板块也占一个号），
    // 这样中间空着的行、以及夹在中间的流程图，都不会让后面的行错位。
    document.querySelectorAll('#sheetBody table.sheet-table tbody tr').forEach((tr) => {
      if (tr.classList.contains('sheet-example') || tr.classList.contains('sheet-given')) return;
      const cells = tr.querySelectorAll('[data-col]');
      if (!cells.length) return;
      const row = { _i: Number(tr.dataset.rowi) || 0 };
      let hasData = false; // 只读的行标签（“鸡”“对象”）不算填过，避免空表也当“已提交”
      cells.forEach((c) => {
        const isField = (c.tagName === 'INPUT' || c.tagName === 'SELECT');
        const v = (isField ? c.value : c.textContent).replace(/\s+/g, ' ').trim();
        row[c.dataset.col] = v;
        // 题目印好的格子（data-pre）跟着一起存，但不算学生填的内容
        if (isField && v && !c.dataset.pre) hasData = true;
      });
      if (hasData) rows.push(row);
    });
    // 流程图板块：选中的词按空位 key 存成一行（一个空都没选就不占行）
    FLOWROWS.forEach((r) => {
      const keys = Object.keys(r.values);
      if (!keys.length) return;
      const row = { _i: r._i };
      keys.forEach((k) => { row[k] = String(r.values[k]).replace(/\s+/g, ' ').trim(); });
      rows.push(row);
    });
    rows.sort((a, b) => a._i - b._i);
    return rows;
  }

  async function saveSheet() {
    if (!SHEET) return;
    const rows = collectSheetRows();
    if (!rows.length) { toast('请先至少填一行内容'); return; }
    const btn = $('sheetSaveBtn'); btn.disabled = true;
    try {
      const j = await api('/api/lesson/' + encodeURIComponent(SHEET.lessonId) + '/sheet/submit', 'POST', { rows });
      SHEET.prev = j.rows; SHEET.lastAt = j.savedAt; SHEET.auto = j.auto || null;
      $('sheetNote').textContent = '已保存 ' + fmtHm(j.savedAt) + ' ✓ 老师能看到，还可继续修改';
      renderSheetAuto(); // 当场按任务判一遍：哪个任务对、哪几格要改
      // 自己那一格当场变绿，不用重开页面（左栏是这一课交没交，保存过就一直算已交）
      const mates = SHEET.mates;
      if (mates && Array.isArray(mates.list)) {
        const me = mates.list.find((r) => r.me);
        if (me && !me.done) { me.done = true; mates.submitted = (mates.submitted || 0) + 1; renderSheetSide(); }
      }
      // 交完任务单这一刻可能就集齐了本课任务 → 当场告诉学生证书已颁发
      const c = j.cert;
      if (c && c.issued) {
        toast(c.pending ? '🎖️ 本课证书已颁发（任务单待老师批阅）' : '🎖️ 任务都做完了，本课证书已颁发');
        const note = $('sheetNote');
        if (note && !note.querySelector('.cert-jump')) {
          const go = el('button', 'btn cert-jump', '🎖️ 查看证书 →');
          go.style.cssText = 'font-size:12px;padding:4px 10px;margin-left:8px';
          go.onclick = () => { location.href = 'cert?lesson=' + encodeURIComponent(SHEET.lessonId); };
          note.appendChild(go);
        }
      } else if (c && (c.missing || []).indexOf('quiz') >= 0) {
        toast('任务单已保存 ✓ 再做完课后小测就能领本课证书');
      } else if (j.auto) {
        toast('任务单已保存 ✓ 系统判分 ' + j.auto.score + '/' + j.auto.taskFull
          + (j.auto.score === j.auto.taskFull ? '，全部做对 🎉' : '，下面红框的地方再看一看'));
      } else {
        toast('任务单已保存 ✓');
      }
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

    // 证书：小测交了、本课的任务都做完 → 这一刻颁发本课证书（有的课还要交课内任务单）
    if (j.cert) {
      const c = j.cert;
      const line = el('div', 'cert-cta');
      if (c.issued) {
        line.appendChild(el('span', 'pill ok',
          '🎖️ 本课证书 · ' + c.stars.toFixed(1) + ' 星 · ' + c.pct.toFixed(1) + '%'));
        const go = el('button', 'btn', '查看我的证书 →');
        go.onclick = () => { location.href = 'cert?lesson=' + encodeURIComponent(LESSON.id); };
        line.appendChild(go);
        if (c.pending) line.appendChild(el('span', 'muted', '课内任务单待老师批阅，批完综合评价与星级会自动更新'));
      } else {
        const miss = (c.missing || []).map((k) => (k === 'sheet' ? '课内任务单' : '课后小测')).join('、');
        line.appendChild(el('span', 'muted', '🎖️ 还差' + (miss || '一点') + '，交完就能领到本课证书'));
      }
      hero.appendChild(line);
    }
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
