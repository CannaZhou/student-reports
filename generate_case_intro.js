const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, Header, Footer, PageNumber
} = require('docx');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = '2-案例简介材料-让小飞能看会认.docx';

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
  });
}

function bodyPara(text) {
  return new Paragraph({
    children: [textRun(text, { size: 21, font: '宋体' })],
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
    children: [textRun(text, { bold: true, size: 32, font: '黑体' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
  });
}

function subtitlePara(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 24, font: '黑体' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 300 },
  });
}

function sectionTitle(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 24, font: '黑体' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 120 },
  });
}

function subSectionTitle(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 21, font: '黑体' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 120, after: 60 },
  });
}

function emptyPara() {
  return new Paragraph({ children: [textRun('', { size: 21 })], spacing: { after: 60 } });
}

// ============================================================
// 生成文档
// ============================================================
function generateDoc() {
  const children = [];

  // 封面标题
  children.push(titlePara('中小学数字化实验教学应用案例'));
  children.push(subtitlePara('案例简介材料'));
  children.push(emptyPara());
  children.push(new Paragraph({
    children: [textRun('案例名称：《让小飞能"看"会"认"》', { bold: true, size: 24, font: '宋体' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }));
  children.push(new Paragraph({
    children: [textRun('案例类型：常规案例', { size: 21, font: '宋体' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }));
  children.push(new Paragraph({
    children: [textRun('学段学科：小学三年级  人工智能通识课程', { size: 21, font: '宋体' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  // ==================== 引言 ====================
  children.push(sectionTitle('引言'));
  children.push(bodyPara('在人工智能快速融入教育领域的今天，如何让小学生不仅会"用"AI，更能深入理解其原理，成为人工智能通识课程面临的核心课题。本案例《让小飞能"看"会"认"》以小学三年级学生为教学对象，以小飞8号机器人和畅言智AI平台为核心实验装备，围绕学校劳动教育周的真实情境，设计了一节聚焦图像识别原理与模型建构的人工智能实验教学课。案例突破了传统AI教学中"重体验轻建构"的局限，让学生在"发现问题→分析问题→解决问题"的完整学习闭环中，亲历数据采集、模型训练、效果验证的全流程，实现了从"AI工具使用者"到"AI模型建构者"的角色转变。'));

  // ==================== 一、数字化实验仪器创新使用 ====================
  children.push(sectionTitle('一、数字化实验仪器的创新使用情况'));

  children.push(subSectionTitle('（一）实验装备配置'));
  children.push(bodyPara('本案例构建了以"小飞8号机器人+畅言智AI平台+平板电脑"为核心的数字化实验教学环境。小飞8号机器人配备高清摄像头、触控显示屏、超声波传感器、触摸传感器等设备，可实现图像采集、语音交互、物体识别等AI功能。畅言智AI平台（央馆人工智能课程配套平台）提供图形化编程界面和AI能力调用接口，支撑图像识别、语音合成、文字识别等技术的教学应用。平板电脑作为学生操作终端，连接小飞机器人和AI平台，实现编程、数据采集、模型训练的实时交互。'));

  children.push(subSectionTitle('（二）创新使用亮点'));
  children.push(bodyPara('亮点一：将"自定义模型训练"功能转化为教学资源。畅言智AI平台中内置了用户自定义图像识别模型的功能——允许用户建立模型、添加标签、拍摄照片、训练本地模型并应用到小飞机器人上。本案例创造性地发现了这一"隐藏"功能，并将其转化为教学资源。当学生发现小飞无法准确识别玉米、西红柿等物品时，教师引导学生利用这一功能亲手训练个性化模型，突破内置模型的限制。'));
  children.push(bodyPara('亮点二：实现"硬件+软件+数据"三位一体的实验教学。小飞机器人（硬件）提供图像采集和执行载体，AI平台（软件）提供模型训练和识别能力，学生采集的图像数据成为训练模型的"养料"。这种三位一体的教学架构让学生直观地感知到"数据是AI的燃料"这一核心理念。'));
  children.push(bodyPara('亮点三：用数字化手段实现教学过程的透明化。传统AI教学往往面临"黑箱"困境——学生看到结果却看不到过程。本案例通过自定义模型训练，将"数据采集→特征标注→模型训练→效果验证→迭代优化"的全链条展示给学生，让机器学习的过程"可见、可感、可操作"。'));

  children.push(subSectionTitle('（三）与同类方案对比'));
  children.push(bodyPara('相较于使用通用型AI工具（如豆包AI、百度AI等）进行演示教学，本案例的独特价值在于：通用工具只能展示"能识别"的结果，学生无法知其所以然；而本案例通过自定义模型训练，让学生亲历"从零训练一个图像识别模型"的过程，在数据采集中理解"数据质量"的重要性，在模型训练中理解"特征提取"的含义，在效果验证中理解"准确率"的概念。这是在"体验"基础上的"建构"，是更深层次的认知提升。'));

  // ==================== 二、教学开展情况与成效 ====================
  children.push(sectionTitle('二、教学开展情况及成效'));

  children.push(subSectionTitle('（一）教学开展情况'));
  children.push(bodyPara('本案例依托学校"校园智能讲解员"项目式课程（共5课时）开展教学，是项目第三课《让小飞能看会认1》。课程整体设计围绕学校劳动教育周产生的真实需求展开：每个班需安排学生讲解员负责介绍本班劳动项目，如何让小飞机器人来"当讲解员"成为驱动性问题。'));
  children.push(bodyPara('项目课时安排如下：第1课《让小飞能听会说》——语音识别与语音合成；第2课《小飞中英文互译》——机器翻译；第3课《让小飞能看会认1》——图像识别与自定义模型训练（本案例）；第4课《让小飞能看会认2》——文字识别；第5课《让小飞能看会认3》——人脸识别。五课时由易到难，从语音到视觉，从感知AI到建构AI，形成完整的学习闭环。'));
  children.push(bodyPara('本案例（第3课）聚焦图像识别核心技术，教学按照"发现问题→分析问题→解决问题"的主线，设计了六个逐层递进的环节：（1）情境导入，激发兴趣（3分钟）——用果蔬游戏引出"看"和"认"；（2）新知学习，学习原理（5分钟）——类比人识别物体，了解机器视觉流程；（3）实验探究，揭秘原理（8分钟）——验证实验，理解识别原理；（4）编程调试，发现问题（7分钟）——编程实现识别，发现模型局限；（5）定制模型，解决问题（12分钟）——数据采集、模型训练、效果验证（核心环节）；（6）生活应用，总结归纳（5分钟）。'));

  children.push(subSectionTitle('（二）三个关键教学场景'));

  children.push(bodyParaMulti([
    { text: '场景一：发现问题——"小飞不认识玉米"', bold: true },
    { text: '。这是全课最关键的转折点。当学生让小飞机器人识别玉米的照片，屏幕上显示"非果蔬"时，学生发出疑问："小飞怎么连玉米都不认识？"教师敏锐抓住这个教学契机，引导讨论后学生提出假设——"可能小飞的图像识别里只学过苹果和香蕉等常见的水果照片"。学生逐步明白："要让机器人认得精准，它的训练数据不仅要多，还要广。"一场从使用内置图像识别到建构自定义模型的深度学习之旅由此开启。' },
  ]));

  children.push(bodyParaMulti([
    { text: '场景二：分析问题——"我们给玉米拍照训练"', bold: true },
    { text: '。在数据采集环节，给学生发放两种果蔬实物，让学生从正面、侧面、俯视图等不同角度拍摄物品（每组至少30张）。"再多拍几个角度，照片素材多一点，机器识别更准确""这张太暗了，机器可能看不清"——学生在实践中自然建构了对数据数量、数据质量的认识和理解。不少学生感叹"原来AI也要学习才能认识东西"，这种将机器学习与人类学习进行类比的深度学习表现，正是本案例最珍贵的教学成果。' },
  ]));

  children.push(bodyParaMulti([
    { text: '场景三：解决问题——"小飞这次认识玉米了"', bold: true },
    { text: '。当小飞准确识别出玉米、西红柿时，同学们欢呼起来。学生争先恐后拿不同蔬果去测试验证自己的模型，每正确识别一项都激动地拍手欢呼。有小组发现还是无法识别花生，教师帮助分析原因——"因为拍的图片中花生占比太小，背景干扰太多"，学生在真实问题中理解了"机器学习中物体特征需要突出，数据才会精准"的核心概念。' },
  ]));

  children.push(subSectionTitle('（三）教学成效'));

  children.push(bodyPara('学生层面：本案例实施后，95%以上的学生对AI学习兴趣提升，91%的学生动手实践能力得到提高。学生从"AI工具的体验者"转变为"AI模型建构者"，在后续课程中能主动迁移知识，讨论数据数量与准确率的关系、背景干扰对识别的影响等深层次问题。近年来学校学生参加各级科技竞赛累计获奖400余人次，AI专项获奖137余项。'));
  children.push(bodyPara('教师层面：笔者参加的人工智能教学课例《让小飞能听会说》获评全国中小学人工智能教育教学"创新课例"，撰写的浙江省教育信息化研究专项课题获省级立项和结题，人工智能案例获区一等奖。笔者获评中央电化教育馆中小学人工智能教育培训师。'));
  children.push(bodyPara('模式层面：本案例形成的"发现问题→分析问题→解决问题"教学闭环模式具有可迁移性，可推广至语音识别、文字识别等更多的人工智能教学领域。'));

  // ==================== 三、六大创新体现 ====================
  children.push(sectionTitle('三、创新体现'));

  children.push(subSectionTitle('（一）实验教学理念创新'));
  children.push(bodyPara('本案例提出了"从实验中理解原理，从建构中培养思维"的核心理念，打破了"重体验轻建构"的传统AI教学范式。将"AI教学"从"观看演示"提升到"亲手建构"，让学生在解决真实问题的过程中深度理解图像识别的原理，实现了从"浅层体验"到"深度建构"的教学理念变革。'));

  children.push(subSectionTitle('（二）教学内容创新'));
  children.push(bodyPara('创造性地将平台"自定义图像识别模型训练"功能转化为教学资源，设计了从"数据采集→数据标注→模型训练→效果验证→迭代优化"的完整教学链。教学内容不再是静态的知识传递，而是动态的、基于真实问题解决的建构过程，让学生在解决"小飞认不出玉米"的真实问题中，自然地掌握图像识别的核心概念。'));

  children.push(subSectionTitle('（三）教学设计创新'));
  children.push(bodyPara('六个教学环节逐层递进，从人的视觉类比到机器视觉，从验证实验到编程实践，从发现问题到定制模型，形成完整的认知闭环。每个环节环环相扣、层层深入，符合三年级学生的认知特点和学习规律。特别是将"定制模型"环节作为教学核心，让"模型训练"这一通常在高中甚至大学才会涉及的内容，以适合小学生认知水平的方式呈现出来。'));

  children.push(subSectionTitle('（四）教学方式方法创新'));
  children.push(bodyPara('综合运用探究式、体验式、项目式等多种教学方法。以"发现问题→分析问题→解决问题"为主线，通过启发式提问（"小飞为什么把西红柿认成苹果？""我们需要怎么做才能让它们分得更清楚？"）引导学生主动思考、动手实践，教师从"知识传授者"转变为"学习引导者"，学生在"做中学"中主动建构知识。'));

  children.push(subSectionTitle('（五）考核评价创新'));
  children.push(bodyPara('采用过程性评价与表现性评价相结合的方式。以"模型识别准确率""改进效果对比""训练过程记录"为核心指标，同时关注小组合作、问题解决、创新思维等素养维度的评价。学生通过对比"改进前的识别效果"和"改进后的识别效果"，用可视化的数据见证自己的学习成果，极大地增强了学习成就感和自信心。'));

  children.push(subSectionTitle('（六）技术手段创新'));
  children.push(bodyPara('以小飞8号机器人和畅言智AI平台为核心，构建了"硬件+软件+数据"三位一体的数字化实验教学环境。技术手段的创新体现在：将教育机器人平台中隐藏的自定义模型训练功能转化为显性教学资源；通过真实任务驱动，实现AI技术的"透明化教学"；将原本"黑箱"的机器学习过程变得"可见、可感、可操作"。'));

  // ==================== 四、未来规划 ====================
  children.push(sectionTitle('四、未来规划'));

  children.push(subSectionTitle('（一）横向拓展：模型建构思路的迁移应用'));
  children.push(bodyPara('将本案例形成的"发现问题→自定义模型训练→验证效果"教学范式迁移至更多人AI教学领域。在语音识别教学中，设计方言识别模型训练任务，让学生理解语音特征提取的原理；在文字识别教学中，设计手写文字识别模型训练任务，让学生理解图像分类在不同场景下的应用。此外，可结合科学教学开展AI辅助植物分类学习、结合数学教学开展图形分类验证等跨学科融合教学。'));

  children.push(subSectionTitle('（二）纵向深化：课程体系的持续迭代'));
  children.push(bodyPara('针对不同年级学生的认知水平，研发差异化的模型建构课程。二年级可侧重"体验模型效果"，三四年级侧重"参与模型训练"，五六年级可挑战"自主设计模型方案"，形成螺旋上升的课程体系。同时，将数据伦理、算法偏见等AI伦理教育融入课程，培养学生在未来AI社会中的责任意识和批判性思维。'));

  children.push(subSectionTitle('（三）技术升级：探索更多数字化实验工具'));
  children.push(bodyPara('随着央馆AI科学实验平台等新技术的发展，探索将更多元化的数字化实验工具引入教学。如利用AI科学实验平台的虚拟实验功能开展混合式实验教学，利用物联网传感器拓展实验数据采集维度，利用大模型技术辅助学生进行更高层次的AI应用开发。学校作为中央电化教育馆中小学人工智能教育培训基地，将持续发挥示范引领作用，将本案例的经验辐射至更多区域学校。'));

  children.push(subSectionTitle('（四）成果推广：形成可复制的教学资源'));
  children.push(bodyPara('整理本案例的教学设计、任务单、编程案例、评价工具等教学资源，形成标准化的教学资源包，通过区域教研活动和教师培训平台进行推广。撰写教学案例研究论文，参与学术交流活动，为人工智能通识课程从"浅层体验"走向"深度建构"提供可迁移的实践路径。'));

  // ==================== 结语 ====================
  children.push(sectionTitle('结语'));
  children.push(bodyPara('《让小飞能"看"会"认"》案例以"轻量创新、深度建构"为特色，利用现有的教育机器人平台和AI技术，以最小的技术成本实现了最大的教学效益。它证明了在小学人工智能通识课程中，学生完全可以从"体验AI"走向"建构AI"，在解决真实问题的过程中深入理解人工智能的核心概念。本案例为人工智能教育的校本化实施提供了一种低成本、高效率、可复制的实践样本。'));

  return new Document({
    title: '案例简介材料',
    styles: { default: { document: { run: { size: 21 } } } },
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

  console.log('📄 正在生成案例简介材料...');
  const doc = generateDoc();
  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
  fs.writeFileSync(outputPath, buffer);

  console.log(`✅ 案例简介材料生成完成！`);
  console.log(`   文件: ${outputPath}`);
  console.log(`   大小: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => { console.error('❌ 运行出错:', err); process.exit(1); });
