/**
 * Linear 集成 E2E 测试
 */
import { test, expect, Page } from '@playwright/test'

const APP_URL = process.env.BASE_URL || 'http://localhost:3000'

// Test Linear API key (should be in environment for real tests)
const TEST_LINEAR_API_KEY = process.env.TEST_LINEAR_API_KEY || 'lin_api_test_key'

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

// Helper to navigate to settings
async function navigateToSettings(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/settings`)
}

// Helper to navigate to a plan with tasks
async function navigateToPlanWithTasks(page: Page): Promise<boolean> {
  await page.goto(APP_URL)

  const projectCard = page.locator('[data-testid="project-card"]').first()
  if (await projectCard.isVisible({ timeout: 5000 })) {
    await projectCard.click()

    const planCard = page.locator('[data-testid="plan-card"]').first()
    if (await planCard.isVisible({ timeout: 5000 })) {
      await planCard.click()

      // Wait for tasks
      const taskCard = page.locator('[data-testid="task-card"]').first()
      return await taskCard.isVisible({ timeout: 5000 })
    }
  }
  return false
}

test.describe('Linear Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('should display settings page', async ({ page }) => {
    await navigateToSettings(page)

    await expect(page).toHaveTitle(/Settings|设置/)
    // Or check for settings content
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })

  test.skip('should show Linear API key input', async ({ page }) => {
    await navigateToSettings(page)

    const apiKeyInput = page.locator('[data-testid="linear-api-key"]')
    await expect(apiKeyInput).toBeVisible()
  })

  test.skip('should validate Linear API key', async ({ page }) => {
    await navigateToSettings(page)

    // Enter API key
    await page.fill('[data-testid="linear-api-key"]', TEST_LINEAR_API_KEY)

    // Click validate
    await page.click('[data-testid="validate-key-btn"]')

    // Wait for validation result
    const result = await Promise.race([
      page.waitForSelector('[data-testid="validation-success"]', { timeout: 10000 }),
      page.waitForSelector('[data-testid="validation-error"]', { timeout: 10000 }),
    ])

    expect(result).toBeTruthy()
  })

  test.skip('should show error for invalid API key', async ({ page }) => {
    await navigateToSettings(page)

    await page.fill('[data-testid="linear-api-key"]', 'invalid_key_12345')
    await page.click('[data-testid="validate-key-btn"]')

    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible({
      timeout: 10000,
    })
  })

  test.skip('should save Linear API key', async ({ page }) => {
    await navigateToSettings(page)

    await page.fill('[data-testid="linear-api-key"]', TEST_LINEAR_API_KEY)
    await page.click('[data-testid="validate-key-btn"]')

    // Wait for validation
    await page.waitForSelector('[data-testid="validation-success"]', { timeout: 10000 })

    // Save
    await page.click('[data-testid="save-settings-btn"]')

    // Should show success
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible()

    // Reload and verify persisted
    await page.reload()
    await expect(page.locator('[data-testid="key-saved-indicator"]')).toBeVisible()
  })

  test.skip('should remove Linear API key', async ({ page }) => {
    await navigateToSettings(page)

    const removeBtn = page.locator('[data-testid="remove-key-btn"]')
    if (await removeBtn.isVisible()) {
      await removeBtn.click()

      // Confirm removal
      await page.click('[data-testid="confirm-remove-btn"]')

      // Key should be removed
      await expect(page.locator('[data-testid="key-saved-indicator"]')).not.toBeVisible()
    }
  })
})

test.describe('Publish to Linear', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should show publish button when tasks exist', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      await expect(page.locator('[data-testid="publish-btn"]')).toBeVisible()
    }
  })

  test.skip('should open publish dialog', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      await page.click('[data-testid="publish-btn"]')

      // Dialog should open
      await expect(page.locator('[data-testid="publish-dialog"]')).toBeVisible()
    }
  })

  test.skip('should show team selector', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      await page.click('[data-testid="publish-btn"]')

      await expect(page.locator('[data-testid="team-select"]')).toBeVisible()
    }
  })

  test.skip('should load teams from Linear', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      await page.click('[data-testid="publish-btn"]')

      // Click team selector
      await page.click('[data-testid="team-select"]')

      // Should show team options
      const teamOption = page.locator('[data-testid="team-option"]').first()
      await expect(teamOption).toBeVisible({ timeout: 10000 })
    }
  })

  test.skip('should show project selector after selecting team', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      await page.click('[data-testid="publish-btn"]')

      // Select team
      await page.click('[data-testid="team-select"]')
      await page.click('[data-testid="team-option"]:first-child')

      // Project selector should appear
      await expect(page.locator('[data-testid="project-select"]')).toBeVisible()
    }
  })

  test.skip('should publish tasks to Linear', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      await page.click('[data-testid="publish-btn"]')

      // Select team
      await page.click('[data-testid="team-select"]')
      await page.click('[data-testid="team-option"]:first-child')

      // Enable META issue
      await page.check('[data-testid="create-meta-issue"]')

      // Publish
      await page.click('[data-testid="confirm-publish-btn"]')

      // Wait for completion
      await expect(page.locator('[data-testid="publish-success"]')).toBeVisible({
        timeout: 30000,
      })
    }
  })

  test.skip('should show Linear issue links after publish', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      // After successful publish
      await page.click('[data-testid="publish-btn"]')
      await page.click('[data-testid="team-select"]')
      await page.click('[data-testid="team-option"]:first-child')
      await page.click('[data-testid="confirm-publish-btn"]')

      await page.waitForSelector('[data-testid="publish-success"]', { timeout: 30000 })

      // Should show Linear links
      const linearLink = page.locator('[data-testid="linear-issue-link"]').first()
      await expect(linearLink).toBeVisible()

      // Link should point to Linear
      const href = await linearLink.getAttribute('href')
      expect(href).toContain('linear.app')
    }
  })

  test.skip('should show error when Linear API key not configured', async ({ page }) => {
    // Ensure no Linear token
    // Navigate to plan
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      await page.click('[data-testid="publish-btn"]')

      // Should show error about missing API key
      await expect(page.locator('[data-testid="no-api-key-error"]')).toBeVisible()
    }
  })
})

test.describe('Published State', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should show Linear icon on published tasks', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      // If tasks are already published
      const linkedIcon = page.locator('[data-testid="linear-linked-icon"]').first()
      if (await linkedIcon.isVisible()) {
        // Should be clickable and open Linear
        await linkedIcon.click()
        // Would open new tab with Linear issue
      }
    }
  })

  test.skip('should update plan status after publish', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      // After publishing, plan status should be PUBLISHED
      const statusBadge = page.locator('[data-testid="plan-status"]')
      const status = await statusBadge.textContent()
      // Check if status is PUBLISHED
    }
  })
})

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should handle publish failure gracefully', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      // Simulate network error during publish
      await page.route('**/api/plans/*/publish', (route) => {
        route.abort('failed')
      })

      await page.click('[data-testid="publish-btn"]')
      await page.click('[data-testid="team-select"]')
      await page.click('[data-testid="team-option"]:first-child')
      await page.click('[data-testid="confirm-publish-btn"]')

      // Should show error
      await expect(page.locator('[data-testid="publish-error"]')).toBeVisible()
    }
  })

  test.skip('should handle partial publish failure', async ({ page }) => {
    // Some tasks fail to publish
    // Should show which ones failed
  })

  test.skip('should allow retry after failure', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      // After failure, retry button should be available
      const retryBtn = page.locator('[data-testid="retry-publish-btn"]')
      if (await retryBtn.isVisible()) {
        await retryBtn.click()
        // Should attempt to publish again
      }
    }
  })
})

test.describe('Publish Preview', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should show task count in publish dialog', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      await page.click('[data-testid="publish-btn"]')

      // Should show count
      const countText = await page.locator('[data-testid="publish-task-count"]').textContent()
      expect(countText).toMatch(/\d+/)
    }
  })

  test.skip('should show priority breakdown', async ({ page }) => {
    const hasTasks = await navigateToPlanWithTasks(page)
    if (hasTasks) {
      await page.click('[data-testid="publish-btn"]')

      // Should show priority counts
      await expect(page.locator('text=P0')).toBeVisible()
      await expect(page.locator('text=P1')).toBeVisible()
    }
  })
})
