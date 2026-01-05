/**
 * 项目扫描器 - 扫描本地目录获取项目信息
 */

import { readdir, stat, readFile, access } from 'fs/promises'
import { join } from 'path'

export interface LocalProject {
  name: string
  path: string
  description?: string
  techStack: string[]
  hasGit: boolean
  lastModified: string
}

export interface ProjectDetails extends LocalProject {
  readme?: string
  conventions?: Record<string, unknown>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/**
 * 检查文件或目录是否存在
 */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * 从 package.json 提取技术栈信息
 */
function extractTechStack(packageJson: {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}): string[] {
  const techStack: string[] = []
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  // 检测主要框架
  if (deps['next']) techStack.push('Next.js')
  if (deps['react']) techStack.push('React')
  if (deps['vue']) techStack.push('Vue')
  if (deps['@angular/core']) techStack.push('Angular')
  if (deps['svelte']) techStack.push('Svelte')
  if (deps['express']) techStack.push('Express')
  if (deps['fastify']) techStack.push('Fastify')
  if (deps['koa']) techStack.push('Koa')
  if (deps['nest']) techStack.push('NestJS')

  // 检测语言/类型
  if (deps['typescript']) techStack.push('TypeScript')

  // 检测数据库/ORM
  if (deps['prisma'] || deps['@prisma/client']) techStack.push('Prisma')
  if (deps['mongoose']) techStack.push('MongoDB')
  if (deps['pg'] || deps['postgres']) techStack.push('PostgreSQL')
  if (deps['mysql'] || deps['mysql2']) techStack.push('MySQL')
  if (deps['typeorm']) techStack.push('TypeORM')
  if (deps['sequelize']) techStack.push('Sequelize')

  // 检测测试框架
  if (deps['jest']) techStack.push('Jest')
  if (deps['vitest']) techStack.push('Vitest')
  if (deps['playwright'] || deps['@playwright/test']) techStack.push('Playwright')

  // 检测样式框架
  if (deps['tailwindcss']) techStack.push('Tailwind CSS')
  if (deps['styled-components']) techStack.push('Styled Components')

  return techStack
}

/**
 * 扫描单个项目目录，提取项目信息
 */
async function scanProject(projectPath: string): Promise<LocalProject | null> {
  try {
    const projectStat = await stat(projectPath)
    if (!projectStat.isDirectory()) {
      return null
    }

    const name = projectPath.split('/').pop() || 'unknown'

    // 检查是否是有效项目
    const hasPackageJson = await exists(join(projectPath, 'package.json'))
    const hasGit = await exists(join(projectPath, '.git'))
    const hasCargo = await exists(join(projectPath, 'Cargo.toml'))
    const hasGo = await exists(join(projectPath, 'go.mod'))
    const hasPython = await exists(join(projectPath, 'pyproject.toml')) ||
                      await exists(join(projectPath, 'setup.py')) ||
                      await exists(join(projectPath, 'requirements.txt'))

    // 至少需要一个项目标识文件
    if (!hasPackageJson && !hasGit && !hasCargo && !hasGo && !hasPython) {
      return null
    }

    let description: string | undefined
    let techStack: string[] = []

    // 从 package.json 提取信息
    if (hasPackageJson) {
      try {
        const packageJsonContent = await readFile(
          join(projectPath, 'package.json'),
          'utf-8'
        )
        const packageJson = JSON.parse(packageJsonContent)
        description = packageJson.description
        techStack = extractTechStack(packageJson)
      } catch {
        // 忽略解析错误
      }
    }

    // 添加非 Node.js 项目的技术栈
    if (hasCargo) techStack.push('Rust')
    if (hasGo) techStack.push('Go')
    if (hasPython) techStack.push('Python')

    return {
      name,
      path: projectPath,
      description,
      techStack,
      hasGit,
      lastModified: projectStat.mtime.toISOString(),
    }
  } catch (error) {
    console.error(`Error scanning project ${projectPath}:`, error)
    return null
  }
}

/**
 * 扫描目录下的所有项目
 */
export async function scanLocalProjects(
  rootPath: string
): Promise<LocalProject[]> {
  // 检查根目录是否存在
  if (!(await exists(rootPath))) {
    console.warn(`Projects root directory does not exist: ${rootPath}`)
    return []
  }

  const entries = await readdir(rootPath)
  const projects: LocalProject[] = []

  for (const entry of entries) {
    // 跳过隐藏目录
    if (entry.startsWith('.')) continue

    const projectPath = join(rootPath, entry)
    const project = await scanProject(projectPath)

    if (project) {
      projects.push(project)
    }
  }

  // 按最后修改时间排序（最新的在前）
  projects.sort(
    (a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  )

  return projects
}

/**
 * 获取单个项目的详细信息
 */
export async function getProjectDetails(
  projectPath: string
): Promise<ProjectDetails | null> {
  const basicInfo = await scanProject(projectPath)
  if (!basicInfo) return null

  const details: ProjectDetails = { ...basicInfo }

  // 读取 README
  const readmePaths = ['README.md', 'readme.md', 'README', 'Readme.md']
  for (const readmePath of readmePaths) {
    try {
      const content = await readFile(join(projectPath, readmePath), 'utf-8')
      // 只取前 2000 字符，避免过长
      details.readme = content.slice(0, 2000)
      break
    } catch {
      // 继续尝试下一个路径
    }
  }

  // 读取 package.json 的依赖信息
  try {
    const packageJsonContent = await readFile(
      join(projectPath, 'package.json'),
      'utf-8'
    )
    const packageJson = JSON.parse(packageJsonContent)
    details.dependencies = packageJson.dependencies
    details.devDependencies = packageJson.devDependencies
  } catch {
    // 忽略
  }

  return details
}
