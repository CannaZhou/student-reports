const { execSync } = require('child_process');
const fs = require('fs');

const GIT = '"C:\\Program Files\\Git\\bin\\git.exe"';
const repoDir = 'F:\\cursor20260624';

function run(cmd) {
  try {
    const r = execSync(`${GIT} ${cmd}`, { cwd: repoDir, encoding: 'utf8', shell: 'cmd.exe' });
    const out = r.trim();
    if (out) console.log(out);
    return out;
  } catch(e) {
    const msg = (e.stdout || e.stderr || e.message || '').trim();
    if (msg) console.log(msg);
    return msg;
  }
}

// 1. 删除临时文件
console.log('--- 清理临时文件 ---');
try { fs.unlinkSync(repoDir + '\\git_setup.js'); console.log('  git_setup.js removed'); } catch(e) {}
try { fs.unlinkSync(repoDir + '\\clean_staging.js'); console.log('  clean_staging.js removed'); } catch(e) {}

// 2. add & commit
console.log('\n--- 提交 ---');
run('add .');
const commitResult = run('commit -m "feat: 学生积分明细Word文档生成工具"');

if (commitResult && commitResult.includes('nothing to commit')) {
  console.log('无变化需要提交');
  process.exit(0);
}

// 3. 添加远程仓库
console.log('\n--- 设置远程仓库 ---');
run('remote remove origin');
run('remote add origin git@github.com:CannaZhou/student-reports.git');
console.log('远程仓库: git@github.com:CannaZhou/student-reports.git');

// 4. 推送到远程
console.log('\n--- 推送到远程 ---');
const pushResult = run('push -u origin master');
console.log('\n完成！');
