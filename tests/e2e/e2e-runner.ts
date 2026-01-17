/**
 * Seedbed + Farmer E2E 测试脚本
 *
 * 运行方式: npx tsx tests/e2e/e2e-runner.ts
 */
import 'dotenv/config'
import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { E2E_TEST, generateTestTasks } from './test-data'

// ===== 类型定义 =====
interface TestResults {
  success: boolean
  planId: string
  executionId: string
  projectId: string
  prUrls: string[]
  duration: number
  phases: PhaseResult[]
}

interface PhaseResult {
  name: string
  status: 'success' | 'failed' | 'skipped'
  duration: number
  error?: string
}

// ===== 配置 =====
const SEEDBED_PORT = process.env.SEEDBED_PORT || '3000'
const FARMER_PORT = process.env.FARMER_PORT || '38965'
const CONFIG = {
  seedbedBase: process.env.SEEDBED_BASE || `http://localhost:${SEEDBED_PORT}`,
  farmerBase: process.env.FARMER_BASE || `http://localhost:${FARMER_PORT}`,
  ...E2E_TEST,
}

// ===== 全局状态 =====
let authToken = ''
let projectId = ''

// ===== 工具函数 =====
function log(phase: string, msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const icons = { info: '  ', success: '✓ ', error: '✗ ', warn: '⚠ ' }
  const colors = { info: '\x1b[0m', success: '\x1b[32m', error: '\x1b[31m', warn: '\x1b[33m' }
  console.log(`${colors[type]}${icons[type]}[${phase}] ${msg}\x1b[0m`)
}

function exec(cmd: string, options?: { cwd?: string; silent?: boolean }): string {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      cwd: options?.cwd,
      stdio: options?.silent ? 'pipe' : 'inherit',
    }).trim()
  } catch (e: unknown) {
    if (options?.silent) return ''
    throw e
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  headers.set('Cookie', `auth-token=${authToken}`)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...options, headers })
}

// ===== Phase 0: 环境准备 =====
async function checkServices(): Promise<void> {
  log('Phase 0', '检查服务状态...')

  // 检查 Seedbed (用根路径，因为没有 health 端点)
  try {
    const res = await fetch(`${CONFIG.seedbedBase}`, { method: 'HEAD' })
    // 2xx 或 3xx 都表示服务在运行
    if (res.status >= 400 && res.status !== 404) throw new Error(`HTTP ${res.status}`)
    log('Phase 0', `Seedbed: UP (${CONFIG.seedbedBase})`, 'success')
  } catch (e) {
    if (e instanceof TypeError && String(e).includes('fetch')) {
      throw new Error(`Seedbed 服务未运行 (${CONFIG.seedbedBase})`)
    }
    // 其他错误（如 404）说明服务在跑
    log('Phase 0', `Seedbed: UP (${CONFIG.seedbedBase})`, 'success')
  }

  // 检查 Farmer
  try {
    const res = await fetch(`${CONFIG.farmerBase}/api/health`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    log('Phase 0', `Farmer: UP (${CONFIG.farmerBase})`, 'success')
  } catch (e) {
    if (e instanceof TypeError && String(e).includes('fetch')) {
      throw new Error(`Farmer 服务未运行 (${CONFIG.farmerBase})`)
    }
    // 尝试用根路径
    try {
      await fetch(`${CONFIG.farmerBase}`, { method: 'HEAD' })
      log('Phase 0', `Farmer: UP (${CONFIG.farmerBase})`, 'success')
    } catch {
      throw new Error(`Farmer 服务未运行 (${CONFIG.farmerBase})`)
    }
  }

  // 检查 Worker
  try {
    const pm2List = exec('pm2 jlist 2>/dev/null', { silent: true })
    if (!pm2List.includes('farmer-worker')) {
      log('Phase 0', 'Farmer Worker: DOWN', 'warn')
    } else {
      log('Phase 0', 'Farmer Worker: UP', 'success')
    }
  } catch {
    log('Phase 0', 'Farmer Worker: 无法检查 pm2', 'warn')
  }
}

async function generateToken(): Promise<string> {
  log('Phase 0', '通过 dev-login 获取 Token（自动创建用户）...')

  const res = await fetch(`${CONFIG.seedbedBase}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`dev-login 失败: HTTP ${res.status}`)
  }

  // 从 Set-Cookie header 中提取 token
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error('dev-login 未返回 cookie')
  }

  const match = setCookie.match(/auth-token=([^;]+)/)
  if (!match) {
    throw new Error('无法从 cookie 中提取 auth-token')
  }

  authToken = match[1]
  log('Phase 0', 'Token 获取成功（用户已创建/存在）', 'success')
  return authToken
}

async function resetTestRepo(): Promise<void> {
  log('Phase 0', '重置测试仓库...')

  const repoPath = CONFIG.project.localPath

  try {
    exec('git fetch origin', { cwd: repoPath, silent: true })
    exec('git checkout main', { cwd: repoPath, silent: true })
    exec('git reset --hard origin/main', { cwd: repoPath, silent: true })
    exec('git clean -fd', { cwd: repoPath, silent: true })

    // 删除本地 farmer/* 分支
    try {
      exec("git branch | grep 'farmer/' | xargs git branch -D 2>/dev/null || true", {
        cwd: repoPath,
        silent: true,
      })
    } catch {
      // 忽略：可能没有 farmer/ 分支
    }

    // 删除远程 farmer/* 分支
    try {
      const remoteBranches = exec("git branch -r | grep 'origin/farmer/' || true", {
        cwd: repoPath,
        silent: true,
      })
      for (const line of remoteBranches.split('\n').filter(Boolean)) {
        const branch = line.trim().replace('origin/', '')
        exec(`git push origin --delete "${branch}" 2>/dev/null || true`, {
          cwd: repoPath,
          silent: true,
        })
      }
    } catch {
      // 忽略
    }

    log('Phase 0', '测试仓库已重置', 'success')
  } catch (e) {
    throw new Error(`重置仓库失败: ${e}`)
  }
}

// ===== Phase 1: 幂等清理 =====
async function cleanupOldPlans(): Promise<void> {
  log('Phase 1', '清理旧的测试 Plans...')

  try {
    // 先尝试获取项目
    const projectRes = await fetchWithAuth(`${CONFIG.seedbedBase}/api/projects/${CONFIG.project.id}`)
    const projectData = await projectRes.json()

    let pid = ''
    if (projectData.project?.id) {
      pid = projectData.project.id
    } else {
      // 尝试通过名称查找
      const listRes = await fetchWithAuth(`${CONFIG.seedbedBase}/api/projects`)
      const listData = await listRes.json()
      const found = listData.projects?.find((p: { name: string }) => p.name === CONFIG.project.name)
      if (found) pid = found.id
    }

    if (!pid) {
      log('Phase 1', '项目不存在，跳过清理', 'info')
      return
    }

    // 获取所有 Plans
    const plansRes = await fetchWithAuth(`${CONFIG.seedbedBase}/api/projects/${pid}/plans`)
    const plansData = await plansRes.json()

    const testPlans =
      plansData.plans?.filter((p: { name: string }) => p.name?.includes(CONFIG.prefix)) || []

    let deletedCount = 0
    for (const plan of testPlans) {
      await fetchWithAuth(`${CONFIG.seedbedBase}/api/plans/${plan.id}`, { method: 'DELETE' })
      deletedCount++
    }

    if (deletedCount > 0) {
      log('Phase 1', `已删除 ${deletedCount} 个测试 Plans`, 'success')
    } else {
      log('Phase 1', '没有需要清理的 Plans', 'info')
    }
  } catch (e) {
    log('Phase 1', `清理 Plans 失败: ${e}`, 'warn')
  }
}

async function closeTestPRs(): Promise<void> {
  log('Phase 1', '关闭测试 PR...')

  try {
    const repo = 'YoshiyukiSakura/e2e-test-repo'
    const prsJson = exec(`gh pr list --repo ${repo} --state open --json number,title,headRefName`, {
      silent: true,
    })
    const prs = JSON.parse(prsJson || '[]')

    // 匹配测试PR：标题包含前缀 或 branch名称以 farmer/ 开头
    const testPrs = prs.filter(
      (pr: { title: string; headRefName: string }) =>
        pr.title?.includes(CONFIG.prefix) || pr.headRefName?.startsWith('farmer/')
    )

    let closedCount = 0
    for (const pr of testPrs) {
      exec(`gh pr close ${pr.number} --repo ${repo} 2>/dev/null || true`, { silent: true })
      closedCount++
    }

    if (closedCount > 0) {
      log('Phase 1', `已关闭 ${closedCount} 个测试 PR`, 'success')
    } else {
      log('Phase 1', '没有需要关闭的 PR', 'info')
    }
  } catch (e) {
    log('Phase 1', `关闭 PR 失败: ${e}`, 'warn')
  }
}

// ===== Phase 2: 确保项目存在 =====
async function ensureProject(): Promise<string> {
  log('Phase 2', '确保测试项目存在...')

  const res = await fetchWithAuth(`${CONFIG.seedbedBase}/api/projects/${CONFIG.project.id}`)
  const data = await res.json()

  if (data.project?.id) {
    projectId = data.project.id
    log('Phase 2', `项目已存在: ${projectId}`, 'success')
    return projectId
  }

  // 创建项目
  const createRes = await fetchWithAuth(`${CONFIG.seedbedBase}/api/projects`, {
    method: 'POST',
    body: JSON.stringify({
      id: CONFIG.project.id,
      name: CONFIG.project.name,
      description: CONFIG.project.description,
      localPath: CONFIG.project.localPath,
      gitUrl: CONFIG.project.gitUrl,
      gitBranch: CONFIG.project.gitBranch,
    }),
  })

  const createData = await createRes.json()
  if (!createData.project?.id) {
    throw new Error(`创建项目失败: ${JSON.stringify(createData)}`)
  }

  projectId = createData.project.id
  log('Phase 2', `项目已创建: ${projectId}`, 'success')
  return projectId
}

// ===== Phase 3: 创建 Plan 和 Tasks =====
async function createPlanViaChat(): Promise<{ planId: string; assistantContent: string }> {
  log('Phase 3', '通过聊天创建 Plan...')

  const { promptText } = generateTestTasks(2)
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
  const prompt = `${CONFIG.prefix} 测试计划 ${timestamp} - ${promptText}`

  log('Phase 3', `发送请求: ${prompt.slice(0, 50)}...`, 'info')

  const response = await fetch(`${CONFIG.seedbedBase}/api/claude/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `auth-token=${authToken}`,
    },
    body: JSON.stringify({ prompt, projectId }),
  })

  if (!response.ok) {
    throw new Error(`聊天请求失败: HTTP ${response.status}`)
  }

  // 读取 SSE 流
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let planId = ''
  let assistantContent = ''
  let buffer = ''

  const startTime = Date.now()
  const maxWait = 120_000 // 最多等待 120 秒

  while (Date.now() - startTime < maxWait) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // 处理完整的 SSE 行
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // 保留不完整的行

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue

      try {
        const jsonStr = line.slice(6)
        if (jsonStr === '[DONE]') continue

        const data = JSON.parse(jsonStr)

        // 检查 planId
        if (data.planId && !planId) {
          planId = data.planId
          log('Phase 3', `获取到 Plan ID: ${planId}`, 'success')
        }

        // 收集 assistant 内容
        if (data.type === 'text' && data.data?.content) {
          assistantContent += data.data.content
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  if (!planId) {
    // 尝试从 API 获取最新的 Plan
    log('Phase 3', '从 SSE 未获取到 planId，尝试从 API 获取...', 'warn')
    const plansRes = await fetchWithAuth(`${CONFIG.seedbedBase}/api/projects/${projectId}/plans`)
    const plansData = await plansRes.json()

    const testPlans = (plansData.plans || [])
      .filter((p: { name: string }) => p.name?.includes(CONFIG.prefix))
      .sort(
        (a: { createdAt: string }, b: { createdAt: string }) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

    if (testPlans.length > 0) {
      planId = testPlans[0].id
      log('Phase 3', `从 API 获取到 Plan ID: ${planId}`, 'success')
    }
  }

  if (!planId) {
    throw new Error('无法获取 Plan ID')
  }

  return { planId, assistantContent }
}

async function extractTasks(planId: string, assistantContent: string): Promise<void> {
  log('Phase 3', '提取任务...')

  let planContent = assistantContent

  // 如果 SSE 内容太短（少于 200 字符），从数据库获取对话内容
  if (!planContent || planContent.length < 200) {
    log('Phase 3', 'SSE 内容不足，从数据库获取对话...', 'info')
    await sleep(2000) // 等待数据库写入完成

    const planRes = await fetchWithAuth(`${CONFIG.seedbedBase}/api/plans/${planId}`)
    const planData = await planRes.json()

    // 获取 assistant 的最后一条消息
    const conversations = planData.plan?.conversations || []
    const assistantMessages = conversations
      .filter((c: { role: string }) => c.role === 'assistant')
      .map((c: { content: string }) => c.content)

    if (assistantMessages.length > 0) {
      planContent = assistantMessages.join('\n\n')
      log('Phase 3', `从数据库获取到 ${planContent.length} 字符的内容`, 'success')
    }
  }

  if (planContent && planContent.length > 100) {
    // 调用任务提取 API
    const extractRes = await fetchWithAuth(`${CONFIG.seedbedBase}/api/tasks/extract`, {
      method: 'POST',
      body: JSON.stringify({ planContent }),
    })

    const extractData = await extractRes.json()
    const tasks = extractData.tasks || []

    if (tasks.length > 0) {
      // 保存任务到数据库
      await fetchWithAuth(`${CONFIG.seedbedBase}/api/plans/${planId}/tasks`, {
        method: 'PUT',
        body: JSON.stringify({ tasks }),
      })
      log('Phase 3', `已提取并保存 ${tasks.length} 个任务`, 'success')
      return
    }
  }

  // 使用后备任务
  log('Phase 3', '使用后备任务...', 'warn')
  const { tasks } = generateTestTasks(2)

  await fetchWithAuth(`${CONFIG.seedbedBase}/api/plans/${planId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ tasks }),
  })
  log('Phase 3', `已创建 ${tasks.length} 个后备任务`, 'success')
}

async function verifyPlanCreation(planId: string): Promise<void> {
  log('Phase 3', '验证 Plan 创建结果...')

  await sleep(2000) // 等待数据同步

  const res = await fetchWithAuth(`${CONFIG.seedbedBase}/api/plans/${planId}`)
  const data = await res.json()

  const plan = data.plan
  if (!plan) {
    throw new Error('无法获取 Plan 详情')
  }

  const convCount = plan.conversations?.length || 0
  const taskCount = plan.tasks?.length || 0

  log('Phase 3', `Plan: ${plan.name}`, 'info')
  log('Phase 3', `对话数: ${convCount}, 任务数: ${taskCount}`, 'info')

  if (taskCount === 0) {
    throw new Error('Plan 没有任务')
  }

  log('Phase 3', 'Plan 验证通过', 'success')
}

async function publishPlan(planId: string): Promise<void> {
  log('Phase 3', '发布 Plan...')

  const res = await fetchWithAuth(`${CONFIG.seedbedBase}/api/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'PUBLISHED' }),
  })

  if (!res.ok) {
    throw new Error(`发布 Plan 失败: HTTP ${res.status}`)
  }

  log('Phase 3', 'Plan 已发布', 'success')
}

async function startExecution(planId: string): Promise<string> {
  log('Phase 4', '启动 Farmer 执行...')

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
  const res = await fetchWithAuth(`${CONFIG.farmerBase}/api/execution/start`, {
    method: 'POST',
    body: JSON.stringify({
      planId,
      idempotencyKey: `e2e-test-${timestamp}`,
    }),
  })

  const data = await res.json()
  const executionId = data.execution?.id || data.id

  if (!executionId) {
    throw new Error(`启动执行失败: ${JSON.stringify(data)}`)
  }

  log('Phase 4', `执行已启动: ${executionId}`, 'success')
  return executionId
}

async function waitForExecution(executionId: string): Promise<string> {
  log('Phase 4', '等待执行完成...')

  const maxWait = 600_000 // 10 分钟
  const interval = 3_000 // 3 秒
  const startTime = Date.now()

  while (Date.now() - startTime < maxWait) {
    const res = await fetchWithAuth(`${CONFIG.farmerBase}/api/execution/${executionId}`)
    const data = await res.json()

    const execution = data.execution || data
    const status = execution.status
    const elapsed = Math.floor((Date.now() - startTime) / 1000)

    // 显示进度
    const issues = execution.issues || []
    const issueStatuses = issues.map((i: { status: string }) => i.status).join(', ')
    process.stdout.write(`\r  [${elapsed}s] 状态: ${status} | Issues: ${issueStatuses}        `)

    if (status === 'COMPLETED' || status === 'FAILED') {
      console.log() // 换行
      log('Phase 4', `执行完成: ${status}`, status === 'COMPLETED' ? 'success' : 'error')
      return status
    }

    await sleep(interval)
  }

  console.log()
  throw new Error('执行超时')
}

// ===== Phase 5: 验证结果 =====
async function verifyResults(executionId: string): Promise<{
  success: boolean
  prUrls: string[]
}> {
  log('Phase 5', '验证执行结果...')

  const res = await fetchWithAuth(`${CONFIG.farmerBase}/api/execution/${executionId}`)
  const data = await res.json()
  const execution = data.execution || data

  log('Phase 5', `最终状态: ${execution.status}`, 'info')

  const issues = execution.issues || []
  const prUrls: string[] = []

  let allIssuesCompleted = true
  for (const issue of issues) {
    log('Phase 5', `  - ${issue.taskTitle}: ${issue.status}`, issue.status === 'COMPLETED' ? 'success' : 'error')
    if (issue.status !== 'COMPLETED') {
      allIssuesCompleted = false
    }
    if (issue.prUrl) {
      prUrls.push(issue.prUrl)
      log('Phase 5', `    PR: ${issue.prUrl}`, 'info')
    }
    if (issue.error) {
      log('Phase 5', `    Error: ${issue.error}`, 'error')
    }
  }

  // 验证 GitHub PR - 通过 execution 记录中的 prUrl 验证
  log('Phase 5', '验证 GitHub PR...', 'info')
  let foundPRs = false

  // 首先检查 execution 记录中是否有 PR 信息
  if (execution.prUrl) {
    foundPRs = true
    log('Phase 5', `Execution PR: ${execution.prUrl}`, 'success')
    if (!prUrls.includes(execution.prUrl)) {
      prUrls.push(execution.prUrl)
    }
  } else {
    // 备用方案：检查 GitHub 上是否有最近创建的 PR（不依赖标题前缀）
    try {
      const prsJson = exec(
        `gh pr list --repo YoshiyukiSakura/e2e-test-repo --state open --json number,title,url,createdAt`,
        { silent: true }
      )
      const prs = JSON.parse(prsJson || '[]')

      // 查找最近10分钟内创建的PR（测试期间创建的）
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000
      const recentPrs = prs.filter((pr: { createdAt: string }) => {
        const prTime = new Date(pr.createdAt).getTime()
        return prTime > tenMinutesAgo
      })

      if (recentPrs.length > 0) {
        foundPRs = true
        log('Phase 5', `找到 ${recentPrs.length} 个最近创建的 PR`, 'success')
        for (const pr of recentPrs) {
          log('Phase 5', `  PR #${pr.number}: ${pr.title}`, 'info')
          if (pr.url && !prUrls.includes(pr.url)) {
            prUrls.push(pr.url)
          }
        }
      } else {
        log('Phase 5', '未找到最近创建的 PR', 'warn')
      }
    } catch (e) {
      log('Phase 5', `验证 PR 失败: ${e}`, 'warn')
    }
  }

  // 成功条件：execution 完成 + 所有 issues 完成 + 找到 PR
  const success = execution.status === 'COMPLETED' && allIssuesCompleted && foundPRs
  return { success, prUrls }
}

// ===== Phase 6: 生成报告 =====
async function generateReport(results: TestResults): Promise<void> {
  log('Phase 6', '生成测试报告...')

  const reportDir = 'tests/e2e/reports'
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true })
  }

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const reportPath = `${reportDir}/e2e-test-report-${date}.md`

  const statusEmoji = results.success ? '✅' : '❌'
  const report = `# Seedbed + Farmer E2E 测试报告

**测试时间**: ${new Date().toISOString()}
**测试状态**: ${statusEmoji} ${results.success ? '全部通过' : '失败'}
**耗时**: ${results.duration.toFixed(1)} 秒

## 测试配置
| 配置项 | 值 |
|--------|-----|
| 项目 ID | ${results.projectId} |
| Plan ID | ${results.planId} |
| Execution ID | ${results.executionId} |

## 测试阶段结果
${results.phases.map(p => `- ${p.status === 'success' ? '✅' : p.status === 'failed' ? '❌' : '⏭️'} **${p.name}** (${p.duration.toFixed(1)}s)${p.error ? ` - ${p.error}` : ''}`).join('\n')}

## 创建的资源

### GitHub PRs
${results.prUrls.length > 0 ? results.prUrls.map(url => `- ${url}`).join('\n') : '无'}

## 成功标准 Checklist
- [${results.phases.find(p => p.name.includes('Phase 0'))?.status === 'success' ? 'x' : ' '}] Phase 0: 所有服务运行正常
- [${results.phases.find(p => p.name.includes('Phase 1'))?.status === 'success' ? 'x' : ' '}] Phase 1: 旧测试数据已清理
- [${results.phases.find(p => p.name.includes('Phase 2'))?.status === 'success' ? 'x' : ' '}] Phase 2: 测试项目存在
- [${results.phases.find(p => p.name.includes('Phase 3'))?.status === 'success' ? 'x' : ' '}] Phase 3: Plan 和 Tasks 创建成功
- [${results.phases.find(p => p.name.includes('Phase 4'))?.status === 'success' ? 'x' : ' '}] Phase 4: Execution 完成
- [${results.phases.find(p => p.name.includes('Phase 5'))?.status === 'success' ? 'x' : ' '}] Phase 5: PR 创建成功
`

  writeFileSync(reportPath, report)
  log('Phase 6', `报告已保存: ${reportPath}`, 'success')
}

// ===== 主流程 =====
async function main() {
  console.log('\n🌱 Seedbed + Farmer E2E Test Starting...\n')
  console.log('=' .repeat(50))

  const startTime = Date.now()
  const phases: PhaseResult[] = []
  let planId = ''
  let executionId = ''
  let prUrls: string[] = []

  // Phase 0: 环境准备
  let phaseStart = Date.now()
  try {
    console.log('\n📋 Phase 0: 环境准备')
    console.log('-'.repeat(50))
    await checkServices()
    await generateToken()
    await resetTestRepo()
    phases.push({ name: 'Phase 0: 环境准备', status: 'success', duration: (Date.now() - phaseStart) / 1000 })
  } catch (e) {
    phases.push({ name: 'Phase 0: 环境准备', status: 'failed', duration: (Date.now() - phaseStart) / 1000, error: String(e) })
    throw e
  }

  // Phase 1: 幂等清理 (并行)
  phaseStart = Date.now()
  try {
    console.log('\n🧹 Phase 1: 幂等清理')
    console.log('-'.repeat(50))
    await Promise.all([cleanupOldPlans(), closeTestPRs()])
    phases.push({ name: 'Phase 1: 幂等清理', status: 'success', duration: (Date.now() - phaseStart) / 1000 })
  } catch (e) {
    phases.push({ name: 'Phase 1: 幂等清理', status: 'failed', duration: (Date.now() - phaseStart) / 1000, error: String(e) })
    // 继续执行，清理失败不阻塞
  }

  // Phase 2: 确保项目存在
  phaseStart = Date.now()
  try {
    console.log('\n📁 Phase 2: 确保项目存在')
    console.log('-'.repeat(50))
    projectId = await ensureProject()
    phases.push({ name: 'Phase 2: 确保项目存在', status: 'success', duration: (Date.now() - phaseStart) / 1000 })
  } catch (e) {
    phases.push({ name: 'Phase 2: 确保项目存在', status: 'failed', duration: (Date.now() - phaseStart) / 1000, error: String(e) })
    throw e
  }

  // Phase 3: 创建 Plan 和 Tasks
  phaseStart = Date.now()
  try {
    console.log('\n💬 Phase 3: 创建 Plan 和 Tasks')
    console.log('-'.repeat(50))
    const result = await createPlanViaChat()
    planId = result.planId
    await extractTasks(planId, result.assistantContent)
    await verifyPlanCreation(planId)
    await publishPlan(planId)
    phases.push({ name: 'Phase 3: 创建 Plan 和 Tasks', status: 'success', duration: (Date.now() - phaseStart) / 1000 })
  } catch (e) {
    phases.push({ name: 'Phase 3: 创建 Plan 和 Tasks', status: 'failed', duration: (Date.now() - phaseStart) / 1000, error: String(e) })
    throw e
  }

  // Phase 4: Farmer 执行
  phaseStart = Date.now()
  try {
    console.log('\n🚜 Phase 4: Farmer 执行')
    console.log('-'.repeat(50))
    executionId = await startExecution(planId)
    await waitForExecution(executionId)
    phases.push({ name: 'Phase 4: Farmer 执行', status: 'success', duration: (Date.now() - phaseStart) / 1000 })
  } catch (e) {
    phases.push({ name: 'Phase 4: Farmer 执行', status: 'failed', duration: (Date.now() - phaseStart) / 1000, error: String(e) })
    throw e
  }

  // Phase 5: 验证结果
  phaseStart = Date.now()
  try {
    console.log('\n✅ Phase 5: 验证结果')
    console.log('-'.repeat(50))
    const verifyResult = await verifyResults(executionId)
    prUrls = verifyResult.prUrls
    phases.push({
      name: 'Phase 5: 验证结果',
      status: verifyResult.success ? 'success' : 'failed',
      duration: (Date.now() - phaseStart) / 1000,
    })
  } catch (e) {
    phases.push({ name: 'Phase 5: 验证结果', status: 'failed', duration: (Date.now() - phaseStart) / 1000, error: String(e) })
  }

  // Phase 6: 生成报告
  const duration = (Date.now() - startTime) / 1000
  const success = phases.every(p => p.status !== 'failed')

  console.log('\n📊 Phase 6: 生成报告')
  console.log('-'.repeat(50))
  await generateReport({
    success,
    planId,
    executionId,
    projectId,
    prUrls,
    duration,
    phases,
  })

  // 最终结果
  console.log('\n' + '='.repeat(50))
  if (success) {
    console.log(`\n✅ 测试完成！耗时: ${duration.toFixed(1)}s\n`)
  } else {
    console.log(`\n❌ 测试失败！耗时: ${duration.toFixed(1)}s\n`)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('\n❌ 测试执行失败:', e)
  process.exit(1)
})
