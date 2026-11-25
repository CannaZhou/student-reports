# AI知识竞赛答题系统

面向约 30 名小学生的线上答题系统：**50 天打卡闯关**（每天 50 题、每题 2 分、自动批改、错题本）+ **分类自由练习** + **班级排行榜**；教师端可导入题目、管理名单、查看每个学生的答题情况。

题库为 500 题 + 2000 题两套合并去重后的 **2483 题**（6 篇章 / 28 单元），零第三方依赖（只用 Node 内置模块），整个 `app/` 目录可整体拷贝到任何一台装了 Node 的电脑上运行。

## 一、快速开始（本机）

```bash
# 1. 需要 Node.js（v18 及以上，建议 v20+）
node -v

# 2. 进入应用目录启动
cd _ai_quiz/app
node server.js
```

看到 `AI知识竞赛答题系统 已启动` 后：

- **学生端**：浏览器打开 `http://localhost:8080`（或 `http://localhost:8080/student`）
- **教师端**：打开 `http://localhost:8080/teacher`

局域网内其他电脑访问：把 `localhost` 换成运行本程序电脑的局域网 IP（见下方"局域网使用"）。

## 二、使用说明

### 学生端

- **登录**：输入自己的名字 + 密码 `zqxx2025`（密码在 `config.js` 里可改，`defaultStudentPassword`）
- **每日打卡**：闯关式，第 1 天 → 第 2 天 → …共 50 天，每天 50 题。做完第 N 天自动解锁第 N+1 天；题目由系统按学生当天"种子"固定，刷新不换题，当天未提交不浪费题库（提交成功才记入已做）
- **分类练习**：按 6 篇章 / 28 单元随机抽 20 题自由练习，不占用打卡进度
- **错题本**：答错的题自动进入，做对自动减少，答错累积次数；可一键"重做错题"
- **排行榜**：全班按"完成天数 → 总分"排名，学生可见

### 教师端（独立密码）

首次进入会提示**设置教师密码**（请牢记）。登录后共 5 个页面：

| 页面 | 功能 |
|---|---|
| 📊 总览 | 全班完成天数 / 总分 / 正确率 / 错题数 |
| 📋 学生名单 | 网页直接添加（逗号/空格/换行分隔）、Excel 上传（需含"姓名"列）、停用 |
| 📚 题目管理 | **三种方式导入**：Excel(.xlsx，需表头：题干、选项A-D、答案、解析) / Word题库(.docx，与现有题库格式一致) / 网页直接新增；支持检索与删除 |
| 🔍 学生详情 | 选择学生 → 逐日成绩 + 错题明细 |
| ⚙️ 设置 | 修改教师密码 |

## 三、目录结构

```
app/
├─ server.js            # 入口（启动自检 + 静态托管 + 路由）
├─ config.js            # 端口 / 50天 / 每天50题 / 每题2分 / 学生密码
├─ core/                # 判分 / 选题 / 会话 / 存储 / 导入解析
├─ routes/              # 学生API / 教师API / 静态文件
├─ public/              # 前端页面（原生JS，无构建）
├─ data/                # 运行时数据：题库 + 学生 + 教师 + 每人进度
├─ content/             # 名家绘本书目 library.json / 小测题 library-quizzes.json（入库）
├─ media/books/         # 名家绘本漫画页（约 76MB，不入库，见第七节）
├─ lib/                 # 离线拷贝的 xlsx / jszip（导入文件解析用）
└─ README.md
```

## 四、数据与备份

所有数据都是 `app/data/` 下的 JSON 文件，**备份只需拷贝整个 `data/` 目录**（建议每天结束时复制一份）。

```
app/data/
├─ bank.json            # 题库（2483 题，含教师新导入的 custom 题）
├─ students.json        # 学生名单 + 学生共享密码哈希
├─ teacher.json         # 教师密码哈希 + 打卡参数
├─ secret               # 会话签名密钥（生成后勿删除，删除会导致所有登录失效）
└─ progress/            # 每个学生一个文件：打卡进度/错题/成绩
```

### 从备份恢复

1. 停止服务（Ctrl+C）
2. 用备份的 `data/` 覆盖当前 `app/data/`
3. 重新 `node server.js`

> 注意：`secret` 首次启动自动生成；若删除，学生/教师只需重新登录即可（进度数据不受影响）。

## 五、局域网使用（学生电脑访问）

学生电脑与教师电脑连同一个 WiFi/局域网：

1. 查教师电脑 IP：`ipconfig` 里找 IPv4 地址（如 `192.168.1.100`）
2. 学生浏览器打开 `http://192.168.1.100:8080`
3. 若访问不通：Windows 防火墙放行端口 8080（"允许应用通过防火墙"→ 添加入站规则，允许 TCP 8080）

## 六、公网部署（学生在家也能访问）

> 当前采用 **cloudflared 固定命名隧道 + 自有域名**，公网地址固定为 **https://ai.aizqxx.top**，重启不变。教师端「📊 总览」→"公网访问"面板已默认填好该地址，点"生成二维码"发给班级群即可。
>
> 适合"学生（家长）用手机相机扫码 / 复制到浏览器打开"。**注意：不要让学生在微信里直接点链接**，微信会拦截未备案的境外域名，要用相机扫码或复制到 Chrome/Safari。

### 固定隧道（当前在用，地址不变）

1. 下载 cloudflared（Windows）：`winget install Cloudflare.cloudflared`（失败用镜像：`curl -L -o cloudflared.exe "https://gh-proxy.com/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"`）
2. 登录授权（首次）：`cloudflared tunnel login` → 浏览器授权，证书写到 `C:\Users\admin\.cloudflared\cert.pem`
3. 建隧道并绑定域名（域名先在 Cloudflare DNS 解析到该账号）：
   ```
   cloudflared tunnel create aizqxx
   cloudflared tunnel route dns aizqxx ai.aizqxx.top
   ```
   配置 `C:\Users\admin\.cloudflared\config.yml`：
   ```yaml
   tunnel: <隧道ID>
   credentials-file: C:/Users/admin/.cloudflared/<隧道ID>.json
   ingress:
     - hostname: ai.aizqxx.top
       service: http://localhost:8080
     - service: http_status:404
   ```
4. **保持答题服务器运行**（`node server.js`），启动隧道：`cloudflared tunnel run aizqxx`
5. 验证：浏览器打开 `https://ai.aizqxx.top` 能访问即成功；教师端"公网访问"面板生成二维码发班级群

一键启停：双击 `启动答题系统.bat` 会自动检测并拉起 node + 固定隧道并弹窗给出地址（详见 `tools/start_quiz.ps1`）。

⚠️ 注意：
- **教师电脑需保持开机、隧道常驻**，关机/断网则链接失效；重启电脑后重新点一键启动即可
- 若扫码慢/连不上（运营商限制 UDP），可给 cloudflared 加 `--protocol http2`

### 方式二：云服务器（学生必须微信里直接点开才需要）

微信内置浏览器会拦截未备案的境外域名，所以"微信里直接点开"必须走国内云服务器 + 备案域名：
1. **服务器**：任一云服务器（如阿里云/腾讯云轻量应用），装 Node.js ≥18
2. **上传**：把整个 `_ai_quiz/app/` 目录拷到服务器（如 `/opt/quiz/app/`）
3. **放行端口**：云控制台安全组 + 服务器防火墙都放行 TCP 8080
4. **域名 + ICP 备案**：购买域名并完成备案（约 1~2 周）
5. **用 Caddy 加 HTTPS**（推荐）：
   ```bash
   # 安装 Caddy 后创建 Caddyfile：
   #   quiz.example.com {
   #     reverse_proxy 127.0.0.1:8080
   #   }
   ```
6. **守护进程**（关掉终端服务不中断）：Windows 用 `nssm`，Linux 用 `systemd`
7. **改密码**：上线后第一时间在教师端 ⚙️ 设置里修改教师密码

## 七、名家绘本馆（未来侦探团）

阅读馆（`/reading.html`）书架下方新增一组**已出版漫画书**，与原创绘本《小AI探险队》完全独立（两套进度、两套数据互不影响）。

| 入口 | 地址 |
|---|---|
| 书架 | `/reading.html`（登录后，「📚 名家绘本 · 未来侦探团」四本立体封面） |
| 书目页 | `/library.html?id=fd-ai`（8 章列表 + 解锁状态 + 打卡记录） |
| 阅读器 | `/reader.html?id=fd-ai&ch=1`（翻页 / 目录 / 打卡） |

四本书 id：`fd-ai` 人工智能篇、`fd-sat` 卫星篇、`fd-data` 大数据篇、`fd-disaster` 防灾救灾篇。

**规则**：每本 8 章；第 1 章直接可读，**翻到本章最后一页并点「我读完啦」**（可写一句感想，200 字以内）才解锁下一章。解锁状态由服务端每次实时计算（不存"已解锁"字段），前端藏按钮不算数，未解锁章节的图片接口直接 403。

**版权**：4 本均为正式出版物。漫画页放在 `app/media/books/`（**故意不在 `public/` 下**），只能通过登录后的 `/api/library/page/...` 读取，带一年私有缓存头；页面加 `noindex`。这是提高门槛，不是保证——正式对外发布前需要出版社授权。

### 内容文件

| 文件 | 说明 | 入库 |
|---|---|---|
| `app/content/library.json` | 书目清单：书名 / ISBN / 作者 / 每章页数 / `rev` | ✅ |
| `app/content/library-quizzes.json` | 每章小测题目（初始为空，老师后续添加） | ✅ |
| `app/media/books/<id>/{cover,chNN/NNN}.webp` | 漫画页，约 76MB | ❌（`.gitignore`） |

`library.json` 与 `books.json` 一样**只在启动时读一次**：改书名、章节名、页数后要重启 8080。打卡与做题是即时落盘，不用重启。

### 重建图片

源文件（EPUB ×3 + PDF ×1）在
`f:\桌面\临时存放\桌面所有图标\2025年师生共读书本活动\阅读之路启动\`（建议另存一份到 `F:\cursor20260624\_books_src\`，临时目录会被清理）。

```bash
cd _ai_quiz
python -I tools/build_library.py            # 增量：已存在的页跳过
python -I tools/build_library.py --rebuild  # 全量重压（换参数后用这个）
python -I tools/build_library.py --dry-run  # 只算体积，不写文件
```

依赖 Python 3.7 + PyMuPDF + Pillow。重建会自动更新 `library.json` 的 `rev`，图片 URL 里的 `?v=` 随之变化，浏览器自动取新图。构建报告写在 `tools/_library_build_report.txt`。

### 验收

```bash
node tools/smoke_library.js   # 隔离实例 8082，临时数据，47 项断言（不碰线上数据/真实题目）
node _verify_library.js       # 隔离实例 8083 + 无头 Edge，截图到 _shots/lib-*.png
```

### 小测（第二阶段）

后端已就绪：`GET/PUT /api/teacher/library/quiz/:bookId/:no` 存题，`GET /api/library/book/:id/chapter/:no/quiz` 与 `POST .../quiz/submit` 给学生做题（复用 `core/grade.js`，支持单选/判断/多选/填空）。
**教师端出题页面还没做**——要加题时先直接编辑 `app/content/library-quizzes.json`（格式见 `core/library.js` 的 `getQuiz`），或等下一阶段补上「📖 绘本题目」页签。

## 八、维护

- **换题目**：教师端"题目管理"导入即可，自动合并进现有题库；误删的题可用备份恢复
- **加学生**：教师端"学生名单"随时添加，新学生用同样密码 `zqxx2025` 登录即可
- **改打卡规则**：编辑 `config.js`（`totalDays` 天数 / `daySize` 每天题数 / `scorePerQuestion` 每题分 / `defaultStudentPassword` 学生密码），改后重启生效
- **常见问题**
  - 端口被占用：改 `config.js` 的 `port`
  - 学生反映题目"做过又出现"：这是"兜底复用"，只在题库耗尽（约第 50 天）后出现
  - 忘了教师密码：删除 `app/data/teacher.json`，重启后重新设置
