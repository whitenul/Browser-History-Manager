# 浏览器历史记录管理器

<p align="center">
  <strong>现代化浏览器历史记录管理 Chrome 扩展</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.4-4FC08D?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5.1-646CFF?logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Chrome_MV3-120+-green?logo=googlechrome" alt="Chrome MV3" />
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License" />
</p>

---

## 项目概述

**浏览器历史记录管理器**是一款基于 Chrome Manifest V3 的专业级历史记录管理扩展。它不仅提供高效的历史记录检索与管理能力，还集成了智能标签系统、深度数据统计、标签页内存优化、阅读队列等功能，帮助用户全面掌控浏览数据、提升浏览效率。

**核心价值**：

- 🔍 **精准检索** — 多维度筛选 + 全文搜索 + 智能分组，秒级定位任意历史记录
- 🏷️ **智能标签** — 30+ 自动分类规则，零配置即可识别社交/视频/技术/购物等类别
- 📊 **深度洞察** — 热力图、生产力评分、浏览节律分析、兴趣趋势追踪
- 🧠 **内存优化** — 自动休眠空闲标签页，实时检测重复标签，降低浏览器内存占用
- 🎨 **高度定制** — 8 预设主题 + 9 渐变 + 自定义配色 + 布局/排版/效果全可调
- 🔒 **隐私安全** — 零第三方数据传输，URL 敏感参数自动脱敏，CSP 严格防护

---

## 功能特性

### 历史记录管理

| 功能 | 说明 |
|------|------|
| 时间筛选 | 今日 / 昨天 / 3天 / 7天 / 30天 / 季度 / 年 / 全部 |
| 分组模式 | 按域名 / 按时间线 / 按会话 / 自定义规则 |
| 排序方式 | 时间升降 / 访问次数升降 / 域名升降 |
| 全文搜索 | 标题 + 网址 + 域名关键词匹配，搜索高亮 |
| 收藏标记 | 快速收藏重要记录，独立筛选查看 |
| 批量操作 | 多选删除、批量标签、批量收藏 |
| 域名黑名单 | 过滤不想看到的网站 |
| CSV 导出 | 导出记录，敏感参数（token/session 等）自动脱敏 |
| 分页加载 | 可配置每页条数，大数据量下流畅滚动 |

### 智能自动标签系统

基于 30+ 分类规则的多维度匹配引擎，零配置自动识别：

- **匹配维度**：精确域名 / 域名后缀 / URL 路径 / 查询参数 / 标题关键词
- **置信度评分**：0-1 浮点评分，区分强匹配与弱匹配
- **分类覆盖**：社交、视频、技术、文档、购物、新闻、设计、学习、邮件、音乐、AI、游戏、金融、博客、论坛、工具、云服务、健康、旅行、美食等 30+ 类别
- **情境标签**：深夜浏览、长文阅读、深层页面等时间与内容维度标签
- **标签缓存**：最大 10000 条缓存，避免重复计算

### 数据统计与洞察

| 分析维度 | 功能 |
|----------|------|
| 访问概览 | 总访问量 / 本周访问 / 日均 / 独立网站数 |
| 热门网站 | TOP 10 轮播展示 |
| 访问趋势 | 本周每日柱状图 |
| 分类统计 | 8 大类别占比（社交/视频/技术/购物/新闻/开发/学习/娱乐） |
| 热力图 | 7×24 时段访问热力分布 |
| 生产力评分 | 高效 / 良好 / 一般 / 需改善 四级评定 |
| 浏览节律 | 峰值时段识别 + 会话模式分类（规律型/夜猫型/工作型/碎片型） |
| 兴趣趋势 | 周环比变化追踪（rising / falling / stable） |
| 情境推荐 | 基于当前时段推荐常浏览网站 |
| 智能推荐 | 综合频率 + 时效 + 时段 + 周期 + 习惯的多因子推荐 |

### 标签页管理（Sidebar 专属）

- 标签页列表展示，显示内存占用估算
- **重复标签检测**：一键关闭重复页面
- **空闲标签休眠**：可配置超时时间，自动 `chrome.tabs.discard()` 释放内存
- **保护机制**：固定标签 / 有声标签 / 活跃标签不受休眠影响
- **定时检查**：Background Service Worker 每 5 分钟自动巡检

### 阅读队列

- 一键添加感兴趣的文章到阅读队列
- 智能优先级排序（基于内容类型 + 时效性）
- 持久化存储，跨会话保留

### 主题系统

| 配置项 | 选项 |
|--------|------|
| 外观模式 | 跟随系统 / 浅色 / 深色 |
| 预设主题 | 靛蓝 / 翡翠 / 玫瑰 / 琥珀 / 青蓝 / 紫罗兰 / 石墨 / 粉樱 |
| 渐变主题 | 海洋 / 日落 / 森林 / 夜晚 / 火焰 / 极光 / 薰衣草 / 冰川 / 沙漠 |
| 自定义颜色 | 主色调 / 背景色 / 文字色（Color Picker） |
| 强调色 | 独立设置，影响按钮/标签/聚焦框/选中态 |
| 圆角风格 | 无 / 小 / 中 / 大 |
| 字号 | 小 (12px) / 中 (13px) / 大 (14px) |
| 字体族 | 系统默认 / 衬线体 / 等宽体 / 圆体 |
| 头部风格 | 实色 / 渐变 / 毛玻璃 / 极简 |
| 卡片风格 | 扁平 / 描边 / 阴影 / 悬浮 |
| 动画速度 | 关闭 / 慢 / 正常 / 快 |
| 滚动条 | 纤细 / 标准 / 隐藏 |
| 背景纹理 | 无 / 点阵 / 网格 / 斜线 / 噪点 |
| 紧凑模式 | 减小间距，提升信息密度 |
| 导入/导出 | JSON 格式，含校验 |
| 重置 | 一键恢复默认 |

### 命令面板

`Ctrl+K` 快速唤起，支持：

- 搜索历史记录
- 切换视图
- 执行操作（清除记录、打开设置等）

### 预览面板

侧滑预览面板，无需跳转即可查看记录详情，URL 敏感参数自动脱敏显示。

---

## 快速开始

### 环境要求

| 依赖 | 最低版本 |
|------|----------|
| Node.js | >= 18.0 |
| npm | >= 9.0 |
| Chrome | >= 120 |

### 安装步骤

```bash
# 1. 克隆项目
git clone <repository-url>
cd "Browser History"

# 2. 安装依赖
npm install

# 3. 构建生产版本
npm run build
```

### 加载扩展

1. 运行 `npm run build`，产物输出到 `dist/` 目录
2. 打开 Chrome，访问 `chrome://extensions/`
3. 右上角开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择项目的 `dist` 目录
6. 扩展图标出现在工具栏，点击即可使用

### 基本使用

- **Popup 模式**：点击扩展图标，弹出 380×580 窗口
- **Sidebar 模式**：右键扩展图标 → 「在侧边栏中打开」，或通过设置页开启
- **命令面板**：在扩展内按 `Ctrl+K`
- **主题设置**：设置页 → 主题设置，或命令面板输入「主题」

---

## 开发指南

### 脚本命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（热更新） |
| `npm run build` | TypeScript 类型检查 + 生产构建 |
| `npm run typecheck` | 仅执行类型检查 |
| `npm run preview` | 预览构建产物 |

### 开发流程

1. `npm run dev` 启动开发服务器
2. 在 Chrome 中加载 `dist/` 目录（首次需手动加载，后续代码变更需刷新扩展）
3. 修改代码后，在 `chrome://extensions/` 页点击刷新按钮
4. 完成开发后运行 `npm run build` 确保无类型错误

---

## 项目结构

```
Browser History/
├── public/
│   ├── manifest.json                 # Chrome 扩展清单 (MV3)
│   └── icons/                        # 扩展图标资源
├── src/
│   ├── background/
│   │   └── main.ts                   # Service Worker（侧边栏控制 + 标签自动休眠）
│   ├── components/
│   │   └── business/                 # 业务组件
│   │       ├── BookmarkPickerModal.vue   # 书签选择器弹窗
│   │       ├── BrowsingDNA.vue           # 浏览 DNA 分析
│   │       ├── CommandPalette.vue        # 命令面板 (Ctrl+K)
│   │       ├── ContextMenu.vue           # 右键菜单
│   │       ├── DeleteConfirmModal.vue    # 删除确认弹窗
│   │       ├── EnhancedCharts.vue        # 增强图表
│   │       ├── FocusMode.vue             # 专注模式
│   │       ├── GroupRuleModal.vue        # 分组规则编辑弹窗
│   │       ├── PreviewPanel.vue          # 预览面板
│   │       ├── ReadingQueue.vue          # 阅读队列
│   │       ├── SmartAssistant.vue        # 智能助手
│   │       ├── SmartTimeline.vue         # 智能时间线
│   │       ├── TagModal.vue              # 标签编辑弹窗
│   │       └── ThemeModal.vue            # 主题设置弹窗
│   ├── composables/
│   │   └── useStatsNavigation.ts     # 统计页面导航逻辑
│   ├── popup/
│   │   ├── App.vue                   # Popup 入口根组件
│   │   └── main.ts                   # Popup 入口
│   ├── sidebar/
│   │   └── main.ts                   # Sidebar 入口
│   ├── stores/                       # Pinia 状态仓库
│   │   ├── history.ts                # 历史记录（核心 Store）
│   │   ├── stats.ts                  # 数据统计
│   │   ├── bookmarks.ts              # 书签管理
│   │   ├── readingQueue.ts           # 阅读队列
│   │   ├── tabOptimizer.ts           # 标签页优化器
│   │   ├── theme.ts                  # 主题系统
│   │   └── ui.ts                     # UI 状态（导航/弹窗/Toast）
│   ├── styles/
│   │   └── main.css                  # 全局样式 & CSS 设计令牌
│   ├── utils/
│   │   ├── helpers.ts                # 工具函数（自动标签/URL脱敏/Favicon/颜色）
│   │   └── cache.ts                  # LRU 缓存（内存 + chrome.storage 持久化）
│   ├── views/                        # 页面视图
│   │   ├── HistoryView.vue           # 历史记录视图
│   │   ├── StatsView.vue             # 数据统计视图
│   │   ├── BookmarksView.vue         # 书签管理视图
│   │   ├── SettingsView.vue          # 设置视图
│   │   └── TabManagerView.vue        # 标签页管理视图（Sidebar 专属）
│   ├── AppShell.vue                  # 应用外壳（Popup + Sidebar 双模式）
│   └── env.d.ts                      # TypeScript 类型声明
├── popup.html                        # Popup 入口 HTML
├── sidebar.html                      # Sidebar 入口 HTML
├── vite.config.ts                    # Vite 构建配置
├── tsconfig.json                     # TypeScript 配置
├── tsconfig.node.json                # Node.js 环境类型配置
├── uno.config.ts                     # UnoCSS 配置
└── package.json
```

---

## 技术架构

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | ^3.4 | 响应式 UI 框架（Composition API + `<script setup>`） |
| TypeScript | ^5.4 | 类型安全 |
| Vite | ^5.1 | 构建工具（多入口打包） |
| Pinia | ^2.1 | 状态管理（7 个 Store） |
| UnoCSS | ^0.58 | 原子化 CSS（preset-uno + preset-icons + transformer-directives） |
| Lucide Icons | ^1.1 | 图标库（通过 @iconify-json/lucide） |
| Chrome Extension MV3 | — | 扩展平台（Manifest V3） |

### 架构设计

```
┌─────────────────────────────────────────────┐
│                  Chrome Browser              │
├──────────────┬──────────────────────────────┤
│  Popup (380×580)  │  Sidebar (全高侧边栏)      │
│  ┌──────────┐    │  ┌──────────────────────┐ │
│  │ AppShell │    │  │      AppShell        │ │
│  │ 5 Tabs   │    │  │ 6 Tabs (+标签页管理)  │ │
│  └──────────┘    │  └──────────────────────┘ │
├──────────────────┴──────────────────────────┤
│           Pinia Stores (7 个)                │
│  history · stats · bookmarks · theme        │
│  readingQueue · tabOptimizer · ui            │
├─────────────────────────────────────────────┤
│        Background Service Worker             │
│  侧边栏控制 · 标签自动休眠 · 定时巡检          │
├─────────────────────────────────────────────┤
│           Chrome Extension APIs              │
│  history · storage · bookmarks · tabs        │
│  sidePanel · contextMenus · alarms · favicon │
└─────────────────────────────────────────────┘
```

### 安全设计

| 措施 | 说明 |
|------|------|
| CSP 策略 | `script-src 'self'; object-src 'none'`，禁止外部脚本和插件 |
| Favicon 获取 | 使用 Chrome 原生 `favicon` 权限 + `/_favicon/` 端点，零网络请求 |
| URL 脱敏 | `sanitizeUrl()` 自动剥离 32 种敏感查询参数（token/session/password 等） |
| 存储安全 | `urlStorageKey()` 使用脱敏 URL 作为存储键 |
| 零第三方 | 无任何第三方数据传输，所有数据仅存于本地 `chrome.storage` |

---

## 贡献指南

### 代码规范

- **语言**：TypeScript 严格模式（`strict: true`）
- **框架**：Vue 3 Composition API + `<script setup>` 语法
- **样式**：UnoCSS 原子化类优先，复杂样式使用 `<style scoped>`
- **状态管理**：Pinia Store，按功能模块拆分
- **命名**：组件 PascalCase，函数/变量 camelCase，CSS 类 kebab-case
- **类型**：所有函数参数和返回值必须有类型注解

### 提交流程

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交变更：`git commit -m 'feat: add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

### Commit 规范

| 前缀 | 用途 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | 修复 Bug |
| `perf:` | 性能优化 |
| `refactor:` | 代码重构 |
| `style:` | 样式调整 |
| `docs:` | 文档更新 |
| `chore:` | 构建/工具变更 |

### PR 要求

- 通过 `npm run build`（含类型检查），无错误
- 新功能需有对应的组件/Store 实现
- 遵循现有代码风格和目录结构
- 描述清晰，说明变更内容和原因

---

## 许可证

[MIT License](LICENSE)

---

## 联系方式与问题反馈

- **问题反馈**：通过 [GitHub Issues](../../issues) 提交 Bug 报告或功能建议
- **安全漏洞**：如发现安全问题，请通过私密渠道报告，勿公开提交 Issue
