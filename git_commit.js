const { execSync } = require('child_process');
const GIT = '"C:\\Program Files\\Git\\bin\\git.exe"';
const dir = 'F:\\cursor20260624';

function run(cmd) {
  try {
    const r = execSync(GIT + ' ' + cmd, { cwd: dir, encoding: 'utf8', shell: 'cmd.exe' });
    const out = r.trim();
    if (out) console.log(out);
    return out;
  } catch(e) {
    const msg = (e.stdout || e.stderr || e.message || '').trim();
    if (msg) console.log(msg);
    return msg;
  }
}

console.log('--- git status ---');
run('status --short');

console.log('\n--- add & commit ---');
run('add .');
run('commit -m "feat: 六年级留空 + 保留背景图片 + 从获奖表自动填充荣誉"');

console.log('\n--- push ---');
const pushResult = run('push');
if (pushResult && pushResult.includes('Everything up-to-date')) {
  console.log('已是最新，无需推送');
}

require('fs').unlinkSync('F:\\cursor20260624\\git_commit.js');
console.log('\n完成！');
