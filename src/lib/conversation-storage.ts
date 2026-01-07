/**
 * localStorage helpers for conversation persistence
 */

const STORAGE_KEY = 'seedbed_active_plans'

interface ActivePlansStore {
  [projectId: string]: string  // projectId -> planId
}

/**
 * Get the last active planId for a project
 */
export function getLastActivePlan(projectId: string | undefined): string | null {
  if (!projectId) return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data: ActivePlansStore = JSON.parse(stored)
      return data[projectId] || null
    }
  } catch (e) {
    console.error('Failed to read from localStorage:', e)
  }
  return null
}

/**
 * Save the active planId for a project
 */
export function saveLastActivePlan(projectId: string, planId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const data: ActivePlansStore = stored ? JSON.parse(stored) : {}
    data[projectId] = planId
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to write to localStorage:', e)
  }
}

/**
 * Clear the active planId for a project
 */
export function clearLastActivePlan(projectId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data: ActivePlansStore = JSON.parse(stored)
      delete data[projectId]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch (e) {
    console.error('Failed to clear from localStorage:', e)
  }
}
