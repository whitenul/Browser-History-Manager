# 浏览器历史记录管理器 v2.0

现代化浏览器历史记录管理 Chrome 扩展，基于 Vue 3 + TypeScript + Vite 构建。

## 技术栈

| 技术 | 用途 |
|------|------|
| Vue 3 + Composition API | 响应式 UI 框架 |
| TypeScript | 类型安全 |
| Vite | 构建工具 |
| Pinia | 状态管理 |
| UnoCSS | 原子化 CSS |

## 项目结构

```
├── public/
│   ├── manifest.json          # Chrome 扩展清单
│   └── icons/                 # 扩展图标
├── src/
│   ├── background/
│   │   └── main.ts            # Service Worker
│   ├── components/
│   │   └── business/          # 业务组件
│   │       ├── ThemeModal.vue
│   │       ├── DeleteConfirmModal.vue
│   │       ├── TagModal.vue
│   │       └── GroupRuleModal.vue
│   ├── popup/
│   │   ├── App.vue            # 根组件
│   │   └── main.ts            # 入口
│   ├── stores/                # Pinia 状态仓库
│   │   ├── history.ts         # 历史记录
│   │   ├── stats.ts           # 数据统计
│   │   ├── bookmarks.ts       # 书签管理
│   │   ├── theme.ts           # 主题设置
│   │   └── ui.ts              # UI 状态
│   ├── styles/
│   │   └── main.css           # 全局样式 & 设计令牌
│   ├── utils/
│   │   ├── helpers.ts         # 工具函数
│   │   └── cache.ts           # LRU 缓存
│   ├── views/
│   │   ├── HistoryView.vue    # 历史记录视图
│   │   ├── StatsView.vue      # 数据统计视图
│   │   └── BookmarksView.vue  # 书签管理视图
│   └── env.d.ts               # 类型声明
├── popup.html                 # Vite 入口 HTML
├── vite.config.ts             # Vite 配置
├── tsconfig.json              # TypeScript 配置
├── uno.config.ts              # UnoCSS 配置
└── package.json
```

## 功能特性

### 历史记录管理
- 按时间范围筛选（今日/3天/7天/30天/全部）
- 多种分组模式（按域名/按时间/自定义规则）
- 多种排序方式（时间/访问次数/域名）
- 关键词搜索（标题+网址+域名）
- 收藏标记、一键删除、右键菜单
- 自定义标签系统
- CSV 导出

### 数据统计
- 访问概览（总访问/本周/日均/网站数）
- 热门网站 TOP 10 轮播
- 智能推荐（基于访问频率和时效性）
- 本周访问趋势柱状图
- 网站分类统计（社交/视频/购物/新闻/开发等）

### 书签管理
- 书签树形结构浏览
- 文件夹展开/折叠
- 书签搜索
- 快速删除

### 主题系统
- 自动/浅色/深色模式
- 6 种渐变主题（海洋/日落/森林/夜晚/火焰/极光）
- 自定义颜色（主色调/背景色/文字色）
- 跟随系统主题自动切换

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build
```

## 安装扩展

1. 运行 `npm run build`
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择项目的 `dist` 目录

## 设计理念

- **专业工具风格**：中性灰调 + 靛蓝主色，信息密度高但不拥挤
- **轻量现代**：Vue 3 + UnoCSS 按需生成，零冗余代码
- **响应式设计**：CSS 自定义属性 + 暗色模式支持
- **性能优先**：LRU 缓存、分页加载、图片懒加载
