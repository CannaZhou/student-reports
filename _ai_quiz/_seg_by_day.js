const APP='F:/cursor20260624/_ai_quiz/app';
const {Store}=require(APP+'/core/store.js');
const store=new Store({dataDir:APP+'/data'}).loadAll();
const byDay={};
for (const n in store.progress){
  if(n==='admin') continue;
  const pr=store.progress[n];
  for (const [day,d] of Object.entries(pr.days||{})){
    const sg=d.segs||{};
    const realDay = d.date || day;
    if(!sg.base && !sg.rest) continue;
    const k=(d.submittedAt||'').slice(0,10);
    if(!byDay[k]) byDay[k]={base:0,rest:0,days:new Set(),users:new Set()};
    if(sg.base){byDay[k].base++; byDay[k].users.add(n);}
    if(sg.rest) byDay[k].rest++;
    byDay[k].days.add(day);
  }
}
let cb=0,cr=0,cu=new Set(),cd=new Set();
for(const k of Object.keys(byDay).sort()){ const v=byDay[k]; console.log(k, '基础',v.base,'进阶',v.rest,'人数',v.users.size); }
console.log('--- cumulative by submit date');
for(const k of Object.keys(byDay).sort()){ const v=byDay[k]; cb+=v.base; cr+=v.rest; for(const u of v.users) cu.add(u); for(const d of v.days) cd.add(d); console.log(k,'cum基础',cb,'cum进阶',cr,'累计日次',cb+cr,'人数',cu.size); }
