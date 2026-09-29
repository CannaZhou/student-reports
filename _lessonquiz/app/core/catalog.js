// 课程目录：年级→册→单元→课；学生取卷脱敏；目录带个人成绩合并
// content.json.grades = [{ grade, semester:'上', units:[{id,title,lessons:[{id,title,questions:[...]}]}] }]

const { lessonName } = require('./lesson.js');
const { certBrief } = require('./cert.js');

const TYPE_NAME = { judge: '判断题', single: '单选题', multi: '多选题', fill: '填空题', flow: '流程图填空' };
const LEVEL_STAR = { 1: '★ 简单', 2: '★★ 中等', 3: '★★★ 偏难' };

// 学生看到的课内任务单（开放填写，无答案/机密字段，仅白名单字段下发）
// 单表任务单：{title, cols, rows, example, ...}
// 多板块任务单：{title, sections:[{heading, cols, rows, ...}, ...]} —— 一个任务单里放多个活动
// 板块还可以是一张流程图（{heading, flow}）：与“课后小测”的流程图填空同一种数据，只是不判分，
// 学生选完随任务单一起存下来给老师看。givenTop＝印在最上面的只读行（如“兔的只数 0~35”），
// rowPick＝按行给整行套下拉候选词（表里某一行是 √/× 时用，列自身的 pick 仍优先）。
// code＝板块里带一段程序（如第4课的“鸡兔同笼.py”）：按原样多行显示，前端渲染成等宽代码块；
// preset＝题目已经印好、不用学生再抄一遍的数据，按「第几个可填行」给：{0:{tou:'35',jiao:'94'}}
//         （这些格子先填好并置灰，收卷时不算“学生填过”，避免只点一下保存就算交了）。
// tasks＝任务名（按任务号排列），学生端「任务一 ✅ / 任务二 ❌」那块要用，发了不泄题。
// ⚠️ 板块上的 keys（标准答案）与 matchBy 绝不在白名单里 —— 一发学生就能照抄，见 core/sheetgrade.js。
const SHEET_FIELDS = ['title', 'heading', 'intro', 'caption', 'code', 'cols', 'rows',
  'example', 'remind', 'image', 'rowLabels', 'rowImages', 'given', 'givenTop', 'preset', 'rowPick', 'noHead', 'center',
  'tasks'];

// 课名（带课号）在 core/lesson.js（叶子模块，cert.js 也要用，避免两个模块互相 require 成环）

// 列：key/label + 可选 pick（候选词 → 该列渲染成下拉选择）
function publicCols(cols) {
  return (cols || []).map((c) => {
    const o = { key: c.key, label: c.label };
    if (Array.isArray(c.pick)) o.pick = c.pick.slice();
    return o;
  });
}
// 任务单里的流程图：只发画布/节点/连线/空位，空位只带候选词，answers（accepts/expl）留在服务端
function publicFlow(flow) {
  if (!flow) return null;
  return {
    canvas: flow.canvas,
    nodes: flow.nodes || [],
    edges: flow.edges || [],
    blanks: (flow.blanks || []).map((b) => ({ key: b.key, mode: b.mode || 'pick', words: (b.words || []).slice() })),
  };
}
function publicBlock(b) {
  const out = {};
  for (const k of SHEET_FIELDS) if (b[k] !== undefined) out[k] = b[k];
  if (out.cols) out.cols = publicCols(out.cols);
  if (b.flow) out.flow = publicFlow(b.flow);
  return out;
}
function publicSheet(sheet) {
  if (!sheet) return null;
  const out = publicBlock(sheet);
  if (Array.isArray(sheet.sections)) out.sections = sheet.sections.map(publicBlock);
  return out;
}

// 任务单「可填视觉行」的列 key 规格：按渲染顺序一行一项，用于校验学生提交的行
// 例：单表 3 行 → [[k1,k2],[k1,k2],[k1,k2]]；多板块 → 各板块依次展开
// 流程图板块整块算「一行」，key 就是各个空位的 key（前端也按同样的顺序编号）
function sheetRowSpecs(sheet) {
  const blocks = (sheet && Array.isArray(sheet.sections) && sheet.sections.length) ? sheet.sections : [sheet];
  const specs = [];
  for (const b of blocks) {
    if (!b) continue;
    if (b.flow) { specs.push((b.flow.blanks || []).map((x) => x.key)); continue; }
    const keys = (b.cols || []).map((c) => c.key);
    const n = b.rows || 0;
    for (let i = 0; i < n; i++) specs.push(keys);
  }
  return specs;
}

// 学生答题用的题目（不含答案/解析/accepts）
function publicQuestion(q) {
  const base = {
    id: q.id, type: q.type, q: q.q, points: q.points || 0,
    level: q.level || 1, typeName: TYPE_NAME[q.type] || q.type, levelName: LEVEL_STAR[q.level] || '',
  };
  if (q.type === 'single' || q.type === 'multi' || q.type === 'judge') {
    base.options = q.options || [];
    if (q.type === 'judge') base.judgeLabel = ['√ 正确', '× 错误'];
  }
  if (q.type === 'fill') {
    if (q.blanks) {
      // fill 空也支持词库点选：mode='pick' 且有 words 时把候选词发给学生（words 即候选，非答案）
      base.blanks = q.blanks.map((b) => {
        const out = { key: b.key, label: b.label || '', mode: b.mode || 'type' };
        if (b.mode === 'pick' && Array.isArray(b.words) && b.words.length) out.words = b.words;
        return out;
      });
    } else {
      base.fillLen = (q.fillLen) || Math.min(20, Math.max(String(q.answer || '').length + 4, 10));
    }
  }
  if (q.type === 'flow') {
    base.flow = {
      canvas: q.flow.canvas,
      nodes: q.flow.nodes,           // text 含 {key} 占位
      edges: q.flow.edges || [],
      blanks: (q.flow.blanks || []).map((b) => ({ key: b.key, mode: b.mode || 'pick', words: b.words || [] })),
    };
  }
  return base;
}

// 目录视图：合并某生的各课成绩
function buildCatalog(store, uid) {
  const out = [];
  for (const g of store.allSemesters()) {
    const units = [];
    for (const u of g.units || []) {
      const lessons = (u.lessons || []).map((l) => {
        const st = store.lessonStat(uid, l.id);
        const sh = store.sheetStat(uid, l.id); // 开放任务单状态（无则 null）
        return {
          id: l.id, title: lessonName(l), no: l.no || null,
          full: (l.questions || []).length, // 满分=题数（每题1积分）
          num: (l.questions || []).length,
          hasFlow: (l.questions || []).some((x) => x.type === 'flow'),
          hasSheet: !!l.sheet,
          sheetDone: !!(sh && (sh.attempts || []).length),
          sheetAttempts: sh ? (sh.attempts || []).length : 0,
          sheetLastAt: sh ? (sh.lastAt || null) : null,
          best: st ? st.best : null,
          last: st ? st.lastScore : null,
          attempts: st ? (st.attempts || []).length : 0,
          done: !!st,
          cert: certBrief(store, uid, l), // 证书小标：{issued, pending, pct, stars, issuedAt, missing}
        };
      });
      units.push({ id: u.id, title: u.title, lessons });
    }
    out.push({ grade: g.grade, semester: g.semester, units });
  }
  return out;
}

module.exports = { TYPE_NAME, LEVEL_STAR, lessonName, publicQuestion, publicSheet, sheetRowSpecs, buildCatalog };
