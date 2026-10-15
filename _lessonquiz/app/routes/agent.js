// 学生端【问问】API：做任务单时随时提问。
// 只在任务单页出现（课后小测是测评，AI 在旁边等于开卷）——所以这里从头到尾
// 只碰 lesson.sheet，从不碰 lesson.questions，小测的答案压根不在上下文里。
const { readBody, ok, fail, readSession } = require('./helpers.js');
const agent = require('../core/agent.js');
const { gradeSheet, studentView, cleanRows } = require('../core/sheetgrade.js');
const { studentOf } = require('./student.js');

const GREETING = '嗨，我是 **问问**！做任务单卡住了就问我，我陪你一起想，但不直接告诉你答案哦 😊';

// 首屏那几个快捷问法：名词解释来自本课 knowledge（客户端手上没有 knowledge，只能问服务端要），
// 再加两句人人都用得上的。
function chipsOf(lesson) {
  const out = [];
  const words = (lesson.knowledge && lesson.knowledge.words) || [];
  words.slice(0, 2).forEach((w) => out.push('什么是' + w.w + '？'));
  out.push('这一步该怎么想？');
  out.push('我这样写对不对？');
  return out.slice(0, 4);
}

function leftOf(store, uid, cfg, day) {
  if (!(cfg.dailyPerStudent > 0)) return null;   // 不限次 → 前端不显示计数器
  const cur = store.askStat(uid);
  const used = (cur && cur.day === day) ? (cur.n || 0) : 0;
  return Math.max(0, cfg.dailyPerStudent - used);
}

// 取课 + 鉴权：所有【问问】路由的头两行
function lessonOf(req, res, config, store, lessonId) {
  const stu = studentOf(readSession(req, config), store);
  if (!stu) { fail(res, 401, '未登录'); return null; }
  const lesson = store.findLesson(String(lessonId || ''));
  if (!lesson) { fail(res, 404, '没有这一课'); return null; }
  if (!lesson.sheet) { fail(res, 404, '本课没有课内任务单'); return null; }
  return { stu, lesson };
}

module.exports = { register, GREETING };

function register(router, { store, config }) {
  // 面板打开时调一次：问候语 + 快捷问法 + 今天还剩几次
  router.add('GET', '/api/ask/hello', (req, res, ctx, params, url) => {
    const hit = lessonOf(req, res, config, store, url.searchParams.get('lessonId'));
    if (!hit) return;
    const cfg = agent.config();
    const day = agent.dayStr();
    const off = !!store.teacher.agentOff;
    ok(res, {
      greeting: off
        ? '问问这会儿被老师暂时关掉啦，你先自己想一想任务单上面的提示语，一会儿再来找我 😊'
        : GREETING,
      chips: off ? [] : chipsOf(hit.lesson),
      left: leftOf(store, hit.stu.uid, cfg, day),
      off,
      on: !!(cfg.enabled && cfg.apiKey) && !off,
    });
  });

  // 重新打开面板时把之前聊过的接上（最近 12 句）
  router.add('GET', '/api/ask/history', (req, res, ctx, params, url) => {
    const hit = lessonOf(req, res, config, store, url.searchParams.get('lessonId'));
    if (!hit) return;
    const log = store.askLog(hit.stu.uid, hit.lesson.id).slice(-6);
    const items = [];
    log.forEach((x) => {
      items.push({ role: 'user', text: x.q, ts: x.ts });
      if (x.a) items.push({ role: 'assistant', text: x.a, ts: x.ts });
    });
    ok(res, { items });
  });

  // 提问：唯一会出网的路由
  router.add('POST', '/api/ask', async (req, res) => {
    const body = await readBody(req, config.maxBodyMB * 1024 * 1024);
    const hit = lessonOf(req, res, config, store, body.lessonId);
    if (!hit) return;
    const { stu, lesson } = hit;
    const cfg = agent.config();
    const day = agent.dayStr();

    let q = String(body.question == null ? '' : body.question).replace(/\s+/g, ' ').trim();
    if (!q) return fail(res, 400, '先写一句话再问');
    q = q.slice(0, cfg.maxQuestion);

    // 历史只认 user/assistant，每条截 400 字，最多带 historyTurns 轮
    const history = (Array.isArray(body.history) ? body.history : [])
      .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && String(h.text || '').trim())
      .slice(-cfg.historyTurns * 2)
      .map((h) => ({ role: h.role, text: String(h.text).slice(0, 400) }));

    const sheet = agent.agentSheet(lesson.sheet);
    // 草稿按白名单清洗：客户端送什么都只留"这一行本来就能填的 key"，每格 40 字、最多 40 格
    const draft = cleanRows(sheet, Array.isArray(body.draft) ? body.draft : []);
    // 系统判分用服务端存着的那一版作答算，不信客户端送来的
    const rows = store.lastSheetRows(stu.uid, lesson.id);
    const g = rows.length ? gradeSheet(lesson.sheet, rows) : null;
    const auto = g && g.graded ? studentView(g) : null;
    // question 也带上：离线兜底要用它判断孩子问的是不是「什么是××？」（名词解释）
    const forHint = { lesson, sheet, rows: draft.length ? draft : rows, question: q };

    // —— 两道闸。到量了回 200 + source:'limit'（不是 429）：
    //    前端 api() 会把非 2xx 抛成错误、只在 toast 里闪一下，而限额提示应该正常渲染成一个气泡。
    const left = leftOf(store, stu.uid, cfg, day);
    if (left !== null && left <= 0) {
      return ok(res, {
        reply: '今天问够啦（每天 ' + cfg.dailyPerStudent + ' 次）～ 剩下的自己想出来才最厉害，' +
          '卡住就先看看任务单上面的提示语，明天再来找我 😊',
        source: 'limit', left: 0,
      });
    }
    const globalUsed = store.usageToday(day);
    if (cfg.dailyTotal > 0 && globalUsed >= cfg.dailyTotal) {
      return ok(res, {
        reply: '今天大家问得太多了，问问要先歇一会儿啦～ 你先看看任务单上面的提示语，或者问问身边的同学 😊',
        source: 'limit', left,
      });
    }
    // 老师课上一键停
    if (store.teacher.agentOff) {
      return ok(res, { reply: '问问这会儿被老师暂时关掉啦，你先自己想想，一会儿再来问我 😊', source: 'limit', left });
    }

    const messages = agent.buildMessages({ lesson, rows, auto, draft, history, question: q });
    const fallbackText = agent.fallbackReply(forHint);
    let out = await agent.chat({ messages, fallbackText });
    // 泄漏闸：模型自己把某一格的标准答案说出来了 → 换成"我不说，但我指给你看"。
    // 第一道防线是答案根本没进 prompt；这道闸管的是"模型自己猜出来了"。
    if (out.source === 'llm' && agent.containsSecret(out.reply, lesson)) {
      out = { reply: agent.blockedReply(forHint), source: 'llm' };
    }

    const n = await store.mutate(() => {
      const p = store.ensureProgress(stu);
      if (!p.ask || p.ask.day !== day) p.ask = { day, n: 0 };
      p.ask.n = (p.ask.n || 0) + 1;
      if (!p.asks) p.asks = {};
      const list = p.asks[lesson.id] || [];
      const last = list[list.length - 1];
      // 和前一条一模一样的问题不重复记账（孩子会连点）
      if (!(last && last.q === q)) {
        list.push({ q, a: out.reply, ts: new Date().toISOString() });
        p.asks[lesson.id] = list.slice(-(cfg.logPerLesson || 30));
      }
      store.usageToday(day);
      store.agentUsage.n = (store.agentUsage.n || 0) + 1;
      store.saveProgress(stu.uid);
      store.saveAgentUsage();
      return cfg.dailyPerStudent > 0 ? Math.max(0, cfg.dailyPerStudent - p.ask.n) : null;
    });

    ok(res, { reply: out.reply, source: out.source, left: n });
  });
}
