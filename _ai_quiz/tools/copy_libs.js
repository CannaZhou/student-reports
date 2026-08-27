// 一次性：把运行时需要的第三方单文件库与框架数据拷入 app/（保证服务器无需 npm install）
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');            // _ai_quiz
const NM = path.join(ROOT, '..', 'node_modules');   // 仓库根 node_modules
const APP = path.join(ROOT, 'app');
const LIB = path.join(APP, 'lib');
const CORE = path.join(APP, 'core');

fs.mkdirSync(LIB, { recursive: true });

const jobs = [
  [path.join(NM, 'xlsx', 'dist', 'xlsx.full.min.js'), path.join(LIB, 'xlsx.full.min.js')],
  [path.join(NM, 'jszip', 'dist', 'jszip.min.js'), path.join(LIB, 'jszip.min.js')],
  [path.join(ROOT, 'framework.js'), path.join(CORE, 'framework.js')],
];

for (const [src, dst] of jobs) {
  if (!fs.existsSync(src)) {
    console.error('缺少源文件，无法拷贝:', src);
    process.exit(1);
  }
  fs.copyFileSync(src, dst);
  console.log('✓', path.basename(dst), '(', (fs.statSync(src).size / 1024).toFixed(0), 'KB )');
}
console.log('拷贝完成 →', APP);
