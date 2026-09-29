// 课内任务单「按任务判分」（老师口径 2026-09-29）：
//   一个任务 1 分，做对得 1 分、做错不得分；满分＝这一课有几个任务。
//   学生交完立刻能看到「哪个任务对、哪个任务错」，不再是一个笼统的总分。
// 数据侧（seed.js）怎么描述：
//   · 板块写 task: 1|2|3 —— 把几个板块归到同一个任务（第4课任务二拆成"看输出/写算式/抄结果"三块，
//     它们算同一个任务，只给 1 分）。没写就按板块序号，与 sheetTaskCount 的默认口径一致。
//   · 板块写 keys —— 标准答案，按「第几个可填行」给：{0:{ji:'23',tu:'12'}}。
//     没写 keys 的格子＝系统不判（如任务二的算式），留给老师看，会在结果里标出来。
//   · 板块写 matchBy —— 答案按「某一列选了什么」来查（如任务一：先选程序，再看它的功能和体会对不对）。
//     这样学生把四行程序换个顺序填也不会误判。keys 这时按那一列的值给：{'在线打字':{func:'…'}}。
// ⚠️ 系统评分只用来「告诉学生哪个任务错了」和「给老师一个参考分」，
//    证书里的任务单得分仍然只认老师赋的分（p.marks）——否则学生反复重交就能把分刷满。
const { normalizeText } = require('./normalize.js');

// 一格的可接受值：字符串或字符串数组，两边都归一后比较（全角转半角、去空白、去引号、小写）
function acceptList(want) {
  if (want == null) return [];
  return (Array.isArray(want) ? want : [want]).map(normalizeText).filter((s) => s !== '');
}
function hit(mine, want) {
  const my = normalizeText(mine == null ? '' : mine);
  if (!my) return false; // 没填就是错
  return acceptList(want).indexOf(my) >= 0;
}

// 任务单里「可填的行」按渲染顺序逐个列出，行号 _i 与后端 sheetRowSpecs / 前端 data-rowi 完全一致。
// 流程图板块整块算一行（key 是各空位的 key）。
function walkRows(sheet) {
  const blocks = (sheet && Array.isArray(sheet.sections) && sheet.sections.length) ? sheet.sections : [sheet];
  const out = [];
  let i = 0;
  blocks.forEach((b, bi) => {
    if (!b) return;
    if (b.flow) {
      out.push({ i: i++, bi, ri: -1, block: b, flow: true, cols: (b.flow.blanks || []).map((x) => ({ key: x.key, label: x.label || '' })) });
      return;
    }
    const cols = (b.cols || []).map((c) => ({ key: c.key, label: c.label || '' }));
    for (let r = 0; r < (b.rows || 0); r++) out.push({ i: i++, bi, ri: r, block: b, flow: false, cols });
  });
  return out;
}

// 这一行里「学生能填的格子」：行标签格（第一列＋rowLabels/rowImages）和题目印好的 preset 格都不算。
function fillableCols(unit) {
  const b = unit.block;
  const labels = b.rowLabels || [], imgs = b.rowImages || [];
  const preset = (b.preset && b.preset[unit.ri]) || null;
  return unit.cols.filter((c, ci) => {
    if (!unit.flow && ci === 0 && (imgs[unit.ri] || labels[unit.ri])) return false;
    if (preset && preset[c.key] != null) return false;
    return true;
  });
}

// 板块的标准答案：两种写法统一成「查表函数」
//   按行（默认）：spec(unit) → {col: want}
//   matchBy：先按学生那一列选的值查，查不到就没有答案（那一行整行算错）
function specOf(block) {
  const k = block.keys;
  if (!k) return null;
  if (block.matchBy) {
    const byVal = {};
    Object.keys(k).forEach((v) => { byVal[normalizeText(v)] = k[v] || {}; });
    const col = block.matchBy;
    return (unit, row) => {
      const key = normalizeText(row ? row[col] : '');
      if (!key) return {};          // 没选程序 → 这一行没有任何答案可对
      return byVal[key] || {};      // 选了不在表里的程序 → 也当没有答案
    };
  }
  return (unit) => k[unit.ri] || {};
}

// 某个板块属于第几个任务：没写 task 就按板块序号（＝旧口径「一个板块一题」）
function taskNoOf(block, bi) {
  return (typeof block.task === 'number' && block.task > 0) ? block.task : bi + 1;
}

// 任务名：优先用 sheet.tasks[任务号-1]，否则退到这一任务第一个板块的 caption / heading
function taskTitle(sheet, no, units) {
  const t = sheet.tasks;
  if (Array.isArray(t) && t[no - 1]) return String(t[no - 1]);
  const u = units.filter((x) => x.no === no)[0];
  if (!u) return '任务' + no;
  return u.block.caption || u.block.heading || ('任务' + no);
}

// 判一份任务单。rows 是学生提交/存档的行（每行带 _i）。
// 返回的 tasks/cells 里带标准答案（want）——给学生看之前必须用 studentView() 抹掉。
function gradeSheet(sheet, rows) {
  if (!sheet) return null;
  const byRow = {};
  (rows || []).forEach((r) => { if (r && Number.isInteger(r._i)) byRow[r._i] = r; });

  const units = walkRows(sheet);
  // 每个可填行归到哪个任务
  units.forEach((u) => { u.no = taskNoOf(u.block, u.bi); });

  const taskMap = new Map();
  const order = [];
  units.forEach((u) => {
    if (!taskMap.has(u.no)) { taskMap.set(u.no, { no: u.no, cells: [], manual: [] }); order.push(u.no); }
  });

  const cells = [];
  const manual = [];
  // 记一格的判定（forceWrong：连标准答案都没有的错，比如"整行没选程序"）
  const mark = (u, col, mine, want, forceWrong) => {
    const t = taskMap.get(u.no);
    const cell = {
      i: u.i, col: col.key, label: col.label, task: u.no,
      ok: forceWrong ? false : hit(mine, want),
      mine: mine || '', want: forceWrong ? null : want,
    };
    cells.push(cell); t.cells.push(cell);
  };
  // 记一格「系统不判」：没写答案的格子（如任务二的算式），留给老师看
  const keepManual = (u, col, mine) => {
    const t = taskMap.get(u.no);
    const m = { i: u.i, col: col.key, label: col.label, task: u.no, mine: mine || '' };
    manual.push(m); t.manual.push(m);
  };

  // 同一个板块的行是连续的，按板块分组
  const groups = [];
  units.forEach((u) => {
    const g = groups[groups.length - 1];
    if (g && g.bi === u.bi) g.units.push(u);
    else groups.push({ bi: u.bi, block: u.block, units: [u] });
  });

  groups.forEach((grp) => {
    const b = grp.block;
    const spec = specOf(b);
    if (b.matchBy) {
      // matchBy 板块（任务一）必须按「答案表」驱动，不能按学生填的行驱动——
      // 否则学生漏选一行、或者把一个程序选两遍，剩下那个程序压根没出现，却照样全对。
      // 规则：答案表里每个程序都必须在学生作答里正好出现一次，它的功能/体会才对得上。
      const mcol = b.matchBy;
      const keys = b.keys || {};
      const seen = {};                 // 归一后的程序名 → 学生填的那几行
      grp.units.forEach((u) => {
        const row = byRow[u.i] || null;
        const k = normalizeText(row ? row[mcol] : '');
        if (!k) return;
        (seen[k] = seen[k] || []).push(u);
      });
      const colsOf = (u) => fillableCols(u).filter((c) => c.key !== mcol);
      Object.keys(keys).forEach((kv) => {
        const us = seen[normalizeText(kv)] || [];
        const want = keys[kv] || {};
        if (!us.length) {
          // 这个程序一个都没选 → 这个任务不可能对（i:-1：没有具体格子可标红，只是记一笔）
          const u0 = grp.units[0];
          colsOf(u0).forEach((c) => mark({ ...u0, i: -1 }, c, '', want[c.key], true));
          return;
        }
        us.forEach((u) => {
          const row = byRow[u.i] || null;
          colsOf(u).forEach((c) => {
            const mine = row ? (row[c.key] || '') : '';
            if (want[c.key] === undefined) keepManual(u, c, mine);
            else mark(u, c, mine, want[c.key]);
          });
        });
      });
      // 选了答案表以外的程序（改题前的老作答/脏数据）：这些格子算错，且没有标准答案可写
      Object.keys(seen).forEach((k) => {
        if (Object.keys(keys).some((kv) => normalizeText(kv) === k)) return;
        seen[k].forEach((u) => {
          const row = byRow[u.i] || null;
          colsOf(u).forEach((c) => mark(u, c, row ? (row[c.key] || '') : '', null, true));
        });
      });
      return;
    }
    grp.units.forEach((u) => {
      const row = byRow[u.i] || null;
      const want0 = spec ? spec(u, row) : null;
      fillableCols(u).forEach((c) => {
        const mine = row ? (row[c.key] || '') : '';
        const want = want0 ? want0[c.key] : undefined;
        if (want === undefined) keepManual(u, c, mine);
        else mark(u, c, mine, want);
      });
    });
  });

  const tasks = order.map((no) => {
    const t = taskMap.get(no);
    const right = t.cells.filter((c) => c.ok).length;
    const wrong = t.cells.length - right;
    const graded = t.cells.length > 0;         // 一个可判的格子都没有 → 这个任务系统不判
    return {
      no, title: taskTitle(sheet, no, units),
      graded, ok: graded ? wrong === 0 : null,
      got: graded ? (wrong === 0 ? 1 : 0) : null, full: 1,
      right, wrong, cells: t.cells.length,
      manual: t.manual.length,                 // 这个任务里有几格要老师看
    };
  });

  const gradedTasks = tasks.filter((t) => t.graded);
  return {
    taskFull: tasks.length,
    score: gradedTasks.filter((t) => t.ok).length,
    graded: gradedTasks.length,
    allGraded: gradedTasks.length === tasks.length,
    tasks, cells, manual,
  };
}

// 给学生看的版本：只留「哪一格错了」，绝不下发标准答案——
// 否则学生照着改一遍就能刷满，系统评分也就没意义了（老师端才给 want）。
function studentView(g) {
  if (!g) return null;
  return {
    taskFull: g.taskFull, score: g.score, graded: g.graded, allGraded: g.allGraded,
    tasks: g.tasks.map((t) => ({
      no: t.no, title: t.title, graded: t.graded, ok: t.ok, got: t.got, full: t.full,
      right: t.right, wrong: t.wrong, cells: t.cells, manual: t.manual,
    })),
    wrong: g.cells.filter((c) => !c.ok).map((c) => ({ i: c.i, col: c.col })),
  };
}

module.exports = { gradeSheet, studentView, walkRows };
