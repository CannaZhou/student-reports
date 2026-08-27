const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType
} = require('docx');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = '3-教学设计方案-让小飞能看会认.docx';

// ============================================================
// 辅助函数
// ============================================================
function textRun(text, opts = {}) {
  return new TextRun({
    text,
    bold: opts.bold || false,
    size: opts.size || 21,
    font: opts.font || '宋体',
    italics: opts.italics || false,
    color: opts.color,
  });
}

function bodyPara(text) {
  const runs = typeof text === 'string'
    ? [textRun(text, { size: 21, font: '宋体' })]
    : text.map(t => typeof t === 'string' ? textRun(t, { size: 21, font: '宋体' }) : textRun(t.text, { ...t, size: t.size || 21, font: t.font || '宋体' }));
  return new Paragraph({
    children: runs,
    alignment: AlignmentType.LEFT,
    spacing: { line: 360, after: 60 },
    indent: { firstLine: 420 },
  });
}

function bodyParaCenter(text) {
  return new Paragraph({
    children: [textRun(text, { size: 21, font: '宋体' })],
    alignment: AlignmentType.CENTER,
    spacing: { line: 360, after: 60 },
  });
}

function bodyParaBold(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 21, font: '宋体' })],
    alignment: AlignmentType.LEFT,
    spacing: { line: 360, after: 60 },
    indent: { firstLine: 420 },
  });
}

function bodyParaMulti(runs) {
  return new Paragraph({
    children: runs.map(r => typeof r === 'string' ? textRun(r, { size: 21, font: '宋体' }) : textRun(r.text, { ...r, size: r.size || 21, font: r.font || '宋体' })),
    alignment: AlignmentType.LEFT,
    spacing: { line: 360, after: 60 },
    indent: { firstLine: 420 },
  });
}

function titlePara(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 28, font: '黑体' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 100 },
  });
}

function subtitlePara(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 24, font: '黑体' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 200 },
  });
}

function sectionTitle(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 24, font: '黑体' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 100 },
  });
}

function subTitle(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 21, font: '黑体' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 120, after: 60 },
    indent: { firstLine: 420 },
  });
}

function emptyPara() {
  return new Paragraph({ children: [textRun('', { size: 21 })], spacing: { after: 40 } });
}

function tableHeaderCell(text, width) {
  return new TableCell({
    children: [new Paragraph({
      children: [textRun(text, { bold: true, size: 21, font: '黑体' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    })],
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: '#D9E2F3' },
    borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
  });
}

function tableCell(text, width) {
  return new TableCell({
    children: [new Paragraph({
      children: [textRun(text, { size: 21, font: '宋体' })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
    })],
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.SINGLE, size: 1 }, left: { style: BorderStyle.SINGLE, size: 1 }, right: { style: BorderStyle.SINGLE, size: 1 } },
  });
}

// ============================================================
// 文档内容
// ============================================================
function generateDoc() {
  const children = [];

  // 大标题
  children.push(titlePara('中小学数字化实验教学应用案例'));
  children.push(subtitlePara('教学设计方案'));
  children.push(emptyPara());

  // 基本信息
  children.push(bodyParaCenter('案例名称：《让小飞能"看"会"认"》'));
  children.push(bodyParaCenter('学科：人工智能通识课程         年级：小学三年级'));
  children.push(bodyParaCenter('课时：1课时（40分钟）         课型：探究体验课'));
  children.push(emptyPara());

  // ==================== 一、教学目标 ====================
  children.push(sectionTitle('一、教学目标'));

  children.push(subTitle('（一）科学观念'));
  children.push(bodyPara('了解图像识别技术的基本原理，知道机器通过"摄像头捕捉图像→提取特征→匹配特征→得出结果"的过程实现物体识别。认识到机器学习需要大量的数据支撑，数据的数量和质量直接影响识别效果。'));

  children.push(subTitle('（二）科学思维'));
  children.push(bodyPara('通过对比人的视觉形成过程和机器的视觉形成过程，培养类比思维能力。在发现小飞识别漏洞→分析原因→定制个性化模型的过程中，培养"发现问题→分析问题→解决问题"的计算思维和批判性思维能力。'));

  children.push(subTitle('（三）探究实践'));
  children.push(bodyPara('1. 通过虚拟实验体验"图像分类应用"，完成验证实验记录单。'));
  children.push(bodyPara('2. 通过编程实现小飞机器人的物体识别功能。'));
  children.push(bodyPara('3. 通过采集图片、标注特征、训练模型，制作个性化图像识别模型并检验识别效果。'));

  children.push(subTitle('（四）态度责任'));
  children.push(bodyPara('1. 培养小组协作完成任务的团队精神，形成良好的信息道德品质。'));
  children.push(bodyPara('2. 感受AI技术的神奇与局限，形成辩证看待人工智能技术的态度。'));
  children.push(bodyPara('3. 激发学生运用AI技术解决生活中实际问题的创新意识。'));

  // ==================== 二、教学重点与难点 ====================
  children.push(sectionTitle('二、教学重点与难点'));

  children.push(subTitle('（一）教学重点'));
  children.push(bodyPara('1. 通过编程，让小飞机器人具备"看"和"认"的能力，理解计算机识别技术。'));
  children.push(bodyPara('2. 通过体验验证实验"图像分类应用"，了解机器的"视觉"形成过程，理解摄像头捕捉图像、提取特征、匹配特征的基本流程。'));

  children.push(subTitle('（二）教学难点'));
  children.push(bodyPara('发现图像识别的漏洞（如将西红柿误认为苹果），分析原因，制作个性化图像识别数据模型，并检验改进后的识别效果。要求学生理解"训练数据不足会导致识别准确率下降"这一机器学习中的核心概念。'));

  // ==================== 三、实验资源 ====================
  children.push(sectionTitle('三、实验资源'));

  children.push(subTitle('（一）硬件设备'));
  children.push(bodyPara('1. 小飞8号机器人：配备高清摄像头、触控显示屏、超声波传感器、触摸传感器等，作为实验教学的核心终端设备。'));
  children.push(bodyPara('2. 平板电脑：每组1台，用于编程操作和AI平台访问。'));
  children.push(bodyPara('3. 未来派5传感器：可外接至小飞机器人，拓展实验功能。'));

  children.push(subTitle('（二）软件平台'));
  children.push(bodyPara('1. 畅言智AI平台（央馆人工智能课程配套平台）：提供AI图形化编程工具和Python编程工具，支撑图像识别、语音合成等AI能力的调用。'));
  children.push(bodyPara('2. 图像识别验证工具：内置在平台中，用于"图像分类应用"验证实验。'));
  children.push(bodyPara('3. 自定义模型训练功能：畅言智AI平台提供的数据采集、标注、训练模块，用于制作个性化图像识别模型。'));

  children.push(subTitle('（三）教学资源'));
  children.push(bodyPara('1. 果蔬实物：西红柿、苹果、香蕉、柚子、玉米、红薯等（每组2种）。'));
  children.push(bodyPara('2. 图像分类应用操作指导视频（数字人演示）。'));
  children.push(bodyPara('3. 实验记录单（纸质/电子）。'));
  children.push(bodyPara('4. 教学课件（PPT）。'));

  // ==================== 四、教学活动设计与实施 ====================
  children.push(sectionTitle('四、教学活动设计与实施'));

  children.push(subTitle('（一）教学活动设计流程图'));
  children.push(bodyPara('情境导入（3分钟）→ 新知学习（5分钟）→ 实验探究（8分钟）→ 编程调试（7分钟）→ 定制模型（12分钟）→ 生活应用（5分钟）'));
  children.push(bodyPara('总流程说明：从人的视觉形成过程出发，类比到机器视觉的理解，再到验证实验、编程实践，最后到发现漏洞、制作个性化模型，形成完整的认知闭环。'));

  children.push(subTitle('（二）教学活动详情'));

  // 环节一
  children.push(bodyParaBold('【环节一】情境导入，激发兴趣（3分钟）'));
  children.push(bodyPara('教师活动：展示校园劳动周项目图片（柚子、红薯、玉米、西瓜等果蔬），通过"闭上眼睛猜果蔬"小游戏，引导学生思考"我们人类是怎么认识物体的？"让学生对"看"和"认"的流程图进行排序，梳理人类识别物体的过程：眼睛看→大脑记住特征→匹配特征→认出。引出问题："小飞机器人能听会说，那它能看会认吗？"'));
  children.push(bodyPara('学生活动：观察果蔬图片，参与小游戏，思考并回答教师追问，明确本课学习任务。'));
  children.push(bodyPara('设计意图：创设校园劳动周果蔬展示情境，通过生活实例引导学生梳理人类"看"和"认"的过程，为理解图像识别原理做铺垫。'));

  // 环节二
  children.push(bodyParaBold('【环节二】新知学习，了解原理（5分钟）'));
  children.push(bodyPara(`教师活动：演示小飞机器人准确识别物体，类比人类认识过程讲解机器的"视觉"。引导学生分析小飞识别的流程图排序：摄像头捕捉图像→提取特征→匹配特征→得出结果。类比讲解："小飞没有眼睛，它靠什么'看'？（摄像头）；没有大脑，它靠什么'认'？（匹配特征）"。`));
  children.push(bodyPara('学生活动：观看演示，思考并回答提问，对小飞认出果蔬的过程进行排序，明确"看"（捕捉特征）和"认"（匹配特征）的核心概念。'));
  children.push(bodyPara('设计意图：结合人类识别过程讲解机器图像识别的基本原理，建立人与机器的类比认知，为后续实验探究奠定基础。'));

  // 环节三
  children.push(bodyParaBold('【环节三】实验探究，揭秘原理（8分钟）'));
  children.push(bodyPara('教师活动：布置验证实验——播放数字人演示视频，使用图像识别验证工具，让平板尝试识别图片。小组合作完成实验记录单（记录识别对象、识别结果）。巡回指导，提醒学生观察识别反应，重点记录识别是否准确。邀请2-3个小组展示实验记录单，小结图像识别原理。'));
  children.push(bodyPara('学生活动：小组合作完成验证实验，操作图像识别工具，仔细观察识别结果，填写实验记录单。小组展示汇报实验成果，分享发现，进一步理解图像识别原理。'));
  children.push(bodyPara('设计意图：通过验证实验让学生直观感受机器识别的过程，在动手操作中加深对原理的理解。'));

  // 环节四
  children.push(bodyParaBold('【环节四】编程调试，识别实物（7分钟）'));
  children.push(bodyPara('教师活动：引导学生思考"该怎么让小飞识别物品？"让学生找出合适的编程指令并进行编程。展示待识别物品（西红柿、苹果、香蕉、柚子等实物），每组发2种果蔬，体验小飞识别真实物品的过程。引导学生观察"有没有出现识别不准确的情况？"初步铺垫后续"漏洞发现"环节。'));
  children.push(bodyPara('学生活动：分组操作图像识别编程，体验小飞识别物品的过程，记录识别结果。观察识别效果，主动发现识别过程中可能出现的不准确情况。'));
  children.push(bodyPara('设计意图：拓展图像识别的应用场景，让学生从"体验内置模型"过渡到"发现模型局限"，为后面的核心环节制造认知冲突。'));

  // 环节五
  children.push(bodyParaBold('【环节五】发现漏洞，定制模型（12分钟）'));
  children.push(bodyPara('教师活动：引导发现漏洞——"刚才识别西红柿和苹果时，小飞经常把西红柿认成苹果？为什么会这样？"（引导学生说出：西红柿和苹果颜色、形状相似，小飞没有分清它们的特征）。讲解改进方法——使用平台的"模型训练"功能，采集更多图片、标注清楚特征，让小飞记住它们的区别（如西红柿顶部有蒂、形状更圆，苹果有凹陷等）。布置任务——小组合作，采集西红柿、苹果图片（每组至少各30张），标注特征，训练个性化模型，完成后检验识别效果。巡回指导，鼓励学生从不同角度采集图片。邀请2个小组展示个性化模型，对比改进前后效果。'));
  children.push(bodyPara('学生活动：发现漏洞、思考原因。小组合作采集图片、标注特征、训练模型。检验模型识别效果，记录改进前后结果。参与小组展示，分享操作过程和发现。'));
  children.push(bodyPara('设计意图：这是本课核心环节。让学生亲历"发现问题→分析问题→解决问题"的完整过程，在亲手训练模型的过程中深度理解"数据是AI的燃料，数据的质量和数量直接影响模型效果"这一核心理念。'));

  // 环节六
  children.push(bodyParaBold('【环节六】生活应用，总结归纳（5分钟）'));
  children.push(bodyPara(`教师活动：引导学生总结"小飞是怎么'看'和'认'的？我们还做了什么改进？"梳理图像识别的优点（速度快、识别多种物品）与局限（容易混淆相似物品，需要不断训练）。拓展人脸识别、扫码支付、垃圾分类等应用方向，鼓励课后留意生活中的AI应用。`));
  children.push(bodyPara('学生活动：回顾本课内容，总结小飞"看"和"认"的过程以及改进方法。理解图像识别的优点与局限，激发对AI技术的探究兴趣。'));
  children.push(bodyPara('设计意图：总结梳理本课核心知识，拓展应用视野，培养信息社会责任意识。'));

  // ==================== 五、教学评价 ====================
  children.push(sectionTitle('五、教学评价'));

  children.push(bodyPara('围绕本课程的学习目标开展评价，课程结束教师引导学生进行自评和互评。评价维度如下：'));

  const evalTable = new Table({
    rows: [
      new TableRow({
        children: [
          tableHeaderCell('评价内容', 60),
          tableHeaderCell('评价选项（打√表示）', 40),
        ],
      }),
      new TableRow({
        children: [
          tableCell('（1）我们小组分工明确，能够相互合作完成任务。', 60),
          tableCell('☐是   ☐部分完成   ☐不是', 40),
        ],
      }),
      new TableRow({
        children: [
          tableCell('（2）我们通过实验让机器人学会了认识水果。', 60),
          tableCell('☐是   ☐部分完成   ☐不是', 40),
        ],
      }),
      new TableRow({
        children: [
          tableCell('（3）我们通过AI训练图像分类模型，学会了定制果蔬识别。', 60),
          tableCell('☐是   ☐部分完成   ☐不是', 40),
        ],
      }),
      new TableRow({
        children: [
          tableCell('（4）在小组合作中，遇到问题我先自己想办法解决，解决不了再找同伴或老师帮忙。', 60),
          tableCell('☐是   ☐部分完成   ☐不是', 40),
        ],
      }),
      new TableRow({
        children: [
          tableCell('（5）同伴遇到问题时，能够主动提供帮助。', 60),
          tableCell('☐是   ☐部分完成   ☐不是', 40),
        ],
      }),
    ],
  });
  children.push(evalTable);
  children.push(emptyPara());

  children.push(bodyPara('此外，教师通过观察学生在实验操作、编程调试和模型训练环节的表现，进行过程性评价。在小组成果展示环节，以"模型识别准确率""改进效果对比""训练过程记录"为指标进行表现性评价。'));

  // ==================== 六、教学反思 ====================
  children.push(sectionTitle('六、教学反思'));

  children.push(bodyPara('本案例实施后取得了良好的教学效果，但也暴露出一些值得进一步改进的问题：'));

  children.push(subTitle('（一）成功之处'));
  children.push(bodyPara('1. 真实情境激发了强烈的学习动机。以学校劳动教育周的果蔬为教学素材，学生看到自己劳动成果的实物时表现出极高的学习热情和参与度。'));
  children.push(bodyPara('2. "发现漏洞→定制模型"环节成为课堂高潮。当学生发现小飞把西红柿认成苹果时的惊讶表情，到亲手训练模型后小飞准确识别时的欢呼声，充分说明了"在解决问题中学习"的教学设计是有效的、有感染力的。'));
  children.push(bodyPara('3. 深度学习的发生。课后有学生主动提问"如果我们拍更多照片（比如100张），小飞是不是能认得更准？""如果拍的东西背景太乱了，会不会影响识别？"——这些问题的提出，说明学生已经触摸到了机器学习的核心概念。'));

  children.push(subTitle('（二）改进方向'));
  children.push(bodyPara('1. 时间分配需要优化。定制模型环节（12分钟）是核心环节，但实际教学中数据采集和模型训练耗时较长，建议适当压缩前两个环节的时间，为核心环节预留更充裕的操作时间。'));
  children.push(bodyPara('2. 小组合作效率有待提升。部分小组在数据采集时缺乏分工，导致训练进度落后。后续教学应在课前设计更明确的组内分工方案，确保人人参与。'));
  children.push(bodyPara('3. 个别化指导需加强。对于编程基础较弱的学生，教师应在课前准备更详细的编程操作指南或微视频，帮助学生快速上手。'));

  children.push(subTitle('（三）专家点评'));

  children.push(bodyParaMulti([
    { text: '专家点评：', bold: true },
    { text: '本案例将抽象的人工智能原理转化为具体的实验操作活动，让学生在"做中学"中理解图像识别的核心概念。"发现漏洞→定制模型"环节的设计是亮点，它不仅是一个技术操作活动，更是一个深度学习活动——学生在这个环节中经历了"发现问题本质→提出解决方案→动手验证方案→反思优化效果"的完整思维过程。这种将机器学习模型的训练过程以适合小学生认知水平的方式呈现的教学设计，为人工智能通识课程从"浅层体验"走向"深度建构"提供了有价值的实践参考。' },
  ]));

  // ==================== 七、实践作业 ====================
  children.push(sectionTitle('七、实践作业'));

  children.push(bodyPara('1. 【基础作业】回家后观察身边的AI图像识别应用（如手机相册的人脸识别、小区门禁的人脸识别、超市的自助结账等），用拍照或画画的方式记录下来，下节课与同学分享。'));
  children.push(bodyPara('2. 【进阶作业】选择两种相似物品（如橘子和橙子、可乐和雪碧、猫和狗等），使用畅言智AI平台的模型训练功能，自己采集图片训练一个能够区分这两种物品的图像识别模型，记录训练数据和识别结果。'));
  children.push(bodyPara('3. 【拓展思考】"如果让小飞识别两种颜色、形状、大小都完全一样的物品，它能做到吗？为什么？"写一段你的思考（50-100字）。'));

  children.push(emptyPara());
  children.push(emptyPara());

  return new Document({
    title: '教学设计方案',
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  });
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('📄 正在生成教学设计方案...');
  const doc = generateDoc();
  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
  fs.writeFileSync(outputPath, buffer);

  console.log(`✅ 教学设计方案生成完成！`);
  console.log(`   文件: ${outputPath}`);
  console.log(`   大小: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => { console.error('❌ 运行出错:', err); process.exit(1); });
