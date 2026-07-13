const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('F:', '桌面', '桌面所有图标', 'Ai+信息科技应用', '2025.9学生名单claude使用.xlsx');
const wb = XLSX.readFile(filePath);

console.log('=== Sheet Names ===');
console.log(wb.SheetNames);

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\n=== Sheet: ${name} (${data.length} rows) ===`);
  console.log('Header row:', JSON.stringify(data[0]));
  // Show first 5 data rows
  for (let i = 1; i < Math.min(6, data.length); i++) {
    console.log(`Row ${i}:`, JSON.stringify(data[i]));
  }
  if (data.length > 6) console.log(`... (${data.length - 6} more rows)`);
}
