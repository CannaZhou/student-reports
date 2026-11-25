const APP='F:/cursor20260624/_ai_quiz/app';
const {Store}=require(APP+'/core/store.js');
const rp=require(APP+'/core/readprogress.js');
const store=new Store({dataDir:APP+'/data'}).loadAll();
for (const s of store.students.list){
  const pr=store.progress[s.name]; if(!pr||!pr.reading) continue;
  const done=rp.completedCount(pr); if(done<6) continue;
  console.log(s.name,'章',done,'徽章',rp.badges(pr).length, rp.badges(pr).join(','),'对话',pr.reading.dialogCount||0,'分',rp.totalQuizPoints(pr));
}
