# Seeder - AI Agent Workflow Platform

<div align="center">

**Planning Visualization + AI-powered Workflow Generation**

Seeder is a single-page AI planning assistant where all features (chat, task management, project selection) are integrated into one unified interface.

[English](README.md) | [中文](README_CN.md)

</div>

---

## Overview

Seeder is an AI-powered project management and task planning platform that combines advanced planning visualization with intelligent workflow generation. It enables teams to define requirements through natural language conversations with AI, automatically extract structured tasks, and visualize them in both list and canvas views.

## Screenshots

### Chat Interface
![Chat Interface](docs/images/chat-view.png)

### Task List View
![Task List](docs/images/task-list.png)

### Canvas View
![Canvas View](docs/images/canvas-view.png)

## Key Features

- **Conversational Planning**: Describe your project requirements in natural language, and the AI assistant helps you plan and structure them into actionable tasks.
- **Planning Visualization**:
  - **List View**: Organize tasks in a structured list with priority, labels, and acceptance criteria.
  - **Canvas View**: Visualize task relationships and dependencies in an interactive canvas.
- **Project Management**: Link plans to projects, manage multiple projects with local or database storage.
- **AI Task Extraction**: Automatically extract structured tasks from planning conversations using AI.
- **Interactive Task Editing**: Drag-and-drop task reordering, inline editing, and dependency management.
- **Slack Integration**: Manage projects and plans directly from Slack with slash commands.
- **Kimi Review**: Request AI-powered review (Kimi) for your plans and get feedback.

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (optional - also works with local storage)
- **AI**: DeepSeek, Kimi (Moonshot AI)
- **Integration**: Slack Bolt SDK

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (optional, for persistent storage)
- DeepSeek API Key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YoshiyukiSakura/seeder.git
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
DEEPSEEK_API_KEY="your-deepseek-api-key"

# Slack (optional)
SLACK_BOT_TOKEN="xoxb-your-token"
SLACK_SIGNING_SECRET="your-signing-secret"
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Create a Project**: Select "New Project" or enter requirements in the chat.
2. **Plan with AI**: Describe your project requirements in the chat.
3. **Extract Tasks**: Click "Extract Tasks" to generate structured task items.
4. **Visualize & Organize**: Switch between List View and Canvas View to organize tasks.
5. **Publish & Share**: Publish your plan and optionally request Kimi review.

## Project Structure

```
seeder/
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

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | No (uses local storage if omitted) |
| `AUTH_SECRET` | JWT signing secret | Yes |
| `DEEPSEEK_API_KEY` | DeepSeek API key | Yes |
| `MINIMAX_API_URL` | MiniMax API URL (for Slack bot) | No |
| `MINIMAX_API_KEY` | MiniMax API key (for Slack bot) | No |
| `SLACK_BOT_TOKEN` | Slack Bot Token | No |
| `SLACK_SIGNING_SECRET` | Slack Signing Secret | No |
| `BOT_SECRET` | Bot shared secret | No |

## License

MIT License
