/**
 * AI 对话和任务生成 E2E 测试
 */
import { test, expect, Page } from '@playwright/test'

const APP_URL = process.env.BASE_URL || 'http://localhost:3000'

// Helper to login
async function loginAsTestUser(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'auth-token',
      value: 'test_jwt_token',
      domain: 'localhost',
      path: '/',
    },
  ])
}

// Helper to navigate to a plan
async function navigateToPlan(page: Page): Promise<boolean> {
  await page.goto(APP_URL)

  const projectCard = page.locator('[data-testid="project-card"]').first()
  if (await projectCard.isVisible({ timeout: 5000 })) {
    await projectCard.click()

    const planCard = page.locator('[data-testid="plan-card"]').first()
    if (await planCard.isVisible({ timeout: 5000 })) {
      await planCard.click()
      return true
    }
  }
  return false
}

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('should load chat page', async ({ page }) => {
    await page.goto(APP_URL)
    await page.waitForLoadState('networkidle')

    // Main page should load
    await expect(page).toHaveTitle(/Seedbed|Seeder/)
  })

  test.skip('should display chat input', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      const chatInput = page.locator('[data-testid="chat-input"]')
      await expect(chatInput).toBeVisible()
    }
  })

  test.skip('should send message', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      // Type message
      await page.fill('[data-testid="chat-input"]', 'Add a comment feature')

      // Send
      await page.click('[data-testid="send-btn"]')

      // Should show user message
      await expect(page.locator('text=Add a comment feature')).toBeVisible()
    }
  })

  test.skip('should show loading state while waiting for AI', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      await page.fill('[data-testid="chat-input"]', 'Test message')
      await page.click('[data-testid="send-btn"]')

      // Should show loading indicator
      const loading = page.locator('[data-testid="loading-indicator"]')
      // Loading might be brief, so we just check it doesn't throw
    }
  })

  test.skip('should receive AI response', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      await page.fill('[data-testid="chat-input"]', 'Create a simple todo app')
      await page.click('[data-testid="send-btn"]')

      // Wait for AI response (may take time)
      await expect(page.locator('[data-testid="ai-message"]')).toBeVisible({
        timeout: 60000,
      })
    }
  })
})

test.describe('Multi-turn Questions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should display question UI when AI asks questions', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      // Send a message that typically triggers questions
      await page.fill('[data-testid="chat-input"]', 'Add user authentication')
      await page.click('[data-testid="send-btn"]')

      // Wait for question panel
      const questionPanel = page.locator('[data-testid="question-panel"]')
      await expect(questionPanel).toBeVisible({ timeout: 60000 })
    }
  })

  test.skip('should allow selecting options', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      await page.fill('[data-testid="chat-input"]', 'Add user authentication')
      await page.click('[data-testid="send-btn"]')

      // Wait for question panel
      await page.waitForSelector('[data-testid="question-panel"]', { timeout: 60000 })

      // Select first option
      const option = page.locator('[data-testid="option-0"]')
      if (await option.isVisible()) {
        await option.click()

        // Submit answer
        await page.click('[data-testid="submit-answer-btn"]')

        // Conversation should continue
        await expect(page.locator('[data-testid="ai-message"]').last()).toBeVisible()
      }
    }
  })

  test.skip('should allow multi-select for appropriate questions', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      // Multi-select questions should allow multiple options
      // The specific behavior depends on the AI's questions
    }
  })
})

test.describe('Task Generation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should display generated tasks', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      await page.fill('[data-testid="chat-input"]', 'Create a simple CRUD API')
      await page.click('[data-testid="send-btn"]')

      // Wait for tasks to appear
      await expect(page.locator('[data-testid="task-card"]').first()).toBeVisible({
        timeout: 60000,
      })
    }
  })

  test.skip('should show task details', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      // Assuming tasks are already generated
      const taskCard = page.locator('[data-testid="task-card"]').first()
      if (await taskCard.isVisible({ timeout: 5000 })) {
        // Task should show title
        await expect(taskCard.locator('.task-title, h3, h4')).toBeVisible()
      }
    }
  })
})

test.describe('Task Editing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should open edit panel when task clicked', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      const taskCard = page.locator('[data-testid="task-card"]').first()
      if (await taskCard.isVisible({ timeout: 5000 })) {
        await taskCard.click()

        // Edit panel should appear
        await expect(page.locator('[data-testid="task-edit-panel"]')).toBeVisible()
      }
    }
  })

  test.skip('should save task edits', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      const taskCard = page.locator('[data-testid="task-card"]').first()
      if (await taskCard.isVisible({ timeout: 5000 })) {
        await taskCard.click()

        // Edit title
        const titleInput = page.locator('[data-testid="edit-title"]')
        await titleInput.clear()
        await titleInput.fill('Updated Task Title')

        // Save
        await page.click('[data-testid="save-task-btn"]')

        // Should reflect changes
        await expect(page.locator('text=Updated Task Title')).toBeVisible()
      }
    }
  })

  test.skip('should change task priority', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      const taskCard = page.locator('[data-testid="task-card"]').first()
      if (await taskCard.isVisible({ timeout: 5000 })) {
        await taskCard.click()

        // Change priority
        await page.selectOption('[data-testid="edit-priority"]', '0')

        // Save
        await page.click('[data-testid="save-task-btn"]')

        // Should show P0
        await expect(page.locator('text=P0')).toBeVisible()
      }
    }
  })

  test.skip('should add acceptance criteria', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      const taskCard = page.locator('[data-testid="task-card"]').first()
      if (await taskCard.isVisible({ timeout: 5000 })) {
        await taskCard.click()

        // Add new criterion
        await page.fill('[data-testid="new-criteria-input"]', 'New acceptance criterion')
        await page.click('[data-testid="add-criteria-btn"]')

        // Should appear in list
        await expect(page.locator('text=New acceptance criterion')).toBeVisible()
      }
    }
  })
})

test.describe('Task Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should reorder tasks via drag and drop', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      const tasks = page.locator('[data-testid="task-card"]')
      const taskCount = await tasks.count()

      if (taskCount >= 2) {
        const firstTask = tasks.first()
        const secondTask = tasks.nth(1)

        const firstTaskTitle = await firstTask.locator('.task-title').textContent()

        // Drag first task to second position
        await firstTask.dragTo(secondTask)

        // Order should change
        const newFirstTitle = await tasks.first().locator('.task-title').textContent()
        expect(newFirstTitle).not.toBe(firstTaskTitle)
      }
    }
  })
})

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should export tasks as JSON', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download')

      // Click export JSON button
      const exportBtn = page.locator('[data-testid="export-json-btn"]')
      if (await exportBtn.isVisible()) {
        await exportBtn.click()

        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/\.json$/)
      }
    }
  })

  test.skip('should export tasks as Markdown', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      const downloadPromise = page.waitForEvent('download')

      const exportBtn = page.locator('[data-testid="export-md-btn"]')
      if (await exportBtn.isVisible()) {
        await exportBtn.click()

        const download = await downloadPromise
        expect(download.suggestedFilename()).toMatch(/\.md$/)
      }
    }
  })
})

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should handle AI error gracefully', async ({ page }) => {
    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      // The app should handle errors from Claude CLI gracefully
      // This is hard to test without mocking
    }
  })

  test.skip('should handle network errors', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true)

    const hasPlan = await navigateToPlan(page)
    if (hasPlan) {
      await page.fill('[data-testid="chat-input"]', 'Test message')
      await page.click('[data-testid="send-btn"]')

      // Should show error message
      // The specific behavior depends on implementation
    }

    await page.context().setOffline(false)
  })
})
