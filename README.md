# Seeder - AI Agent Workflow Platform

<div align="center">

**Planning Visualization + AI-powered Workflow Generation**

Seeder is a single-page AI planning assistant where all features (chat, task management, project selection) are integrated into one unified interface.

[English](#english) | [中文](#中文)

</div>

---

## English

### Overview

Seeder is an AI-powered project management and task planning platform that combines advanced planning visualization with intelligent workflow generation. It enables teams to define requirements through natural language conversations with AI, automatically extract structured tasks, and visualize them in both list and canvas views.

### Key Features

- **Conversational Planning**: Describe your project requirements in natural language, and the AI assistant helps you plan and structure them into actionable tasks.
- **Planning Visualization**:
  - **List View**: Organize tasks in a structured list with priority, labels, and acceptance criteria.
  - **Canvas View**: Visualize task relationships and dependencies in an interactive canvas.
- **Project Management**: Link plans to projects, manage multiple projects with local or database storage.
- **AI Task Extraction**: Automatically extract structured tasks from planning conversations using AI.
- **Interactive Task Editing**: Drag-and-drop task reordering, inline editing, and dependency management.
- **Slack Integration**: Manage projects and plans directly from Slack with slash commands.
- **Kimi Review**: Request AI-powered review (Kimi) for your plans and get feedback.

### Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (optional - also works with local storage)
- **AI**: Anthropic Claude, Kimi (Moonshot AI)
- **Integration**: Slack Bolt SDK

### Getting Started

#### Prerequisites

- Node.js 18+
- PostgreSQL (optional, for persistent storage)
- Anthropic API Key

#### Installation

1. Clone the repository:
```bash
git clone https://github.com/asakuraYoshiyuki/seeder.git
cd seeder
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/seeder"

# Auth
AUTH_SECRET="your-auth-secret"

# AI API
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Slack (optional)
SLACK_BOT_TOKEN="xoxb-your-token"
SLACK_SIGNING_SECRET="your-signing-secret"
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Usage

1. **Create a Project**: Select "New Project" or enter requirements in the chat.
2. **Plan with AI**: Describe your project requirements in the chat.
3. **Extract Tasks**: Click "Extract Tasks" to generate structured task items.
4. **Visualize & Organize**: Switch between List View and Canvas View to organize tasks.
5. **Publish & Share**: Publish your plan and optionally request Kimi review.

### Project Structure

```
seedbed/
├── src/
│   ├── app/                 # Next.js App Router pages and API
│   ├── components/          # React components
│   ├── lib/                 # Utilities and core logic
│   └── types/               # TypeScript type definitions
├── slack-bot/               # Slack bot integration
├── prisma/                  # Database schema
├── tests/                   # Test files
└── .env.example             # Environment variables template
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | No (uses local storage if omitted) |
| `AUTH_SECRET` | JWT signing secret | Yes |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Yes |
| `MINIMAX_API_URL` | MiniMax API URL (for Slack bot) | No |
| `MINIMAX_API_KEY` | MiniMax API key (for Slack bot) | No |
| `SLACK_BOT_TOKEN` | Slack Bot Token | No |
| `SLACK_SIGNING_SECRET` | Slack Signing Secret | No |
| `BOT_SECRET` | Bot shared secret | No |

### License

MIT License

---

## 中文

### 概述

Seeder 是一个结合了高级规划可视化和智能工作流生成的 AI 驱动项目管理和任务规划平台。它使团队能够通过与 AI 的自然语言对话来定义需求，自动提取结构化任务，并在列表和画布视图中可视化它们。

### 主要功能

- **对话式规划**：用自然语言描述项目需求，AI 助手帮助您将其规划和结构化为可执行的任务。
- **规划可视化**：
  - **列表视图**：在结构化列表中组织任务，包含优先级、标签和验收标准。
  - **画布视图**：在交互式画布中可视化任务关系和依赖关系。
- **项目管理**：将计划链接到项目，使用本地或数据库存储管理多个项目。
- **AI 任务提取**：使用 AI 自动从规划对话中提取结构化任务。
- **交互式任务编辑**：拖放任务排序、内联编辑和依赖关系管理。
- **Slack 集成**：使用斜杠命令直接从 Slack 管理和计划。
- **Kimi 评审**：请求 AI 驱动（Kimi）评审您的计划并获得反馈。

### 技术栈

- **前端**：Next.js 14, React, TypeScript, Tailwind CSS
- **后端**：Next.js API Routes, Prisma ORM
- **数据库**：PostgreSQL（可选 - 也支持本地存储）
- **AI**：Anthropic Claude, Kimi (Moonshot AI)
- **集成**：Slack Bolt SDK

### 快速开始

#### 前置条件

- Node.js 18+
- PostgreSQL（可选，用于持久化存储）
- Anthropic API Key

#### 安装

1. 克隆仓库：
```bash
git clone https://github.com/asakuraYoshiyuki/seeder.git
cd seeder
```

2. 安装依赖：
```bash
npm install
```

3. 创建环境变量文件：
```bash
cp .env.example .env
```

4. 在 `.env` 中配置环境变量：
```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/seeder"

# 认证
AUTH_SECRET="your-auth-secret"

# AI API
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Slack（可选）
SLACK_BOT_TOKEN="xoxb-your-token"
SLACK_SIGNING_SECRET="your-signing-secret"
```

5. 启动开发服务器：
```bash
npm run dev
```

6. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

### 使用方法

1. **创建项目**：选择"新建项目"或在聊天中输入需求。
2. **AI 规划**：在聊天中描述您的项目需求。
3. **提取任务**：点击"提取任务"生成结构化的任务项。
4. **可视化与组织**：在列表视图和画布视图之间切换以组织任务。
5. **发布与分享**：发布您的计划，可选择请求 Kimi 评审。

### 项目结构

```
seedbed/
├── src/
│   ├── app/                 # Next.js App Router 页面和 API
│   ├── components/          # React 组件
│   ├── lib/                 # 工具库和核心逻辑
│   └── types/               # TypeScript 类型定义
├── slack-bot/               # Slack 机器人集成
├── prisma/                  # 数据库模式
├── tests/                   # 测试文件
└── .env.example             # 环境变量模板
```

### 环境变量

| 变量 | 描述 | 必需 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 否（省略时使用本地存储） |
| `AUTH_SECRET` | JWT 签名密钥 | 是 |
| `ANTHROPIC_API_KEY` | Anthropic Claude API 密钥 | 是 |
| `MINIMAX_API_URL` | MiniMax API URL（用于 Slack 机器人） | 否 |
| `MINIMAX_API_KEY` | MiniMax API 密钥（用于 Slack 机器人） | 否 |
| `SLACK_BOT_TOKEN` | Slack Bot Token | 否 |
| `SLACK_SIGNING_SECRET` | Slack Signing Secret | 否 |
| `BOT_SECRET` | 机器人共享密钥 | 否 |

### 开源协议

MIT License