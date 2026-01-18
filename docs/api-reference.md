# API Reference

本文档描述了 Seedbed 应用的 API 接口。

## 目录

- [图片上传 API](#图片上传-api)
- [Claude 对话 API](#claude-对话-api)
  - [开始新对话](#post-apiclaudestart)
  - [继续对话](#post-apiclaudecontinue)
- [SSE 事件类型](#sse-事件类型)

---

## 图片上传 API

### POST /api/images/upload

上传图片文件到服务器。支持多文件上传，返回上传后的文件路径。

#### 认证

需要用户认证。未认证请求将返回 401 错误。

#### 请求

**Content-Type:** `multipart/form-data`

| 字段名 | 类型 | 必填 | 描述 |
|-------|------|-----|------|
| files | File[] | 是 | 要上传的图片文件（支持多文件） |

**支持的图片类型:**
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`
- `image/svg+xml`

**文件限制:**
- 单个文件最大: 5MB

#### 响应

**成功 (201 Created):**

```json
{
  "paths": ["/tmp/uploads/1705123456-8f3a2c1b.jpg"],
  "warnings": ["File too large: large.png. Maximum size: 5MB"]
}
```

| 字段 | 类型 | 描述 |
|-----|------|------|
| paths | string[] | 成功上传的文件路径数组 |
| warnings | string[] | （可选）部分文件上传失败时的警告信息 |

**错误 (400 Bad Request):**

```json
{
  "error": "All files failed validation",
  "details": [
    "Invalid file type: document.pdf. Allowed types: image/jpeg, image/png, image/gif, image/webp, image/svg+xml"
  ]
}
```

| 字段 | 类型 | 描述 |
|-----|------|------|
| error | string | 错误信息 |
| details | string[] | （可选）各文件的具体错误原因 |

**错误 (401 Unauthorized):**

```json
{
  "error": "Unauthorized"
}
```

**错误 (500 Internal Server Error):**

```json
{
  "error": "Internal server error"
}
```

#### 示例

```typescript
const formData = new FormData()
formData.append('files', file1)
formData.append('files', file2)

const response = await fetch('/api/images/upload', {
  method: 'POST',
  body: formData,
  credentials: 'include'
})

const result = await response.json()
// result.paths: ["/tmp/uploads/1705123456-8f3a2c1b.jpg", "/tmp/uploads/1705123457-9a4b3d2e.png"]
```

---

## Claude 对话 API

Claude 对话 API 使用 Server-Sent Events (SSE) 流式返回响应。两个端点配合使用：
- `/api/claude/start` - 开始新对话
- `/api/claude/continue` - 继续现有对话（回答 Claude 提出的问题）

### POST /api/claude/start

开始一个新的 Claude 对话会话。

#### 请求

**Content-Type:** `application/json`

```json
{
  "prompt": "帮我分析这段代码",
  "projectPath": "/path/to/project",
  "projectId": "proj_abc123",
  "imagePaths": ["/tmp/uploads/1705123456-8f3a2c1b.jpg"]
}
```

| 字段 | 类型 | 必填 | 描述 |
|-----|------|-----|------|
| prompt | string | 是 | 用户的初始提示/问题 |
| projectPath | string | 否 | Claude CLI 的工作目录，默认为当前目录 |
| projectId | string | 否 | 关联的项目 ID，用于保存对话到数据库 |
| imagePaths | string[] | 否 | 图片路径数组（通过 `/api/images/upload` 获取） |

#### 响应

**Content-Type:** `text/event-stream`

返回 SSE 事件流。详见 [SSE 事件类型](#sse-事件类型) 章节。

#### 副作用

当提供 `projectId` 时：
- 创建新的 Plan 记录
- 保存用户消息到 Conversation 表
- 保存 Claude 的 sessionId 到 Plan 表
- 保存助手响应到 Conversation 表

---

### POST /api/claude/continue

继续现有的 Claude 对话会话（用于回答 Claude 提出的问题）。

#### 请求

**Content-Type:** `application/json`

```json
{
  "answer": "选择第一个方案",
  "projectPath": "/path/to/project",
  "sessionId": "session_abc123",
  "planId": "plan_xyz789",
  "imagePaths": ["/tmp/uploads/1705123456-8f3a2c1b.jpg"]
}
```

| 字段 | 类型 | 必填 | 描述 |
|-----|------|-----|------|
| answer | string | 是 | 用户对之前问题的回答 |
| sessionId | string | 是 | 之前对话的会话 ID（从 `result` 事件获取） |
| projectPath | string | 否 | Claude CLI 的工作目录 |
| planId | string | 否 | 关联的 Plan ID |
| imagePaths | string[] | 否 | 附加的图片路径数组 |

#### 响应

**Content-Type:** `text/event-stream`

返回 SSE 事件流。格式与 `/api/claude/start` 相同。

#### 副作用

当提供 `planId` 时：
- 保存用户回答到 Conversation 表
- 清除 Plan 的 `pendingQuestion` 字段
- 保存助手响应到 Conversation 表

---

## SSE 事件类型

Claude API 返回的 SSE 流包含以下事件类型：

### init 事件

会话初始化事件，在开始处理时发送。

```json
{
  "type": "init",
  "data": {
    "cwd": "/path/to/project",
    "resuming": false,
    "tools": 15,
    "sessionId": "session_abc123"
  }
}
```

| 字段 | 类型 | 描述 |
|-----|------|------|
| cwd | string | 工作目录 |
| resuming | boolean | 是否为恢复的会话 |
| tools | number | 可用工具数量 |
| sessionId | string | Claude 会话 ID |

### text 事件

Claude 输出的文本内容（流式传输）。

```json
{
  "type": "text",
  "data": {
    "content": "让我来分析这段代码..."
  }
}
```

| 字段 | 类型 | 描述 |
|-----|------|------|
| content | string | 文本内容片段 |

### tool 事件

Claude 使用工具时的通知。

```json
{
  "type": "tool",
  "data": {
    "name": "Read",
    "id": "tool_use_123",
    "summary": "src/app/page.tsx",
    "timestamp": 1705123456789
  }
}
```

| 字段 | 类型 | 描述 |
|-----|------|------|
| name | string | 工具名称（如 Read, Grep, Bash 等） |
| id | string | 工具调用 ID |
| summary | string | 参数摘要（便于用户了解操作内容） |
| timestamp | number | 工具调用时间戳 |

### question 事件

Claude 向用户提问时发送。

```json
{
  "type": "question",
  "data": {
    "toolUseId": "tool_use_456",
    "questions": [
      {
        "question": "你希望使用哪种方案？",
        "header": "选择方案",
        "options": [
          { "label": "方案A", "description": "使用 React Context" },
          { "label": "方案B", "description": "使用 Redux" }
        ],
        "multiSelect": false
      }
    ]
  }
}
```

| 字段 | 类型 | 描述 |
|-----|------|------|
| toolUseId | string | AskUserQuestion 工具的调用 ID |
| questions | array | 问题数组 |
| questions[].question | string | 问题文本 |
| questions[].header | string | （可选）问题标题 |
| questions[].options | array | （可选）选项列表 |
| questions[].options[].label | string | 选项标签 |
| questions[].options[].description | string | （可选）选项描述 |
| questions[].multiSelect | boolean | 是否允许多选 |

### result 事件

对话完成时发送。

```json
{
  "type": "result",
  "data": {
    "content": "分析完成。主要问题是...",
    "sessionId": "session_abc123",
    "planId": "plan_xyz789"
  }
}
```

| 字段 | 类型 | 描述 |
|-----|------|------|
| content | string | 最终结果内容 |
| sessionId | string | 会话 ID（用于后续 continue 调用） |
| planId | string | （可选）关联的 Plan ID |

### error 事件

发生错误时发送。

```json
{
  "type": "error",
  "data": {
    "message": "Session not found",
    "errorType": "session_error",
    "code": "SESSION_NOT_FOUND",
    "recoverable": true,
    "details": "The session may have expired"
  }
}
```

| 字段 | 类型 | 描述 |
|-----|------|------|
| message | string | 错误信息 |
| errorType | string | 错误类型（见下表） |
| code | string | （可选）错误代码 |
| recoverable | boolean | 是否可恢复/重试 |
| details | string | （可选）详细信息 |

**错误类型:**

| errorType | 描述 |
|-----------|------|
| validation_error | 请求参数验证错误 |
| auth_error | 认证错误 |
| session_error | 会话错误（不存在、过期等） |
| claude_error | Claude CLI 返回的错误 |
| process_error | 进程启动/执行错误 |
| timeout_error | 超时错误 |
| unknown_error | 未知错误 |

### done 事件

流结束时发送。

```json
{
  "type": "done",
  "data": {}
}
```

---

## 客户端集成示例

### 处理 SSE 流

```typescript
async function handleClaudeStream(response: Response) {
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.slice(6))

        switch (event.type) {
          case 'text':
            // 追加文本到 UI
            appendText(event.data.content)
            break
          case 'question':
            // 显示问题对话框
            showQuestionDialog(event.data.questions)
            break
          case 'tool':
            // 显示工具调用状态
            showToolExecution(event.data.name, event.data.summary)
            break
          case 'result':
            // 保存 sessionId 用于后续对话
            saveSessionId(event.data.sessionId)
            break
          case 'error':
            // 处理错误
            handleError(event.data)
            break
          case 'done':
            // 流结束
            onStreamComplete()
            break
        }
      }
    }
  }
}
```

### 完整对话流程

```typescript
// 1. 上传图片（可选）
const uploadResponse = await fetch('/api/images/upload', {
  method: 'POST',
  body: formData,
  credentials: 'include'
})
const { paths: imagePaths } = await uploadResponse.json()

// 2. 开始对话
const startResponse = await fetch('/api/claude/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: '分析这段代码',
    projectId: 'proj_abc123',
    imagePaths
  })
})

// 3. 处理 SSE 流
let sessionId: string
await handleClaudeStream(startResponse, (event) => {
  if (event.type === 'result') {
    sessionId = event.data.sessionId
  }
  if (event.type === 'question') {
    // 用户回答问题后继续对话
    continueConversation(sessionId, userAnswer)
  }
})

// 4. 继续对话（回答问题）
async function continueConversation(sessionId: string, answer: string) {
  const continueResponse = await fetch('/api/claude/continue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answer,
      sessionId,
      planId: 'plan_xyz789'
    })
  })

  await handleClaudeStream(continueResponse)
}
```
