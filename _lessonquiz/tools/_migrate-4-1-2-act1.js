// 一次性数据迁移：清掉四年级第2课《多样的数据》任务单「活动一」那 4 行的旧答案。
// 背景：活动一原先自己改编成“《观潮》文件夹”那版（4 行），2026-09-18 改回课件原题的四张图。
//       两个班（2023级7班/4班）此前交的答案按行号 _i=0..3 对上来，现在会和换后的图张冠李戴，
//       所以只清这 4 行；活动二(_i=4..7)、活动三(_i=8..)、提交次数、课后小测成绩、教师赋分一律不动。
// 用法：node tools/_migrate-4-1-2-act1.js        （空跑，只报告）
//       node tools/_migrate-4-1-2-act1.js --apply（真改，改前先整目录备份）
// 注意：服务在跑时它把成绩缓存在内存里，学生交一次会把该生整个记录写回去覆盖本脚本的改动。
//       所以要么先停服务再跑，要么跑完尽快重启——重启会重新从磁盘读，改动就生效了。
const fs = require('fs');
const path = require('path');

const LESSON = '4-1-2';
const ACT1_ROWS = [0, 1, 2, 3];            // 活动一占的可填行号
const DIR = path.resolve(__dirname, '..', 'app', 'data', 'progress');
const BAK = path.resolve(__dirname, '..', '_backup_progress_' + new Date().toISOString().slice(0, 10).replace(/-/g, ''));
const APPLY = process.argv.includes('--apply');

const rowIdx = (r, i) => (r && r._i !== undefined && r._i !== null) ? r._i : i;

function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
  let touched = 0, removed = 0, positional = 0;
  const plan = [];

  for (const f of files) {
    const p = path.join(DIR, f);
    let d;
    try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.log('跳过（读不动）:', f); continue; }
    const sh = d.sheets && d.sheets[LESSON];
    if (!sh || !Array.isArray(sh.attempts)) continue;

    let hit = 0;
    for (const a of sh.attempts) {
      const rows = Array.isArray(a.rows) ? a.rows : [];
      for (let i = 0; i < rows.length; i++) if (rows[i] && (rows[i]._i === undefined || rows[i]._i === null)) positional++;
      a.rows = rows.filter((r, i) => !ACT1_ROWS.includes(rowIdx(r, i)));
      hit += rows.length - a.rows.length;
    }
    // 只留活动二/三的行；某次提交若只剩空数组，保持空数组（次数不动）
    if (hit) { touched++; removed += hit; plan.push({ f, hit, name: d.name, cls: d.className }); }
  }

  console.log('成绩目录：' + DIR);
  console.log('扫描到 ' + files.length + ' 个成绩文件；其中 ' + touched + ' 人需要清理，共删 ' + removed + ' 行。');
  console.log('（没有 _i 字段、按数组位置算的老行：' + positional + ' 行，本次也一并按位置处理）');
  console.log('按班：' + JSON.stringify(plan.reduce((m, x) => { m[x.cls] = (m[x.cls] || 0) + 1; return m; }, {})));
  console.log('前 5 个：' + plan.slice(0, 5).map((x) => x.name + '(' + x.hit + '行)').join('、'));

  if (!APPLY) { console.log('\n空跑结束，加 --apply 才会真改。'); return; }

  fs.mkdirSync(BAK, { recursive: true });
  for (const f of files) fs.copyFileSync(path.join(DIR, f), path.join(BAK, f));
  console.log('\n已整目录备份到：' + BAK);

  for (const f of files) {
    const p = path.join(DIR, f);
    let d;
    try { d = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { continue; }
    const sh = d.sheets && d.sheets[LESSON];
    if (!sh || !Array.isArray(sh.attempts)) continue;
    let hit = 0;
    for (const a of sh.attempts) {
      const rows = Array.isArray(a.rows) ? a.rows : [];
      a.rows = rows.filter((r, i) => !ACT1_ROWS.includes(rowIdx(r, i)));
      hit += rows.length - a.rows.length;
    }
    if (hit) {
      const s = JSON.stringify(d, null, 1);
      fs.writeFileSync(p, s);
      // 成绩文件旁边的 .bak 不是“上一版”，而是当前文件的副本（store.saveProgress 写完就拷贝，
      // 只在主文件读坏时拿来兜底）。所以这里要跟着更新，否则损坏回退会把清掉的行又带回来。
      if (fs.existsSync(p + '.bak')) fs.writeFileSync(p + '.bak', s);
    }
  }
  console.log('已清理 ' + touched + ' 人的成绩文件。');
}

main();
