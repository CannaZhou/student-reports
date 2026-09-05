// 教师端逻辑
const $ = (s) => document.querySelector(s);
const view = $('#view');
const state = { units: [], preview: [] };

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) {
    const err = new Error((j.error && j.error.msg) || '请求失败');
    err.code = j.error && j.error.code;
    err.needsSetup = !!j.needsSetup;
    err.status = res.status;
    throw err;
  }
  return j;
}
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
const TYPE_NAME = { single: '单选', judge: '判断', multi: '多选', fill: '填空' };
const TYPE_KEYS = Object.keys(TYPE_NAME);

function unitOptions(selected) {
  let html = '<option value="">（未归类）</option>';
  state.units.forEach((u) => {
    html += `<option value="${u.id}" ${u.id === selected ? 'selected' : ''}>${esc(u.id)} ${esc(u.title)}</option>`;
  });
  return html;
}

// ---------------- 登录 ----------------
$('#loginBtn').addEventListener('click', async () => {
  const pw = $('#tpw').value;
  if (!pw) return toast('请输入密码');
  try { await api('POST', '/api/teacher/login', { password: pw }); enterApp(); }
  catch (e) {
    if (e.needsSetup) { $('#loginCard').classList.add('hidden'); $('#setupCard').classList.remove('hidden'); }
    else toast(e.message);
  }
});
$('#tpw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#loginBtn').click(); });
$('#setupBtn').addEventListener('click', async () => {
  const pw = $('#npw').value;
  if (pw.length < 4) return toast('密码至少 4 位');
  try { await api('POST', '/api/teacher/setup', { password: pw }); enterApp(); }
  catch (e) { toast(e.message); }
});
$('#logoutBtn').addEventListener('click', async () => {
  try { await api('POST', '/api/teacher/logout', {}); } catch (e) {}
  location.reload();
});

async function enterApp() {
  $('#loginBox').classList.add('hidden');
  $('#appBox').classList.remove('hidden');
  $('#who').classList.remove('hidden');
  $('#logoutBtn').classList.remove('hidden');
  try { state.units = flattenUnits((await api('GET', '/api/teacher/stats')).categories); } catch (e) {}
  switchView('overview');
}
function flattenUnits(categories) {
  const out = [];
  categories.forEach((c) => c.units.forEach((u) => out.push({ id: u.id, title: c.title.replace(/^第.*篇　/, '') + '·' + u.title })));
  return out;
}

function switchView(name) {
  document.querySelectorAll('#mainNav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'overview') loadOverview();
  else if (name === 'reading') loadReading();
  else if (name === 'students') loadStudents();
  else if (name === 'questions') renderQuestions();
  else if (name === 'detail') loadDetail();
  else if (name === 'settings') renderSettings();
}
$('#mainNav').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  switchView(b.dataset.view);
});

// ---------------- 阅读统计 ----------------
async function loadReading() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/teacher/reading/stats');
    let html = `<div class="card">
      <h3>📖 阅读统计 · ${esc(r.book.title)}</h3>
      <p class="tip">参与学生 ${r.summary.readerCount}/${r.summary.studentCount} · 人均完成 ${r.summary.avgDone} 章 · 总积分 ${r.summary.totalPoints} · AI提问 ${r.summary.totalDialogs} 次</p>
    </div>`;
    html += `<div class="card"><h4>章节进度</h4><table><tr><th>章</th><th>章节</th><th>读完故事</th><th>完成闯关</th><th>平均答对</th></tr>`;
    for (const c of r.chapterAgg) {
      html += `<tr><td>${c.no}</td><td>${esc(c.title)}</td><td>${c.storyCount} 人</td><td>${c.quizCount} 人</td><td>${c.quizCount ? c.avgScore + ' 题' : '—'}</td></tr>`;
    }
    html += `</table></div>`;
    html += `<div class="card"><h4>学生阅读明细</h4><table><tr><th>学生</th><th>完成章节</th><th>积分</th><th>AI提问</th><th>徽章</th></tr>`;
    for (const s of r.students) {
      html += `<tr><td>${esc(s.name)}${s.active ? '' : '（停用）'}</td><td>${s.doneChapters}</td><td>${s.points}</td><td>${s.dialogCount}</td><td>${s.badgeCount}</td></tr>`;
    }
    html += `</table></div>`;
    view.innerHTML = html;
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

// ---------------- 总览 ----------------
// 固定公网域名（2026-08-28 起固定，不再随隧道变化）
const PUB_URL = 'https://ai.aizqxx.top';
function publicPanelHtml() {
  return `<div class="card"><div class="row">
    <h3 class="grow">📡 公网访问 · 学生链接</h3>
    <button class="sm secondary" data-copy-pub>复制链接</button>
  </div>
  <p class="tip">学生访问地址固定如下（教师电脑需保持开机并已启动隧道）。学生用<b>手机相机扫码</b>或<b>复制链接到浏览器打开</b>即可进入（不要在微信里直接点，会被拦截）。</p>
  <p class="mono" style="font-size:17px;font-weight:600;color:var(--primary-dark);word-break:break-all;">${PUB_URL}</p>
  </div>`;
}

async function loadOverview() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/teacher/overview');
    const byType = r.bank.byType;
    const typeHtml = Object.keys(byType).map((t) => `${TYPE_NAME[t] || t} ${byType[t]}`).join(' · ');
    let html = publicPanelHtml();
    html += `<div class="card"><div class="row">
      <h3 class="grow">📊 班级答题总览</h3>
      <span class="badge info">题库共 ${r.bank.total} 题（${typeHtml}）</span>
    </div>
    <p class="tip">打卡规则：${r.config.totalDays} 天 × 每天 ${r.config.daySize} 题 × 每题 ${r.config.scorePerQuestion} 分</p></div>`;

    if (!r.students.length) {
      html += `<div class="card center"><p>还没有学生，请到"学生名单"添加</p></div>`;
    } else {
      html += `<div class="card"><table>
        <thead><tr><th>姓名</th><th>完成天数</th><th>总分</th><th>平均分</th><th>正确率</th><th>错题数</th><th>最近作答</th></tr></thead><tbody>`;
      r.students.forEach((s) => {
        html += `<tr><td>${esc(s.name)}</td><td>${s.doneDays}/${r.config.totalDays}</td><td>${s.totalScore}</td>
          <td>${s.avg}</td><td>${s.correctRate}%</td><td>${s.totalWrong}</td>
          <td class="tip">${s.lastActive ? new Date(s.lastActive).toLocaleString() : '—'}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }
    view.innerHTML = html;

    // 公网链接：一键复制固定地址
    const copyBtn = view.querySelector('[data-copy-pub]');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      navigator.clipboard && navigator.clipboard.writeText(PUB_URL).then(() => toast('链接已复制，发送到班级群即可'));
    });
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

// ---------------- 学生名单 ----------------
async function loadStudents() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/teacher/students');
    let html = `<div class="card"><h3>📋 学生名单（${r.list.length} 人）</h3>
      <p class="tip">格式：<b>班级，姓名</b>，一行一个（可写 <b>2020级5班，李文博</b>，也可只写姓名）；也可上传 Excel（需含"姓名"列，有"班级"列会自动读取）</p>
      <textarea id="namesInput" rows="3" placeholder="例：2020级5班，李文博&#10;2021级1班，宗子越"></textarea>
      <div class="row mt"><button id="addBtn">＋ 添加学生</button>
        <label class="grow" style="margin:0; display:flex; align-items:center; gap:8px; cursor:pointer;">
          <button class="secondary" onclick="document.getElementById('xlsxFile').click()">📁 从 Excel 上传</button>
          <input type="file" id="xlsxFile" accept=".xlsx,.xls" class="hidden">
        </label></div>
    </div>`;
    html += `<div class="card"><table><thead><tr><th>班级</th><th>姓名</th><th>添加时间</th><th>状态</th><th>操作</th></tr></thead><tbody>`;
    r.list.forEach((s) => {
      html += `<tr><td>${esc(s.className || '—')}</td><td>${esc(s.name)}</td>
        <td class="tip">${new Date(s.createdAt).toLocaleDateString()}</td>
        <td>${s.active === false ? '<span class="badge no">已停用</span>' : '<span class="badge ok">正常</span>'}</td>
        <td>${s.active === false ? '' : `<button class="sm danger" data-del="${esc(s.name)}">停用</button>`}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    view.innerHTML = html;

    $('#addBtn').addEventListener('click', async () => {
      const nameText = $('#namesInput').value;
      try {
        const r = await api('POST', '/api/teacher/students', { nameText });
        toast(`新增 ${r.added.length} 人${r.existed.length ? '，已存在 ' + r.existed.length + ' 人' : ''}`);
        loadStudents();
      } catch (e) { toast(e.message); }
    });
    $('#xlsxFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = await readFileAsDataURL(file);
        const r = await api('POST', '/api/teacher/students/upload', { dataBase64: data, filename: file.name });
        toast(`读到 ${r.total} 人，新增 ${r.added.length} 人`);
        loadStudents();
      } catch (err) { toast(err.message); }
    });
    view.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('确定停用 ' + b.dataset.del + ' 吗？')) return;
        try { await api('DELETE', '/api/teacher/students/' + encodeURIComponent(b.dataset.del)); toast('已停用'); loadStudents(); }
        catch (e) { toast(e.message); }
      });
    });
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// ---------------- 题目管理 ----------------
function renderQuestions() {
  let html = `<div class="nav" id="qnav">
    <button data-sub="import" class="active">📥 导入题目</button>
    <button data-sub="add">✍️ 新增题目</button>
    <button data-sub="search">🔍 检索题库</button>
  </div>
  <div id="qpanel"></div>`;
  view.innerHTML = html;
  $('#qnav').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#qnav button').forEach((x) => x.classList.toggle('active', x === b));
    renderQPanel(b.dataset.sub);
  });
  renderQPanel('import');
}

function renderQPanel(sub) {
  const panel = $('#qpanel');
  if (sub === 'import') renderImport(panel);
  else if (sub === 'add') renderAdd(panel);
  else if (sub === 'search') renderSearch(panel);
}

async function renderImport(panel) {
  panel.innerHTML = `<div class="card"><h3>📥 导入题目</h3>
    <p class="tip">支持 <b>Excel（.xlsx）</b> 和 <b>Word题库（.docx）</b>。
    Excel 需含表头：题干、选项A..D、答案、解析（可选）；Word 与现有题库格式一致即可。</p>
    <label style="margin:10px 0 0; cursor:pointer; display:inline-block;"
      onclick="document.getElementById('importFile').click()">
      <button class="accent">📁 选择题库文件</button>
      <input type="file" id="importFile" accept=".xlsx,.xls,.docx" class="hidden">
    </label>
    <div id="preview" class="mt"></div></div>`;
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    panel.innerHTML = '<p class="tip">解析中…</p>';
    try {
      const data = await readFileAsDataURL(file);
      const isDocx = /\.docx$/i.test(file.name);
      const r = await api('POST', isDocx ? '/api/teacher/import/docx' : '/api/teacher/import/excel', { dataBase64: data, filename: file.name });
      state.preview = r.preview;
      renderPreview(panel);
    } catch (err) { panel.innerHTML = `<div class="card"><p>${esc(err.message)}</p></div>`; }
  });
}

function renderPreview(panel) {
  const p = state.preview;
  if (!p.length) { panel.innerHTML += '<div class="card"><p>没有解析出题目，请检查文件格式</p></div>'; return; }
  let html = `<div class="card"><div class="row">
    <h3 class="grow">解析出 ${p.length} 题（可勾选要入库的）</h3>
    <button id="commitBtn" class="accent">确认入库</button>
  </div>
  <div style="max-height:420px; overflow:auto;"><table>
    <thead><tr><th></th><th>#</th><th>题型</th><th>题干</th><th>答案</th><th>归类单元</th></tr></thead><tbody>`;
  p.forEach((it, i) => {
    const opts = it.options.map((o) => `${o.key}.${o.text}`).join(' ');
    html += `<tr data-i="${i}">
      <td><input type="checkbox" class="keep" checked></td>
      <td>${i + 1}</td>
      <td><span class="badge info">${TYPE_NAME[it.type] || it.type}</span></td>
      <td style="max-width:340px;">${esc(it.q)}<span class="tip">${opts ? '<br>' + esc(opts) : ''}</span></td>
      <td>${esc(it.answer)}</td>
      <td><select class="unit" style="min-width:150px;">${unitOptions(it.unit)}</select></td>
    </tr>`;
  });
  html += `</tbody></table></div></div>`;
  panel.innerHTML = html;

  const commitBtn = panel.querySelector('#commitBtn');
  commitBtn.addEventListener('click', async () => {
    const items = [];
    panel.querySelectorAll('tbody tr').forEach((tr) => {
      if (!tr.querySelector('.keep').checked) return;
      const it = state.preview[Number(tr.dataset.i)];
      const unit = tr.querySelector('.unit').value;
      items.push({
        q: it.q, options: it.options, answer: it.answer, expl: it.expl,
        chapter: it.chapter, section: it.section, unit, chapterIdx: unit ? unit[0] - 1 : -1,
        unitTitle: unit ? (state.units.find((u) => u.id === unit) || {}).title || '' : '',
      });
    });
    if (!items.length) return toast('请勾选要入库的题目');
    commitBtn.disabled = true; commitBtn.textContent = '入库中…';
    try {
      const r = await api('POST', '/api/teacher/import/commit', { questions: items });
      toast(`已入库 ${r.added} 题，题库现有 ${r.total} 题`);
      panel.innerHTML = `<div class="card center"><p>✅ 成功入库 ${r.added} 题</p></div>`;
    } catch (e) { commitBtn.disabled = false; commitBtn.textContent = '确认入库'; toast(e.message); }
  });
}

function renderAdd(panel) {
  panel.innerHTML = `<div class="card"><h3>✍️ 新增题目</h3>
    <label>题型</label>
    <select id="qType">${TYPE_KEYS.map((t) => `<option value="${t}">${TYPE_NAME[t]}</option>`).join('')}</select>
    <label>题干</label>
    <textarea id="qText" rows="3" placeholder="请输入题目内容"></textarea>
    <div id="optWrap"></div>
    <label>答案</label>
    <input id="qAns" placeholder="选择/判断题填字母(如 A 或 A,B,C)；填空填答案文字">
    <label>解析（可选）</label>
    <textarea id="qExpl" rows="2"></textarea>
    <label>归类单元</label>
    <select id="qUnit">${unitOptions('')}</select>
    <button class="mt accent" id="saveQ">保存题目</button>
  </div>`;
  renderOptInputs();
  $('#qType').addEventListener('change', renderOptInputs);
  $('#saveQ').addEventListener('click', async () => {
    const type = $('#qType').value;
    const q = $('#qText').value.trim();
    if (!q) return toast('请输入题干');
    let options = [];
    if (type !== 'fill') {
      options = ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: document.getElementById('opt' + k).value.trim() }))
        .filter((o) => o.text);
      if (options.length < 2) return toast('请至少填写两个选项');
    }
    const unit = $('#qUnit').value;
    const body = {
      q, options, answer: $('#qAns').value.trim(), expl: $('#qExpl').value.trim(),
      unit, chapterIdx: unit ? unit[0] - 1 : -1,
      unitTitle: unit ? (state.units.find((u) => u.id === unit) || {}).title || '' : '',
    };
    try {
      await api('POST', '/api/teacher/question', body);
      toast('已保存');
      $('#qText').value = ''; $('#qAns').value = ''; $('#qExpl').value = '';
      ['A', 'B', 'C', 'D'].forEach((k) => { document.getElementById('opt' + k).value = ''; });
    } catch (e) { toast(e.message); }
  });
}
function renderOptInputs() {
  const type = $('#qType').value;
  $('#optWrap').innerHTML = (type === 'fill')
    ? ''
    : ['A', 'B', 'C', 'D'].map((k) =>
        `<label>选项 ${k}</label><input id="opt${k}" placeholder="选项${k}内容">`).join('');
}

async function renderSearch(panel) {
  panel.innerHTML = `<div class="card"><h3>🔍 检索题库</h3>
    <div class="row">
      <input id="skw" class="grow" placeholder="输入关键词搜索题干/单元">
      <select id="stype" style="width:140px;">
        <option value="">全部题型</option>${TYPE_KEYS.map((t) => `<option value="${t}">${TYPE_NAME[t]}</option>`).join('')}
      </select>
      <button id="sbtn">搜索</button>
    </div>
    <div id="slist" class="mt"></div></div>`;
  const run = async () => {
    const kw = $('#skw').value;
    const type = $('#stype').value;
    try {
      const r = await api('GET', '/api/teacher/questions?q=' + encodeURIComponent(kw) + '&type=' + type + '&pageSize=50');
      let html = `<div class="tip">共 ${r.total} 条</div><table><thead><tr><th>题型</th><th>题干</th><th>答案</th><th>操作</th></tr></thead><tbody>`;
      r.list.forEach((q) => {
        html += `<tr><td><span class="badge info">${TYPE_NAME[q.type] || q.type}</span></td>
          <td style="max-width:480px;">${esc(q.q)}</td>
          <td>${esc(q.answer)}</td>
          <td>${q.deleted ? '<span class="badge no">已删除</span>' : `<button class="sm danger" data-delid="${q.id}">删除</button>`}</td></tr>`;
      });
      html += `</tbody></table>`;
      $('#slist').innerHTML = html;
      $('#slist').querySelectorAll('[data-delid]').forEach((b) => {
        b.addEventListener('click', async () => {
          if (!confirm('确定删除该题吗？（学生将不再遇到）')) return;
          try { await api('DELETE', '/api/teacher/question/' + encodeURIComponent(b.dataset.delid)); toast('已删除'); run(); }
          catch (e) { toast(e.message); }
        });
      });
    } catch (e) { $('#slist').innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
  };
  $('#sbtn').addEventListener('click', run);
  $('#skw').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  run();
}

// ---------------- 学生详情 ----------------
async function loadDetail() {
  view.innerHTML = '<p class="tip">加载中…</p>';
  try {
    const r = await api('GET', '/api/teacher/students');
    let html = `<div class="card"><h3>🔍 学生答题详情</h3>
      <label>选择学生</label>
      <select id="stuSel"><option value="">请选择…</option>
        ${r.list.filter((s) => s.active !== false).map((s) => `<option value="${esc(s.name)}">${esc(s.className || '')} ${esc(s.name)}</option>`).join('')}
      </select></div>
      <div id="stuDetail"></div>`;
    view.innerHTML = html;
    $('#stuSel').addEventListener('change', async () => {
      const name = $('#stuSel').value;
      if (!name) return;
      try {
        const d = await api('GET', '/api/teacher/student/' + encodeURIComponent(name));
        let h = `<div class="card"><div class="row">
          <h3 class="grow">${esc(name)}</h3>
          <span class="badge info">完成 ${d.stats.doneDays} 天</span>
          <span class="badge info">总分 ${d.stats.totalScore}</span>
          <span class="badge no">错题 ${d.stats.totalWrong}</span></div></div>`;
        h += `<div class="card"><h4>逐日成绩</h4><table><thead><tr><th>天数</th><th>得分</th><th>对/总</th><th>提交时间</th></tr></thead><tbody>`;
        d.days.forEach((x) => {
          h += `<tr><td>第 ${x.day} 天</td><td>${x.done ? x.score : '—'}</td><td>${x.done ? x.correct + '/' + x.total : '未完成'}</td>
            <td class="tip">${x.submittedAt ? new Date(x.submittedAt).toLocaleString() : '—'}</td></tr>`;
        });
        h += `</tbody></table></div>`;
        h += `<div class="card"><h4>错题明细</h4>`;
        if (!d.wrong.length) h += '<p class="tip">暂无错题</p>';
        d.wrong.forEach((w, i) => {
          h += `<p class="mt"><b>${i + 1}.</b> ${esc(w.q)}<br>
            <span class="tip">正确答案：${esc(w.answer)}</span> · <span class="badge no">错${w.count}次</span></p>`;
        });
        h += `</div>`;
        $('#stuDetail').innerHTML = h;
      } catch (e) { $('#stuDetail').innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
    });
  } catch (e) { view.innerHTML = `<p class="tip">${esc(e.message)}</p>`; }
}

// ---------------- 设置 ----------------
function renderSettings() {
  view.innerHTML = `<div class="card" style="max-width:440px;"><h3>⚙️ 修改教师密码</h3>
    <label>原密码</label><input id="oldPw" type="password">
    <label>新密码（至少4位）</label><input id="newPw" type="password">
    <button class="accent mt" id="chPw">保存新密码</button>
    <p class="tip mt">提示：学生登录密码统一为 zqxx2025，如需修改请编辑 config.js 后重启。</p>
  </div>`;
  $('#chPw').addEventListener('click', async () => {
    try {
      await api('POST', '/api/teacher/password', { oldPassword: $('#oldPw').value, newPassword: $('#newPw').value });
      toast('密码已更新'); $('#oldPw').value = ''; $('#newPw').value = '';
    } catch (e) { toast(e.message); }
  });
}

// ---------------- 启动 ----------------
async function init() {
  try { await api('GET', '/api/teacher/overview'); enterApp(); return; } catch (e) {}
  $('#loginBox').classList.remove('hidden');
}
init();
