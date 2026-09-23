// 课名（带课号）：课数据里 no=第几课，显示成“第2课 多样的数据”，方便辨认；教材里课号是全书连排的。
// 单独放一个叶子模块（catalog.js 与 cert.js 都要用）：这两个模块互相依赖，谁也不能顶层 require 对方
// —— 顶层成环时先加载的那个只能拿到空 exports，课名会静默变空。
function lessonName(l) {
  if (!l) return '';
  return (l.no ? '第' + l.no + '课 ' : '') + (l.title || '');
}

module.exports = { lessonName };
