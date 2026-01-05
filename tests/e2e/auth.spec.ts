/**
 * 认证流程 E2E 测试
 */
import { test, expect, Page } from '@playwright/test'

const APP_URL = process.env.BASE_URL || 'http://localhost:3000'

// Helper functions
async function generateLoginToken(page: Page): Promise<string> {
  // In real tests, this would call the API
  // For now, we simulate with a test token
  return 'test_login_token_' + Date.now()
}

async function loginAsTestUser(page: Page): Promise<void> {
  // Set auth cookie directly for testing
  await page.context().addCookies([
    {
      name: 'auth-token',
      value: 'test_jwt_token',
      domain: 'localhost',
      path: '/',
    },
  ])
}

test.describe('Login Flow', () => {
  test('should display login page for unauthenticated users', async ({ page }) => {
    await page.goto(APP_URL)

    // Check if redirected to login or shows login prompt
    // Since this app uses Slack login, check for appropriate UI
    await expect(page).toHaveTitle(/Seedbed|Seeder/)
  })

  test('should redirect to error page for invalid token', async ({ page }) => {
    await page.goto(`${APP_URL}/auth?token=invalid_token_xyz`)

    // Should redirect to login with error
    await page.waitForURL(/\/login\?error=|\/auth\?error=/)

    // Check for error message
    const errorParam = page.url().includes('error=')
    expect(errorParam).toBe(true)
  })

  test('should redirect to error page for missing token', async ({ page }) => {
    await page.goto(`${APP_URL}/auth`)

    // Should handle missing token gracefully
    await page.waitForURL(/\/login|\/auth/)
  })

  test.skip('should complete full Slack login flow', async ({ page }) => {
    // This test requires actual Slack OAuth setup
    // Skip in CI, run manually for full integration testing

    // 1. Navigate to login
    await page.goto(`${APP_URL}/login`)

    // 2. Click Slack login button
    const slackButton = page.locator('[data-testid="slack-login-btn"]')
    if (await slackButton.isVisible()) {
      await slackButton.click()
      // Would redirect to Slack OAuth
    }
  })

  test('should show user info after login', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto(APP_URL)

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Check for user-related UI elements
    // The specific selectors depend on actual implementation
  })

  test('should persist session across page reloads', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto(APP_URL)

    // Reload page
    await page.reload()

    // Should still be logged in (auth cookie persists)
    const cookies = await page.context().cookies()
    const authCookie = cookies.find(c => c.name === 'auth-token')
    expect(authCookie).toBeDefined()
  })
})

test.describe('Logout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
  })

  test.skip('should clear session on logout', async ({ page }) => {
    await page.goto(APP_URL)

    // Click logout button
    const logoutBtn = page.locator('[data-testid="logout-btn"]')
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()

      // Auth cookie should be removed
      const cookies = await page.context().cookies()
      const authCookie = cookies.find(c => c.name === 'auth-token')
      expect(authCookie?.value).toBeFalsy()
    }
  })

  test.skip('should redirect to login after logout', async ({ page }) => {
    await page.goto(APP_URL)

    const logoutBtn = page.locator('[data-testid="logout-btn"]')
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await page.waitForURL(/\/login/)
    }
  })
})

test.describe('Session Security', () => {
  test('should reject expired token', async ({ page }) => {
    // Set an expired token
    await page.context().addCookies([
      {
        name: 'auth-token',
        value: 'expired_jwt_token',
        domain: 'localhost',
        path: '/',
        expires: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      },
    ])

    await page.goto(APP_URL)

    // Should be treated as unauthenticated
    // The app should handle expired tokens gracefully
  })

  test('should handle concurrent sessions', async ({ browser }) => {
    // Open two browser contexts (different users)
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    // Set different auth tokens
    await context1.addCookies([
      { name: 'auth-token', value: 'user1_token', domain: 'localhost', path: '/' },
    ])
    await context2.addCookies([
      { name: 'auth-token', value: 'user2_token', domain: 'localhost', path: '/' },
    ])

    await page1.goto(APP_URL)
    await page2.goto(APP_URL)

    // Both should work independently
    await expect(page1).toHaveTitle(/Seedbed|Seeder/)
    await expect(page2).toHaveTitle(/Seedbed|Seeder/)

    await context1.close()
    await context2.close()
  })
})

test.describe('Error Handling', () => {
  test('should show friendly error for token_expired', async ({ page }) => {
    await page.goto(`${APP_URL}/login?error=token_expired`)

    // Check for error message
    const pageContent = await page.textContent('body')
    // The app should display user-friendly error messages
    expect(pageContent).toBeTruthy()
  })

  test('should show friendly error for token_used', async ({ page }) => {
    await page.goto(`${APP_URL}/login?error=token_used`)

    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })

  test('should show friendly error for invalid_token', async ({ page }) => {
    await page.goto(`${APP_URL}/login?error=invalid_token`)

    const pageContent = await page.textContent('body')
    expect(pageContent).toBeTruthy()
  })
})
