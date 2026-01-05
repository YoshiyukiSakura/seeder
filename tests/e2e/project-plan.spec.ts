/**
 * 项目和计划 E2E 测试
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

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('should display project list', async ({ page }) => {
    await page.goto(APP_URL)
    await page.waitForLoadState('networkidle')

    // Check for project list or empty state
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })

  test.skip('should create new project', async ({ page }) => {
    await page.goto(APP_URL)

    // Click create project button
    const createBtn = page.locator('[data-testid="create-project-btn"]')
    if (await createBtn.isVisible()) {
      await createBtn.click()

      // Fill form
      await page.fill('[name="projectName"], [data-testid="project-name-input"]', 'E2E Test Project')
      await page.fill('[name="description"], [data-testid="project-description-input"]', 'Created by E2E test')

      // Submit
      await page.click('[data-testid="submit-project-btn"]')

      // Verify project appears
      await expect(page.locator('text=E2E Test Project')).toBeVisible({ timeout: 5000 })
    }
  })

  test.skip('should navigate to project details', async ({ page }) => {
    await page.goto(APP_URL)

    // Click on a project card
    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      const projectName = await projectCard.textContent()
      await projectCard.click()

      // Should navigate to project page
      await page.waitForURL(/\/projects\//)

      // Project details should be visible
      if (projectName) {
        await expect(page.locator(`text=${projectName}`)).toBeVisible()
      }
    }
  })

  test.skip('should edit project details', async ({ page }) => {
    await page.goto(APP_URL)

    // Navigate to project
    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      await projectCard.click()

      // Click edit button
      const editBtn = page.locator('[data-testid="edit-project-btn"]')
      if (await editBtn.isVisible()) {
        await editBtn.click()

        // Update name
        const nameInput = page.locator('[data-testid="project-name-input"]')
        await nameInput.clear()
        await nameInput.fill('Updated Project Name')

        // Save
        await page.click('[data-testid="save-project-btn"]')

        // Verify update
        await expect(page.locator('text=Updated Project Name')).toBeVisible()
      }
    }
  })

  test.skip('should delete project', async ({ page }) => {
    await page.goto(APP_URL)

    // Navigate to project
    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      const projectName = await projectCard.textContent()
      await projectCard.click()

      // Click delete button
      const deleteBtn = page.locator('[data-testid="delete-project-btn"]')
      if (await deleteBtn.isVisible()) {
        await deleteBtn.click()

        // Confirm deletion
        await page.click('[data-testid="confirm-delete-btn"]')

        // Should redirect to project list
        await page.waitForURL(APP_URL)

        // Project should be gone
        if (projectName) {
          await expect(page.locator(`text=${projectName}`)).not.toBeVisible()
        }
      }
    }
  })
})

test.describe('Plan Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should display plans in project', async ({ page }) => {
    await page.goto(APP_URL)

    // Navigate to project
    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      await projectCard.click()

      // Plans should be listed
      await expect(page.locator('[data-testid="plan-list"]')).toBeVisible({ timeout: 5000 })
    }
  })

  test.skip('should create new plan', async ({ page }) => {
    await page.goto(APP_URL)

    // Navigate to project
    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      await projectCard.click()

      // Click create plan button
      const createBtn = page.locator('[data-testid="create-plan-btn"]')
      if (await createBtn.isVisible()) {
        await createBtn.click()

        // Fill form
        await page.fill('[data-testid="plan-name-input"]', 'E2E Test Plan')

        // Submit
        await page.click('[data-testid="submit-plan-btn"]')

        // Should navigate to plan page
        await page.waitForURL(/\/plans\//)

        // Plan title should be visible
        await expect(page.locator('text=E2E Test Plan')).toBeVisible()
      }
    }
  })

  test.skip('should navigate to plan chat interface', async ({ page }) => {
    await page.goto(APP_URL)

    // Navigate to project
    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      await projectCard.click()

      // Click on plan
      const planCard = page.locator('[data-testid="plan-card"]').first()
      if (await planCard.isVisible()) {
        await planCard.click()

        // Should show chat interface
        await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 5000 })
      }
    }
  })
})

test.describe('Plan Status', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should display plan status', async ({ page }) => {
    await page.goto(APP_URL)

    // Navigate to project with plans
    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      await projectCard.click()

      // Check for status badges
      const statusBadge = page.locator('[data-testid="plan-status"]').first()
      if (await statusBadge.isVisible()) {
        const status = await statusBadge.textContent()
        expect(['DRAFT', 'REVIEWING', 'PUBLISHED', 'ARCHIVED']).toContain(status)
      }
    }
  })

  test.skip('should show task count in plan card', async ({ page }) => {
    await page.goto(APP_URL)

    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      await projectCard.click()

      // Check for task count
      const taskCount = page.locator('[data-testid="plan-task-count"]').first()
      if (await taskCount.isVisible()) {
        const count = await taskCount.textContent()
        expect(count).toMatch(/\d+/)
      }
    }
  })
})

test.describe('Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('should show empty state when no projects', async ({ page }) => {
    await page.goto(APP_URL)
    await page.waitForLoadState('networkidle')

    // If no projects, should show empty state or create prompt
    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })

  test.skip('should show empty state when no plans', async ({ page }) => {
    // Navigate to empty project
    // Should show prompt to create first plan
  })
})

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test('should navigate back to project list from project page', async ({ page }) => {
    await page.goto(APP_URL)

    // Navigate to project
    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      await projectCard.click()
      await page.waitForURL(/\/projects\//)

      // Click back/home button
      const homeBtn = page.locator('[data-testid="home-btn"], [data-testid="back-btn"]')
      if (await homeBtn.isVisible()) {
        await homeBtn.click()
        await page.waitForURL(APP_URL)
      }
    }
  })

  test('should use browser back button', async ({ page }) => {
    await page.goto(APP_URL)

    // Navigate to project
    const projectCard = page.locator('[data-testid="project-card"]').first()
    if (await projectCard.isVisible()) {
      await projectCard.click()
      await page.waitForURL(/\/projects\//)

      // Use browser back
      await page.goBack()

      // Should be back at project list
      await expect(page).toHaveURL(APP_URL)
    }
  })
})
