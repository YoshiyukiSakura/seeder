import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Check if GitHub CLI (gh) is configured and authenticated
 */
export async function isGitHubConfigured(): Promise<boolean> {
  try {
    await execAsync('gh auth status')
    return true
  } catch {
    return false
  }
}

/**
 * Get the GitHub username of the authenticated user
 */
export async function getGitHubUsername(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('gh api user --jq .login')
    return stdout.trim() || null
  } catch (error) {
    console.error('Failed to get GitHub username:', error)
    return null
  }
}

export interface GitHubRepoInfo {
  sshUrl: string
  httpsUrl: string
  htmlUrl: string
  fullName: string
}

/**
 * Create a new GitHub repository using gh CLI
 */
export async function createGitHubRepo(
  name: string,
  description: string,
  isPrivate = true
): Promise<GitHubRepoInfo> {
  try {
    // Create repository using gh CLI
    const visibility = isPrivate ? '--private' : '--public'
    const descFlag = description ? `--description "${description.replace(/"/g, '\\"')}"` : ''

    // Create the repository (returns the URL on stdout)
    await execAsync(`gh repo create "${name}" ${visibility} ${descFlag}`)

    // Get the username to construct URLs
    const username = await getGitHubUsername()
    if (!username) {
      throw new Error('Could not determine GitHub username')
    }

    const fullName = `${username}/${name}`

    return {
      sshUrl: `git@github.com:${fullName}.git`,
      httpsUrl: `https://github.com/${fullName}.git`,
      htmlUrl: `https://github.com/${fullName}`,
      fullName,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('already exists')) {
      throw new Error(`Repository "${name}" already exists`)
    }
    if (message.includes('not logged') || message.includes('auth')) {
      throw new Error('GitHub CLI not authenticated. Run: gh auth login')
    }

    throw new Error(`Failed to create GitHub repository: ${message}`)
  }
}

/**
 * Check if a repository name is available
 */
export async function isRepoNameAvailable(name: string): Promise<boolean> {
  try {
    const username = await getGitHubUsername()
    if (!username) return true

    await execAsync(`gh repo view "${username}/${name}" --json name`)
    return false  // Repo exists
  } catch {
    return true  // Repo doesn't exist or error, assume available
  }
}
