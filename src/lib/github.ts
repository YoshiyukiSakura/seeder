import { Octokit } from '@octokit/rest'

/**
 * Check if GitHub token is configured
 */
export function isGitHubConfigured(): boolean {
  return !!process.env.GITHUB_TOKEN
}

/**
 * Get the GitHub username of the authenticated user
 */
export async function getGitHubUsername(): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return null

  try {
    const octokit = new Octokit({ auth: token })
    const { data } = await octokit.users.getAuthenticated()
    return data.login
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
 * Create a new GitHub repository for the authenticated user
 */
export async function createGitHubRepo(
  name: string,
  description: string,
  isPrivate = true
): Promise<GitHubRepoInfo> {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured')
  }

  const octokit = new Octokit({ auth: token })

  try {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: false,  // We'll initialize locally with our own commit
    })

    return {
      sshUrl: data.ssh_url,
      httpsUrl: data.clone_url,
      htmlUrl: data.html_url,
      fullName: data.full_name,
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      const octokitError = error as { status: number; message?: string }
      if (octokitError.status === 422) {
        throw new Error(`Repository "${name}" already exists or name is invalid`)
      }
      if (octokitError.status === 401) {
        throw new Error('GitHub authentication failed. Please check your GITHUB_TOKEN')
      }
    }
    throw error
  }
}

/**
 * Check if a repository name is available
 */
export async function isRepoNameAvailable(name: string): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return true  // Can't check without token

  const octokit = new Octokit({ auth: token })

  try {
    const username = await getGitHubUsername()
    if (!username) return true

    await octokit.repos.get({
      owner: username,
      repo: name,
    })
    return false  // Repo exists
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'status' in error) {
      const octokitError = error as { status: number }
      if (octokitError.status === 404) {
        return true  // Repo doesn't exist, name is available
      }
    }
    return true  // Assume available on other errors
  }
}
