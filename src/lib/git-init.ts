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
  const { remoteUrl, branch = 'main', claudeMdContent, gitignoreContent } = options

  try {
    // Create directory if it doesn't exist
    await fs.mkdir(localPath, { recursive: true })

    // Check if directory is not empty
    const files = await fs.readdir(localPath)
    if (files.length > 0) {
      // Check if it's already a git repo
      const isGitRepo = files.includes('.git')
      if (isGitRepo) {
        return {
          success: false,
          error: 'Directory is already a git repository'
        }
      }
      // For now, allow initializing in non-empty directories
      // but warn in the logs
      console.warn(`Initializing git repo in non-empty directory: ${localPath}`)
    }

    // Initialize git repository
    await execAsync(`git init -b ${branch}`, { cwd: localPath })

    // Create CLAUDE.md if content provided
    if (claudeMdContent) {
      const claudeMdPath = path.join(localPath, 'CLAUDE.md')
      await fs.writeFile(claudeMdPath, claudeMdContent, 'utf-8')
    }

    // Create .gitignore
    const gitignorePath = path.join(localPath, '.gitignore')
    await fs.writeFile(gitignorePath, gitignoreContent || DEFAULT_GITIGNORE, 'utf-8')

    // Create initial commit
    await execAsync('git add .', { cwd: localPath })
    await execAsync('git commit -m "Initial commit with CLAUDE.md"', { cwd: localPath })

    // Add remote and push if URL provided
    let hasRemote = false
    if (remoteUrl) {
      try {
        await execAsync(`git remote add origin "${remoteUrl}"`, { cwd: localPath })
        await execAsync(`git push -u origin ${branch}`, { cwd: localPath })
        hasRemote = true
      } catch (pushError) {
        // Remote setup failed, but local repo is still valid
        console.error('Failed to setup remote:', pushError)
        // We don't fail the whole operation, just note the remote wasn't set up
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
