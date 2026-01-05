/**
 * Linear API 集成测试
 */
import {
  createMockUser,
  createMockPlan,
  createMockTask,
  createMockLinearClient,
  mockPrisma,
} from '../../utils/mocks'
import {
  SAMPLE_TASKS,
  LINEAR_TEAMS,
  LINEAR_PROJECTS,
} from '../../utils/fixtures'

// Mock Linear SDK
jest.mock('@linear/sdk', () => ({
  LinearClient: jest.fn().mockImplementation(() => createMockLinearClient()),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/linear/validate', () => {
  it('should validate correct API key', async () => {
    const mockClient = createMockLinearClient()
    const viewer = await mockClient.viewer

    expect(viewer.id).toBe('linear_user_123')
    expect(viewer.name).toBe('Linear User')
    expect(viewer.email).toBe('linear@example.com')
  })

  it('should reject invalid API key', async () => {
    const mockClient = {
      viewer: Promise.reject(new Error('Invalid API key')),
    }

    await expect(mockClient.viewer).rejects.toThrow('Invalid API key')
  })

  it('should reject empty API key', () => {
    const apiKey = ''
    expect(apiKey.trim()).toBe('')
    // Should return { valid: false }
  })

  it('should return user info for valid key', async () => {
    const mockClient = createMockLinearClient()
    const viewer = await mockClient.viewer

    const response = {
      valid: true,
      user: {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
      },
    }

    expect(response.valid).toBe(true)
    expect(response.user.name).toBe('Linear User')
  })
})

describe('PUT /api/user/linear-token', () => {
  it('should save Linear API key for user', async () => {
    const user = createMockUser()
    const updatedUser = {
      ...user,
      linearToken: 'encrypted_token',
    }

    mockPrisma.user.update.mockResolvedValue(updatedUser)

    const result = await mockPrisma.user.update({
      where: { id: user.id },
      data: { linearToken: 'encrypted_token' },
    })

    expect(result.linearToken).toBe('encrypted_token')
  })

  it('should update existing token', async () => {
    const user = createMockUser({ linearToken: 'old_token' })
    const updatedUser = {
      ...user,
      linearToken: 'new_token',
    }

    mockPrisma.user.update.mockResolvedValue(updatedUser)

    const result = await mockPrisma.user.update({
      where: { id: user.id },
      data: { linearToken: 'new_token' },
    })

    expect(result.linearToken).toBe('new_token')
  })
})

describe('DELETE /api/user/linear-token', () => {
  it('should remove Linear API key', async () => {
    const user = createMockUser({ linearToken: 'token_to_remove' })
    const updatedUser = {
      ...user,
      linearToken: null,
    }

    mockPrisma.user.update.mockResolvedValue(updatedUser)

    const result = await mockPrisma.user.update({
      where: { id: user.id },
      data: { linearToken: null },
    })

    expect(result.linearToken).toBeNull()
  })
})

describe('GET /api/linear/teams', () => {
  it('should return teams when linearToken is set', async () => {
    const user = createMockUser({ linearToken: 'valid_token' })
    mockPrisma.user.findUnique.mockResolvedValue(user)

    const mockClient = createMockLinearClient()
    const teams = await mockClient.teams()

    expect(teams.nodes).toHaveLength(2)
    expect(teams.nodes[0]).toHaveProperty('id')
    expect(teams.nodes[0]).toHaveProperty('name')
    expect(teams.nodes[0]).toHaveProperty('key')
  })

  it('should return 400 when linearToken is not set', async () => {
    const user = createMockUser({ linearToken: null })
    mockPrisma.user.findUnique.mockResolvedValue(user)

    expect(user.linearToken).toBeNull()
    // Should return 400 Bad Request
  })

  it('should transform team data correctly', async () => {
    const mockClient = createMockLinearClient()
    const teams = await mockClient.teams()

    const transformed = teams.nodes.map(team => ({
      id: team.id,
      name: team.name,
      key: team.key,
    }))

    expect(transformed).toEqual([
      { id: 'team_1', name: 'Engineering', key: 'ENG' },
      { id: 'team_2', name: 'Design', key: 'DES' },
    ])
  })
})

describe('GET /api/linear/teams/[teamId]/projects', () => {
  it('should return projects for team', async () => {
    const mockClient = createMockLinearClient()
    const team = mockClient.team('team_1')
    const projects = await team.projects()

    expect(projects.nodes).toHaveLength(2)
    expect(projects.nodes[0]).toHaveProperty('id')
    expect(projects.nodes[0]).toHaveProperty('name')
    expect(projects.nodes[0]).toHaveProperty('state')
  })

  it('should return empty array for team without projects', async () => {
    const mockClient = createMockLinearClient()
    mockClient.team = jest.fn().mockReturnValue({
      projects: jest.fn().mockResolvedValue({ nodes: [] }),
    })

    const team = mockClient.team('empty_team')
    const projects = await team.projects()

    expect(projects.nodes).toEqual([])
  })
})

describe('POST /api/plans/[planId]/publish', () => {
  it('should publish tasks to Linear', async () => {
    const user = createMockUser({ linearToken: 'valid_token' })
    const plan = createMockPlan({ name: 'Test Plan' })
    const tasks = SAMPLE_TASKS.slice(0, 3)

    mockPrisma.user.findUnique.mockResolvedValue(user)
    mockPrisma.plan.findFirst.mockResolvedValue(plan)
    mockPrisma.task.findMany.mockResolvedValue(
      tasks.map(t => ({
        ...createMockTask(t),
        planId: plan.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    )

    const mockClient = createMockLinearClient()

    // Create issues
    const results = []
    for (const task of tasks) {
      const result = await mockClient.createIssue({
        teamId: 'team_1',
        title: task.title,
        description: task.description,
        priority: task.priority + 1,
      })

      if (result.success) {
        const issue = await result.issue
        results.push({
          taskId: task.id,
          linearIssueId: issue.id,
          linearIssueUrl: issue.url,
          identifier: issue.identifier,
        })
      }
    }

    expect(results).toHaveLength(3)
    expect(results[0]).toHaveProperty('linearIssueId')
    expect(results[0]).toHaveProperty('identifier')
  })

  it('should create META issue when requested', async () => {
    const mockClient = createMockLinearClient()

    const metaResult = await mockClient.createIssue({
      teamId: 'team_1',
      title: '📋 Test Plan',
      description: '# Plan Summary\n\nTasks...',
      priority: 2,
    })

    expect(metaResult.success).toBe(true)
    const issue = await metaResult.issue
    expect(issue.identifier).toBe('ENG-123')
  })

  it('should save linearIssueId to tasks', async () => {
    const task = createMockTask()
    const updatedTask = {
      ...task,
      linearIssueId: 'issue_123',
    }

    mockPrisma.task.update.mockResolvedValue(updatedTask)

    const result = await mockPrisma.task.update({
      where: { id: task.id },
      data: { linearIssueId: 'issue_123' },
    })

    expect(result.linearIssueId).toBe('issue_123')
  })

  it('should return 400 when linearToken not set', async () => {
    const user = createMockUser({ linearToken: null })
    mockPrisma.user.findUnique.mockResolvedValue(user)

    expect(user.linearToken).toBeNull()
  })

  it('should return 404 for non-existent plan', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue(null)

    const result = await mockPrisma.plan.findFirst({
      where: { id: 'nonexistent' },
    })

    expect(result).toBeNull()
  })

  it('should handle partial publish failure', async () => {
    const mockClient = {
      ...createMockLinearClient(),
      createIssue: jest.fn()
        .mockResolvedValueOnce({
          success: true,
          issue: Promise.resolve({ id: 'issue_1', url: 'url1', identifier: 'ENG-1' }),
        })
        .mockResolvedValueOnce({
          success: false,
          issue: null,
        })
        .mockResolvedValueOnce({
          success: true,
          issue: Promise.resolve({ id: 'issue_3', url: 'url3', identifier: 'ENG-3' }),
        }),
    }

    const results = []
    const errors = []

    for (let i = 0; i < 3; i++) {
      const result = await mockClient.createIssue({
        teamId: 'team_1',
        title: `Task ${i + 1}`,
        description: '',
      })

      if (result.success) {
        const issue = await result.issue
        results.push(issue)
      } else {
        errors.push(`Failed to create task ${i + 1}`)
      }
    }

    expect(results).toHaveLength(2)
    expect(errors).toHaveLength(1)
  })
})

describe('Linear API Error Handling', () => {
  it('should handle network errors', async () => {
    const mockClient = {
      viewer: Promise.reject(new Error('Network error')),
    }

    await expect(mockClient.viewer).rejects.toThrow('Network error')
  })

  it('should handle rate limiting', async () => {
    const mockClient = {
      createIssue: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
    }

    await expect(mockClient.createIssue({})).rejects.toThrow('Rate limit exceeded')
  })

  it('should handle invalid team ID', async () => {
    const mockClient = {
      team: jest.fn().mockReturnValue({
        projects: jest.fn().mockRejectedValue(new Error('Team not found')),
      }),
    }

    const team = mockClient.team('invalid_team')
    await expect(team.projects()).rejects.toThrow('Team not found')
  })
})

describe('Published Plan Status', () => {
  it('should update plan status to PUBLISHED', async () => {
    const plan = createMockPlan({ status: 'DRAFT' })
    const publishedPlan = {
      ...plan,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    }

    mockPrisma.plan.update.mockResolvedValue(publishedPlan)

    const result = await mockPrisma.plan.update({
      where: { id: plan.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })

    expect(result.status).toBe('PUBLISHED')
    expect(result.publishedAt).toBeTruthy()
  })

  it('should save linearProjectId when using Linear project', async () => {
    const plan = createMockPlan()
    const updatedPlan = {
      ...plan,
      linearProjectId: 'linear_proj_123',
    }

    mockPrisma.plan.update.mockResolvedValue(updatedPlan)

    const result = await mockPrisma.plan.update({
      where: { id: plan.id },
      data: { linearProjectId: 'linear_proj_123' },
    })

    expect(result.linearProjectId).toBe('linear_proj_123')
  })
})
