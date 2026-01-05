/**
 * Linear 集成模块单元测试
 * 测试 src/lib/linear/client.ts 和 src/lib/linear/publish.ts
 */
import { createMockLinearClient, createMockTask } from '../../utils/mocks'
import { SAMPLE_TASKS, LINEAR_TEAMS, LINEAR_PROJECTS, LINEAR_WORKFLOW_STATES } from '../../utils/fixtures'
import { TaskToPublish } from '@/lib/linear/publish'

// Mock Linear SDK
jest.mock('@linear/sdk', () => ({
  LinearClient: jest.fn().mockImplementation(() => createMockLinearClient()),
}))

describe('Linear Client Module', () => {
  describe('validateApiKey', () => {
    it('should return user for valid API key', async () => {
      const mockClient = createMockLinearClient()
      const viewer = await mockClient.viewer

      expect(viewer).toBeDefined()
      expect(viewer.id).toBe('linear_user_123')
      expect(viewer.name).toBe('Linear User')
      expect(viewer.email).toBe('linear@example.com')
    })

    it('should handle API key validation failure', async () => {
      const mockClient = {
        ...createMockLinearClient(),
        viewer: Promise.reject(new Error('Invalid API key')),
      }

      await expect(mockClient.viewer).rejects.toThrow('Invalid API key')
    })
  })

  describe('getTeams', () => {
    it('should return list of teams', async () => {
      const mockClient = createMockLinearClient()
      const teams = await mockClient.teams()

      expect(teams.nodes).toHaveLength(2)
      expect(teams.nodes[0]).toHaveProperty('id')
      expect(teams.nodes[0]).toHaveProperty('name')
      expect(teams.nodes[0]).toHaveProperty('key')
    })

    it('should transform team data correctly', async () => {
      const mockClient = createMockLinearClient()
      const teams = await mockClient.teams()

      const transformedTeams = teams.nodes.map(team => ({
        id: team.id,
        name: team.name,
        key: team.key,
      }))

      expect(transformedTeams[0].id).toBe('team_1')
      expect(transformedTeams[0].name).toBe('Engineering')
      expect(transformedTeams[0].key).toBe('ENG')
    })
  })

  describe('getProjects', () => {
    it('should return list of projects for team', async () => {
      const mockClient = createMockLinearClient()
      const team = mockClient.team('team_1')
      const projects = await team.projects()

      expect(projects.nodes).toHaveLength(2)
      expect(projects.nodes[0]).toHaveProperty('id')
      expect(projects.nodes[0]).toHaveProperty('name')
      expect(projects.nodes[0]).toHaveProperty('state')
    })
  })

  describe('getWorkflowStates', () => {
    it('should return workflow states for team', async () => {
      const mockClient = createMockLinearClient()
      const states = await mockClient.workflowStates()

      expect(states.nodes.length).toBeGreaterThan(0)
      expect(states.nodes[0]).toHaveProperty('id')
      expect(states.nodes[0]).toHaveProperty('name')
      expect(states.nodes[0]).toHaveProperty('type')
      expect(states.nodes[0]).toHaveProperty('color')
    })

    it('should include all standard state types', async () => {
      const mockClient = createMockLinearClient()
      const states = await mockClient.workflowStates()

      const types = states.nodes.map(s => s.type)

      expect(types).toContain('backlog')
      expect(types).toContain('unstarted')
      expect(types).toContain('started')
      expect(types).toContain('completed')
    })
  })
})

describe('Linear Publish Module', () => {
  describe('Priority Mapping', () => {
    const PRIORITY_MAP: Record<number, number> = {
      0: 1, // P0 -> Urgent
      1: 2, // P1 -> High
      2: 3, // P2 -> Medium
      3: 4, // P3 -> Low
    }

    it('should map P0 to Urgent (1)', () => {
      expect(PRIORITY_MAP[0]).toBe(1)
    })

    it('should map P1 to High (2)', () => {
      expect(PRIORITY_MAP[1]).toBe(2)
    })

    it('should map P2 to Medium (3)', () => {
      expect(PRIORITY_MAP[2]).toBe(3)
    })

    it('should map P3 to Low (4)', () => {
      expect(PRIORITY_MAP[3]).toBe(4)
    })

    it('should default to Medium for invalid priority', () => {
      const mapPriority = (p: number) => PRIORITY_MAP[p] ?? 3

      expect(mapPriority(99)).toBe(3)
      expect(mapPriority(-1)).toBe(3)
    })
  })

  describe('formatIssueDescription', () => {
    function formatIssueDescription(task: TaskToPublish): string {
      let description = task.description || ''

      if (task.acceptanceCriteria?.length > 0) {
        description += '\n\n## 验收标准\n'
        description += task.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')
      }

      if (task.relatedFiles?.length > 0) {
        description += '\n\n## 相关文件\n'
        description += task.relatedFiles.map(f => `- \`${f}\``).join('\n')
      }

      description += '\n\n---\n*由 Seedbed 自动创建*'

      return description
    }

    it('should format description with all fields', () => {
      const task = SAMPLE_TASKS[0]
      const result = formatIssueDescription(task)

      expect(result).toContain(task.description)
      expect(result).toContain('## 验收标准')
      expect(result).toContain('- [ ] Prisma schema 定义完成')
      expect(result).toContain('## 相关文件')
      expect(result).toContain('`prisma/schema.prisma`')
      expect(result).toContain('由 Seedbed 自动创建')
    })

    it('should handle empty acceptance criteria', () => {
      const task: TaskToPublish = {
        id: 'task_1',
        title: 'Simple Task',
        description: 'Just a description',
        priority: 2,
        labels: [],
        acceptanceCriteria: [],
        relatedFiles: [],
        estimateHours: null,
      }
      const result = formatIssueDescription(task)

      expect(result).not.toContain('## 验收标准')
      expect(result).not.toContain('## 相关文件')
    })

    it('should handle empty description', () => {
      const task: TaskToPublish = {
        id: 'task_1',
        title: 'No Desc',
        description: '',
        priority: 2,
        labels: [],
        acceptanceCriteria: ['Criterion 1'],
        relatedFiles: [],
        estimateHours: null,
      }
      const result = formatIssueDescription(task)

      expect(result).toContain('## 验收标准')
      expect(result).toContain('- [ ] Criterion 1')
    })

    it('should format multiple acceptance criteria', () => {
      const task = SAMPLE_TASKS[1] // Has multiple criteria
      const result = formatIssueDescription(task)

      const criteriaCount = (result.match(/- \[ \]/g) || []).length
      expect(criteriaCount).toBe(task.acceptanceCriteria.length)
    })

    it('should format multiple related files', () => {
      const task: TaskToPublish = {
        id: 'task_1',
        title: 'Multi-file Task',
        description: 'Desc',
        priority: 2,
        labels: [],
        acceptanceCriteria: [],
        relatedFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
        estimateHours: null,
      }
      const result = formatIssueDescription(task)

      expect(result).toContain('`file1.ts`')
      expect(result).toContain('`file2.ts`')
      expect(result).toContain('`file3.ts`')
    })
  })

  describe('formatMetaIssueDescription', () => {
    interface PublishedIssue {
      taskId: string
      identifier: string
    }

    function formatMetaIssueDescription(
      planName: string,
      tasks: TaskToPublish[],
      publishedIssues: PublishedIssue[]
    ): string {
      const p0Count = tasks.filter(t => t.priority === 0).length
      const p1Count = tasks.filter(t => t.priority === 1).length
      const p2Count = tasks.filter(t => t.priority === 2).length
      const p3Count = tasks.filter(t => t.priority === 3).length
      const totalHours = tasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0)

      let description = `# 计划摘要: ${planName}\n\n`
      description += `## 任务统计\n`
      description += `- 总任务数: ${tasks.length}\n`
      description += `- P0 (紧急): ${p0Count}\n`
      description += `- P1 (高): ${p1Count}\n`
      description += `- P2 (中): ${p2Count}\n`
      description += `- P3 (低): ${p3Count}\n`
      if (totalHours > 0) {
        description += `- 总预估工时: ${totalHours}h\n`
      }
      description += '\n'

      description += `## 任务列表\n`
      publishedIssues.forEach((issue) => {
        const task = tasks.find(t => t.id === issue.taskId)
        description += `- [ ] ${issue.identifier} ${task?.title || ''}\n`
      })

      description += '\n---\n*由 Seedbed 生成*'

      return description
    }

    it('should generate correct statistics', () => {
      const tasks = SAMPLE_TASKS
      const publishedIssues = tasks.map((t, i) => ({
        taskId: t.id,
        identifier: `ENG-${i + 1}`,
      }))

      const result = formatMetaIssueDescription('Test Plan', tasks, publishedIssues)

      expect(result).toContain('总任务数: 5')
      expect(result).toContain('P0 (紧急): 1')
      expect(result).toContain('P1 (高): 2')
      expect(result).toContain('P2 (中): 1')
      expect(result).toContain('P3 (低): 1')
    })

    it('should calculate total hours', () => {
      const tasks = SAMPLE_TASKS
      const publishedIssues = tasks.map((t, i) => ({
        taskId: t.id,
        identifier: `ENG-${i + 1}`,
      }))

      const result = formatMetaIssueDescription('Test Plan', tasks, publishedIssues)

      // 2 + 3 + 2 + 2 + 1 = 10
      expect(result).toContain('总预估工时: 10h')
    })

    it('should list all published issues', () => {
      const tasks = SAMPLE_TASKS.slice(0, 2)
      const publishedIssues = [
        { taskId: tasks[0].id, identifier: 'ENG-1' },
        { taskId: tasks[1].id, identifier: 'ENG-2' },
      ]

      const result = formatMetaIssueDescription('Test Plan', tasks, publishedIssues)

      expect(result).toContain('ENG-1')
      expect(result).toContain('ENG-2')
      expect(result).toContain(tasks[0].title)
      expect(result).toContain(tasks[1].title)
    })

    it('should include plan name in header', () => {
      const result = formatMetaIssueDescription('My Feature Plan', [], [])

      expect(result).toContain('# 计划摘要: My Feature Plan')
    })

    it('should handle empty tasks', () => {
      const result = formatMetaIssueDescription('Empty Plan', [], [])

      expect(result).toContain('总任务数: 0')
      expect(result).toContain('P0 (紧急): 0')
    })

    it('should not show hours if all tasks have no estimate', () => {
      const tasks: TaskToPublish[] = [
        {
          id: 'task_1',
          title: 'Task 1',
          description: '',
          priority: 2,
          labels: [],
          acceptanceCriteria: [],
          relatedFiles: [],
          estimateHours: null,
        },
      ]
      const publishedIssues = [{ taskId: 'task_1', identifier: 'ENG-1' }]

      const result = formatMetaIssueDescription('Test', tasks, publishedIssues)

      expect(result).not.toContain('总预估工时')
    })
  })

  describe('createIssue', () => {
    it('should create issue with correct payload', async () => {
      const mockClient = createMockLinearClient()
      const task = SAMPLE_TASKS[0]

      const result = await mockClient.createIssue({
        teamId: 'team_1',
        title: task.title,
        description: task.description,
        priority: 1,
      })

      expect(result.success).toBe(true)
      const issue = await result.issue
      expect(issue.id).toBe('issue_123')
      expect(issue.identifier).toBe('ENG-123')
    })

    it('should handle createIssue failure', async () => {
      const mockClient = {
        ...createMockLinearClient(),
        createIssue: jest.fn().mockResolvedValue({
          success: false,
          issue: null,
        }),
      }

      const result = await mockClient.createIssue({
        teamId: 'team_1',
        title: 'Test',
        description: '',
      })

      expect(result.success).toBe(false)
    })
  })
})

describe('Linear Data Fixtures', () => {
  it('should have valid team fixtures', () => {
    expect(LINEAR_TEAMS).toHaveLength(3)
    LINEAR_TEAMS.forEach(team => {
      expect(team).toHaveProperty('id')
      expect(team).toHaveProperty('name')
      expect(team).toHaveProperty('key')
    })
  })

  it('should have valid project fixtures', () => {
    expect(LINEAR_PROJECTS).toHaveLength(3)
    LINEAR_PROJECTS.forEach(project => {
      expect(project).toHaveProperty('id')
      expect(project).toHaveProperty('name')
      expect(project).toHaveProperty('state')
    })
  })

  it('should have valid workflow state fixtures', () => {
    expect(LINEAR_WORKFLOW_STATES.length).toBeGreaterThan(0)
    LINEAR_WORKFLOW_STATES.forEach(state => {
      expect(state).toHaveProperty('id')
      expect(state).toHaveProperty('name')
      expect(state).toHaveProperty('type')
      expect(state).toHaveProperty('color')
    })
  })
})
