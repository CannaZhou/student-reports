const { execSync } = require('child_process');
const GIT = '"C:\\Program Files\\Git\\bin\\git.exe"';
const dir = 'F:\\cursor20260624';

function run(cmd) {
  try {
    const r = execSync(GIT + ' ' + cmd, { cwd: dir, encoding: 'utf8', shell: 'cmd.exe' });
    console.log(r.trim());
  } catch(e) {
    const msg = (e.stdout || e.stderr || e.message || '').trim();
    if (msg) console.log(msg);
  }
}

run('add .');
run('commit -m "refactor: 基于新模板生成，保留背景+等级列+信息科技成果"');
run('push');

require('fs').unlinkSync(__filename);
