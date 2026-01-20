/**
 * /api/projects/analyze
 * POST - 分析 Git 仓库，先 clone 再用 AI 提取项目信息
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getMiniMaxClient } from '@/lib/minimax'
import { validateGitUrl, extractRepoName } from '@/lib/git-utils'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

interface AnalyzeResult {
  name: string
  description: string
  techStack: string[]
}

// 快速 shallow clone 到临时目录
async function shallowClone(gitUrl: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `analyze-${Date.now()}`)
  await fs.mkdir(tempDir, { recursive: true })

  try {
    await execAsync(`git clone --depth 1 "${gitUrl}" "${tempDir}"`, {
      timeout: 60000, // 1 分钟超时
    })
    return tempDir
  } catch (error) {
    // 清理失败的目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {}
    throw error
  }
}

// 读取关键文件内容
async function readKeyFiles(repoPath: string): Promise<Record<string, string>> {
  const keyFiles = [
    'package.json',
    'README.md',
    'readme.md',
    'README',
    'pyproject.toml',
    'setup.py',
    'Cargo.toml',
    'go.mod',
    'pom.xml',
    'build.gradle',
    'composer.json',
    'Gemfile',
    '.nvmrc',
    'tsconfig.json',
  ]

  const contents: Record<string, string> = {}

  for (const file of keyFiles) {
    try {
      const filePath = path.join(repoPath, file)
      const content = await fs.readFile(filePath, 'utf-8')
      // 限制每个文件最大 2000 字符
      contents[file] = content.slice(0, 2000)
    } catch {
      // 文件不存在，跳过
    }
  }

  return contents
}

// 获取目录结构
async function getDirectoryStructure(repoPath: string): Promise<string[]> {
  const items: string[] = []

  async function scanDir(dir: string, prefix: string = '', depth: number = 0) {
    if (depth > 2) return // 最多扫描 3 层

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        // 跳过隐藏文件和 node_modules 等
        if (entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === 'vendor' ||
            entry.name === '__pycache__' ||
            entry.name === 'target' ||
            entry.name === 'dist' ||
            entry.name === 'build') {
          continue
        }

        const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name
        items.push(entry.isDirectory() ? `${itemPath}/` : itemPath)

        if (entry.isDirectory() && items.length < 50) {
          await scanDir(path.join(dir, entry.name), itemPath, depth + 1)
        }
      }
    } catch {}
  }

  await scanDir(repoPath)
  return items.slice(0, 50) // 最多返回 50 个条目
}

// 构建项目分析 prompt
function buildProjectAnalysisPrompt(
  repoName: string,
  files: Record<string, string>,
  structure: string[]
): string {
  let filesSection = ''
  for (const [filename, content] of Object.entries(files)) {
    filesSection += `\n### ${filename}\n\`\`\`\n${content}\n\`\`\`\n`
  }

  return `分析以下 Git 仓库并提取项目信息。

仓库名称: ${repoName}

## 目录结构
${structure.join('\n')}

## 关键文件内容
${filesSection}

请分析并返回 JSON 格式的项目信息:
{
  "name": "项目显示名称",
  "description": "项目简短描述（1-2句话，中文）",
  "techStack": ["技术栈数组"]
}

要求:
1. name: 从 package.json 或 README 中提取项目名，如果没有则使用仓库名
2. description: 根据 README 和代码结构总结项目用途
3. techStack: 从依赖文件和目录结构识别技术栈（如 TypeScript, React, Node.js, Python, Go 等）

只返回 JSON，不要有其他内容。`
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let tempDir: string | null = null

  try {
    const body = await request.json()
    const { gitUrl } = body

    if (!gitUrl) {
      return NextResponse.json({ error: 'gitUrl is required' }, { status: 400 })
    }

    // 验证 URL 格式
    if (!validateGitUrl(gitUrl)) {
      return NextResponse.json(
        { error: 'Invalid Git URL format' },
        { status: 400 }
      )
    }

    const repoName = extractRepoName(gitUrl)
    console.log(`Analyzing repository: ${repoName}`)

    // 1. Shallow clone
    console.log('Shallow cloning repository...')
    tempDir = await shallowClone(gitUrl)
    console.log(`Cloned to: ${tempDir}`)

    // 2. 读取关键文件
    const files = await readKeyFiles(tempDir)
    console.log(`Found ${Object.keys(files).length} key files`)

    // 3. 获取目录结构
    const structure = await getDirectoryStructure(tempDir)
    console.log(`Directory structure: ${structure.length} items`)

    // 4. 使用 AI 分析
    const prompt = buildProjectAnalysisPrompt(repoName, files, structure)
    const minimaxClient = getMiniMaxClient()
    const response = await minimaxClient.generateContent(prompt)

    // 5. 解析 AI 响应
    let result: AnalyzeResult
    try {
      let jsonStr = response.trim()

      // 移除 <think>...</think> 思考标签
      jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

      // 移除 markdown code block
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7)
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3)
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3)
      }
      jsonStr = jsonStr.trim()

      result = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse AI response:', response)
      // Fallback
      result = {
        name: repoName.charAt(0).toUpperCase() + repoName.slice(1),
        description: '',
        techStack: []
      }
    }

    return NextResponse.json({
      name: result.name || repoName,
      description: result.description || '',
      techStack: result.techStack || [],
      gitBranch: 'main'
    })
  } catch (error) {
    console.error('Project analysis error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: `Analysis failed: ${errorMessage}` },
      { status: 500 }
    )
  } finally {
    // 清理临时目录
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
        console.log(`Cleaned up temp directory: ${tempDir}`)
      } catch (cleanupError) {
        console.error('Failed to cleanup temp directory:', cleanupError)
      }
    }
  }
}
