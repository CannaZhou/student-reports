// 根据单元的小节名，从题库数据中计算题目序号区间
const fs = require('fs');
const { FRAMEWORK } = require('./framework.js');

function load(file) {
  return JSON.parse(fs.readFileSync('F:/cursor20260624/_ai_quiz/' + file, 'utf8')).questions;
}
const Q500 = load('data500.json');
const Q2000 = load('data2000.json');

// 把一组题号切成连续区间
function ranges(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const out = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; continue; }
    out.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = sorted[i]; prev = sorted[i];
  }
  out.push(start === prev ? `${start}` : `${start}–${prev}`);
  return out.join('、');
}

function sectionNums(questions, sectionNames) {
  const nums = [];
  for (const q of questions) {
    if (sectionNames.includes(q.section)) nums.push(q.no);
  }
  return nums.sort((a, b) => a - b);
}

// 为每个单元生成题目映射
function buildMapping() {
  const out = [];
  for (const chapter of FRAMEWORK) {
    for (const unit of chapter.units) {
      const n500 = sectionNums(Q500, unit.sec500);
      const n2000 = sectionNums(Q2000, unit.sec2000);
      out.push({
        id: unit.id,
        title: unit.title,
        count500: n500.length,
        count2000: n2000.length,
        range500: ranges(n500),
        range2000: ranges(n2000),
      });
    }
  }
  return out;
}

module.exports = { buildMapping, sectionNums, ranges, Q500, Q2000, FRAMEWORK };

if (require.main === module) {
  const m = buildMapping();
  for (const u of m) {
    console.log(`${u.id} ${u.title} | 500题:${u.count500}题 [${u.range500}] | 2000题:${u.count2000}题 [${u.range2000}]`);
  }
}
