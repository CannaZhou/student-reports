// flowchart.js — 数据驱动流程图渲染（答题 / 判分结果共用）
// 数据来源：GET /api/lesson/:id  的 flow 对象（已脱敏）
//   flow.canvas:{w,h}   flow.nodes:[{id,shape,x,y,w,h,text(含{key}占位)}]
//   flow.edges:[{from,to,pts:[[x,y],…],label}]   flow.blanks:[{key,mode:'pick',words:[…]}]
// 坐标系：x,y 为图元中心；单位与 canvas 相同。
//
// 图形规范（信息科技教材）：
//   term/start/end → 圆角矩形   proc → 直角矩形   io/input/output → 平行四边形(斜)
//   diamond/decision → 菱形    连线一律水平/垂直，转弯为直角，不得弯曲。
// 实现：连线与节点外框都画在 SVG 层（矢量、边框清晰）；节点文字/选词控件是 HTML 层，
//       HTML 层不带边框背景，只负责承载内容，因此矢量框不会被 clip 掉。
(function (global) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const BLANK_RE = /\{([a-zA-Z_][\w]*)\}/;
  const STROKE = '#2E6234';          // var(--green-dk)
  const ARROW = '#2E6234';
  const LABEL = '#e8590c';
  const R_FILL = '#E7F6EC';          // 判对底色
  const R_STROKE = '#2f9e44';        // var(--ok)
  const W_FILL = '#FDEAEA';          // 判错底色
  const W_STROKE = '#e03131';        // var(--bad)

  function el(tag, cls, text) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }
  function svgEl(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function shuffle(a) {
    const out = a.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  // shape 别名 → 四种教材形状
  function shapeKind(s) {
    if (s === 'term' || s === 'start' || s === 'end') return 'term';
    if (s === 'io' || s === 'input' || s === 'output') return 'io';
    if (s === 'diamond' || s === 'decision') return 'diamond';
    return 'proc';
  }

  // 把折线规整为纯水平/垂直（出现斜段时自动补一个直角肘点分成两段），绝无曲线。
  function ortho(pts) {
    if (!pts || pts.length < 2) return pts || [];
    const out = [pts[0].slice()];
    for (let i = 1; i < pts.length; i++) {
      const x0 = out[out.length - 1][0], y0 = out[out.length - 1][1];
      const x1 = pts[i][0], y1 = pts[i][1];
      if (x0 === x1 || y0 === y1) out.push([x1, y1]);
      else { out.push([x0, y1]); out.push([x1, y1]); } // 先竖后横补一个直角
    }
    return out;
  }

  // 节点外框的 SVG 图元（中心 x,y；尺寸 w×h）
  function shapeEl(nd, kind) {
    const cx = nd.x, cy = nd.y, w = nd.w, h = nd.h;
    if (kind === 'diamond') {
      const p = [cx, cy - h / 2, cx + w / 2, cy, cx, cy + h / 2, cx - w / 2, cy];
      return svgEl('polygon', { points: p.join(' ') });
    }
    if (kind === 'io') {
      // 平行四边形：上下边等长平行、整排水平错开（顶排右移 s、底排左移 s），斜边等倾
      const s = Math.min(22, Math.max(10, w * 0.12));
      const pts = [
        [cx - w / 2 + s, cy - h / 2], [cx + w / 2 + s, cy - h / 2],
        [cx + w / 2 - s, cy + h / 2], [cx - w / 2 - s, cy + h / 2],
      ];
      return svgEl('polygon', { points: pts.map((q) => q.join(',')).join(' ') });
    }
    const rx = (kind === 'term') ? Math.min(16, h / 2) : 0; // 起止=圆角矩形，处理=直角矩形
    return svgEl('rect', { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx, ry: rx });
  }

  // 流程图按原始清晰尺寸显示；容器 .fc-scroll 提供横向滚动。
  function applyScale(wrap, holder, cw, ch) {
    holder.style.transform = 'none';
    wrap.style.width = cw + 'px';
    wrap.style.height = ch + 'px';
  }
  // 页面显示后重设尺寸（若将来启用缩放，在此处按 host 实际宽度重算）
  function fit(host) {
    const wrap = host && host.firstElementChild;
    if (!wrap || !wrap.classList.contains('fc-scroll')) return;
    const holder = wrap.firstElementChild;
    if (!holder) return;
    const cw = Number(holder.dataset.cw) || 860;
    const ch = Number(holder.dataset.ch) || 1000;
    applyScale(wrap, holder, cw, ch);
  }

  // opts: { mode:'answer'|'result', values:{key:val}, blanksState:[{key,ok,got,correct,expl}], onChange(key,val) }
  function render(host, flow, opts) {
    opts = opts || {};
    host.innerHTML = '';
    const cw = (flow.canvas && flow.canvas.w) || 860;
    const ch = (flow.canvas && flow.canvas.h) || 1000;
    const wrap = el('div', 'fc-scroll');
    const holder = el('div', 'fc');
    holder.style.width = cw + 'px';
    holder.style.height = ch + 'px';
    holder.dataset.cw = cw;
    holder.dataset.ch = ch;
    wrap.appendChild(holder);
    applyScale(wrap, holder, cw, ch);
    host.appendChild(wrap);

    // ---- SVG 层：连线(先) + 节点外框(后) ----
    const svg = svgEl('svg', { viewBox: '0 0 ' + cw + ' ' + ch, width: cw, height: ch });
    svg.classList.add('fc-edges');
    const defs = svgEl('defs', {});
    const arrowId = 'fcarr_' + Math.random().toString(36).slice(2, 8);
    const mk = svgEl('marker', {
      id: arrowId, viewBox: '0 0 10 10', refX: '8.5', refY: '5',
      markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse',
    });
    const ap = svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: ARROW });
    mk.appendChild(ap); defs.appendChild(mk); svg.appendChild(defs);

    // 连线：正交折线，只走直线
    for (const ed of (flow.edges || [])) {
      const pts = ortho(ed.pts);
      if (pts.length < 2) continue;
      const p = svgEl('path', {
        d: 'M' + pts.map((q, i) => (i ? 'L' : '') + q[0] + ' ' + q[1]).join(' '),
        fill: 'none', stroke: STROKE, 'stroke-width': '2',
        'marker-end': 'url(#' + arrowId + ')',
      });
      svg.appendChild(p);
      if (ed.label) {
        const a = pts[0], b = pts[1];
        const hz = Math.abs(b[1] - a[1]) < 1;
        const t = svgEl('text', {
          x: hz ? (a[0] + b[0]) / 2 : (a[0] + 14),
          y: hz ? (a[1] - 6) : (a[1] + b[1]) / 2 + 4,
          fill: LABEL, 'font-size': '12', 'font-weight': '700',
        });
        t.textContent = ed.label;
        svg.appendChild(t);
      }
    }

    // 节点外框（矢量，白底描边；判对/判错换底色）
    const stateOf = {};
    for (const s of (opts.blanksState || [])) stateOf[s.key] = s;
    for (const nd of (flow.nodes || [])) {
      const kind = shapeKind(nd.shape);
      const sh = shapeEl(nd, kind);
      sh.setAttribute('fill', '#fff');
      sh.setAttribute('stroke', STROKE);
      sh.setAttribute('stroke-width', '2');
      // 该节点是否含错空（结果态高亮整框）
      let nok = null; // true=全对 false=有错
      const keys = String(nd.text || '').match(/\{([a-zA-Z_][\w]*)\}/g) || [];
      for (const ks of keys) {
        const st = stateOf[ks.slice(1, -1)];
        if (st) nok = (nok !== false && st.ok) ? true : false;
      }
      if (opts.mode === 'result' && nok === false) { sh.setAttribute('fill', W_FILL); sh.setAttribute('stroke', W_STROKE); }
      else if (opts.mode === 'result' && nok === true) { sh.setAttribute('fill', R_FILL); sh.setAttribute('stroke', R_STROKE); }
      svg.appendChild(sh);
    }
    holder.appendChild(svg);

    // ---- HTML 层：节点文字与选词控件（无边框背景，压在矢量框之上） ----
    const blankMeta = {};
    for (const b of (flow.blanks || [])) blankMeta[b.key] = b;
    for (const nd of (flow.nodes || [])) {
      const kind = shapeKind(nd.shape);
      const node = el('div', 'fc-node fc-shape-' + kind);
      const hw = nd.w / 2, hh = nd.h / 2;
      node.style.left = (nd.x - hw) + 'px'; node.style.top = (nd.y - hh) + 'px';
      node.style.width = nd.w + 'px'; node.style.height = nd.h + 'px';
      const inner = el('div', 'inner');

      const parts = String(nd.text || '').split(/(\{[a-zA-Z_][\w]*\})/);
      for (const part of parts) {
        const m = part.match(BLANK_RE);
        if (!m) { if (part) inner.appendChild(el('span', null, part)); continue; }
        const key = m[1];
        const meta = blankMeta[key];
        const cur = (opts.values && opts.values[key]) || '';
        const st = stateOf[key];
        inner.appendChild(buildBlank(key, meta, cur, opts, st));
        if (st && opts.mode === 'result') {
          node.classList.add(st.ok ? 'right' : 'wrong'); // 选中控件的对/错配色
        }
      }
      if (!parts.length) inner.appendChild(el('span', null, nd.text || ''));
      node.appendChild(inner);
      holder.appendChild(node);
    }
    return holder;
  }

  function buildBlank(key, meta, cur, opts, st) {
    meta = meta || {};
    const mode = meta.mode || 'pick';
    if (mode === 'pick') {
      const sel = el('select');
      if (opts.mode === 'result' && !cur) {
        const ph2 = el('option'); ph2.value = ''; ph2.textContent = '（未作答）'; ph2.selected = true;
        sel.appendChild(ph2); sel.disabled = true; return sel;
      }
      const words = (meta.words && meta.words.length ? meta.words : [cur]).slice();
      const options = shuffle(words);
      const ph = el('option'); ph.value = ''; ph.textContent = '▾ 请选…';
      ph.selected = !cur;
      sel.appendChild(ph);
      let found = -1;
      options.forEach((w, i) => {
        const o = el('option'); o.value = w; o.textContent = w;
        if (w === cur) found = i + 1; // +1 因占位 option
        sel.appendChild(o);
      });
      sel.title = '点击从中选择';
      if (cur) {
        if (found >= 0) sel.selectedIndex = found;
        else { const o = el('option'); o.value = cur; o.textContent = cur; sel.appendChild(o); sel.selectedIndex = sel.options.length - 1; }
      }
      sel.addEventListener('change', function () {
        if (opts.onChange) opts.onChange(key, sel.value);
      });
      sel.disabled = (opts.mode === 'result');
      return sel;
    }
    const inp = el('input', 'input');
    inp.type = 'text';
    inp.placeholder = '请输入';
    inp.value = cur || '';
    if (opts.mode === 'result') inp.disabled = true;
    else inp.addEventListener('input', function () { if (opts.onChange) opts.onChange(key, inp.value.trim()); });
    return inp;
  }

  global.Flowchart = { render, fit };
})(window);
