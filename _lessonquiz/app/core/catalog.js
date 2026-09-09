// 课程目录：年级→册→单元→课；学生取卷脱敏；目录带个人成绩合并
// content.json.grades = [{ grade, semester:'上', units:[{id,title,lessons:[{id,title,questions:[...]}]}] }]

const TYPE_NAME = { judge: '判断题', single: '单选题', multi: '多选题', fill: '填空题', flow: '流程图填空' };
const LEVEL_STAR = { 1: '★ 简单', 2: '★★ 中等', 3: '★★★ 偏难' };

// 学生看到的课内任务单（开放填写，无答案/机密字段，仅白名单字段下发）
function publicSheet(sheet) {
  if (!sheet) return null;
  const out = {};
  for (const k of ['title', 'heading', 'intro', 'caption', 'cols', 'rows', 'example', 'remind']) {
    if (sheet[k] !== undefined) out[k] = sheet[k];
  }
  return out;
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
          id: l.id, title: l.title,
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
        };
      });
      units.push({ id: u.id, title: u.title, lessons });
    }
    out.push({ grade: g.grade, semester: g.semester, units });
  }
  return out;
}

module.exports = { TYPE_NAME, LEVEL_STAR, publicQuestion, publicSheet, buildCatalog };
