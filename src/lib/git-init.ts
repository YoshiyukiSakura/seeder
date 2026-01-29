import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)

export interface InitRepoOptions {
  remoteUrl?: string
  branch?: string
  claudeMdContent?: string
  gitignoreContent?: string
  skipExistingGit?: boolean  // 如果目录已有 .git，跳过初始化
  requireRemote?: boolean    // 如果为 true，remote 设置失败会导致整体失败
}

export interface InitRepoResult {
  success: boolean
  error?: string
  localPath?: string
  branchName?: string
  hasRemote?: boolean
}

const DEFAULT_GITIGNORE = `# Dependencies
node_modules/
.pnpm-store/

# Environment
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
.next/
out/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test coverage
coverage/

# Temp files
*.tmp
*.temp
`

/**
 * Initialize a new local git repository with CLAUDE.md and optional GitHub remote
 */
export async function initializeLocalRepo(
  localPath: string,
  options: InitRepoOptions = {}
): Promise<InitRepoResult> {
  const { remoteUrl, branch = 'main', claudeMdContent, gitignoreContent, skipExistingGit, requireRemote } = options

  try {
    // Create directory if it doesn't exist
    await fs.mkdir(localPath, { recursive: true })

    // Check if directory is not empty
    const files = await fs.readdir(localPath)
    const isGitRepo = files.includes('.git')
    let hasExistingCode = false

    if (files.length > 0) {
      if (isGitRepo) {
        // Directory already has a git repo
        if (skipExistingGit) {
          console.log(`[initializeLocalRepo] Directory already has git repo, skipping init`)
          hasExistingCode = true
        } else {
          return {
            success: false,
            error: 'Directory is already a git repository'
          }
        }
      } else {
        // Non-empty directory without git
        hasExistingCode = true
        console.warn(`[initializeLocalRepo] Initializing git repo in non-empty directory: ${localPath}`)
      }
    }

    if (!hasExistingCode) {
      // Fresh empty directory - initialize git
      await execAsync(`git init -b ${branch}`, { cwd: localPath })
    } else if (!isGitRepo) {
      // Non-empty directory without git - initialize git
      await execAsync(`git init -b ${branch}`, { cwd: localPath })
    }

    // Create/Update CLAUDE.md if content provided
    if (claudeMdContent) {
      const claudeMdPath = path.join(localPath, 'CLAUDE.md')
      await fs.writeFile(claudeMdPath, claudeMdContent, 'utf-8')
    }

    // Create/Update .gitignore
    const gitignorePath = path.join(localPath, '.gitignore')
    const existingIgnore = hasExistingCode && !isGitRepo ? null : await fs.readFile(gitignorePath, 'utf-8').catch(() => null)
    if (!existingIgnore || existingIgnore === DEFAULT_GITIGNORE) {
      await fs.writeFile(gitignorePath, gitignoreContent || DEFAULT_GITIGNORE, 'utf-8')
    }

    // Create commit (or amend if there are uncommitted changes)
    try {
      // Check if there are changes to commit
      const status = await execAsync('git status --porcelain', { cwd: localPath })
      if (status.stdout.trim()) {
        await execAsync('git add .', { cwd: localPath })
        await execAsync('git commit -m "Initial commit with CLAUDE.md"', { cwd: localPath })
      } else {
        console.log('[initializeLocalRepo] No changes to commit')
      }
    } catch (commitError) {
      // Commit might fail if there's no content or author config issue
      console.warn('[initializeLocalRepo] Failed to create commit:', commitError)
    }

    // Add remote and push if URL provided
    let hasRemote = false
    if (remoteUrl) {
      try {
        // Check if origin remote already exists
        try {
          await execAsync('git remote get-url origin', { cwd: localPath })
          // Origin exists, remove it first
          console.log('[initializeLocalRepo] Removing existing origin remote')
          await execAsync('git remote remove origin', { cwd: localPath })
        } catch {
          // Origin doesn't exist, that's fine
        }

        // Add origin remote
        await execAsync(`git remote add origin "${remoteUrl}"`, { cwd: localPath })
        console.log(`[initializeLocalRepo] Added origin remote: ${remoteUrl}`)

        // Push to remote
        await execAsync(`git push -u origin ${branch}`, { cwd: localPath })
        hasRemote = true
        console.log(`[initializeLocalRepo] Pushed to origin/${branch}`)
      } catch (pushError) {
        console.error('Failed to setup remote:', pushError)
        if (requireRemote) {
          // For Fresh Start projects, remote is required
          return {
            success: false,
            error: `Failed to setup git remote: ${pushError instanceof Error ? pushError.message : String(pushError)}`
          }
        }
        // Non-Fresh Start: remote setup failed, but local repo is still valid
      }
    }

    return {
      success: true,
      localPath,
      branchName: branch,
      hasRemote
    }
  } catch (error) {
    console.error('Failed to initialize local repo:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Check if a local path already exists and contains a git repository
 */
export async function checkLocalPath(localPath: string): Promise<{
  exists: boolean
  isGitRepo: boolean
  isEmpty: boolean
}> {
  try {
    const stat = await fs.stat(localPath)
    if (!stat.isDirectory()) {
      return { exists: true, isGitRepo: false, isEmpty: false }
    }

    const files = await fs.readdir(localPath)
    const isEmpty = files.length === 0
    const isGitRepo = files.includes('.git')

    return { exists: true, isGitRepo, isEmpty }
  } catch {
    // Path doesn't exist
    return { exists: false, isGitRepo: false, isEmpty: true }
  }
}

/**
 * Generate a safe directory name from a project name
 */
export function generateSafeDirectoryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .slice(0, 50)                  // Limit length
}
