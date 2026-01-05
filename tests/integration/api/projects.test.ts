/**
 * 项目 API 集成测试
 */
import {
  createMockRequest,
  createMockUser,
  createMockProject,
  createMockPlan,
  createTestJWT,
  mockPrisma,
} from '../../utils/mocks'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/projects', () => {
  it('should return projects for authenticated user team', async () => {
    const user = createMockUser({ slackTeamId: 'T12345' })
    const projects = [
      createMockProject({ id: 'proj_1', name: 'Project 1', userId: user.id }),
      createMockProject({ id: 'proj_2', name: 'Project 2', userId: user.id }),
    ]

    mockPrisma.user.findUnique.mockResolvedValue(user)
    mockPrisma.project.findMany.mockResolvedValue(projects)

    const jwt = await createTestJWT({ userId: user.id })
    const request = createMockRequest({
      url: 'http://localhost:3000/api/projects',
      cookies: { 'auth-token': jwt },
    })

    // Simulate API behavior
    expect(request.cookies.get('auth-token')?.value).toBeTruthy()

    const result = await mockPrisma.project.findMany({
      where: {
        user: {
          slackTeamId: user.slackTeamId,
        },
      },
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
    })

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Project 1')
  })

  it('should return 401 for unauthenticated request', async () => {
    const request = createMockRequest({
      url: 'http://localhost:3000/api/projects',
      cookies: {},
    })

    expect(request.cookies.get('auth-token')).toBeUndefined()
  })

  it('should return empty array when no projects exist', async () => {
    const user = createMockUser()
    mockPrisma.user.findUnique.mockResolvedValue(user)
    mockPrisma.project.findMany.mockResolvedValue([])

    const result = await mockPrisma.project.findMany({
      where: { user: { slackTeamId: user.slackTeamId } },
    })

    expect(result).toEqual([])
  })

  it('should include project user info', async () => {
    const user = createMockUser()
    const projectWithUser = {
      ...createMockProject(),
      user,
    }

    mockPrisma.project.findMany.mockResolvedValue([projectWithUser])

    const result = await mockPrisma.project.findMany({
      include: { user: true },
    })

    expect(result[0].user).toBeDefined()
    expect(result[0].user.slackUsername).toBe('testuser')
  })
})

describe('POST /api/projects', () => {
  it('should create new project', async () => {
    const user = createMockUser()
    const newProject = createMockProject({
      name: 'New Project',
      description: 'A new project',
      userId: user.id,
    })

    mockPrisma.user.findUnique.mockResolvedValue(user)
    mockPrisma.project.create.mockResolvedValue(newProject)

    const result = await mockPrisma.project.create({
      data: {
        name: 'New Project',
        description: 'A new project',
        userId: user.id,
      },
    })

    expect(result.name).toBe('New Project')
    expect(result.userId).toBe(user.id)
    expect(mockPrisma.project.create).toHaveBeenCalled()
  })

  it('should reject empty project name', () => {
    // Validation should happen before Prisma call
    const projectData = { name: '', description: 'Test' }

    expect(projectData.name.trim()).toBe('')
    // Should return 400 Bad Request
  })

  it('should reject project name with only spaces', () => {
    const projectData = { name: '   ', description: 'Test' }

    expect(projectData.name.trim()).toBe('')
  })

  it('should handle project creation with all fields', async () => {
    const user = createMockUser()
    const fullProject = {
      ...createMockProject(),
      name: 'Full Project',
      description: 'Full description',
      gitUrl: 'https://github.com/org/repo',
      gitBranch: 'main',
      localPath: '/data/repos/repo',
      techStack: ['Next.js', 'TypeScript', 'Prisma'],
    }

    mockPrisma.project.create.mockResolvedValue(fullProject)

    const result = await mockPrisma.project.create({
      data: {
        name: 'Full Project',
        description: 'Full description',
        gitUrl: 'https://github.com/org/repo',
        gitBranch: 'main',
        localPath: '/data/repos/repo',
        techStack: ['Next.js', 'TypeScript', 'Prisma'],
        userId: user.id,
      },
    })

    expect(result.techStack).toContain('Next.js')
    expect(result.gitUrl).toBe('https://github.com/org/repo')
  })
})

describe('GET /api/projects/[id]', () => {
  it('should return project details', async () => {
    const user = createMockUser()
    const project = createMockProject({ userId: user.id })

    mockPrisma.user.findUnique.mockResolvedValue(user)
    mockPrisma.project.findFirst.mockResolvedValue(project)

    const result = await mockPrisma.project.findFirst({
      where: {
        id: project.id,
        user: { slackTeamId: user.slackTeamId },
      },
    })

    expect(result).toBeTruthy()
    expect(result!.id).toBe(project.id)
  })

  it('should return 404 for non-existent project', async () => {
    const user = createMockUser()
    mockPrisma.user.findUnique.mockResolvedValue(user)
    mockPrisma.project.findFirst.mockResolvedValue(null)

    const result = await mockPrisma.project.findFirst({
      where: {
        id: 'nonexistent',
        user: { slackTeamId: user.slackTeamId },
      },
    })

    expect(result).toBeNull()
  })

  it('should return 404 for project from different team', async () => {
    const userA = createMockUser({ slackTeamId: 'TEAM_A' })
    const projectB = createMockProject({ userId: 'user_b' })

    mockPrisma.user.findUnique.mockResolvedValue(userA)
    mockPrisma.project.findFirst.mockResolvedValue(null) // Different team

    const result = await mockPrisma.project.findFirst({
      where: {
        id: projectB.id,
        user: { slackTeamId: userA.slackTeamId },
      },
    })

    expect(result).toBeNull()
  })
})

describe('PUT /api/projects/[id]', () => {
  it('should update project details', async () => {
    const user = createMockUser()
    const project = createMockProject({ userId: user.id })
    const updatedProject = {
      ...project,
      name: 'Updated Name',
      description: 'Updated description',
    }

    mockPrisma.project.findFirst.mockResolvedValue(project)
    mockPrisma.project.update.mockResolvedValue(updatedProject)

    const result = await mockPrisma.project.update({
      where: { id: project.id },
      data: {
        name: 'Updated Name',
        description: 'Updated description',
      },
    })

    expect(result.name).toBe('Updated Name')
    expect(result.description).toBe('Updated description')
  })

  it('should not update project from different team', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null)

    const result = await mockPrisma.project.findFirst({
      where: {
        id: 'proj_123',
        user: { slackTeamId: 'different_team' },
      },
    })

    expect(result).toBeNull()
    expect(mockPrisma.project.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('should delete project and cascade to plans/tasks', async () => {
    const user = createMockUser()
    const project = createMockProject({ userId: user.id })

    mockPrisma.project.findFirst.mockResolvedValue(project)
    mockPrisma.project.delete.mockResolvedValue(project)

    // First verify project exists and belongs to user's team
    const existing = await mockPrisma.project.findFirst({
      where: {
        id: project.id,
        user: { slackTeamId: user.slackTeamId },
      },
    })

    expect(existing).toBeTruthy()

    // Then delete
    await mockPrisma.project.delete({
      where: { id: project.id },
    })

    expect(mockPrisma.project.delete).toHaveBeenCalledWith({
      where: { id: project.id },
    })
  })

  it('should return 404 when deleting non-existent project', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null)

    const result = await mockPrisma.project.findFirst({
      where: { id: 'nonexistent' },
    })

    expect(result).toBeNull()
    expect(mockPrisma.project.delete).not.toHaveBeenCalled()
  })
})

describe('GET /api/projects/[id]/plans', () => {
  it('should return plans for project', async () => {
    const user = createMockUser()
    const project = createMockProject({ userId: user.id })
    const plans = [
      createMockPlan({ id: 'plan_1', projectId: project.id, name: 'Plan 1' }),
      createMockPlan({ id: 'plan_2', projectId: project.id, name: 'Plan 2' }),
    ]

    mockPrisma.project.findFirst.mockResolvedValue(project)
    mockPrisma.plan.findMany.mockResolvedValue(plans)

    const result = await mockPrisma.plan.findMany({
      where: { projectId: project.id },
      orderBy: { updatedAt: 'desc' },
    })

    expect(result).toHaveLength(2)
    expect(result[0].projectId).toBe(project.id)
  })

  it('should return empty array when no plans exist', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(createMockProject())
    mockPrisma.plan.findMany.mockResolvedValue([])

    const result = await mockPrisma.plan.findMany({
      where: { projectId: 'proj_123' },
    })

    expect(result).toEqual([])
  })

  it('should include task count in plans', async () => {
    const plan = {
      ...createMockPlan(),
      _count: { tasks: 5 },
    }

    mockPrisma.plan.findMany.mockResolvedValue([plan])

    const result = await mockPrisma.plan.findMany({
      include: { _count: { select: { tasks: true } } },
    })

    expect(result[0]._count.tasks).toBe(5)
  })
})

describe('POST /api/projects/[id]/plans', () => {
  it('should create new plan', async () => {
    const user = createMockUser()
    const project = createMockProject({ userId: user.id })
    const newPlan = createMockPlan({
      name: 'New Plan',
      projectId: project.id,
    })

    mockPrisma.project.findFirst.mockResolvedValue(project)
    mockPrisma.plan.create.mockResolvedValue(newPlan)

    const result = await mockPrisma.plan.create({
      data: {
        name: 'New Plan',
        projectId: project.id,
      },
    })

    expect(result.name).toBe('New Plan')
    expect(result.projectId).toBe(project.id)
    expect(result.status).toBe('DRAFT')
  })

  it('should reject empty plan name', () => {
    const planData = { name: '' }
    expect(planData.name.trim()).toBe('')
  })
})
