// ============================================================
// 生成《小AI探险队》书架数据 books.json
// 输入：story_data.js（故事） + app/core/framework.js（知识卡） + app/data/bank.json（闯关题）
// 输出：app/data/books.json（阅读智能体的"书"）
// 复现方式：node tools/build_books.js
// ============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { STORY } = require(path.join(ROOT, 'story_data.js'));
const { FRAMEWORK } = require(path.join(ROOT, 'app', 'core', 'framework.js'));
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'data', 'bank.json'), 'utf8'));

// 题库索引：id -> question
const byId = new Map();
for (const q of bank.questions) byId.set(q.id, q);

// FRAMEWORK 单元索引：unit.id -> unit（含篇章信息）
const unitIndex = new Map();
for (const ch of FRAMEWORK) {
  for (const u of ch.units) unitIndex.set(u.id, { ...u, chapter: ch.chapter, chapterIdx: FRAMEWORK.indexOf(ch) });
}

// 故事里的闯关题号 {bank,no} -> bank.json id
function resolveQuizId(ref) {
  return `${ref.bank}-${ref.no}`;
}

const missing = [];
const chapters = STORY.chapters.map((c) => {
  const quizIds = c.quiz.map((ref) => resolveQuizId(ref));

  // 校验题号存在
  for (const id of quizIds) if (!byId.has(id)) missing.push(`第${c.no}章: ${id}`);

  // 收集本章闯关题涉及的单元 -> 知识卡（取自 FRAMEWORK）
  const unitIds = [...new Set(quizIds.map((id) => byId.get(id)?.unit).filter(Boolean))];
  const knowledgeCards = unitIds
    .map((uid) => unitIndex.get(uid))
    .filter(Boolean)
    .map((u) => ({
      id: u.id,
      title: u.title,
      chapter: u.chapter,
      summary: u.summary || '',
      points: u.points || [],
    }));

  return {
    no: c.no,
    title: c.title,
    chapterTitle: c.chapterTitle,
    story: c.story,
    knowledge: c.knowledge,
    mnemonic: c.mnemonic,
    quizIds,
    knowledgeCards,
  };
});

const books = {
  version: 1,
  builtAt: new Date().toISOString(),
  title: STORY.title,
  subtitle: STORY.subtitle,
  intro: STORY.intro,
  map: STORY.map,
  ending: STORY.ending,
  chapters,
};

const outPath = path.join(ROOT, 'app', 'data', 'books.json');
fs.writeFileSync(outPath, JSON.stringify(books, null, 1), 'utf8');

console.log('✓ 已生成', outPath);
console.log(`  书名: ${books.title}`);
console.log(`  章节: ${chapters.length} 章`);
for (const c of chapters) {
  console.log(`    ${c.no}. ${c.title} | 闯关 ${c.quizIds.length} 题 | 知识卡 ${c.knowledgeCards.length} 张`);
}
if (missing.length) {
  console.warn('✗ 以下题号在 bank.json 中不存在（需修正 story_data.js）:');
  for (const m of missing) console.warn('  -', m);
  process.exit(1);
} else {
  console.log('✓ 所有闯关题号均可从题库找到');
}
