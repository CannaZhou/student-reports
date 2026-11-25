const BASE='http://127.0.0.1:8080';
(async()=>{
  const name=process.argv[2]||'胡瀚文';
  const r=await fetch(BASE+'/api/student/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,password:'zqxx2025'})});
  const ck=(r.headers.get('set-cookie')||'').split(';')[0];
  const h=await (await fetch(BASE+'/api/reading/chat/history',{headers:{Cookie:ck}})).json();
  for(const m of (h.dialog||[])) console.log('['+m.role+'] '+m.text.replace(/\n/g,' / ').slice(0,300));
})();
