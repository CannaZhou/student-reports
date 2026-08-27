// 教师导入链路端到端验证：构造 xlsx/docx → 上传 → 预览 → 入库 → 题库数增加
// 依赖运行中的服务器 + app/lib 里的 XLSX/JSZip
// 用法：node tools/e2e_import.js [BASE_URL] [教师密码]
const XLSX = require('../app/lib/xlsx.full.min.js');
const JSZip = require('../app/lib/jszip.min.js');

const BASE = process.argv[2] || 'http://localhost:8080';
const TEACHER_PW = process.argv[3] || 'test1234';
let cookie = '';
let passed = 0, failed = 0;

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗ FAIL:', msg); }
}
function b64(buf) { return Buffer.from(buf).toString('base64'); }

// 构造一个 xlsx：3 道题（单选/判断/填空）
function buildXlsx() {
  const rows = [
    ['题干', '选项A', '选项B', '选项C', '选项D', '答案', '解析', '章节', '小节'],
    ['人工智能之父是谁？', '图灵', '爱因斯坦', '牛顿', '爱迪生', 'A', '图灵被公认为AI之父', '第二篇', 'AI核心'],
    ['人工智能只能用于工业。', '正确', '错误', '', '', 'B', 'AI应用广泛', '第三篇', 'AI应用'],
    ['计算机的英文缩写是___。', '', '', '', '', 'PC', '', '第一篇', '计算机基础'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '题目');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// 构造一个 docx：2 道题
async function buildDocx() {
  const paras = [
    '<w:p><w:r><w:t>1.下列属于人工智能应用的是？（答案：A）</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>A.语音助手</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>B.计算器</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>C.手电筒</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>D.闹钟</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>2.AI的中文全称是人工智能。（正确）</w:t></w:r></w:p>',
    '<w:p><w:r><w:t>解析：Artificial Intelligence。</w:t></w:r></w:p>',
  ].join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}</w:body></w:document>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  zip.file('word/document.xml', xml);
  return await zip.generateAsync({ type: 'nodebuffer' });
}

async function main() {
  console.log('== 教师登录 ==');
  let r = await api('POST', '/api/teacher/login', { password: TEACHER_PW });
  if (r.needsSetup) { await api('POST', '/api/teacher/setup', { password: TEACHER_PW }); r = await api('POST', '/api/teacher/login', { password: TEACHER_PW }); }
  assert(r.ok === true, '教师登录');

  const before = (await api('GET', '/api/teacher/stats')).total;

  console.log('== xlsx 导入 ==');
  const xbuf = buildXlsx();
  r = await api('POST', '/api/teacher/import/excel', { dataBase64: b64(xbuf), filename: 'test.xlsx' });
  assert(r.ok && r.preview.length === 3, '预览解析出 3 题，实际 ' + (r.preview ? r.preview.length : 0));
  assert(r.preview.every((p) => p.type), '每题都有题型: ' + r.preview.map((p) => p.type).join(','));

  r = await api('POST', '/api/teacher/import/commit', { questions: r.preview.map((p) => ({ ...p })) });
  assert(r.ok && r.added === 3, 'xlsx 入库 3 题');
  const after1 = (await api('GET', '/api/teacher/stats')).total;
  assert(after1 === before + 3, '题库从 ' + before + ' → ' + after1);

  console.log('== docx 导入 ==');
  const dbuf = await buildDocx();
  r = await api('POST', '/api/teacher/import/docx', { dataBase64: b64(dbuf), filename: 'test.docx' });
  assert(r.ok && r.preview.length === 2, 'docx 预览解析出 2 题，实际 ' + (r.preview ? r.preview.length : 0));
  r = await api('POST', '/api/teacher/import/commit', { questions: r.preview.map((p) => ({ ...p })) });
  assert(r.ok && r.added === 2, 'docx 入库 2 题');
  assert((await api('GET', '/api/teacher/stats')).total === after1 + 2, '题库 +2');

  console.log('== 检索新题 ==');
  r = await api('GET', '/api/teacher/questions?q=' + encodeURIComponent('人工智能之父'), '');
  assert(r.ok && r.total >= 1, '按关键词检索到新题 ' + r.total);

  console.log('\n结果: ' + passed + ' 通过, ' + failed + ' 失败');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('测试异常:', e); process.exit(1); });
