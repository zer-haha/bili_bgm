# BiliBGM Pro

B站视频/BGM 下载 Chrome 浏览器插件，支持音频 MP3/M4A、视频 MP4 下载，批量多P下载，高清画质选择。

## 功能特性

- **BGM/音频下载** - 支持 M4A (纯浏览器) 和 MP3 (增强模式)
- **视频下载** - 支持 MP4/M4S，可选画质 (360P~4K)
- **多P批量下载** - 支持当前P/全选/指定P批量下载
- **高画质/音质选择** - 支持最高可用画质/音质
- **增强模式** - 本地 FFmpeg 转码 MP3、合并 MP4
- **现代 UI** - 深色/浅色自适应，B站粉色主题，毛玻璃效果
- **悬浮按钮** - B站视频页悬浮快捷下载按钮 (可拖拽)
- **任务管理** - 下载任务列表，状态/进度追踪

## 项目结构

```
bilibgm-pro/
├── package.json          # 依赖配置
├── vite.config.ts        # Vite 构建配置
├── tsconfig.json         # TypeScript 配置
├── tailwind.config.js    # Tailwind CSS 配置
├── popup.html            # Popup 入口 HTML
├── options.html          # 设置页入口 HTML
├── public/
│   ├── manifest.json     # Chrome Extension Manifest V3
│   ├── icons/            # 插件图标
│   └── content/          # Content Script CSS
├── src/
│   ├── background/       # Service Worker (后台逻辑)
│   ├── content/          # Content Script (悬浮按钮)
│   ├── popup/            # Popup UI (React)
│   │   ├── App.tsx       # 主应用组件
│   │   ├── MainPanel.tsx # 主面板 (流列表+下载)
│   │   └── styles.css    # Tailwind + 自定义样式
│   ├── options/          # 独立设置页
│   ├── core/             # 核心业务逻辑
│   │   ├── bilibiliApi.ts    # B站API封装
│   │   ├── parser.ts         # URL解析 (BV/AV/EP/SS)
│   │   ├── streamSelector.ts # 音视频流选择
│   │   ├── downloader.ts     # 下载器
│   │   ├── filename.ts       # 文件名生成
│   │   └── taskManager.ts    # 任务管理
│   ├── native/           # Native Messaging 通信
│   └── types/            # TypeScript 类型定义
└── native-host/          # 本地增强组件
    ├── src/index.ts      # Native Host 主程序
    ├── install-host.bat  # Windows 安装脚本
    └── uninstall-host.bat# Windows 卸载脚本
```

## 安装与使用

### 前置要求

- **Node.js** >= 18
- **Chrome** >= 110 (支持 Manifest V3)

### 1. 构建插件

```bash
cd bilibgm-pro

# 安装依赖
npm install

# 构建
npm run build
```

构建产物在 `dist/` 目录。

### 2. 加载插件到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist/` 目录
5. 插件图标出现在工具栏，点击固定

### 3. 使用插件

1. 打开任意 B站视频页或番剧页
2. 点击工具栏上的 BiliBGM Pro 图标
3. 插件自动识别视频信息 (标题/UP主/BV号/封面)
4. 点击快捷按钮下载：
   - **下载 BGM** - 下载音频 (M4A 或 MP3)
   - **下载 M4A** - 直接下载 M4A 音频
   - **下载视频 MP4** - 下载视频
   - **复制链接** - 复制视频直链
5. 展开「高级选项」可手动选择音质/画质/分P

### 4. 安装增强组件 (可选，用于 MP3 转码)

如果需要 MP3 格式或 MP4 合并功能：

#### 4.1 安装 FFmpeg

1. 下载 FFmpeg: https://ffmpeg.org/download.html
2. 解压并将 `ffmpeg.exe` 所在目录添加到系统 PATH
3. 验证: 打开命令行输入 `ffmpeg -version`

#### 4.2 安装 Native Host

```bash
cd native-host

# 安装依赖
npm install

# 构建
npm run build
```

然后运行安装脚本：

```
native-host\install-host.bat
```

安装时需要输入你的 Chrome 扩展 ID（在 `chrome://extensions/` 中查看）。

安装完成后，重启 Chrome，在插件设置页面点击「检测」确认状态。

#### 4.3 启用增强模式

1. 打开插件 → 设置页
2. 开启「增强模式」
3. 确认 FFmpeg 路径正确
4. 保存设置

### 5. 卸载增强组件

```
native-host\uninstall-host.bat
```

## 两种工作模式

### 模式 A: 纯浏览器模式 (默认)

| 功能 | 支持情况 |
|------|----------|
| 下载 M4A 音频 | ✅ |
| 下载视频 M4S | ✅ (音视频分离) |
| MP3 转码 | ❌ 不支持 |
| MP4 合并 | ❌ 不支持 |
| 需要本地程序 | ❌ 不需要 |

### 模式 B: 增强模式

| 功能 | 支持情况 |
|------|----------|
| 下载 M4A 音频 | ✅ |
| 下载 MP3 音频 | ✅ (FFmpeg 转码) |
| 下载 MP4 视频 | ✅ (FFmpeg 合并) |
| 需要本地程序 | ✅ Native Host + FFmpeg |

## 开发

```bash
# 监听模式构建 (修改代码自动重新构建)
npm run dev

# 每次修改后在 chrome://extensions/ 页面点击刷新按钮
```

## 权限说明

| 权限 | 用途 |
|------|------|
| `activeTab` | 获取当前标签页URL |
| `downloads` | 触发文件下载 |
| `storage` | 保存设置和任务列表 |
| `tabs` | 获取标签页信息 |
| `scripting` | 注入 Content Script |
| `nativeMessaging` | 与本地 FFmpeg 通信 |

**Host 权限:**

| 域名 | 用途 |
|------|------|
| `bilibili.com` | B站页面 |
| `api.bilibili.com` | B站API接口 |
| `*.bilivideo.com` | 音视频CDN |
| `*.biliapi.net` | B站备用API |
| `*.hdslb.com` | B站静态资源 |

## 常见问题

### Q: 插件无法识别视频信息？
A: 确保你打开的是 B站视频页面 (URL 包含 `/video/` 或 `/bangumi/play/`)。

### Q: 下载时提示"权限不足"？
A: 请先在浏览器中登录 B站账号，插件会自动使用你的登录状态获取更高画质。

### Q: 音频/视频流为空？
A: 某些视频可能需要大会员权限，或者 B站限制了该视频的下载。

### Q: MP3 下载失败？
A: MP3 需要安装增强组件。请确认:
1. FFmpeg 已安装且在 PATH 中
2. Native Host 已正确安装
3. 在设置中启用了增强模式

### Q: 视频下载后无法播放？
A: 纯浏览器模式下，视频和音频是分离的 (.m4s 文件)。需要安装增强组件启用自动合并。

### Q: Native Host 连接失败？
A: 
1. 确认 `install-host.bat` 运行成功
2. 确认输入的 Extension ID 正确
3. 重启 Chrome
4. 在设置页点击「检测」

## 技术栈

- **Chrome Extension Manifest V3**
- **TypeScript**
- **React 18**
- **Vite 6**
- **Tailwind CSS 3**
- **Chrome APIs**: downloads, storage, tabs, scripting, nativeMessaging

## 参考项目

- [BBDown](https://github.com/nilaoda/BBDown) - BV/AV解析、playurl接口
- [Bili23-Downloader](https://github.com/ScottSloan/Bili23-Downloader) - 下载器交互设计
- [Bilibili API 文档](https://github.com/SocialSisterYi/bilibili-API-collect) - 接口参考

## 免责声明

本插件仅供个人学习研究使用。请勿将下载的内容用于商业用途，并尊重内容创作者的版权。使用者需自行承担使用本工具产生的一切法律责任。
