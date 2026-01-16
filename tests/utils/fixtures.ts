/**
 * 测试数据 Fixtures
 * 用于创建测试场景的预设数据
 */

// ============ Task Fixtures ============

export interface SampleTask {
  id: string
  title: string
  description: string
  priority: number
  labels: string[]
  acceptanceCriteria: string[]
  relatedFiles: string[]
  estimateHours: number
}

export const SAMPLE_TASKS: SampleTask[] = [
  {
    id: 'task_1',
    title: '创建用户数据模型',
    description: '设计并实现 User 模型，包含基本用户信息字段',
    priority: 0,
    labels: ['后端', '数据库'],
    acceptanceCriteria: [
      'Prisma schema 定义完成',
      '数据库迁移成功',
      '模型包含 id, email, name 等字段',
    ],
    relatedFiles: ['prisma/schema.prisma'],
    estimateHours: 2,
  },
  {
    id: 'task_2',
    title: '实现用户注册 API',
    description: '创建 POST /api/auth/register 接口',
    priority: 1,
    labels: ['后端', 'API'],
    acceptanceCriteria: [
      '接收 email 和 password',
      '验证输入格式',
      '密码加密存储',
      '返回用户信息和 token',
    ],
    relatedFiles: ['src/app/api/auth/register/route.ts'],
    estimateHours: 3,
  },
  {
    id: 'task_3',
    title: '创建注册表单组件',
    description: '前端注册表单 UI',
    priority: 1,
    labels: ['前端', 'UI'],
    acceptanceCriteria: [
      '表单包含 email 和 password 输入框',
      '客户端验证',
      '提交成功后跳转',
    ],
    relatedFiles: ['src/components/auth/RegisterForm.tsx'],
    estimateHours: 2,
  },
  {
    id: 'task_4',
    title: '编写单元测试',
    description: '为注册功能编写测试用例',
    priority: 2,
    labels: ['测试'],
    acceptanceCriteria: [
      'API 单元测试覆盖率 > 80%',
      '组件测试覆盖正常和错误场景',
    ],
    relatedFiles: ['tests/unit/auth/register.test.ts'],
    estimateHours: 2,
  },
  {
    id: 'task_5',
    title: '文档更新',
    description: '更新 API 文档',
    priority: 3,
    labels: ['文档'],
    acceptanceCriteria: ['README 更新', 'API 文档添加注册接口说明'],
    relatedFiles: ['README.md', 'docs/api.md'],
    estimateHours: 1,
  },
]

// ============ Claude Response Fixtures ============

export const CLAUDE_PLAN_RESPONSE = `
# 评论功能实现计划

基于你的需求，我为你规划了以下任务：

## 任务 1: [P0] 创建 Comment 数据模型

**描述**: 在 Prisma schema 中定义 Comment 模型，支持嵌套回复结构

**标签**: 后端, 数据库

**验收标准**:
- [ ] Comment 模型包含 id, content, authorId, postId, parentId
- [ ] 支持自关联查询嵌套评论
- [ ] 数据库迁移成功执行

**相关文件**: prisma/schema.prisma

**预估时间**: 1h

## 任务 2: [P1] 实现评论 CRUD API

**描述**: 创建评论相关的 REST API 接口

**标签**: 后端, API

**验收标准**:
- [ ] POST /api/comments - 创建评论
- [ ] GET /api/posts/:id/comments - 获取帖子评论
- [ ] DELETE /api/comments/:id - 删除评论
- [ ] 支持嵌套评论查询

**相关文件**: src/app/api/comments/route.ts, src/app/api/posts/[id]/comments/route.ts

**预估时间**: 3h

## 任务 3: [P1] 创建评论组件

**描述**: 实现前端评论展示和输入组件

**标签**: 前端, UI

**验收标准**:
- [ ] CommentList 组件支持嵌套显示
- [ ] CommentForm 输入框
- [ ] 支持回复指定评论

**相关文件**: src/components/comments/

**预估时间**: 4h

## 任务 4: [P2] 实现评论通知

**描述**: 当有新评论时通知文章作者

**标签**: 后端, 通知

**验收标准**:
- [ ] 评论创建后发送通知
- [ ] 作者收到 email 通知

**相关文件**: src/lib/notifications/

**预估时间**: 2h

---

总计: 4 个任务, 预估 10 小时
`

// ============ SSE Event Fixtures ============

export const SSE_INIT_EVENT = {
  type: 'init' as const,
  data: { cwd: '/test/project', useContinue: false },
}

export const SSE_TEXT_EVENT = {
  type: 'text' as const,
  data: { content: '我来帮你规划这个功能...' },
}

export const SSE_TOOL_EVENT = {
  type: 'tool' as const,
  data: { name: 'Read' },
}

export const SSE_QUESTION_EVENT = {
  type: 'question' as const,
  data: {
    toolUseId: 'tool_123',
    questions: [
      {
        question: '评论是否需要支持嵌套回复？',
        header: '嵌套评论',
        options: [
          { label: '是', description: '支持多级嵌套回复' },
          { label: '否', description: '只支持单层评论' },
        ],
        multiSelect: false,
      },
      {
        question: '是否需要审核机制？',
        header: '审核',
        options: [
          { label: '需要', description: '评论需先审核再显示' },
          { label: '不需要', description: '评论直接显示' },
        ],
        multiSelect: false,
      },
    ],
  },
}

// SSE Question Event with multiSelect option
export const SSE_QUESTION_MULTISELECT_EVENT = {
  type: 'question' as const,
  data: {
    toolUseId: 'tool_456',
    questions: [
      {
        question: '需要支持哪些认证方式？',
        header: '认证方式',
        options: [
          { label: 'Email/Password', description: '传统邮箱密码登录' },
          { label: 'Google OAuth', description: 'Google 账号登录' },
          { label: 'GitHub OAuth', description: 'GitHub 账号登录' },
          { label: 'Magic Link', description: '邮箱链接登录' },
        ],
        multiSelect: true,  // Allow multiple selections
      },
      {
        question: '主要技术栈是什么？',
        header: '技术栈',
        options: [
          { label: 'Next.js', description: 'React 全栈框架' },
          { label: 'Express', description: 'Node.js Web 框架' },
        ],
        multiSelect: false,  // Single select
      },
    ],
  },
}

export const SSE_RESULT_EVENT = {
  type: 'result' as const,
  data: { content: CLAUDE_PLAN_RESPONSE },
}

export const SSE_DONE_EVENT = {
  type: 'done' as const,
  data: {},
}

// ============ Auth Fixtures ============

export const VALID_LOGIN_TOKEN = {
  token: 'valid_login_token_123',
  slackUserId: 'U12345',
  slackUsername: 'testuser',
  slackTeamId: 'T12345',
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  usedAt: null,
}

export const EXPIRED_LOGIN_TOKEN = {
  token: 'expired_token_456',
  slackUserId: 'U12345',
  slackUsername: 'testuser',
  slackTeamId: 'T12345',
  expiresAt: new Date(Date.now() - 1000),
  usedAt: null,
}

export const USED_LOGIN_TOKEN = {
  token: 'used_token_789',
  slackUserId: 'U12345',
  slackUsername: 'testuser',
  slackTeamId: 'T12345',
  expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  usedAt: new Date(),
}
