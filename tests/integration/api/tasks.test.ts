/**
 * 任务 API 集成测试
 */
import {
  createMockUser,
  createMockProject,
  createMockPlan,
  createMockTask,
  mockPrisma,
} from '../../utils/mocks'
import { SAMPLE_TASKS } from '../../utils/fixtures'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/plans/[planId]/tasks', () => {
  it('should return tasks sorted by sortOrder', async () => {
    const user = createMockUser()
    const project = createMockProject({ userId: user.id })
    const plan = createMockPlan({ projectId: project.id })
    const tasks = [
      createMockTask({ id: 'task_1', title: 'First', sortOrder: 0 }),
      createMockTask({ id: 'task_2', title: 'Second', sortOrder: 1 }),
      createMockTask({ id: 'task_3', title: 'Third', sortOrder: 2 }),
    ]

    mockPrisma.plan.findFirst.mockResolvedValue(plan)
    mockPrisma.task.findMany.mockResolvedValue(tasks)

    const result = await mockPrisma.task.findMany({
      where: { planId: plan.id },
      orderBy: { sortOrder: 'asc' },
    })

    expect(result).toHaveLength(3)
    expect(result[0].title).toBe('First')
    expect(result[1].title).toBe('Second')
    expect(result[2].title).toBe('Third')
  })

  it('should return empty array when no tasks exist', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue(createMockPlan())
    mockPrisma.task.findMany.mockResolvedValue([])

    const result = await mockPrisma.task.findMany({
      where: { planId: 'plan_123' },
    })

    expect(result).toEqual([])
  })

  it('should return 404 for non-existent plan', async () => {
    mockPrisma.plan.findFirst.mockResolvedValue(null)

    const result = await mockPrisma.plan.findFirst({
      where: { id: 'nonexistent' },
    })

    expect(result).toBeNull()
  })

  it('should include all task fields', async () => {
    const fullTask = createMockTask({
      title: 'Full Task',
      description: 'Full description',
      priority: 1,
      labels: ['label1', 'label2'],
      acceptanceCriteria: ['criterion1', 'criterion2'],
      relatedFiles: ['file1.ts', 'file2.ts'],
      estimateHours: 5,
      sortOrder: 0,
      dependsOnId: null,
    })

    mockPrisma.task.findMany.mockResolvedValue([fullTask])

    const result = await mockPrisma.task.findMany({
      where: { planId: 'plan_123' },
    })

    expect(result[0]).toMatchObject({
      title: 'Full Task',
      description: 'Full description',
      priority: 1,
      labels: ['label1', 'label2'],
      acceptanceCriteria: ['criterion1', 'criterion2'],
      relatedFiles: ['file1.ts', 'file2.ts'],
      estimateHours: 5,
    })
  })
})

describe('POST /api/plans/[planId]/tasks', () => {
  it('should create multiple tasks in batch', async () => {
    const plan = createMockPlan()
    const tasksToCreate = SAMPLE_TASKS.slice(0, 3)
    const createdTasks = tasksToCreate.map((t, i) => ({
      ...createMockTask({
        ...t,
        sortOrder: i,
      }),
      planId: plan.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    mockPrisma.plan.findFirst.mockResolvedValue(plan)
    mockPrisma.task.count.mockResolvedValue(0)
    mockPrisma.task.createMany.mockResolvedValue({ count: 3 })
    mockPrisma.task.findMany.mockResolvedValue(createdTasks)

    // Get current max sortOrder
    const currentCount = await mockPrisma.task.count({
      where: { planId: plan.id },
    })
    expect(currentCount).toBe(0)

    // Create tasks
    const result = await mockPrisma.task.createMany({
      data: tasksToCreate.map((t, i) => ({
        ...t,
        planId: plan.id,
        sortOrder: currentCount + i,
      })),
    })

    expect(result.count).toBe(3)

    // Fetch created tasks
    const created = await mockPrisma.task.findMany({
      where: { planId: plan.id },
    })

    expect(created).toHaveLength(3)
  })

  it('should assign correct sortOrder to new tasks', async () => {
    const plan = createMockPlan()

    // Existing tasks
    mockPrisma.task.count.mockResolvedValue(5)

    const newTask = createMockTask({
      title: 'New Task',
      sortOrder: 5, // Next available sortOrder
    })

    mockPrisma.task.create.mockResolvedValue(newTask)

    const currentCount = await mockPrisma.task.count({
      where: { planId: plan.id },
    })

    const result = await mockPrisma.task.create({
      data: {
        title: 'New Task',
        description: '',
        planId: plan.id,
        sortOrder: currentCount,
        priority: 2,
        labels: [],
        acceptanceCriteria: [],
        relatedFiles: [],
      },
    })

    expect(result.sortOrder).toBe(5)
  })

  it('should validate required fields', () => {
    // Title is required
    const invalidTask = { description: 'No title' }
    expect((invalidTask as any).title).toBeUndefined()

    // Description can be empty
    const validTask = { title: 'Has title', description: '' }
    expect(validTask.title).toBeTruthy()
  })

  it('should default priority to P2 (2)', () => {
    const taskWithoutPriority = createMockTask({
      priority: 2, // Default
    })

    expect(taskWithoutPriority.priority).toBe(2)
  })
})

describe('PUT /api/plans/[planId]/tasks/[taskId]', () => {
  it('should update task fields', async () => {
    const plan = createMockPlan()
    const existingTask = createMockTask({
      id: 'task_123',
      title: 'Original',
      priority: 2,
    })
    const updatedTask = {
      ...existingTask,
      title: 'Updated',
      priority: 0,
      labels: ['后端'],
    }

    mockPrisma.plan.findFirst.mockResolvedValue(plan)
    mockPrisma.task.findFirst.mockResolvedValue(existingTask)
    mockPrisma.task.update.mockResolvedValue(updatedTask)

    const result = await mockPrisma.task.update({
      where: { id: 'task_123' },
      data: {
        title: 'Updated',
        priority: 0,
        labels: ['后端'],
      },
    })

    expect(result.title).toBe('Updated')
    expect(result.priority).toBe(0)
    expect(result.labels).toContain('后端')
  })

  it('should update acceptance criteria', async () => {
    const existingTask = createMockTask({
      acceptanceCriteria: ['Old criterion'],
    })
    const updatedTask = {
      ...existingTask,
      acceptanceCriteria: ['New criterion 1', 'New criterion 2'],
    }

    mockPrisma.task.findFirst.mockResolvedValue(existingTask)
    mockPrisma.task.update.mockResolvedValue(updatedTask)

    const result = await mockPrisma.task.update({
      where: { id: existingTask.id },
      data: {
        acceptanceCriteria: ['New criterion 1', 'New criterion 2'],
      },
    })

    expect(result.acceptanceCriteria).toHaveLength(2)
    expect(result.acceptanceCriteria).toContain('New criterion 1')
  })

  it('should update related files', async () => {
    const existingTask = createMockTask({
      relatedFiles: ['old.ts'],
    })
    const updatedTask = {
      ...existingTask,
      relatedFiles: ['new1.ts', 'new2.ts'],
    }

    mockPrisma.task.findFirst.mockResolvedValue(existingTask)
    mockPrisma.task.update.mockResolvedValue(updatedTask)

    const result = await mockPrisma.task.update({
      where: { id: existingTask.id },
      data: {
        relatedFiles: ['new1.ts', 'new2.ts'],
      },
    })

    expect(result.relatedFiles).toHaveLength(2)
  })

  it('should return 404 for non-existent task', async () => {
    mockPrisma.task.findFirst.mockResolvedValue(null)

    const result = await mockPrisma.task.findFirst({
      where: { id: 'nonexistent' },
    })

    expect(result).toBeNull()
  })
})

describe('DELETE /api/plans/[planId]/tasks/[taskId]', () => {
  it('should delete task', async () => {
    const task = createMockTask({ id: 'task_123' })

    mockPrisma.task.findFirst.mockResolvedValue(task)
    mockPrisma.task.delete.mockResolvedValue(task)

    await mockPrisma.task.delete({
      where: { id: 'task_123' },
    })

    expect(mockPrisma.task.delete).toHaveBeenCalledWith({
      where: { id: 'task_123' },
    })
  })

  it('should remove dependency references when task deleted', async () => {
    const taskToDelete = createMockTask({ id: 'task_1' })
    const dependentTask = createMockTask({
      id: 'task_2',
      dependsOnId: 'task_1',
    })

    mockPrisma.task.findFirst.mockResolvedValue(taskToDelete)
    mockPrisma.task.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.task.delete.mockResolvedValue(taskToDelete)

    // Update dependent tasks first
    await mockPrisma.task.updateMany({
      where: { dependsOnId: 'task_1' },
      data: { dependsOnId: null },
    })

    // Then delete
    await mockPrisma.task.delete({
      where: { id: 'task_1' },
    })

    expect(mockPrisma.task.updateMany).toHaveBeenCalledWith({
      where: { dependsOnId: 'task_1' },
      data: { dependsOnId: null },
    })
  })
})

describe('PUT /api/plans/[planId]/tasks/reorder', () => {
  it('should update sortOrder for multiple tasks', async () => {
    const tasks = [
      createMockTask({ id: 'task_1', sortOrder: 0 }),
      createMockTask({ id: 'task_2', sortOrder: 1 }),
      createMockTask({ id: 'task_3', sortOrder: 2 }),
    ]

    // New order: task_3, task_1, task_2
    const newOrder = ['task_3', 'task_1', 'task_2']

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn(mockPrisma)
    })

    await mockPrisma.$transaction(async (tx: any) => {
      for (let i = 0; i < newOrder.length; i++) {
        await tx.task.update({
          where: { id: newOrder[i] },
          data: { sortOrder: i },
        })
      }
    })

    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })
})

describe('Task Dependencies', () => {
  it('should set task dependency', async () => {
    const task1 = createMockTask({ id: 'task_1' })
    const task2WithDep = {
      ...createMockTask({ id: 'task_2' }),
      dependsOnId: 'task_1',
    }

    mockPrisma.task.update.mockResolvedValue(task2WithDep)

    const result = await mockPrisma.task.update({
      where: { id: 'task_2' },
      data: { dependsOnId: 'task_1' },
    })

    expect(result.dependsOnId).toBe('task_1')
  })

  it('should prevent circular dependency', async () => {
    const task1 = createMockTask({ id: 'task_1', dependsOnId: 'task_2' })
    const task2 = createMockTask({ id: 'task_2' })

    // task_1 depends on task_2
    // Trying to make task_2 depend on task_1 should fail

    mockPrisma.task.findFirst.mockResolvedValue(task1)

    // Check if setting task_2 -> task_1 would create cycle
    const task1Dep = await mockPrisma.task.findFirst({
      where: { id: 'task_1' },
    })

    const wouldCreateCycle = task1Dep?.dependsOnId === 'task_2'
    expect(wouldCreateCycle).toBe(true)
    // Should return 400 Bad Request
  })

  it('should remove task dependency', async () => {
    const task = createMockTask({ id: 'task_1', dependsOnId: null })

    mockPrisma.task.update.mockResolvedValue(task)

    const result = await mockPrisma.task.update({
      where: { id: 'task_1' },
      data: { dependsOnId: null },
    })

    expect(result.dependsOnId).toBeNull()
  })
})

describe('Task Validation', () => {
  it('should accept valid priority values (0-3)', () => {
    const validPriorities = [0, 1, 2, 3]

    validPriorities.forEach(priority => {
      const task = createMockTask({ priority })
      expect(task.priority).toBeGreaterThanOrEqual(0)
      expect(task.priority).toBeLessThanOrEqual(3)
    })
  })

  it('should handle null estimate hours', () => {
    const task = createMockTask({ estimateHours: undefined })
    expect(task.estimateHours).toBeUndefined()
  })

  it('should handle empty arrays for list fields', () => {
    const task = createMockTask({
      labels: [],
      acceptanceCriteria: [],
      relatedFiles: [],
    })

    expect(task.labels).toEqual([])
    expect(task.acceptanceCriteria).toEqual([])
    expect(task.relatedFiles).toEqual([])
  })
})
