// 生成《复习资料》Word文档（文档2）
const path = require('path');
const {
  Document, Paragraph, AlignmentType, PageBreak,
  tr, para, body, h1, h2, h3, h4, makeTable, saveDoc,
} = require('./docx_helpers.js');
const { FRAMEWORK } = require('./framework.js');
const { REVIEW_DATA } = require('./review_data.js');
const { Q500, Q2000, buildMapping } = require('./mapping.js');

const M = {};
buildMapping().forEach(m => { M[m.id] = m; });

// 按题号取题目
const byNo500 = {};
Q500.forEach(q => byNo500[q.no] = q);
const byNo2000 = {};
Q2000.forEach(q => byNo2000[q.no] = q);

// 题目渲染辅助
function qStem(q) {
  return `${q.no}. ${q.q}`;
}
function qOptions(q) {
  if (!q.options.length) return '';
  return q.options.map(o => `${o.key}. ${o.text}`).join('　　');
}
function qAnswerLine(q) {
  const ans = q.answer;
  return `【答案】${ans}`;
}
function qExpl(q) {
  return q.expl ? `【解析】${q.expl}` : '';
}

// 渲染一道例题（含答案与解析）
function examplePara(q, idx, showNo = true) {
  const children = [];
  const label = q.no; // 保留原题号
  children.push(new Paragraph({
    children: [tr(`例题${idx}（${label}）`, { bold: true, color: 'C00000' }), tr('　' + qStem(q))],
    spacing: { before: 60, after: 20 },
  }));
  if (qOptions(q)) {
    children.push(new Paragraph({
      children: [tr(qOptions(q), { size: 19, color: '404040' })],
      spacing: { after: 20 },
    }));
  }
  children.push(new Paragraph({
    children: [tr(qAnswerLine(q) + '　' + qExpl(q), { size: 19, color: '1F6E1F' })],
    spacing: { after: 80 },
  }));
  return children;
}

// 渲染一道练习题（不含答案）
function practicePara(q, idx, showNo = true) {
  const children = [];
  children.push(new Paragraph({
    children: [tr(`${idx}. `, { bold: true }), tr(qStem(q).replace(/^\d+\.\s*/, ''))],
    spacing: { before: 40, after: 20 },
  }));
  if (qOptions(q)) {
    children.push(new Paragraph({
      children: [tr(qOptions(q), { size: 19, color: '404040' })],
      spacing: { after: 20 },
    }));
  }
  return children;
}

// 显示填空题作答行
function answerLine(qs, startIdx) {
  return qs.map((q, i) => `第${startIdx + i}题：${q.answer}`).join('　');
}

// ================= 文档 =================
const children = [];

// 封面
children.push(new Paragraph({ children: [tr('', { size: 80 })], spacing: { before: 200 } }));
children.push(new Paragraph({
  children: [tr('AI知识竞赛·复习资料', { bold: true, size: 52, font: '黑体', color: '1F4E79' })],
  alignment: AlignmentType.CENTER, spacing: { after: 80 },
}));
children.push(new Paragraph({
  children: [tr('小学组（500题 + 2000题 全覆盖）', { bold: true, size: 30, font: '黑体', color: '2E74B5' })],
  alignment: AlignmentType.CENTER, spacing: { after: 260 },
}));
children.push(new Paragraph({
  children: [tr('按“六大篇章 · 24个单元”系统复习', { size: 26, color: '595959' })],
  alignment: AlignmentType.CENTER, spacing: { after: 60 },
}));
children.push(new Paragraph({
  children: [tr('每个单元包含：知识要点 → 记忆口诀 → 例题精讲 → 练一练', { size: 26, color: '595959' })],
  alignment: AlignmentType.CENTER, spacing: { after: 60 },
}));
children.push(new Paragraph({
  children: [tr('配套文件：《01-AI知识竞赛教学知识框架.docx》', { size: 24, color: '7F7F7F' })],
  alignment: AlignmentType.CENTER, spacing: { after: 60 },
}));
children.push(new Paragraph({
  children: [tr('2026年8月', { size: 24, color: '595959' })],
  alignment: AlignmentType.CENTER, spacing: { after: 0 },
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 使用说明
children.push(h1('使用说明'));
children.push(body('本复习资料与《教学知识框架》配套使用，按六大篇章、24个单元系统覆盖两套题库的全部考点。建议复习流程：'));
children.push(new Paragraph({
  children: [tr('第一步：通读每个单元的“知识要点”，建立整体概念；', { size: 21 })],
  indent: { left: 200 }, spacing: { after: 20 },
}));
children.push(new Paragraph({
  children: [tr('第二步：记住“记忆口诀”，帮助快速回忆；', { size: 21 })],
  indent: { left: 200 }, spacing: { after: 20 },
}));
children.push(new Paragraph({
  children: [tr('第三步：完成“例题精讲”（选自500题，含答案与解析）；', { size: 21 })],
  indent: { left: 200 }, spacing: { after: 20 },
}));
children.push(new Paragraph({
  children: [tr('第四步：独立完成“练一练”（选自2000题），再对照参考答案检查。', { size: 21 })],
  indent: { left: 200 }, spacing: { after: 20 },
}));
children.push(body('提示：例题题号为500题库原题号，练一练题号为2000题库原题号，可回原题库核对。复习完本书后，可在《教学知识框架》中按单元题号进行全量刷题。'));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ============ 各篇章各单元 ============
const CN = ['一', '二', '三', '四', '五', '六'];
FRAMEWORK.forEach((ch, ci) => {
  children.push(new Paragraph({
    children: [tr(`第${CN[ci]}篇　${ch.chapter}`, { bold: true, size: 30, font: '黑体', color: 'FFFFFF' })],
    spacing: { before: 200, after: 120 },
    shading: { fill: '1F4E79', type: 'clear', color: 'auto' },
    indent: { left: 160 },
  }));
  children.push(body(ch.intro));

  ch.units.forEach(u => {
    const m = M[u.id];
    const rd = REVIEW_DATA[u.id];

    // 单元标题
    children.push(new Paragraph({
      children: [tr(`单元 ${u.id}　${u.title}`, { bold: true, size: 26, font: '黑体', color: 'FFFFFF' })],
      spacing: { before: 160, after: 80 },
      shading: { fill: '2E74B5', type: 'clear', color: 'auto' },
      indent: { left: 120 },
    }));
    // 题量信息
    children.push(new Paragraph({
      children: [tr(`覆盖题量：500题 ${m.count500 || '——'} 题；2000题 ${m.count2000 || '——'} 题。`, { size: 19, color: '595959' })],
      spacing: { after: 40 },
    }));

    // 知识要点
    children.push(h4('◆ 知识要点'));
    children.push(body(u.summary));
    u.points.forEach((p, pi) => {
      children.push(new Paragraph({
        children: [tr(`${pi + 1}. `, { bold: true, color: '2E74B5' }), tr(p, { size: 20 })],
        indent: { left: 120, firstLine: 0 },
        spacing: { line: 300, after: 30 },
      }));
    });

    // 记忆口诀
    children.push(h4('◆ 记忆口诀'));
    children.push(new Paragraph({
      children: [tr(rd.mnemonic, { size: 22, bold: true, color: 'C00000' })],
      indent: { left: 120 },
      spacing: { after: 60 },
    }));

    // 例题精讲
    if (rd.examples.length) {
      children.push(h4('◆ 例题精讲（选自500题）'));
      rd.examples.forEach((no, idx) => {
        const q = byNo500[no];
        if (q) examplePara(q, idx + 1).forEach(p => children.push(p));
      });
    } else {
      children.push(h4('◆ 例题精讲'));
      children.push(body('本单元内容主要收录于2000题库，请结合下方“练一练”掌握。（可对照《教学知识框架》查阅对应2000题题号）'));
    }

    // 练一练
    children.push(h4('◆ 练一练（选自2000题）'));
    if (rd.practice.length) {
      rd.practice.forEach((no, idx) => {
        const q = byNo2000[no];
        if (q) practicePara(q, idx + 1).forEach(p => children.push(p));
      });
      // 参考答案
      const realQs = rd.practice.map(no => byNo2000[no]).filter(Boolean);
      children.push(new Paragraph({
        children: [tr('【参考答案】', { bold: true, color: '1F6E1F' }), tr(answerLine(realQs, 1), { size: 19, color: '1F6E1F' })],
        spacing: { before: 60, after: 100 },
      }));
    } else {
      children.push(body('本单元暂无对应2000题练习，请参照《教学知识框架》进行复习。'));
    }
  });

  // 每篇结束分页
  children.push(new Paragraph({ children: [new PageBreak()] }));
});

// ============ 考前速记 ============
children.push(h1('附录　考前高频考点速记清单'));
const speedNotes = [
  ['AI是什么', 'AI=人工智能（Artificial Intelligence）；让机器像人一样感知、学习、推理、决策；AI有边界，非万能。'],
  ['AI三要素', '数据（粮食）＋ 算法（方法）＋ 算力（动力）；大数据=数量大、来源多、种类丰富。'],
  ['机器学习', '三大类：监督学习（有标签）、无监督学习（无标签，聚类）、强化学习（尝试+奖励）；过拟合=训练好新数据差。'],
  ['深度学习', '多层神经网络；CNN管图像、RNN管序列、Transformer靠注意力机制；GPU加速训练。'],
  ['自然语言处理', 'NLP让机器懂人话；分词、翻译、摘要、情感分析、纠错、命名实体识别；提示词要清晰。'],
  ['计算机视觉', '让机器看世界；分类、检测、分割、人脸识别、风格迁移、超分辨率。'],
  ['语音技术', '语音识别（声→字）、语音合成（字→声）、声纹识别（认人）、唤醒词、翻译耳机三合一。'],
  ['智慧城市', '大数据＋AI＋物联网；红绿灯看车流、站牌报到达、门禁刷脸。'],
  ['无人驾驶', '摄像头/雷达感知 + AI决策；智能红绿灯随车流调整。'],
  ['医疗·环保', 'AI影像辅助诊断（医生把关）、健康手环监测；AI监测环境、海洋保护、精准农业。'],
  ['教育·校园', 'AI个性化推荐、智能批改、语音评测；AI是助手，不能代写作业。'],
  ['艺术创作', 'AI绘画/作曲/特效是创作助手；生成内容要标明，不能冒充真人。'],
  ['发展史', '1956达特茅斯定名；图灵测试辨人机；1997深蓝、2016AlphaGo；大模型2020年前后兴起。'],
  ['前沿技术', '大模型、多模态、AIGC、具身智能、AGI、脑机接口、数字人、AI芯片。'],
  ['大语言模型', '海量文本训练；能写问答译；会“幻觉”要核实；信息可能过时；AI是辅助，思考靠自己。'],
  ['伦理与安全', '隐私不泄露、强密码、陌生要钱多核实；防深度伪造、防语音克隆诈骗；AI要公平、守版权。'],
  ['数学·几何', '正方形周长=边长×4；三角面积=底×高÷2；圆周长=2πr；正方体体积=棱长³。'],
  ['数学·运算', '先乘除后加减；0不能作除数；加法交换律。'],
  ['数学·应用', '总价=单价×数量；速度=路程÷时间；8折=×0.8；减少百分比=（原价-现价）÷原价。'],
  ['数学·数论', '质数只有1和本身（19）；2是偶质数；最大公因数、最小公倍数。'],
  ['逻辑·数列', '等差（差不变）、等比（比不变）、平方数列、斐波那契（前两项之和）。'],
  ['逻辑·思维', '演绎（一般→特殊）、归纳（特殊→一般）、类比（找相似）、传递性排序。'],
  ['逻辑·集合', '容斥：至少喜欢一样=A+B-A∩B；只喜欢A=A-A∩B；都不喜欢=全班-并集；韦恩图。'],
  ['AI与人类', 'AI是助手和伙伴；人类擅长创造、情感、价值判断；AI帮我但不代替我。'],
];
children.push(makeTable(['考点', '速记内容'], speedNotes, {
  colWidths: [1800, 6200], bodySize: 20,
}));
children.push(body('祝同学们复习顺利、赛出好成绩！'));

const doc = new Document({
  styles: { default: { document: { run: { font: '宋体', size: 21 } } } },
  sections: [{ children }],
});
saveDoc(doc, path.join('F:/cursor20260624/output', '02-AI知识竞赛复习资料.docx'));
