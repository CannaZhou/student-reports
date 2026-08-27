const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageNumber, PageBreak, TabStopPosition, TabStopType
} = require('docx');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = '1-案例申报书-让小飞能看会认.docx';

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
    ...(opts.color ? { color: opts.color } : {}),
  });
}

function para(text, opts = {}) {
  const runs = [];
  if (typeof text === 'string') {
    runs.push(textRun(text, opts));
  } else if (Array.isArray(text)) {
    text.forEach(t => {
      if (typeof t === 'string') runs.push(textRun(t));
      else runs.push(textRun(t.text, t));
    });
  }
  return new Paragraph({
    children: runs,
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: opts.spacing || { line: 360, after: 60 },
    indent: opts.indent,
    heading: opts.heading,
    ...(opts.firstLineIndent ? { indent: { firstLine: opts.firstLineIndent } } : {}),
  });
}

function heading1(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 28, font: '黑体' })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
  });
}

function heading2(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 24, font: '黑体' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 160, after: 100 },
  });
}

function heading3(text) {
  return new Paragraph({
    children: [textRun(text, { bold: true, size: 21, font: '黑体' })],
    alignment: AlignmentType.LEFT,
    spacing: { before: 120, after: 60 },
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

function bodyParaNoIndent(text) {
  return new Paragraph({
    children: [textRun(text, { size: 21, font: '宋体' })],
    alignment: AlignmentType.LEFT,
    spacing: { line: 360, after: 60 },
  });
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

const CONTENT = {
  caseName: '让小飞能"看"会"认"',
  caseType: '常规案例',
};

function generateDoc() {
  const children = [];

  // ==================== 正文开始 ====================

  // 标题
  children.push(heading1('全国师生数字素养提升实践活动'));
  children.push(heading1('科学教育专项（中小学数字化实验教学应用案例）'));
  children.push(heading1('申报书'));

  children.push(para('', { spacing: { after: 200 } }));

  // 基本信息表
  const basicInfoTable = new Table({
    rows: [
      new TableRow({
        children: [
          tableCell('案例名称', 20),
          tableCell(CONTENT.caseName, 80),
        ],
      }),
      new TableRow({
        children: [
          tableCell('案例类型', 20),
          tableCell(CONTENT.caseType, 80),
        ],
      }),
      new TableRow({
        children: [
          tableCell('案例负责人', 20),
          tableCell('[姓名]', 80),
        ],
      }),
      new TableRow({
        children: [
          tableCell('学校名称', 20),
          tableCell('[学校名称]', 80),
        ],
      }),
    ],
  });
  children.push(basicInfoTable);
  children.push(para('', { spacing: { after: 200 } }));

  // 负责人信息表
  children.push(heading3('案例负责人信息'));
  const personInfoTable = new Table({
    rows: [
      new TableRow({
        children: [
          tableHeaderCell('姓名', 12), tableCell('[姓名]', 12),
          tableHeaderCell('性别', 12), tableCell('[性别]', 12),
          tableHeaderCell('出生年月', 12), tableCell('[年月]', 12),
          tableHeaderCell('职称', 12), tableCell('[职称]', 12),
        ],
      }),
      new TableRow({
        children: [
          tableHeaderCell('职务', 12), tableCell('[职务]', 12),
          tableHeaderCell('学历', 12), tableCell('[学历]', 12),
          tableHeaderCell('专业', 12), tableCell('[专业]', 12),
          tableHeaderCell('联系电话', 12), tableCell('[电话]', 12),
        ],
      }),
      new TableRow({
        children: [
          tableHeaderCell('邮箱', 12),
          tableCell('[邮箱]', 88),
        ],
      }),
    ],
  });
  children.push(personInfoTable);
  children.push(para('', { spacing: { after: 200 } }));

  // 团队成员信息
  children.push(heading3('案例团队其他成员信息（不超过2人）'));
  const teamHeader = new TableRow({
    children: [
      tableHeaderCell('序号', 10),
      tableHeaderCell('姓名', 18),
      tableHeaderCell('出生年月', 18),
      tableHeaderCell('学历', 18),
      tableHeaderCell('职称/职务', 18),
      tableHeaderCell('联系电话', 18),
    ],
  });

  const teamRow1 = new TableRow({
    children: [
      tableCell('1', 10),
      tableCell('[姓名]', 18),
      tableCell('[年月]', 18),
      tableCell('[学历]', 18),
      tableCell('[职称]', 18),
      tableCell('[电话]', 18),
    ],
  });

  const teamRow2 = new TableRow({
    children: [
      tableCell('2', 10),
      tableCell('', 18),
      tableCell('', 18),
      tableCell('', 18),
      tableCell('', 18),
      tableCell('', 18),
    ],
  });

  children.push(new Table({ rows: [teamHeader, teamRow1, teamRow2] }));
  children.push(para('', { spacing: { after: 300 } }));

  // ==================== 一、案例特色和创新点 ====================
  children.push(heading2('一、案例特色和创新点'));

  children.push(bodyPara('本案例《让小飞能"看"会"认"》是小学三年级人工智能通识课程中的图像识别教学案例，以小飞8号机器人和畅言智AI平台为主要数字化实验工具，围绕学校劳动教育周的真实情境展开教学。案例最大的特色在于——突破"浅层体验"，走向"深度建构"，让学生从"使用AI工具"转变为"建构AI模型"，在解决真实问题的过程中深度理解图像识别的基本原理。'));

  children.push(heading3('（一）实验教学理念创新'));
  children.push(bodyPara('本案例提出了"从实验中理解原理，从建构中培养思维"的核心理念。传统的人工智能图像识别教学往往止步于让学生体验AI工具"能识别"的神奇效果，而本案例通过"发现问题→分析问题→解决问题"的教学闭环，引导学生从"AI工具的体验者"转变为"AI模型的建构者"。当学生发现小飞机器人无法准确识别玉米、西红柿等真实果蔬时，教师不是直接告诉答案，而是引导学生分析原因、动手采集数据、训练个性化图像识别模型，在真实的实验过程中建构对机器学习原理的理解。'));

  children.push(heading3('（二）教学内容创新'));
  children.push(bodyPara('本案例教学内容围绕"图像识别模型建构"这一核心展开，打破了"见好就收"的教学惯例。在常规教学中，当内置AI图像识别模型无法识别特定物品时，教师通常会"分析问题"后止步于此，转而使用通用型AI工具演示。本案例却创造性地将畅言智AI平台中的"自定义图像识别模型训练"功能转化为教学资源，设计了从"数据采集→数据标注→模型训练→效果验证→迭代优化"的完整教学链，让学生在真实的问题情境中经历机器学习模型建构的全流程。'));

  children.push(heading3('（三）教学设计创新'));
  children.push(bodyPara('本案例设计了六个逐层递进的教学环节：情境导入（3分钟）→新知学习（5分钟）→实验探究（8分钟）→编程调试（7分钟）→定制模型（12分钟）→生活应用（5分钟）。教学流程采用"体验式学习+项目式学习"融合模式，从人的视觉形成过程类比出发，过渡到机器视觉原理的理解，再从验证实验到编程实践，最后到发现问题、制作个性化模型，形成完整的认知闭环。特别是在"定制模型"环节，学生亲历数据采集、标注、训练、验证的全过程，实现了深度学习。'));

  children.push(heading3('（四）教学方式方法创新'));
  children.push(bodyPara('本案例综合运用了讲授式、探究式、体验式等多种教学方法。在实验探究环节，学生以小组合作形式操作图像识别工具，亲身体验机器"看"的过程；在定制模型环节，学生以项目化学习方式完成数据采集、模型训练、效果检验的全流程，教师从"知识传授者"转变为"学习引导者"。学生通过"做中学"主动建构知识，计算思维、批判性思维和创造性解决问题的能力得到全面提升。'));

  children.push(heading3('（五）考核评价创新'));
  children.push(bodyPara('本案例注重过程性评价与表现性评价相结合。设置了包含五项维度的评价量表，涵盖小组合作、实验操作、模型建构、问题解决和同伴互助等方面。同时，学生在小组展示环节展示个性化模型的训练过程和检验效果，通过"识别成功率"等量化指标和"改进前后对比"等质性分析相结合的方式进行评价，全面反映学生的知识获得和能力发展。'));

  children.push(heading3('（六）技术手段创新'));
  children.push(bodyPara('本案例以小飞8号机器人（含摄像头、传感器、触控显示屏）为核心实验装备，配合畅言智AI平台（央馆人工智能课程配套平台）和平板电脑，构建了完整的数字化实验教学环境。技术手段的创新主要体现在：一是将教育机器人平台中隐藏的"自定义模型训练"功能转化为显性的教学资源；二是通过任务驱动实现"硬件（机器人）+软件（AI平台）+数据（学生采集的图像）"三位一体的实验教学；三是将AI技术的"黑箱"透明化，让学生在采集数据、训练模型的过程中直观理解"数据→算法→模型→应用"的技术链路。'));

  // ==================== 二、目标和实施过程 ====================
  children.push(heading2('二、目标和实施过程'));

  children.push(heading3('（一）教学背景与问题分析'));
  children.push(bodyPara('本案例依托学校"校园智能讲解员"项目式课程（共5课时），聚焦"图像识别"这一核心技术。在教学实践中发现：系统内置的图像识别模块仅能识别苹果、香蕉、西瓜等少数常见水果，对于劳动教育周中常见的玉米、柚子、西红柿、花生、红薯等农作物却无法准确识别。这一局限并非个例，而是当前教育类AI产品普遍面临的共性问题。在常规教学中，面对这一困境，多数教师止步于"分析问题"，教学效果大打折扣。本案例正是在这一背景下，将平台开放的"自定义图像识别模型"功能转化为教学资源，让学生亲自采集数据、训练模型，真正理解图像识别的原理。'));

  children.push(heading3('（二）教学目标'));
  children.push(bodyPara('1. 通过虚拟实验体验"图像分类应用"，对比人的视觉形成过程，解释机器的"视觉"形成过程，培养计算思维。'));
  children.push(bodyPara('2. 通过编程实践，让小飞机器人具备"看"和"认"的能力，实现小飞机器人的物体识别功能。'));
  children.push(bodyPara('3. 在小飞识别物体的过程中，发现识别不准确的缺陷，定制个性化的物体识别训练模型，能将计算机识别技术拓展应用到实际生活中，培养创造性解决问题的能力，形成数字化学习与创新意识。'));
  children.push(bodyPara('4. 培养小组协作完成任务的团队精神，形成良好的信息道德品质。'));

  children.push(heading3('（三）实验教学环境建设'));
  children.push(bodyPara('学校自2019年以来持续深耕人工智能教育领域，2021年获评区首批人工智能实验校，2022年获评浙江省"人工智能+教育"试点校，2025年获评中央电化教育馆中小学人工智能教育培训基地和第四批"央馆人工智能课程"规模化应用试点校。学校已构建覆盖普及课、特色课、专项课的三维课程体系，累计建成4间人工智能专用教室。'));
  children.push(bodyPara('本案例实验教学环境包括：（1）小飞8号机器人（含摄像头、触控显示屏、传感器、电控手臂等）；（2）畅言智AI平台（提供图像识别、语音合成、文字识别等AI能力）；（3）科大讯飞AI图形化编程工具；（4）平板电脑（每组1台）；（5）校园劳动教育周采摘的果蔬实物（玉米、柚子、西红柿、苹果、香蕉等）。'));

  children.push(heading3('（四）教学活动设计（六个环节）'));

  children.push(heading3('环节一：情境导入（3分钟）'));
  children.push(bodyPara('展示校园劳动周项目图片（柚子、红薯、玉米、西瓜等果蔬），通过"闭上眼睛猜果蔬"的小游戏，引导学生梳理人类"看"和"认"的过程——眼睛看→大脑记特征→匹配特征→认出。由此引出本课主题"让小飞能看会认"——小飞机器人能否像人一样看和认？'));

  children.push(heading3('环节二：新知学习（5分钟）'));
  children.push(bodyPara('演示小飞机器人准确识别物体，类比人类认识过程，引导学生分析小飞的"看"（摄像头捕捉图像）和"认"（提取特征→匹配特征→得出结果）的流程，初步建立机器视觉的概念。'));

  children.push(heading3('环节三：实验探究（8分钟）'));
  children.push(bodyPara('播放数字人演示视频，学生以小组合作形式使用平板上的图像识别工具进行验证实验，记录识别对象和识别结果。通过实验直观感受机器识别过程，加深对图像识别原理的理解。'));

  children.push(heading3('环节四：编程调试（7分钟）'));
  children.push(bodyPara('学生分组编程，让小飞机器人识别西红柿、苹果、香蕉等实物，体验图像识别应用。引导学生观察"有没有出现识别不准确的情况？"铺垫后续"漏洞发现"环节。'));

  children.push(heading3('环节五：定制模型（12分钟）'));
  children.push(bodyPara('这是本课核心环节。引导学生发现小飞将西红柿和苹果混淆的问题，分析原因（颜色、形状相似，训练数据不足）。布置任务：小组合作使用畅言智AI平台的"模型训练"功能，采集西红柿和苹果的图片（每组至少各30张），标注特征，训练个性化模型，完成后检验识别效果，记录改进前后对比。'));

  children.push(heading3('环节六：生活应用（5分钟）'));
  children.push(bodyPara('总结图像识别的优点与局限，拓展人脸识别、扫码支付、垃圾分类等应用方向，激发学生对AI技术的进一步探究兴趣。'));

  children.push(heading3('（五）教学方法'));
  children.push(bodyPara('本案例综合运用探究式、体验式、项目式等教学方法。以"发现问题→分析问题→解决问题"为主线，学生在真实情境中通过动手实验、编程实践、模型训练等方式主动建构知识。教师采用启发式提问引导学生思考，如"小飞为什么把西红柿认成苹果？""我们需要怎么做才能让它们分得更清楚？"等，促进学生的批判性思维发展。'));

  children.push(heading3('（六）评价方法'));
  children.push(bodyPara('采用过程性评价与表现性评价相结合的方式。过程性评价关注学生在实验操作、编程实践、小组合作中的表现；表现性评价以小组展示个性化模型为核心，从"模型识别准确率""改进效果对比""训练过程记录"三个维度进行评价。同时引导学生进行自评，从小组分工合作、实验完成度、问题解决能力、同伴互助等方面反思自己的学习过程。'));

  // ==================== 三、教学效果 ====================
  children.push(heading2('三、教学效果'));

  children.push(heading3('（一）学生层面：素养提升显著'));
  children.push(bodyPara('本案例实施后，学生的学习从"AI能认识物品太神奇啦"的被动体验，转变为"AI同样需要学习，我们可以给它足够多、质量好的照片教它准确认识物品"的主动建构。学生建立了对机器学习基本原理的深层次理解，在后续课程中能主动迁移知识，讨论"训练模型时照片数量对准确率的影响""拍照时背景干扰对识别结果的影响"等深层次问题。'));
  children.push(bodyPara('课题数据显示：课程实施后95%以上的学生对AI学习兴趣提升，91%的学生动手实践能力得到提高。学生从"AI工具的使用者"转变为"AI工具开发的主动建构者"，逐渐养成了"发现问题→分析问题→解决问题"的思维素养。近年来，学校积极组织学生参加各级科技竞赛，累计获奖400余人次，AI专项获奖137余项，包括NOC AI天工造物全国决赛一等奖、浙江省学生信息素养提升实践活动"智能博物"项目一等奖等。'));

  children.push(heading3('（二）教师层面：专业成长迅速'));
  children.push(bodyPara('在人工智能通识课程教学中，面临的难题激发了教师勇于突破困境的动力。笔者参加的人工智能教学课例《让小飞能听会说》获评全国中小学人工智能教育教学"创新课例"。此外，教学实践也促成了科研成果的积累，撰写的浙江省教育信息化研究专项课题《人工智能教育的课程设计与实施研究——以J市X小学为例》（编号2024ETC025）获省级立项和结题、市三等奖、区一等奖。人工智能案例《让机器"听"懂校园：人工智能赋能小学AI实验教学实践》获区一等奖。笔者还获评中央电化教育馆中小学人工智能教育培训师等荣誉。'));

  children.push(heading3('（三）教学模式：可迁移性强'));
  children.push(bodyPara('本案例从"分析问题"到"解决问题"的教学闭环模式具有很强的可迁移性。从图像识别领域出发，可以将"发现问题→自定义模型训练→验证效果"的教学范式推广至语音识别模型建构、文字识别模型训练等其他人工智能教学领域，为小学人工智能通识课程从"浅层体验"走向"深度建构"提供了一条可迁移的实践路径。'));

  // ==================== 四、总结反思 ====================
  children.push(heading2('四、总结反思'));

  children.push(heading3('（一）本案例的成功经验'));
  children.push(bodyPara('第一，真实情境驱动学习。以学校劳动教育周讲解任务为驱动，学生在真实需求中产生学习动机，学习目标明确、内在动力强。第二，"做中学"促进深度学习。学生通过亲手采集数据、训练模型，将抽象的机器学习原理转化为具象的操作经验，实现了从感性认识到理性认识的飞跃。第三，技术赋能教学创新。畅言智AI平台的自定义模型训练功能为教学提供了技术支撑，使得"发现AI局限→突破AI局限"的教学设计从愿景变为现实。'));

  children.push(heading3('（二）存在的局限'));
  children.push(bodyPara('第一，自定义模型训练高度依赖平台技术支持，并非所有教育机器人平台都开放此功能，推广需要根据具体平台进行适配。第二，本案例以三年级学生为学习对象，学生对机器学习原理的理解还停留在概念层面，课程深度需随年龄递进进一步拓展延伸。第三，受限于课时安排，模型训练的数据采集量有限（每组约30张），在实际的机器学习应用中，更大量的数据训练效果更佳。'));

  children.push(heading3('（三）未来规划'));
  children.push(bodyPara('第一，将模型建构思路迁移至更多教学领域，如语音识别教学中的方言识别模型训练、文字识别教学中的手写文字识别模型训练等。第二，探索跨学科融合应用，将图像识别技术与科学、数学等学科结合，如用图像识别技术辅助植物分类学习、用模型训练验证数学图形分类等。第三，深入研究人工智能教育中"从体验到建构"的教学策略，形成可推广的教学模式，为更多学校和教师提供参考。第四，持续关注央馆AI科学实验平台等新技术的发展，适时引入更多元的数字化实验工具，丰富实验教学手段。'));

  // ==================== 签字栏 ====================
  children.push(para('', { spacing: { before: 400 } }));
  children.push(para('', { spacing: { before: 200 } }));
  children.push(para('本人承诺以上申报内容的真实性，符合申报要求以及相关法律法规。同意主办单位使用作品知识产权和出版；同意在应用推广过程中配合主办方要求对作品进行完善、提升与改进。', { spacing: { line: 360, after: 200 } }));

  children.push(para('', { spacing: { before: 300 } }));
  children.push(bodyParaNoIndent('案例负责人签字：____________________'));
  children.push(para('', { spacing: { after: 40 } }));
  children.push(bodyParaNoIndent('年    月    日'));

  return new Document({
    title: '案例申报书',
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

  console.log('📄 正在生成案例申报书...');
  const doc = generateDoc();
  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
  fs.writeFileSync(outputPath, buffer);

  console.log(`✅ 案例申报书生成完成！`);
  console.log(`   文件: ${outputPath}`);
  console.log(`   大小: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(err => { console.error('❌ 运行出错:', err); process.exit(1); });
