---
name: project-workflow
description: AI 驱动的全栈项目开发工作流模板。用于指导新项目从 0 到 1 的完整开发流程，包括建仓库、产品规划、技术选型、UI/UX 设计、开发部署、测试验证、CI/CD 等 10 个阶段。适用于 SaaS 产品、Web 应用、AI 应用开发。
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, TodoWrite
---

# AI 驱动的全栈项目开发工作流

> 从 0 到 1 的完整项目开发流程模板
> 适用于：SaaS 产品、Web 应用、AI 应用开发

---

## 工作流概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI 驱动的全栈项目开发流程                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐          │
│  │  1   │──▶│  2   │──▶│  3   │──▶│  4   │──▶│  5   │──▶│  6   │          │
│  │ 建仓库 │   │ Idea │   │ 调研  │   │ 技术  │   │ UI/UX │   │ 开发  │          │
│  └──────┘   └──────┘   │ 设计  │   │ 选型  │   │ 设计  │   │ 部署  │          │
│                        └──────┘   └──────┘   └──────┘   └──────┘          │
│                                                                              │
│  ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐                                 │
│  │  7   │──▶│  8   │──▶│  9   │──▶│ 10   │ ◀─────────────────┐            │
│  │ 自测  │   │ 测试  │   │ 上线  │   │CI/CD │                   │            │
│  │ 优化  │   │      │   │ 测试  │   │ 迭代  │───────────────────┘            │
│  └──────┘   └──────┘   └──────┘   └──────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: 建仓库 (Repository Setup)

### 目标
初始化项目仓库，建立基础结构

### 输出物
- [ ] GitHub/GitLab 仓库
- [ ] README.md
- [ ] LICENSE
- [ ] .gitignore
- [ ] CLAUDE.md (AI Coding 指南)
- [ ] 基础目录结构

### AI 可自动化
```bash
# 创建仓库结构
mkdir -p docs/{planning,design,development}
mkdir -p .claude/{commands,skills}

# 生成基础文件
# - README.md: 项目介绍
# - CLAUDE.md: AI 编码指南
# - .env.example: 环境变量模板
```

### 检查清单
- [ ] 仓库命名规范（小写、连字符）
- [ ] 分支保护规则配置
- [ ] Collaborators 权限设置
- [ ] Issue/PR 模板创建

---

## Phase 2: Idea (创意构思)

### 目标
明确产品定位、目标用户、核心价值

### 输出物
- [ ] `docs/planning/product-plan.md` - 产品规划
- [ ] `docs/planning/content-generation-directions.md` - 方向探索（可选）

### 产品规划模板

```markdown
# [产品名] 产品规划

## 产品定位
一句话描述：**[用 XX 技术解决 XX 问题]**

## 核心价值
| 传统方式 | 本产品 |
|----------|--------|
| 痛点 1   | 解决方案 1 |
| 痛点 2   | 解决方案 2 |

## 目标用户
| 用户群 | 核心需求 | 使用场景 |
|--------|----------|----------|
| 主要用户 1 | ... | ... |
| 主要用户 2 | ... | ... |

## 核心功能
### MVP (Phase 1) - 必须有
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 功能 1 | ... | P0 |

### 进阶 (Phase 2) - 应该有
| 功能 | 描述 | 优先级 |
|------|------|--------|
| 功能 2 | ... | P1 |

## 商业模式
- 定价策略
- 目标 MRR
- 竞品分析
```

### AI 辅助
- 使用 AI 进行市场调研
- 竞品分析和功能对比
- 用户画像生成

---

## Phase 3: 调研设计 (Research & System Design)

### 目标
完成系统架构设计、流程图、技术预研

### 输出物
- [ ] `docs/design/design-research.md` - 设计总览
- [ ] 系统架构图
- [ ] 用户旅程图
- [ ] 核心流程图
- [ ] 数据流图

### 设计总览模板

```markdown
# [产品名] 设计总览

## 系统架构
[ASCII 架构图]

## 用户旅程
[用户从注册到核心功能的完整流程]

## 核心流程
[主要业务流程图]

## 技术预研
| 问题 | 方案 A | 方案 B | 选择 |
|------|--------|--------|------|
| 问题 1 | ... | ... | A |
```

### AI 辅助
- 生成 ASCII 架构图
- 生成 Mermaid 流程图
- 技术方案对比分析

---

## Phase 4: 技术选型 (Technology Selection)

### 目标
确定技术栈、数据库、第三方服务

### 输出物
- [ ] `docs/design/backend-architecture.md` - 后端架构
- [ ] `docs/design/frontend-architecture.md` - 前端架构
- [ ] `docs/design/database-schema.md` - 数据库设计
- [ ] `docs/design/api-design.md` - API 设计
- [ ] `docs/planning/[service]-providers.md` - 第三方服务选型

### 技术选型决策表

```markdown
## 前端技术栈
| 技术 | 选择 | 替代方案 | 选择理由 |
|------|------|----------|----------|
| 框架 | React | Vue, Svelte | 生态成熟 |
| 语言 | TypeScript | JavaScript | 类型安全 |
| 样式 | Tailwind | CSS Modules | 开发效率 |
| 状态 | Zustand | Redux, Jotai | 简单轻量 |

## 后端技术栈
| 技术 | 选择 | 替代方案 | 选择理由 |
|------|------|----------|----------|
| 运行时 | Cloudflare Workers | Vercel, AWS Lambda | 边缘部署 |
| 框架 | Hono | Express | 轻量高性能 |
| 数据库 | D1 (SQLite) | PostgreSQL | Serverless |
| 存储 | R2 | S3 | 成本低 |

## 第三方服务
| 服务 | 选择 | 成本 | 选择理由 |
|------|------|------|----------|
| 认证 | Clerk | $0-25/mo | 开箱即用 |
| 支付 | Stripe | 2.9%+0.3 | 国际化 |
| AI | OpenAI | 按量付费 | 质量最佳 |
```

### 数据库设计模板

```markdown
## ER 图
[ASCII ER 图]

## 表结构
### users 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| email | TEXT | 邮箱 |
| created_at | DATETIME | 创建时间 |

## 索引设计
[索引列表]

## 查询示例
[常用查询 SQL]
```

---

## Phase 5: UI/UX 设计 (User Interface Design)

### 目标
完成界面设计、交互规范、组件库

### 输出物
- [ ] `docs/design/ui-ux-design.md` - UI/UX 规范
- [ ] `docs/design/pages-design.md` - 页面设计
- [ ] `docs/design/landing-page-design.md` - 主页设计
- [ ] `docs/design/user-guide-pages.md` - 用户导向页面
- [ ] `docs/design/figma-integration.md` - 设计工具集成（可选）

### UI/UX 规范模板

```markdown
## 设计系统

### 色彩
| 名称 | 色值 | 用途 |
|------|------|------|
| Primary | #1A6BA0 | 主要按钮、链接 |
| Secondary | #10B981 | 成功状态 |
| Error | #EF4444 | 错误提示 |

### 字体
| 级别 | 大小 | 行高 | 用途 |
|------|------|------|------|
| H1 | 36px | 1.2 | 页面标题 |
| Body | 16px | 1.5 | 正文 |

### 间距
| 名称 | 值 | 用途 |
|------|-----|------|
| xs | 4px | 紧凑元素 |
| sm | 8px | 小间距 |
| md | 16px | 标准间距 |

### 组件规范
[Button, Input, Card, Modal 等组件规范]
```

### 页面设计模板

```markdown
## 页面列表
| 页面 | 路径 | 状态 | 说明 |
|------|------|------|------|
| 登录 | /login | 设计中 | Clerk 托管 |
| 主页 | / | 设计中 | Landing Page |
| 应用 | /app | 设计中 | 核心功能 |

## 页面线框图
### [页面名]
[ASCII 线框图]

### 组件说明
| 组件 | 功能 | 交互 |
|------|------|------|
| 组件 1 | ... | ... |
```

### AI 辅助
- 根据设计文档生成组件代码
- 使用 v0.dev 生成 UI
- Figma MCP 读取设计稿

---

## Phase 6: 开发部署 (Development & Deployment)

### 目标
完成代码开发、本地调试、部署上线

### 输出物
- [ ] `docs/development/env-config.md` - 环境配置
- [ ] `docs/development/deployment-architecture.md` - 部署架构
- [ ] 前端代码 (`/src` 或 `/apps/web`)
- [ ] 后端代码 (`/api` 或 `/apps/api`)
- [ ] 配置文件 (package.json, wrangler.toml, etc.)

### 开发流程

```
1. 项目初始化
   ├── 前端脚手架 (Vite + React + TypeScript)
   ├── 后端脚手架 (Cloudflare Workers + Hono)
   └── 依赖安装

2. 基础搭建
   ├── 路由配置
   ├── 状态管理
   ├── API 客户端
   └── 认证集成

3. 功能开发
   ├── 按 MVP 功能列表逐个实现
   ├── 先后端 API，再前端页面
   └── 单元测试同步编写

4. 部署配置
   ├── 环境变量配置
   ├── CI/CD 流水线
   └── 域名和 SSL
```

### 部署架构模板

```markdown
## 部署架构

### 生产环境
| 服务 | 平台 | 配置 |
|------|------|------|
| 前端 | Vercel | 自动部署 |
| 后端 | Cloudflare Workers | 边缘部署 |
| 数据库 | Cloudflare D1 | SQLite |
| 存储 | Cloudflare R2 | 对象存储 |

### 备用方案
| 服务 | 主方案 | 备用方案 |
|------|--------|----------|
| 前端 | Vercel | Cloudflare Pages |
| 后端 | Workers | AWS Lambda |

### CI/CD
[GitHub Actions 配置]
```

### AI 可自动化
- 脚手架代码生成
- 组件代码生成
- API 路由生成
- 测试代码生成
- 配置文件生成

---

## Phase 7: 自测优化 (Self-Testing & Optimization)

### 目标
开发者自测、代码审查、性能优化

### 输出物
- [ ] 自测报告
- [ ] 性能优化记录
- [ ] 代码质量报告

### 自测检查清单

```markdown
## 功能自测
- [ ] 所有 MVP 功能正常工作
- [ ] 边界情况处理
- [ ] 错误提示友好
- [ ] 加载状态正确

## 兼容性测试
- [ ] Chrome / Firefox / Safari
- [ ] 移动端响应式
- [ ] 不同屏幕尺寸

## 性能检查
- [ ] Lighthouse 评分 > 90
- [ ] 首屏加载 < 3s
- [ ] API 响应 < 500ms
- [ ] 无内存泄漏

## 安全检查
- [ ] XSS 防护
- [ ] CSRF 防护
- [ ] SQL 注入防护
- [ ] 敏感信息不暴露

## 代码质量
- [ ] ESLint 无警告
- [ ] TypeScript 无错误
- [ ] 测试覆盖率 > 80%
```

### 自评打分表

```markdown
| 维度 | 满分 | 自评 | 说明 |
|------|------|------|------|
| 功能完整性 | 20 | ? | MVP 功能是否全部实现 |
| 用户体验 | 20 | ? | 交互是否流畅 |
| 代码质量 | 20 | ? | 可维护性、可读性 |
| 性能 | 20 | ? | 加载速度、响应速度 |
| 安全性 | 20 | ? | 安全防护措施 |
| **总分** | 100 | ? | |
```

---

## Phase 8: 测试 (Testing)

### 目标
完成单元测试、集成测试、E2E 测试

### 输出物
- [ ] `docs/development/automation-plan.md` - 测试计划
- [ ] 单元测试代码
- [ ] E2E 测试代码
- [ ] 测试覆盖率报告

### 测试策略

```markdown
## 测试金字塔

        /\
       /  \      E2E 测试 (10%)
      /----\     关键用户流程
     /      \
    /--------\   集成测试 (20%)
   /          \  API 接口测试
  /------------\ 单元测试 (70%)
 /              \ 组件、函数、工具
```

### 测试代码模板

```typescript
// 单元测试 - Vitest
describe('formatDuration', () => {
  it('formats seconds to mm:ss', () => {
    expect(formatDuration(65)).toBe('01:05');
  });
});

// E2E 测试 - Playwright
test('user can create audio', async ({ page }) => {
  await page.goto('/create');
  await page.fill('[name="text"]', 'Hello World');
  await page.click('button[type="submit"]');
  await expect(page.locator('.audio-player')).toBeVisible();
});
```

### AI 辅助
- 生成测试用例
- 生成测试代码
- 分析测试覆盖率缺口

---

## Phase 9: 线上测试 (Production Testing)

### 目标
生产环境验证、冒烟测试、监控配置

### 输出物
- [ ] `docs/development/release-verification.md` - 上线验证
- [ ] 监控告警配置
- [ ] 回滚计划

### 上线验证检查清单

```markdown
## 部署前检查
- [ ] 所有测试通过
- [ ] 环境变量已配置
- [ ] 数据库迁移已执行
- [ ] CDN 缓存策略正确

## 冒烟测试
- [ ] 首页加载正常
- [ ] 登录流程正常
- [ ] 核心功能正常
- [ ] 支付流程正常（如适用）

## 监控配置
- [ ] 错误监控 (Sentry)
- [ ] 性能监控 (Web Vitals)
- [ ] 业务指标监控
- [ ] 告警通知渠道

## 回滚计划
- [ ] 回滚脚本准备
- [ ] 回滚触发条件定义
- [ ] 回滚通知机制
```

### 灰度发布策略

```markdown
## 发布阶段
1. 内部测试 (1% 流量)
2. Beta 用户 (5% 流量)
3. 逐步放量 (25% → 50% → 100%)

## 监控指标
- 错误率 < 0.1%
- P99 延迟 < 1s
- 用户投诉 = 0
```

---

## Phase 10: CI/CD 持续迭代 (Continuous Integration/Deployment)

### 目标
建立持续集成、持续部署、持续迭代机制

### 输出物
- [ ] `.github/workflows/ci.yml` - CI 配置
- [ ] `.github/workflows/deploy.yml` - CD 配置
- [ ] 版本发布流程
- [ ] 迭代计划

### CI/CD 流水线

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run deploy
```

### 迭代流程

```
┌─────────────────────────────────────────────────────────────┐
│                      持续迭代循环                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────┐                                             │
│    │ 用户反馈  │◀─────────────────────────────────┐         │
│    └────┬─────┘                                   │         │
│         ▼                                         │         │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐  │         │
│    │ 需求整理  │───▶│ 开发实现  │───▶│ 测试验证  │──┤         │
│    └──────────┘    └──────────┘    └──────────┘  │         │
│                                         │        │         │
│                                         ▼        │         │
│                                    ┌──────────┐  │         │
│                                    │ 发布上线  │──┘         │
│                                    └──────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 版本管理

```markdown
## 版本号规则
- MAJOR.MINOR.PATCH (语义化版本)
- MAJOR: 不兼容的 API 变更
- MINOR: 向下兼容的功能新增
- PATCH: 向下兼容的问题修复

## 发布节奏
- 每周发布 1 次 Minor 版本
- 紧急修复随时发布 Patch 版本
- 每季度评估 Major 版本
```

---

## 文档索引模板

在项目中维护一个 `docs/README.md` 作为文档索引：

```markdown
# [项目名] 设计文档索引

> 最后更新: YYYY-MM-DD

## 一、产品与规划
| 文档 | 说明 |
|------|------|
| product-plan.md | 产品规划 |

## 二、技术设计
### 2.1 系统设计
| 文档 | 说明 |
|------|------|
| design-research.md | 设计总览 |

### 2.2 后端设计
| 文档 | 说明 |
|------|------|
| api-design.md | API 设计 |
| database-schema.md | 数据库设计 |

### 2.3 前端设计
| 文档 | 说明 |
|------|------|
| ui-ux-design.md | UI/UX 规范 |
| pages-design.md | 页面设计 |

## 三、开发与运维
| 文档 | 说明 |
|------|------|
| env-config.md | 环境配置 |
| deployment-architecture.md | 部署架构 |
```

---

## AI 自动化程度总结

| 阶段 | AI 自动化 | 需人工操作 |
|------|-----------|------------|
| 1. 建仓库 | 90% | GitHub 创建仓库 |
| 2. Idea | 70% | 产品决策 |
| 3. 调研设计 | 80% | 方案选择 |
| 4. 技术选型 | 85% | 最终决策 |
| 5. UI/UX | 85% | 设计审核 |
| 6. 开发部署 | 90% | 外部服务配置 |
| 7. 自测优化 | 75% | 问题判断 |
| 8. 测试 | 85% | 测试策略 |
| 9. 线上测试 | 60% | 监控告警 |
| 10. CI/CD | 90% | 流程定义 |

**整体：约 80% 可由 AI 自动完成**

---

## 使用方式

1. 复制此 skill 到新项目的 `.claude/skills/` 目录
2. 按照阶段顺序执行
3. 每个阶段完成后检查输出物
4. 使用检查清单确保质量

---

## 相关资源

- [AIMake 项目](../) - 使用此工作流的实际案例
- [docs/README.md](../../docs/README.md) - 文档索引示例
