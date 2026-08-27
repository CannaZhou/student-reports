// ============================================================
// LLM 适配层：AI伴读对话（DeepSeek Chat Completions）
// - 配置：../llm.config.json（真实 key 不入库，模板见 llm.config.example.json）
// - 调用失败 / 未配置 / 超时 → 兜底为本地知识卡模板回复，课堂不中断
// - 多模型协同口径：对话用 chat 模型；闯关判分用确定性题库；AI解读留 reasoner 接口
// ============================================================
const https = require('https');
const fs = require('fs');
const path = require('path');

let _cfg = null;
function config() {
  if (_cfg) return _cfg;
  try {
    _cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'llm.config.json'), 'utf8'));
  } catch (e) {
    _cfg = { enabled: false };
  }
  return _cfg;
}

// 章节知识库文本：知识加油站 + 知识卡（刻意不含闯关题答案，守住测评边界）
function chapterKnowledgeText(chapter) {
  const lines = [];
  lines.push('【知识加油站】');
  for (const k of chapter.knowledge || []) lines.push('- ' + k);
  const cards = chapter.knowledgeCards || [];
  if (cards.length) {
    lines.push('【知识卡】');
    for (const c of cards) {
      lines.push(`- ${c.title}：${c.summary}`);
      for (const p of c.points || []) lines.push(`  · ${p}`);
    }
  }
  return lines.join('\n');
}

// 伴读 system prompt（提示词工程：角色 + 儿童化 + 助读不代读 + 知识库注入）
function buildCompanionMessages({ chapter, question, history, studentName, storyRead }) {
  const sys = [
    `你是《小AI探险队》里的守护精灵【点点】，陪${studentName}读AI知识冒险故事、一起学AI知识。`,
    `回答要求：`,
    `1. 用小学3-6年级能听懂的话回答，简短亲切，多用生活比喻（像"数据是粮食、算法是菜谱、算力是炉火"）。`,
    `2. 只能依据下面【本章知识库】的内容回答；知识库里没有的，要诚实说"这个知识库里还没讲到哦，我们一起去翻翻书或者问问老师吧"，绝不编造。`,
    `3. 【助读不代读】不直接替小朋友写作业、写作文、报整道题的现成答案；先用提问引导TA自己思考，等TA说出想法后再点头确认或补充。`,
    `4. 每次回答结尾，用一个有趣的追问，鼓励小朋友把AI知识联系到生活里。`,
    `5. 语气活泼可爱，像陪小朋友玩的好伙伴，可适当用emoji，但不要刷屏。`,
    ``,
    `学生阅读情况：本章故事${storyRead ? '已读完' : '还没读完'}。`,
    ``,
    `【本章知识库】`,
    chapterKnowledgeText(chapter),
  ].join('\n');

  const messages = [{ role: 'system', content: sys }];
  for (const h of (history || []).slice(-4)) {
    messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
  }
  messages.push({ role: 'user', content: question });
  return messages;
}

// 兜底回复：本地知识卡模板（无网络/失败时使用，保持课堂可用）
function fallbackReply(chapter, question) {
  const bullets = (chapter.knowledge || []).slice(0, 5);
  const lines = [
    `（离线回答）点点现在连不上"智慧之光"的网络啦～不过本章的【知识加油站】就在书里，你再翻翻看：`,
    ``,
    ...bullets.map((b) => '• ' + b),
    ``,
    `读完再试试用里面的词语回答自己的问题，也可以先问问身边的小伙伴，点点稍后再来陪你聊！😊`,
  ];
  return lines.join('\n');
}

// 调用大模型；返回 { reply, source: 'llm' | 'local' }
function chat({ messages, fallbackText }) {
  const cfg = config();
  if (!cfg.enabled || !cfg.apiKey) {
    return Promise.resolve({ reply: fallbackText, source: 'local' });
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (obj) => { if (!done) { done = true; resolve(obj); } };

    const url = (cfg.baseUrl || 'https://api.deepseek.com') + '/chat/completions';
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey,
      },
      timeout: cfg.timeoutMs || 20000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const reply = j.choices && j.choices[0] && j.choices[0].message
            ? j.choices[0].message.content : null;
          finish(reply ? { reply, source: 'llm' } : { reply: fallbackText, source: 'local' });
        } catch (e) {
          finish({ reply: fallbackText, source: 'local' });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); });
    req.on('error', () => finish({ reply: fallbackText, source: 'local' }));
    req.write(JSON.stringify({
      model: cfg.model || 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 600,
    }));
    req.end();
  });
}

module.exports = { config, chapterKnowledgeText, buildCompanionMessages, fallbackReply, chat };
