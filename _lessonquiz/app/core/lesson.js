// 课名（带课号）：课数据里 no=第几课，显示成“第2课 多样的数据”，方便辨认；教材里课号是全书连排的。
// 单独放一个叶子模块（catalog.js 与 cert.js 都要用）：这两个模块互相依赖，谁也不能顶层 require 对方
// —— 顶层成环时先加载的那个只能拿到空 exports，课名会静默变空。
function lessonName(l) {
  if (!l) return '';
  return (l.no ? '第' + l.no + '课 ' : '') + (l.title || '');
}

// 课内任务单有「几题」（=几个板块）：老师按「一题 1 分、做对几题得几分」打分，
// 所以这就是任务单的满分，证书里也拿它当分母（2026-09-25 老师口径）。
// 单表结构（没有 sections）算 1 题；某课想改口就写 sheet.taskCount 显式覆盖。
function sheetTaskCount(sheet) {
  if (!sheet) return 0;
  if (typeof sheet.taskCount === 'number' && sheet.taskCount > 0) return sheet.taskCount;
  return (sheet.sections && sheet.sections.length) || 1;
}

module.exports = { lessonName, sheetTaskCount };
