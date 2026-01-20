/**
 * Git utilities for cloning and managing repositories
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs/promises'

const execAsync = promisify(exec)

/**
 * Validate a Git URL format
 * Supports HTTPS and SSH formats
 */
export function validateGitUrl(url: string): boolean {
  // HTTPS format: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsPattern = /^https:\/\/[a-zA-Z0-9.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/

  // SSH format: git@github.com:owner/repo.git
  const sshPattern = /^git@[a-zA-Z0-9.-]+:[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/

  return httpsPattern.test(url) || sshPattern.test(url)
}

/**
 * Extract repository name from a Git URL
 * e.g., "https://github.com/owner/repo.git" -> "repo"
 * e.g., "git@github.com:owner/repo.git" -> "repo"
 */
export function extractRepoName(gitUrl: string): string {
  // Remove trailing .git if present
  const cleanUrl = gitUrl.replace(/\.git$/, '')

  // Handle SSH format (git@host:owner/repo)
  if (cleanUrl.includes('@') && cleanUrl.includes(':')) {
    const parts = cleanUrl.split(':')
    const pathPart = parts[parts.length - 1]
    return pathPart.split('/').pop() || ''
  }

  // Handle HTTPS format
  const parts = cleanUrl.split('/')
  return parts.pop() || ''
}

/**
 * Clone a repository to the target path
 * @param gitUrl - The Git URL to clone
 * @param targetPath - The local path to clone to
 * @param branch - Optional branch to checkout after cloning
 * @returns The path to the cloned repository
 */
export async function cloneRepository(
  gitUrl: string,
  targetPath: string,
  branch?: string
): Promise<{ success: true; path: string } | { success: false; error: string }> {
  // Validate URL format
  if (!validateGitUrl(gitUrl)) {
    return { success: false, error: 'Invalid Git URL format' }
  }

  // Check if target directory already exists
  try {
    await fs.access(targetPath)
    return { success: false, error: `Directory already exists: ${targetPath}` }
  } catch {
    // Directory doesn't exist, which is expected
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(targetPath)
  try {
    await fs.mkdir(parentDir, { recursive: true })
  } catch (error) {
    return { success: false, error: `Failed to create parent directory: ${error}` }
  }

  // Clone the repository (shallow clone for faster operation)
  try {
    await execAsync(`git clone --depth 1 "${gitUrl}" "${targetPath}"`, {
      timeout: 120000, // 2 minutes timeout
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    // Clean up partial clone if it exists
    try {
      await fs.rm(targetPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }

    // Parse common git errors
    if (errorMessage.includes('Permission denied') || errorMessage.includes('Authentication failed')) {
      return { success: false, error: 'Permission denied. Make sure the repository is accessible.' }
    }
    if (errorMessage.includes('Repository not found') || errorMessage.includes('not found')) {
      return { success: false, error: 'Repository not found. Check the URL.' }
    }
    if (errorMessage.includes('Could not resolve host')) {
      return { success: false, error: 'Network error. Could not reach the Git host.' }
    }

    return { success: false, error: `Git clone failed: ${errorMessage}` }
  }

  // Checkout specific branch if provided and not the default
  if (branch && branch !== 'main' && branch !== 'master') {
    try {
      await execAsync(`git -C "${targetPath}" checkout "${branch}"`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      // Don't fail completely if branch checkout fails, just warn
      if (errorMessage.includes('did not match any file')) {
        return { success: false, error: `Branch '${branch}' does not exist in the repository` }
      }
      return { success: false, error: `Failed to checkout branch '${branch}': ${errorMessage}` }
    }
  }

  return { success: true, path: targetPath }
}

/**
 * Get the PROJECTS_ROOT environment variable
 * @throws Error if PROJECTS_ROOT is not set
 */
export function getProjectsRoot(): string {
  const projectsRoot = process.env.PROJECTS_ROOT
  if (!projectsRoot) {
    throw new Error('PROJECTS_ROOT environment variable is not set')
  }
  return projectsRoot
}

/**
 * Generate a unique local path for a project
 * Format: {PROJECTS_ROOT}/{userId}/{repoName}
 */
export function generateLocalPath(userId: string, gitUrl: string): string {
  const repoName = extractRepoName(gitUrl)
  const projectsRoot = getProjectsRoot()
  return path.join(projectsRoot, userId, repoName)
}

/**
 * Check if a repository path exists and is a valid git repository
 */
export async function isValidGitRepo(repoPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(repoPath, '.git'))
    return true
  } catch {
    return false
  }
}
