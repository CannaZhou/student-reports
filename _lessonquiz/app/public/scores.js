/* 学生成绩页 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; };

  async function api(path, method, body) {
    const opt = { method: method || 'GET', headers: {} };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(path, opt);
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const e = new Error((j && j.error && j.error.msg) || '请求失败'); e.status = r.status; e.json = j; throw e; }
    return j;
  }

  async function load() {
    try { await api('/api/student/me'); await render(); }
    catch (e) { $('loginCard').hidden = false; $('scoresBody').hidden = true; }
  }

  async function render() {
    $('loginCard').hidden = true;
    const body = $('scoresBody'); body.hidden = false; body.innerHTML = '';

    const headCard = el('div', 'card');
    headCard.appendChild(el('h1', 'screen', '📊 我的积分'));
    headCard.appendChild(el('div', 'muted', '每一课的答题情况（每题整题答对得 1 积分）。若老师评过课内任务单，末尾列会显示老师评分（满分 10）。'));
    body.appendChild(headCard);

    const rowsCard = el('div', 'card');
    try {
      const j = await api('/api/student/scores');
      if (!j.rows.length) {
        rowsCard.appendChild(el('div', 'empty-note', '还没有答题记录，去「开始答题」做第一课吧 🌱'));
        rowsCard.appendChild(el('div', 'action-row'));
        const go = el('button', 'btn', '去答题 →');
        go.onclick = () => { location.href = 'quiz'; };
        rowsCard.lastChild.appendChild(go);
      } else {
        const t = el('table', 'tbl');
        const tr = el('tr');
        ['课程', '最高积分', '最近一次', '次数', '历次积分', '任务单评分'].forEach((h) => tr.appendChild(el('th', null, h)));
        t.appendChild(tr);
        j.rows.forEach((r) => {
          const row = el('tr');
          row.appendChild(el('td', null, r.title));
          row.appendChild(el('td', null, r.best == null ? '—' : String(r.best)));
          row.appendChild(el('td', null, r.lastScore == null ? '—' : String(r.lastScore)));
          row.appendChild(el('td', null, String(r.attempts)));
          const hd = el('td', 'hist');
          (r.recent || []).forEach((a) => {
            hd.appendChild(el('b', null, String(a.score)));
            hd.appendChild(document.createTextNode('　'));
          });
          if (!(r.recent || []).length) hd.appendChild(document.createTextNode('—'));
          row.appendChild(hd);
          // 任务单老师评分：评过显 数字/10；交过未评显 待评分；无任务单/没交显 —
          const tk = el('td', null);
          if (r.hasSheet) {
            if (r.task != null) {
              const b = el('b', null, String(r.task) + ' / 10');
              if (r.taskAt) b.title = '评于 ' + new Date(r.taskAt).toLocaleString('zh-CN');
              tk.appendChild(b);
            } else if (r.sheetSubmitted) {
              tk.appendChild(el('span', 'muted', '待老师评分'));
            } else tk.appendChild(document.createTextNode('—'));
          } else tk.appendChild(document.createTextNode('—'));
          row.appendChild(tk);
          t.appendChild(row);
        });
        rowsCard.appendChild(t);
      }
    } catch (err) {
      if (err.status === 401) { $('loginCard').hidden = false; body.hidden = true; return; }
      rowsCard.appendChild(el('div', 'empty-note', err.message));
    }
    body.appendChild(rowsCard);
  }

  $('sGo').addEventListener('click', doLogin);
  $('sName').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  async function doLogin() {
    const name = $('sName').value.trim(); if (!name) return;
    $('sErr').textContent = '';
    try { await api('/api/student/login', 'POST', { name }); await render(); }
    catch (e) {
      if (e.status === 409 && e.json && e.json.candidates) {
        $('sCls').hidden = false; const box = $('sClsOpts'); box.innerHTML = '';
        e.json.candidates.forEach((c) => {
          const b = el('div', 'switch', c.className + '（' + c.grade + '年级）');
          b.onclick = async () => { try { await api('/api/student/login', 'POST', { name: c.name, className: c.className }); await render(); } catch (err) { $('sErr').textContent = err.message; } };
          box.appendChild(b);
        });
        return;
      }
      $('sErr').textContent = e.message;
    }
  }

  load();
})();
