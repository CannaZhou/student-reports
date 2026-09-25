// 扫所有流程图填空题的连线，找出「线段相交」和「拐折过多」的边。
// 用法：node tools/_flowcheck.js
const fs = require('fs');
const path = require('path');

const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'data', 'content.json'), 'utf8'));

// 与 flowchart.js 的 ortho() 保持一致：把斜段拆成直角肘点
function ortho(pts) {
  if (!pts || pts.length < 2) return pts || [];
  const out = [pts[0].slice()];
  for (let i = 1; i < pts.length; i++) {
    const x0 = out[out.length - 1][0], y0 = out[out.length - 1][1];
    const x1 = pts[i][0], y1 = pts[i][1];
    if (x0 === x1 || y0 === y1) out.push([x1, y1]);
    else { out.push([x0, y1]); out.push([x1, y1]); }
  }
  return out;
}
const segs = (pts) => {
  const p = ortho(pts), out = [];
  for (let i = 1; i < p.length; i++) out.push([p[i - 1], p[i]]);
  return out;
};
const horiz = (s) => s[0][1] === s[1][1];
const vert = (s) => s[0][0] === s[1][0];

// 两线段是否真交叉（共线重叠算「重叠」不算交叉；只有内部交点才算交叉）
function cross(a, b) {
  const [p1, p2] = a, [p3, p4] = b;
  if (horiz(a) && vert(b)) {
    const y = p1[1], x = p3[0];
    const xa = [Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0])];
    const yb = [Math.min(p3[1], p4[1]), Math.max(p3[1], p4[1])];
    if (x > xa[0] && x < xa[1] && y > yb[0] && y < yb[1]) return [x, y];
  }
  if (vert(a) && horiz(b)) return cross(b, a);
  return null;
}

let total = 0;
for (const g of content.grades) {
  for (const u of g.units) {
    for (const l of u.lessons) {
      // 课后小测的流程图题 + 课内任务单里的流程图板块，一起查
      const flows = (l.questions || []).filter((q) => q.type === 'flow' && q.flow).map((q) => [q.id, q.flow]);
      const secs = (l.sheet && Array.isArray(l.sheet.sections)) ? l.sheet.sections : (l.sheet ? [l.sheet] : []);
      secs.forEach((b, bi) => { if (b && b.flow) flows.push([l.id + ' 任务单板块' + (bi + 1), b.flow]); });
      for (const [qid, qflow] of flows) {
        const q = { id: qid, flow: qflow };
        const eds = q.flow.edges || [];
        const bad = [];
        for (let i = 0; i < eds.length; i++) {
          const si = segs(eds[i].pts);
          for (let j = i + 1; j < eds.length; j++) {
            for (const sa of si) {
              for (const sb of segs(eds[j].pts)) {
                const p = cross(sa, sb);
                if (p) bad.push(`${eds[i].from}→${eds[i].to} ✕ ${eds[j].from}→${eds[j].to} @ (${p[0]},${p[1]})`);
              }
            }
          }
        }
        // 拐折数：ortho 后的拐点数（点位数 - 2）
        const bends = eds.map((e) => ({ id: `${e.from}→${e.to}`, n: Math.max(0, ortho(e.pts).length - 2) }));
        const manyBends = bends.filter((b) => b.n >= 3);
        if (bad.length || manyBends.length) {
          total++;
          console.log(`■ ${l.id} ${l.title} / ${q.id}`);
          for (const b of bad) console.log('   交叉: ' + b);
          if (manyBends.length) console.log('   拐折≥3: ' + manyBends.map((b) => `${b.id}(${b.n})`).join(', '));
          console.log('   全部拐折: ' + bends.map((b) => `${b.id}=${b.n}`).join(', '));
        }
      }
    }
  }
}
console.log(total ? `\n共 ${total} 处需要整理` : '\n所有流程图连线均无交叉、拐折均 ≤2');
