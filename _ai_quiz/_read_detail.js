const APP = 'F:/cursor20260624/_ai_quiz/app';
const { Store } = require(APP + '/core/store.js');
const rp = require(APP + '/core/readprogress.js');
const store = new Store({ dataDir: APP + '/data' }).loadAll();
const rows=[];
for (const s of store.students.list) {
  const pr = store.progress[s.name]; if (!pr || !pr.reading) continue;
  const r = pr.reading, done = rp.completedCount(pr);
  let story = 0; for (const c of rp.CHAPTERS) if (r.chapters[c.no] && r.chapters[c.no].storyRead) story++;
  rows.push({name:s.name, started:(r.startedAt||'').slice(0,16), done, story, dlg:r.dialogCount||0, pts:rp.totalQuizPoints(pr), quizObj:Object.keys(r.chapters||{}).length});
}
rows.sort((a,b)=> a.started < b.started ? -1 : 1);
for (const x of rows) console.log(`${x.started}  ${x.name}\t章${x.done}\t故事${x.story}\t对话${x.dlg}\t分${x.pts}`);
console.log('total', rows.length);
const byDay={}; for (const x of rows) byDay[x.started.slice(0,10)]=(byDay[x.started.slice(0,10)]||0)+1;
console.log(byDay);
