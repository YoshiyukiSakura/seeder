# Seedbed 测试用例设计文档

> 版本: v1.0
> 日期: 2026-01-05

---

## 一、单元测试 (Unit Tests)

### 1.1 认证模块 (`src/lib/auth.ts`)

#### TC-AUTH-001: JWT Token 生成
```typescript
describe('signJWT', () => {
  it('should generate valid JWT with userId', async () => {
    const jwt = await signJWT({ userId: 'user123', slackUsername: 'testuser' })
    expect(jwt).toBeTruthy()
    expect(typeof jwt).toBe('string')
  })

  it('should set correct expiration time (7 days)', async () => {
    const jwt = await signJWT({ userId: 'user123', slackUsername: 'testuser' })
    const decoded = await verifyJWT(jwt)
    const expiry = decoded.exp - decoded.iat
    expect(expiry).toBe(7 * 24 * 60 * 60) // 7 days in seconds
  })
})
```

#### TC-AUTH-002: JWT Token 验证
```typescript
describe('verifyJWT', () => {
  it('should verify valid token and return payload', async () => {
    const jwt = await signJWT({ userId: 'user123', slackUsername: 'testuser' })
    const payload = await verifyJWT(jwt)
    expect(payload.userId).toBe('user123')
    expect(payload.slackUsername).toBe('testuser')
  })

  it('should throw error for invalid token', async () => {
    await expect(verifyJWT('invalid.token.here')).rejects.toThrow()
  })

  it('should throw error for expired token', async () => {
    // Mock an expired token
    const expiredToken = createExpiredToken()
    await expect(verifyJWT(expiredToken)).rejects.toThrow()
  })

  it('should throw error for tampered token', async () => {
    const jwt = await signJWT({ userId: 'user123', slackUsername: 'testuser' })
    const tamperedJwt = jwt.slice(0, -5) + 'xxxxx'
    await expect(verifyJWT(tamperedJwt)).rejects.toThrow()
  })
})
```

#### TC-AUTH-003: 获取当前用户
```typescript
describe('getCurrentUser', () => {
  it('should return null when no cookie present', async () => {
    const mockRequest = createMockRequest({ cookies: {} })
    const user = await getCurrentUser()
    expect(user).toBeNull()
  })

  it('should return user when valid token', async () => {
    // Setup: create user in DB and valid token
    const user = await prisma.user.create({
      data: { slackUserId: 'U123', slackUsername: 'testuser' }
    })
    const token = await signJWT({ userId: user.id, slackUsername: 'testuser' })
    mockCookies({ 'auth-token': token })

    const result = await getCurrentUser()
    expect(result.id).toBe(user.id)
  })

  it('should return null when user not found in DB', async () => {
    const token = await signJWT({ userId: 'nonexistent', slackUsername: 'testuser' })
    mockCookies({ 'auth-token': token })

    const result = await getCurrentUser()
    expect(result).toBeNull()
  })
})
```

---

### 1.2 Claude CLI 模块 (`src/lib/claude.ts`)

#### TC-CLAUDE-001: SSE 事件解析
```typescript
describe('parseSSELine', () => {
  it('should parse init event', () => {
    const line = 'data: {"type":"init","data":{"cwd":"/project"}}'
    const event = parseSSELine(line)
    expect(event.type).toBe('init')
    expect(event.data.cwd).toBe('/project')
  })

  it('should parse text event', () => {
    const line = 'data: {"type":"text","data":{"content":"Hello"}}'
    const event = parseSSELine(line)
    expect(event.type).toBe('text')
    expect(event.data.content).toBe('Hello')
  })

  it('should parse question event', () => {
    const questionData = {
      type: 'question',
      data: {
        toolUseId: 'tool123',
        questions: [{ question: 'Which option?', options: [{ label: 'A' }, { label: 'B' }] }]
      }
    }
    const line = `data: ${JSON.stringify(questionData)}`
    const event = parseSSELine(line)
    expect(event.type).toBe('question')
    expect(event.data.questions).toHaveLength(1)
  })

  it('should handle malformed JSON gracefully', () => {
    const line = 'data: {invalid json}'
    expect(() => parseSSELine(line)).not.toThrow()
  })

  it('should ignore non-data lines', () => {
    const line = 'event: ping'
    const event = parseSSELine(line)
    expect(event).toBeNull()
  })
})
```

#### TC-CLAUDE-002: 任务提取
```typescript
describe('extractTasksFromMarkdown', () => {
  it('should extract task with all fields', () => {
    const markdown = `
## 任务 1: [P0] 创建数据模型
**描述**: 设计 Comment 表结构
**标签**: 后端, 数据库
**验收标准**:
- [ ] 数据库迁移成功
- [ ] 模型测试通过
**相关文件**: prisma/schema.prisma
**预估时间**: 2h
`
    const tasks = extractTasksFromMarkdown(markdown)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('创建数据模型')
    expect(tasks[0].priority).toBe(0)
    expect(tasks[0].labels).toContain('后端')
    expect(tasks[0].acceptanceCriteria).toHaveLength(2)
    expect(tasks[0].estimateHours).toBe(2)
  })

  it('should extract multiple tasks', () => {
    const markdown = `
## 任务 1: [P1] 任务一
## 任务 2: [P2] 任务二
## 任务 3: [P3] 任务三
`
    const tasks = extractTasksFromMarkdown(markdown)
    expect(tasks).toHaveLength(3)
  })

  it('should handle missing optional fields', () => {
    const markdown = `
## 任务 1: [P2] 简单任务
**描述**: 只有描述
`
    const tasks = extractTasksFromMarkdown(markdown)
    expect(tasks[0].labels).toEqual([])
    expect(tasks[0].acceptanceCriteria).toEqual([])
    expect(tasks[0].estimateHours).toBeNull()
  })

  it('should handle empty markdown', () => {
    const tasks = extractTasksFromMarkdown('')
    expect(tasks).toEqual([])
  })

  it('should default to P2 when priority not specified', () => {
    const markdown = `## 任务 1: 无优先级任务`
    const tasks = extractTasksFromMarkdown(markdown)
    expect(tasks[0].priority).toBe(2)
  })
})
```

#### TC-CLAUDE-003: 会话管理
```typescript
describe('Claude Session Management', () => {
  it('should extract session_id from result message', () => {
    const resultMsg = {
      type: 'result',
      subtype: 'success',
      session_id: 'sess_abc123',
      result: 'Plan completed'
    }
    const sessionId = extractSessionId(resultMsg)
    expect(sessionId).toBe('sess_abc123')
  })

  it('should build correct CLI args for start', () => {
    const args = buildClaudeArgs({
      mode: 'start',
      prompt: 'Create a comment feature',
      projectPath: '/project'
    })
    expect(args).toContain('--permission-mode')
    expect(args).toContain('plan')
    expect(args).toContain('--output-format')
    expect(args).toContain('stream-json')
    expect(args).toContain('--cwd')
    expect(args).toContain('/project')
  })

  it('should build correct CLI args for continue with session', () => {
    const args = buildClaudeArgs({
      mode: 'continue',
      prompt: 'Yes, proceed',
      sessionId: 'sess_abc123'
    })
    expect(args).toContain('--resume')
    expect(args).toContain('sess_abc123')
  })
})
```

---

### 1.3 Linear 集成模块 (`src/lib/linear/`)

#### TC-LINEAR-001: API Key 验证
```typescript
describe('validateApiKey', () => {
  it('should return true for valid API key', async () => {
    const validKey = 'lin_api_valid_key'
    mockLinearClient(validKey, { viewer: { id: 'user1', name: 'Test User' } })

    const result = await validateApiKey(validKey)
    expect(result).toBe(true)
  })

  it('should return false for invalid API key', async () => {
    const invalidKey = 'lin_api_invalid'
    mockLinearClientError(invalidKey, new Error('Invalid API key'))

    const result = await validateApiKey(invalidKey)
    expect(result).toBe(false)
  })

  it('should return false for empty API key', async () => {
    const result = await validateApiKey('')
    expect(result).toBe(false)
  })
})
```

#### TC-LINEAR-002: Issue 描述格式化
```typescript
describe('formatIssueDescription', () => {
  it('should format description with all fields', () => {
    const task = {
      description: 'Implement comment API',
      acceptanceCriteria: ['API returns 200', 'Data is persisted'],
      relatedFiles: ['src/api/comments.ts', 'prisma/schema.prisma']
    }
    const result = formatIssueDescription(task)

    expect(result).toContain('Implement comment API')
    expect(result).toContain('## 验收标准')
    expect(result).toContain('- [ ] API returns 200')
    expect(result).toContain('## 相关文件')
    expect(result).toContain('`src/api/comments.ts`')
    expect(result).toContain('由 Seedbed 自动创建')
  })

  it('should handle empty acceptance criteria', () => {
    const task = { description: 'Simple task', acceptanceCriteria: [], relatedFiles: [] }
    const result = formatIssueDescription(task)

    expect(result).not.toContain('## 验收标准')
    expect(result).not.toContain('## 相关文件')
  })
})
```

#### TC-LINEAR-003: 优先级映射
```typescript
describe('Priority Mapping', () => {
  it('should map P0 to Urgent (1)', () => {
    expect(mapPriority(0)).toBe(1)
  })

  it('should map P1 to High (2)', () => {
    expect(mapPriority(1)).toBe(2)
  })

  it('should map P2 to Medium (3)', () => {
    expect(mapPriority(2)).toBe(3)
  })

  it('should map P3 to Low (4)', () => {
    expect(mapPriority(3)).toBe(4)
  })

  it('should default to Medium for invalid priority', () => {
    expect(mapPriority(99)).toBe(3)
    expect(mapPriority(-1)).toBe(3)
  })
})
```

#### TC-LINEAR-004: META Issue 生成
```typescript
describe('formatMetaIssueDescription', () => {
  it('should generate correct statistics', () => {
    const tasks = [
      { priority: 0, estimateHours: 2 },
      { priority: 0, estimateHours: 3 },
      { priority: 1, estimateHours: 4 },
      { priority: 2, estimateHours: 1 },
    ]
    const publishedIssues = [
      { taskId: '1', identifier: 'ENG-1' },
      { taskId: '2', identifier: 'ENG-2' },
      { taskId: '3', identifier: 'ENG-3' },
      { taskId: '4', identifier: 'ENG-4' },
    ]

    const result = formatMetaIssueDescription('Test Plan', tasks, publishedIssues)

    expect(result).toContain('总任务数: 4')
    expect(result).toContain('P0 (紧急): 2')
    expect(result).toContain('P1 (高): 1')
    expect(result).toContain('总预估工时: 10h')
    expect(result).toContain('ENG-1')
  })
})
```

---

### 1.4 任务组件 (`src/components/tasks/`)

#### TC-TASK-001: TaskCard 组件
```typescript
describe('TaskCard', () => {
  it('should render task title and priority', () => {
    const task = createMockTask({ title: 'Test Task', priority: 0 })
    render(<TaskCard task={task} />)

    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('P0')).toBeInTheDocument()
  })

  it('should show correct priority color', () => {
    const p0Task = createMockTask({ priority: 0 })
    const { container } = render(<TaskCard task={p0Task} />)

    const badge = container.querySelector('.priority-badge')
    expect(badge).toHaveClass('bg-red-500') // P0 = red
  })

  it('should render labels', () => {
    const task = createMockTask({ labels: ['后端', '数据库'] })
    render(<TaskCard task={task} />)

    expect(screen.getByText('后端')).toBeInTheDocument()
    expect(screen.getByText('数据库')).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn()
    const task = createMockTask()
    render(<TaskCard task={task} onClick={handleClick} />)

    fireEvent.click(screen.getByRole('article'))
    expect(handleClick).toHaveBeenCalledWith(task)
  })

  it('should show Linear icon when linearIssueId present', () => {
    const task = createMockTask({ linearIssueId: 'issue123' })
    render(<TaskCard task={task} />)

    expect(screen.getByTestId('linear-linked-icon')).toBeInTheDocument()
  })
})
```

#### TC-TASK-002: TaskEditPanel 组件
```typescript
describe('TaskEditPanel', () => {
  it('should populate form with task data', () => {
    const task = createMockTask({
      title: 'Edit Me',
      description: 'Description here',
      priority: 1
    })
    render(<TaskEditPanel task={task} onSave={jest.fn()} />)

    expect(screen.getByDisplayValue('Edit Me')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Description here')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1')).toBeInTheDocument()
  })

  it('should call onSave with updated data', async () => {
    const onSave = jest.fn()
    const task = createMockTask({ title: 'Original' })
    render(<TaskEditPanel task={task} onSave={onSave} />)

    const titleInput = screen.getByLabelText('标题')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Updated Title')

    fireEvent.click(screen.getByText('保存'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Updated Title'
    }))
  })

  it('should add new acceptance criteria', async () => {
    const task = createMockTask({ acceptanceCriteria: ['Existing'] })
    render(<TaskEditPanel task={task} onSave={jest.fn()} />)

    await userEvent.type(screen.getByPlaceholderText('添加验收标准'), 'New criterion')
    fireEvent.click(screen.getByTestId('add-criteria-btn'))

    expect(screen.getByText('New criterion')).toBeInTheDocument()
  })

  it('should remove acceptance criteria', async () => {
    const task = createMockTask({ acceptanceCriteria: ['To Remove', 'Keep This'] })
    render(<TaskEditPanel task={task} onSave={jest.fn()} />)

    const removeButtons = screen.getAllByTestId('remove-criteria-btn')
    fireEvent.click(removeButtons[0])

    expect(screen.queryByText('To Remove')).not.toBeInTheDocument()
    expect(screen.getByText('Keep This')).toBeInTheDocument()
  })

  it('should validate required title', async () => {
    const task = createMockTask()
    render(<TaskEditPanel task={task} onSave={jest.fn()} />)

    const titleInput = screen.getByLabelText('标题')
    await userEvent.clear(titleInput)
    fireEvent.click(screen.getByText('保存'))

    expect(screen.getByText('标题不能为空')).toBeInTheDocument()
  })
})
```

#### TC-TASK-003: TaskList 拖拽排序
```typescript
describe('TaskList Drag and Drop', () => {
  it('should render tasks in correct order', () => {
    const tasks = [
      createMockTask({ id: '1', title: 'First', sortOrder: 0 }),
      createMockTask({ id: '2', title: 'Second', sortOrder: 1 }),
      createMockTask({ id: '3', title: 'Third', sortOrder: 2 }),
    ]
    render(<TaskList tasks={tasks} />)

    const taskElements = screen.getAllByRole('article')
    expect(taskElements[0]).toHaveTextContent('First')
    expect(taskElements[1]).toHaveTextContent('Second')
    expect(taskElements[2]).toHaveTextContent('Third')
  })

  it('should call onReorder when drag ends', async () => {
    const onReorder = jest.fn()
    const tasks = [
      createMockTask({ id: '1', title: 'First', sortOrder: 0 }),
      createMockTask({ id: '2', title: 'Second', sortOrder: 1 }),
    ]
    render(<TaskList tasks={tasks} onReorder={onReorder} />)

    // Simulate drag from First to after Second
    await simulateDragAndDrop(
      screen.getByText('First'),
      screen.getByText('Second')
    )

    expect(onReorder).toHaveBeenCalledWith(['2', '1'])
  })
})
```

---

## 二、集成测试 (Integration Tests)

### 2.1 API 端点测试

#### TC-API-001: 认证流程
```typescript
describe('POST /api/auth/slack', () => {
  beforeEach(async () => {
    await prisma.loginToken.deleteMany()
    await prisma.user.deleteMany()
  })

  it('should create user and set cookie for valid token', async () => {
    // Setup: create login token
    const loginToken = await prisma.loginToken.create({
      data: {
        token: 'valid_token_123',
        slackUserId: 'U12345',
        slackUsername: 'testuser',
        slackTeamId: 'T12345',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
      }
    })

    const response = await request(app)
      .get('/api/auth/slack?token=valid_token_123')
      .expect(302) // Redirect

    expect(response.headers['set-cookie']).toBeDefined()
    expect(response.headers.location).toBe('/')

    // Verify user created
    const user = await prisma.user.findUnique({
      where: { slackUserId: 'U12345' }
    })
    expect(user).toBeTruthy()
    expect(user.slackUsername).toBe('testuser')

    // Verify token marked as used
    const usedToken = await prisma.loginToken.findUnique({
      where: { id: loginToken.id }
    })
    expect(usedToken.usedAt).toBeTruthy()
  })

  it('should reject expired token', async () => {
    await prisma.loginToken.create({
      data: {
        token: 'expired_token',
        slackUserId: 'U12345',
        slackUsername: 'testuser',
        expiresAt: new Date(Date.now() - 1000) // Expired
      }
    })

    const response = await request(app)
      .get('/api/auth/slack?token=expired_token')
      .expect(302)

    expect(response.headers.location).toContain('error=token_expired')
  })

  it('should reject already used token', async () => {
    await prisma.loginToken.create({
      data: {
        token: 'used_token',
        slackUserId: 'U12345',
        slackUsername: 'testuser',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        usedAt: new Date() // Already used
      }
    })

    const response = await request(app)
      .get('/api/auth/slack?token=used_token')
      .expect(302)

    expect(response.headers.location).toContain('error=token_used')
  })
})
```

#### TC-API-002: 项目 CRUD
```typescript
describe('Projects API', () => {
  let authCookie: string
  let testUser: User

  beforeEach(async () => {
    testUser = await createTestUser()
    authCookie = await getAuthCookie(testUser)
  })

  describe('GET /api/projects', () => {
    it('should return projects for user team', async () => {
      await prisma.project.create({
        data: {
          name: 'Team Project',
          userId: testUser.id
        }
      })

      const response = await request(app)
        .get('/api/projects')
        .set('Cookie', authCookie)
        .expect(200)

      expect(response.body.projects).toHaveLength(1)
      expect(response.body.projects[0].name).toBe('Team Project')
    })

    it('should return 401 without auth', async () => {
      await request(app)
        .get('/api/projects')
        .expect(401)
    })
  })

  describe('POST /api/projects', () => {
    it('should create new project', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Cookie', authCookie)
        .send({
          name: 'New Project',
          description: 'Test description'
        })
        .expect(201)

      expect(response.body.project.name).toBe('New Project')

      const dbProject = await prisma.project.findUnique({
        where: { id: response.body.project.id }
      })
      expect(dbProject).toBeTruthy()
    })

    it('should reject empty name', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Cookie', authCookie)
        .send({ name: '' })
        .expect(400)

      expect(response.body.error).toContain('name')
    })
  })

  describe('DELETE /api/projects/[id]', () => {
    it('should delete project and cascade to plans/tasks', async () => {
      const project = await prisma.project.create({
        data: {
          name: 'To Delete',
          userId: testUser.id,
          plans: {
            create: {
              name: 'Plan 1',
              tasks: {
                create: { title: 'Task 1', description: 'Desc' }
              }
            }
          }
        }
      })

      await request(app)
        .delete(`/api/projects/${project.id}`)
        .set('Cookie', authCookie)
        .expect(200)

      const deletedProject = await prisma.project.findUnique({
        where: { id: project.id }
      })
      expect(deletedProject).toBeNull()

      const plans = await prisma.plan.findMany({
        where: { projectId: project.id }
      })
      expect(plans).toHaveLength(0)
    })
  })
})
```

#### TC-API-003: 任务 API
```typescript
describe('Tasks API', () => {
  let authCookie: string
  let testPlan: Plan

  beforeEach(async () => {
    const { user, cookie } = await setupAuthenticatedUser()
    authCookie = cookie

    const project = await prisma.project.create({
      data: { name: 'Test Project', userId: user.id }
    })

    testPlan = await prisma.plan.create({
      data: { name: 'Test Plan', projectId: project.id }
    })
  })

  describe('GET /api/plans/[planId]/tasks', () => {
    it('should return tasks sorted by sortOrder', async () => {
      await prisma.task.createMany({
        data: [
          { planId: testPlan.id, title: 'Third', description: '', sortOrder: 2 },
          { planId: testPlan.id, title: 'First', description: '', sortOrder: 0 },
          { planId: testPlan.id, title: 'Second', description: '', sortOrder: 1 },
        ]
      })

      const response = await request(app)
        .get(`/api/plans/${testPlan.id}/tasks`)
        .set('Cookie', authCookie)
        .expect(200)

      expect(response.body.tasks[0].title).toBe('First')
      expect(response.body.tasks[1].title).toBe('Second')
      expect(response.body.tasks[2].title).toBe('Third')
    })
  })

  describe('POST /api/plans/[planId]/tasks', () => {
    it('should create multiple tasks in batch', async () => {
      const tasks = [
        { title: 'Task 1', description: 'Desc 1', priority: 0 },
        { title: 'Task 2', description: 'Desc 2', priority: 1 },
      ]

      const response = await request(app)
        .post(`/api/plans/${testPlan.id}/tasks`)
        .set('Cookie', authCookie)
        .send({ tasks })
        .expect(201)

      expect(response.body.tasks).toHaveLength(2)

      const dbTasks = await prisma.task.findMany({
        where: { planId: testPlan.id }
      })
      expect(dbTasks).toHaveLength(2)
    })

    it('should assign correct sortOrder to new tasks', async () => {
      // Create initial task
      await prisma.task.create({
        data: { planId: testPlan.id, title: 'Existing', description: '', sortOrder: 0 }
      })

      const response = await request(app)
        .post(`/api/plans/${testPlan.id}/tasks`)
        .set('Cookie', authCookie)
        .send({ tasks: [{ title: 'New', description: 'New task' }] })
        .expect(201)

      expect(response.body.tasks[0].sortOrder).toBe(1)
    })
  })

  describe('PUT /api/plans/[planId]/tasks/[taskId]', () => {
    it('should update task fields', async () => {
      const task = await prisma.task.create({
        data: {
          planId: testPlan.id,
          title: 'Original',
          description: 'Original desc',
          priority: 2
        }
      })

      const response = await request(app)
        .put(`/api/plans/${testPlan.id}/tasks/${task.id}`)
        .set('Cookie', authCookie)
        .send({
          title: 'Updated',
          priority: 0,
          labels: ['后端']
        })
        .expect(200)

      expect(response.body.task.title).toBe('Updated')
      expect(response.body.task.priority).toBe(0)
      expect(response.body.task.labels).toContain('后端')
    })
  })
})
```

#### TC-API-004: Linear 集成 API
```typescript
describe('Linear Integration API', () => {
  let authCookie: string
  let testUser: User

  beforeEach(async () => {
    const setup = await setupAuthenticatedUser()
    authCookie = setup.cookie
    testUser = setup.user
  })

  describe('POST /api/linear/validate', () => {
    it('should validate correct API key', async () => {
      mockLinearSDK.viewer.mockResolvedValue({
        id: 'user123',
        name: 'Test User',
        email: 'test@example.com'
      })

      const response = await request(app)
        .post('/api/linear/validate')
        .set('Cookie', authCookie)
        .send({ apiKey: 'lin_api_valid' })
        .expect(200)

      expect(response.body.valid).toBe(true)
      expect(response.body.user.name).toBe('Test User')
    })

    it('should reject invalid API key', async () => {
      mockLinearSDK.viewer.mockRejectedValue(new Error('Invalid'))

      const response = await request(app)
        .post('/api/linear/validate')
        .set('Cookie', authCookie)
        .send({ apiKey: 'invalid_key' })
        .expect(200)

      expect(response.body.valid).toBe(false)
    })
  })

  describe('GET /api/linear/teams', () => {
    it('should return user teams when linearToken set', async () => {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { linearToken: 'encrypted_token' }
      })

      mockLinearSDK.teams.mockResolvedValue({
        nodes: [
          { id: 'team1', name: 'Engineering', key: 'ENG' },
          { id: 'team2', name: 'Design', key: 'DES' }
        ]
      })

      const response = await request(app)
        .get('/api/linear/teams')
        .set('Cookie', authCookie)
        .expect(200)

      expect(response.body.teams).toHaveLength(2)
    })

    it('should return 400 when linearToken not set', async () => {
      await request(app)
        .get('/api/linear/teams')
        .set('Cookie', authCookie)
        .expect(400)
    })
  })

  describe('POST /api/plans/[planId]/publish', () => {
    it('should publish tasks to Linear', async () => {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { linearToken: 'valid_token' }
      })

      const plan = await createTestPlanWithTasks(testUser.id)

      mockLinearSDK.createIssue.mockResolvedValue({
        success: true,
        issue: Promise.resolve({
          id: 'issue123',
          url: 'https://linear.app/team/issue/ENG-1',
          identifier: 'ENG-1'
        })
      })

      const response = await request(app)
        .post(`/api/plans/${plan.id}/publish`)
        .set('Cookie', authCookie)
        .send({
          teamId: 'team1',
          createMetaIssue: true
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.issues).toBeDefined()

      // Verify linearIssueId saved
      const task = await prisma.task.findFirst({
        where: { planId: plan.id }
      })
      expect(task.linearIssueId).toBe('issue123')
    })
  })
})
```

---

### 2.2 Claude CLI 集成测试

#### TC-CLAUDE-INT-001: SSE 流式响应
```typescript
describe('Claude CLI SSE Integration', () => {
  it('should stream Claude output as SSE events', async () => {
    const events: SSEEvent[] = []

    const response = await fetch('/api/claude/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({
        prompt: 'Create a simple todo app',
        projectPath: '/test-project'
      })
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value)
      const lines = text.split('\n').filter(l => l.startsWith('data:'))

      for (const line of lines) {
        const event = JSON.parse(line.slice(5))
        events.push(event)
      }
    }

    expect(events.some(e => e.type === 'init')).toBe(true)
    expect(events.some(e => e.type === 'text')).toBe(true)
    expect(events.some(e => e.type === 'done')).toBe(true)
  }, 60000) // 60s timeout

  it('should handle AskUserQuestion and continue', async () => {
    // Start session
    const startResponse = await streamClaude('/api/claude/start', {
      prompt: 'Add authentication feature'
    })

    // Check for question event
    const questionEvent = startResponse.events.find(e => e.type === 'question')
    expect(questionEvent).toBeDefined()

    // Continue with answer
    const continueResponse = await streamClaude('/api/claude/continue', {
      answer: 'Use JWT tokens'
    })

    expect(continueResponse.events.some(e => e.type === 'result')).toBe(true)
  }, 120000)
})
```

---

### 2.3 数据库集成测试

#### TC-DB-001: 数据完整性
```typescript
describe('Database Integrity', () => {
  it('should enforce unique slackUserId', async () => {
    await prisma.user.create({
      data: { slackUserId: 'U123', slackUsername: 'user1' }
    })

    await expect(
      prisma.user.create({
        data: { slackUserId: 'U123', slackUsername: 'user2' }
      })
    ).rejects.toThrow('Unique constraint')
  })

  it('should cascade delete plans when project deleted', async () => {
    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        user: { create: { slackUserId: 'U123', slackUsername: 'test' } },
        plans: {
          create: { name: 'Plan 1' }
        }
      },
      include: { plans: true }
    })

    await prisma.project.delete({ where: { id: project.id } })

    const plans = await prisma.plan.findMany({
      where: { projectId: project.id }
    })
    expect(plans).toHaveLength(0)
  })

  it('should handle self-referential task dependencies', async () => {
    const plan = await createTestPlan()

    const task1 = await prisma.task.create({
      data: { planId: plan.id, title: 'Task 1', description: '' }
    })

    const task2 = await prisma.task.create({
      data: {
        planId: plan.id,
        title: 'Task 2',
        description: '',
        dependsOnId: task1.id
      }
    })

    const task2WithDep = await prisma.task.findUnique({
      where: { id: task2.id },
      include: { dependsOn: true }
    })

    expect(task2WithDep.dependsOn.id).toBe(task1.id)
  })
})
```

---

## 三、端到端测试 (E2E Tests)

### 3.1 认证流程 E2E

#### TC-E2E-001: 完整登录流程
```typescript
describe('Login Flow', () => {
  it('should complete full Slack login flow', async () => {
    // 1. Generate login token (simulating Slack Bot)
    const tokenResponse = await fetch(`${API_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'X-Bot-Secret': BOT_SECRET },
      body: JSON.stringify({
        slackUserId: 'U12345',
        slackUsername: 'testuser',
        slackTeamId: 'T12345'
      })
    })
    const { token, loginUrl } = await tokenResponse.json()

    // 2. Visit login URL
    await page.goto(loginUrl)

    // 3. Verify redirect to dashboard
    await expect(page).toHaveURL('/')

    // 4. Verify user info displayed
    await expect(page.locator('[data-testid="user-greeting"]')).toContainText('testuser')
  })

  it('should show error for invalid token', async () => {
    await page.goto(`${APP_URL}/auth?token=invalid_token`)

    await expect(page).toHaveURL(/\/login\?error=invalid_token/)
    await expect(page.locator('.error-message')).toBeVisible()
  })
})
```

### 3.2 主流程 E2E

#### TC-E2E-002: 创建项目和计划
```typescript
describe('Project and Plan Creation', () => {
  beforeEach(async () => {
    await loginAsTestUser(page)
  })

  it('should create new project', async () => {
    // Click create project button
    await page.click('[data-testid="create-project-btn"]')

    // Fill form
    await page.fill('[name="projectName"]', 'E2E Test Project')
    await page.fill('[name="description"]', 'Created by E2E test')

    // Submit
    await page.click('[data-testid="submit-project-btn"]')

    // Verify project appears in list
    await expect(page.locator('[data-testid="project-card"]')).toContainText('E2E Test Project')
  })

  it('should create new plan within project', async () => {
    // Navigate to project
    await page.click('text=E2E Test Project')

    // Create plan
    await page.click('[data-testid="create-plan-btn"]')
    await page.fill('[name="planName"]', 'Test Feature Plan')
    await page.click('[data-testid="submit-plan-btn"]')

    // Verify navigation to plan page
    await expect(page).toHaveURL(/\/plans\//)
    await expect(page.locator('h1')).toContainText('Test Feature Plan')
  })
})
```

#### TC-E2E-003: AI 对话和任务生成
```typescript
describe('AI Chat and Task Generation', () => {
  beforeEach(async () => {
    await loginAsTestUser(page)
    await navigateToTestPlan(page)
  })

  it('should send message and receive AI response', async () => {
    // Type message
    await page.fill('[data-testid="chat-input"]', 'Add a comment feature with nested replies')
    await page.click('[data-testid="send-btn"]')

    // Wait for AI response (streaming)
    await expect(page.locator('[data-testid="ai-message"]')).toBeVisible({ timeout: 30000 })

    // Verify response contains relevant content
    const response = await page.locator('[data-testid="ai-message"]').textContent()
    expect(response.toLowerCase()).toContain('comment')
  }, 60000)

  it('should handle multi-turn questions', async () => {
    await page.fill('[data-testid="chat-input"]', 'Add user authentication')
    await page.click('[data-testid="send-btn"]')

    // Wait for question UI
    await expect(page.locator('[data-testid="question-panel"]')).toBeVisible({ timeout: 30000 })

    // Select an option
    await page.click('[data-testid="option-0"]') // First option
    await page.click('[data-testid="submit-answer-btn"]')

    // Verify conversation continues
    await expect(page.locator('[data-testid="ai-message"]').last()).toBeVisible()
  }, 90000)

  it('should extract and display tasks from AI response', async () => {
    await page.fill('[data-testid="chat-input"]', 'Create a simple todo app with CRUD operations')
    await page.click('[data-testid="send-btn"]')

    // Wait for tasks to appear
    await expect(page.locator('[data-testid="task-card"]').first()).toBeVisible({ timeout: 60000 })

    // Verify multiple tasks generated
    const taskCount = await page.locator('[data-testid="task-card"]').count()
    expect(taskCount).toBeGreaterThan(0)
  }, 90000)
})
```

#### TC-E2E-004: 任务编辑
```typescript
describe('Task Editing', () => {
  beforeEach(async () => {
    await loginAsTestUser(page)
    await navigateToTestPlanWithTasks(page)
  })

  it('should edit task details', async () => {
    // Click on first task
    await page.click('[data-testid="task-card"]:first-child')

    // Edit panel should appear
    await expect(page.locator('[data-testid="task-edit-panel"]')).toBeVisible()

    // Edit title
    await page.fill('[data-testid="edit-title"]', 'Updated Task Title')

    // Change priority
    await page.selectOption('[data-testid="edit-priority"]', '0')

    // Save
    await page.click('[data-testid="save-task-btn"]')

    // Verify changes reflected
    await expect(page.locator('[data-testid="task-card"]:first-child')).toContainText('Updated Task Title')
    await expect(page.locator('[data-testid="task-card"]:first-child .priority')).toContainText('P0')
  })

  it('should reorder tasks via drag and drop', async () => {
    const firstTask = page.locator('[data-testid="task-card"]:first-child')
    const secondTask = page.locator('[data-testid="task-card"]:nth-child(2)')

    const firstTaskTitle = await firstTask.locator('.task-title').textContent()
    const secondTaskTitle = await secondTask.locator('.task-title').textContent()

    // Drag first to second position
    await firstTask.dragTo(secondTask)

    // Verify order changed
    const newFirstTitle = await page.locator('[data-testid="task-card"]:first-child .task-title').textContent()
    expect(newFirstTitle).toBe(secondTaskTitle)
  })

  it('should manage acceptance criteria', async () => {
    await page.click('[data-testid="task-card"]:first-child')

    // Add new criterion
    await page.fill('[data-testid="new-criteria-input"]', 'New acceptance criterion')
    await page.click('[data-testid="add-criteria-btn"]')

    // Verify added
    await expect(page.locator('[data-testid="criteria-item"]')).toContainText('New acceptance criterion')

    // Remove criterion
    await page.click('[data-testid="remove-criteria-btn"]:first-child')

    // Verify removed
    await expect(page.locator('[data-testid="criteria-item"]').first()).not.toContainText('New acceptance criterion')
  })
})
```

### 3.3 Linear 集成 E2E

#### TC-E2E-005: Linear API Key 配置
```typescript
describe('Linear Settings', () => {
  beforeEach(async () => {
    await loginAsTestUser(page)
  })

  it('should save and validate Linear API key', async () => {
    await page.goto(`${APP_URL}/settings`)

    // Enter API key
    await page.fill('[data-testid="linear-api-key"]', TEST_LINEAR_API_KEY)
    await page.click('[data-testid="validate-key-btn"]')

    // Wait for validation
    await expect(page.locator('[data-testid="validation-success"]')).toBeVisible()
    await expect(page.locator('[data-testid="connected-user"]')).toContainText('@')

    // Save
    await page.click('[data-testid="save-settings-btn"]')
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible()

    // Refresh and verify persisted
    await page.reload()
    await expect(page.locator('[data-testid="key-saved-indicator"]')).toBeVisible()
  })

  it('should show error for invalid API key', async () => {
    await page.goto(`${APP_URL}/settings`)

    await page.fill('[data-testid="linear-api-key"]', 'invalid_key')
    await page.click('[data-testid="validate-key-btn"]')

    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible()
  })
})
```

#### TC-E2E-006: 发布到 Linear
```typescript
describe('Publish to Linear', () => {
  beforeEach(async () => {
    await loginAsTestUser(page)
    await setupLinearApiKey(page)
    await navigateToTestPlanWithTasks(page)
  })

  it('should publish tasks to Linear', async () => {
    // Open publish dialog
    await page.click('[data-testid="publish-btn"]')

    // Select team
    await page.click('[data-testid="team-select"]')
    await page.click('[data-testid="team-option"]:first-child')

    // Enable META issue
    await page.check('[data-testid="create-meta-issue"]')

    // Publish
    await page.click('[data-testid="confirm-publish-btn"]')

    // Wait for completion
    await expect(page.locator('[data-testid="publish-success"]')).toBeVisible({ timeout: 30000 })

    // Verify Linear links shown
    await expect(page.locator('[data-testid="linear-issue-link"]')).toBeVisible()
  }, 60000)

  it('should show error when Linear API fails', async () => {
    // Mock Linear API failure
    await mockLinearAPIFailure()

    await page.click('[data-testid="publish-btn"]')
    await page.click('[data-testid="team-select"]')
    await page.click('[data-testid="team-option"]:first-child')
    await page.click('[data-testid="confirm-publish-btn"]')

    await expect(page.locator('[data-testid="publish-error"]')).toBeVisible()
  })
})
```

### 3.4 导出功能 E2E

#### TC-E2E-007: 导出任务
```typescript
describe('Export Tasks', () => {
  beforeEach(async () => {
    await loginAsTestUser(page)
    await navigateToTestPlanWithTasks(page)
  })

  it('should export tasks as JSON', async () => {
    // Setup download listener
    const downloadPromise = page.waitForEvent('download')

    // Click export JSON
    await page.click('[data-testid="export-json-btn"]')

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.json$/)

    // Verify content
    const content = await download.createReadStream().then(stream => {
      return new Promise(resolve => {
        let data = ''
        stream.on('data', chunk => data += chunk)
        stream.on('end', () => resolve(JSON.parse(data)))
      })
    })

    expect(content.tasks).toBeDefined()
    expect(Array.isArray(content.tasks)).toBe(true)
  })

  it('should export tasks as Markdown', async () => {
    const downloadPromise = page.waitForEvent('download')

    await page.click('[data-testid="export-md-btn"]')

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.md$/)
  })
})
```

---

## 四、性能测试

### 4.1 负载测试

#### TC-PERF-001: 并发 API 请求
```typescript
describe('API Load Testing', () => {
  it('should handle 50 concurrent task creation requests', async () => {
    const plan = await createTestPlan()
    const requests = []

    for (let i = 0; i < 50; i++) {
      requests.push(
        fetch(`/api/plans/${plan.id}/tasks`, {
          method: 'POST',
          headers: { 'Cookie': authCookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: [{ title: `Task ${i}`, description: 'Load test' }] })
        })
      )
    }

    const responses = await Promise.all(requests)
    const successCount = responses.filter(r => r.status === 201).length

    expect(successCount).toBe(50)
  })

  it('should respond within 200ms for project list', async () => {
    const start = Date.now()
    await fetch('/api/projects', {
      headers: { 'Cookie': authCookie }
    })
    const duration = Date.now() - start

    expect(duration).toBeLessThan(200)
  })
})
```

### 4.2 大数据量测试

#### TC-PERF-002: 大量任务处理
```typescript
describe('Large Data Handling', () => {
  it('should handle plan with 100+ tasks', async () => {
    const plan = await createTestPlan()
    const tasks = Array.from({ length: 100 }, (_, i) => ({
      title: `Task ${i + 1}`,
      description: `Description for task ${i + 1}`,
      priority: i % 4,
      labels: ['test'],
      acceptanceCriteria: ['Criterion 1', 'Criterion 2']
    }))

    const response = await fetch(`/api/plans/${plan.id}/tasks`, {
      method: 'POST',
      headers: { 'Cookie': authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks })
    })

    expect(response.status).toBe(201)

    const result = await response.json()
    expect(result.tasks).toHaveLength(100)
  })

  it('should render 100 task cards without lag', async () => {
    await navigateToPlanWith100Tasks(page)

    // Measure render time
    const startTime = await page.evaluate(() => performance.now())
    await page.waitForSelector('[data-testid="task-card"]', { state: 'attached' })
    const endTime = await page.evaluate(() => performance.now())

    expect(endTime - startTime).toBeLessThan(2000) // Under 2 seconds
  })
})
```

---

## 五、安全测试

### 5.1 认证安全

#### TC-SEC-001: Token 安全
```typescript
describe('Authentication Security', () => {
  it('should not expose JWT secret in responses', async () => {
    const response = await fetch('/api/auth/me', {
      headers: { 'Cookie': authCookie }
    })
    const body = await response.text()

    expect(body).not.toContain(process.env.AUTH_SECRET)
  })

  it('should invalidate token after logout', async () => {
    // Logout
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    })

    // Try to access protected route
    const response = await fetch('/api/projects', {
      headers: { 'Cookie': authCookie }
    })

    expect(response.status).toBe(401)
  })

  it('should not allow login token reuse', async () => {
    const token = await generateLoginToken()

    // First use
    const response1 = await fetch(`/api/auth/slack?token=${token}`)
    expect(response1.status).toBe(302)

    // Second use attempt
    const response2 = await fetch(`/api/auth/slack?token=${token}`)
    expect(response2.headers.get('location')).toContain('error=token_used')
  })
})
```

### 5.2 权限控制

#### TC-SEC-002: 跨用户访问
```typescript
describe('Authorization', () => {
  it('should not allow access to other team projects', async () => {
    // Create project for team A
    const teamAUser = await createTestUser({ slackTeamId: 'TEAM_A' })
    const project = await createProject(teamAUser)

    // Try to access with team B user
    const teamBUser = await createTestUser({ slackTeamId: 'TEAM_B' })
    const teamBCookie = await getAuthCookie(teamBUser)

    const response = await fetch(`/api/projects/${project.id}`, {
      headers: { 'Cookie': teamBCookie }
    })

    expect(response.status).toBe(404) // or 403
  })

  it('should encrypt Linear API key in database', async () => {
    await prisma.user.update({
      where: { id: testUser.id },
      data: { linearToken: 'lin_api_secret_key' }
    })

    const user = await prisma.user.findUnique({
      where: { id: testUser.id }
    })

    // Should be encrypted, not plaintext
    expect(user.linearToken).not.toBe('lin_api_secret_key')
  })
})
```

### 5.3 输入验证

#### TC-SEC-003: XSS 防护
```typescript
describe('Input Validation', () => {
  it('should sanitize task title for XSS', async () => {
    const maliciousTitle = '<script>alert("xss")</script>'

    await fetch(`/api/plans/${testPlan.id}/tasks`, {
      method: 'POST',
      headers: { 'Cookie': authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: [{ title: maliciousTitle, description: 'Test' }]
      })
    })

    // Render in browser
    await page.goto(`/plans/${testPlan.id}`)

    // Should not execute script
    const alerts = []
    page.on('dialog', dialog => alerts.push(dialog))

    await page.waitForTimeout(1000)
    expect(alerts).toHaveLength(0)
  })

  it('should validate project name length', async () => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Cookie': authCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'a'.repeat(256) // Too long
      })
    })

    expect(response.status).toBe(400)
  })
})
```

---

## 六、测试环境配置

### 6.1 推荐测试框架

```json
// package.json devDependencies
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@playwright/test": "^1.40.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "supertest": "^6.3.0",
    "msw": "^2.0.0"
  }
}
```

### 6.2 测试脚本配置

```json
// package.json scripts
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:coverage": "jest --coverage"
  }
}
```

### 6.3 Jest 配置

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts'
  ]
}
```

### 6.4 Playwright 配置

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

---

## 七、测试覆盖率目标

| 类型 | 覆盖率目标 |
|------|-----------|
| 单元测试 (语句覆盖) | >= 80% |
| 单元测试 (分支覆盖) | >= 70% |
| 集成测试 (API 端点) | 100% |
| E2E 测试 (关键路径) | 100% |

---

## 八、测试执行计划

### Phase 1: 单元测试 (1-2 天)
1. 认证模块测试
2. Claude CLI 模块测试
3. Linear 集成模块测试
4. React 组件测试

### Phase 2: 集成测试 (2-3 天)
1. API 端点测试
2. 数据库操作测试
3. Claude CLI SSE 集成测试

### Phase 3: E2E 测试 (2-3 天)
1. 认证流程
2. 主要业务流程
3. Linear 发布流程
4. 错误场景

### Phase 4: 性能和安全测试 (1-2 天)
1. 负载测试
2. 大数据量测试
3. 安全漏洞扫描

---

*文档版本: v1.0*
*创建日期: 2026-01-05*
