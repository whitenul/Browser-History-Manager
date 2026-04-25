# 贡献指南

感谢你对 **浏览器历史记录管理器** 项目的关注！本文档将帮助你了解如何参与贡献。

## 行为准则

本项目采用 [Contributor Covenant](https://www.contributor-covenant.org/) 行为准则。参与本项目即表示你同意遵守其条款。完整内容请参阅 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 如何贡献

### 报告 Bug

1. 搜索 [现有 Issues](../../issues) 避免重复提交
2. 使用 Bug 报告模板创建新 Issue
3. 包含以下信息：
   - 复现步骤
   - 期望行为
   - 实际行为
   - 环境信息（Chrome 版本、操作系统）

### 提出新功能

1. 先开 Issue 讨论方案，获得维护者反馈
2. 明确功能描述、使用场景、预期效果
3. 获得认可后再开始开发

### 提交代码

```bash
# 1. Fork 本仓库
# 2. 创建功能分支
git checkout -b feature/your-feature

# 3. 提交变更（遵循 Conventional Commits 规范）
git commit -m 'feat: add your feature'

# 4. 推送分支
git push origin feature/your-feature

# 5. 创建 Pull Request
```

## 开发环境搭建

```bash
# 克隆项目
git clone <repository-url>
cd "Browser History"

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## Commit 规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

| 前缀 | 用途 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | Bug 修复 |
| `perf:` | 性能优化 |
| `refactor:` | 代码重构 |
| `style:` | 样式调整（不影响逻辑） |
| `docs:` | 文档更新 |
| `test:` | 测试相关 |
| `chore:` | 构建/工具变更 |

## 代码规范

- **语言**：TypeScript 严格模式（`strict: true`）
- **框架**：Vue 3 Composition API + `<script setup>` 语法
- **样式**：UnoCSS 原子化类优先，复杂样式使用 `<style scoped>`
- **状态管理**：Pinia Store，按功能模块拆分
- **命名**：组件 PascalCase，函数/变量 camelCase，CSS 类 kebab-case
- **类型**：所有函数参数和返回值必须有类型注解

## PR 检查清单

- [ ] 通过 `npm run build`（含类型检查），无错误
- [ ] 遵循现有代码风格和目录结构
- [ ] 新功能有对应的组件/Store 实现
- [ ] 描述清晰，说明变更内容和原因
- [ ] 无 `console.log` 残留（生产构建会自动移除，但开发时也应清理）

## 发布流程

1. 更新 `package.json` 中的版本号
2. 更新 `public/manifest.json` 中的版本号
3. 运行 `npm run build` 确保构建成功
4. 提交变更并创建版本 Tag
5. 在 GitHub Releases 中发布

## 问题反馈

- **Bug 报告 / 功能建议**：通过 [GitHub Issues](../../issues) 提交
- **安全漏洞**：如发现安全问题，请通过私密渠道报告，勿公开提交 Issue
