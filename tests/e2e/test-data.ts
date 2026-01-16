/**
 * E2E 测试数据常量
 *
 * 这些常量用于 Seedbed + Farmer 全流程自动化测试
 */

export const E2E_TEST = {
  // 测试项目配置
  project: {
    id: 'test-project-e2e',
    name: 'E2E Test Project',
    description: '自动化测试专用，请勿手动修改',
    localPath: '/Users/yoshiyuki/WebstormProjects/e2e-test-repo',
    gitUrl: 'git@github.com:YoshiyukiSakura/e2e-test-repo.git',
    gitBranch: 'main',
  },

  // 测试用户
  user: {
    id: 'cmk3ufpfe00008yzaw3lkhv18',
    slackUserId: 'DEV_USER_001',
    slackUsername: 'dev-user',
  },

  // 测试标识前缀（用于幂等清理）
  prefix: '[E2E-TEST]',

  // API 端点
  endpoints: {
    seedbed: 'http://localhost:3000',
    farmer: 'http://localhost:38965',
  },
}

/**
 * 生成带时间戳的测试名称
 */
export function generateTestName(base: string): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
  return `${E2E_TEST.prefix} ${base} ${timestamp}`
}

// ============================================
// 动态任务池 - 每次测试随机选择不同的任务
// ============================================

/** 函数任务模板（在 utils.ts 中添加） */
const FUNCTION_TEMPLATES = [
  {
    name: 'greet',
    signature: 'greet(name: string): string',
    returnFormat: 'Hello, {name}!',
    description: '创建问候函数',
  },
  {
    name: 'farewell',
    signature: 'farewell(name: string): string',
    returnFormat: 'Goodbye, {name}!',
    description: '创建告别函数',
  },
  {
    name: 'welcome',
    signature: 'welcome(user: string): string',
    returnFormat: 'Welcome back, {user}!',
    description: '创建欢迎函数',
  },
  {
    name: 'formatName',
    signature: 'formatName(first: string, last: string): string',
    returnFormat: '{last}, {first}',
    description: '创建姓名格式化函数',
  },
  {
    name: 'getInitials',
    signature: 'getInitials(name: string): string',
    returnFormat: '返回名字首字母大写',
    description: '创建获取首字母函数',
  },
  {
    name: 'repeat',
    signature: 'repeat(text: string, times: number): string',
    returnFormat: '将 text 重复 times 次',
    description: '创建字符串重复函数',
  },
  {
    name: 'truncate',
    signature: 'truncate(text: string, maxLen: number): string',
    returnFormat: '截断字符串到 maxLen 长度',
    description: '创建字符串截断函数',
  },
  {
    name: 'slugify',
    signature: 'slugify(text: string): string',
    returnFormat: '将空格替换为短横线并转小写',
    description: '创建 slug 转换函数',
  },
]

/** 配置任务模板（在 config.ts 中添加） */
const CONFIG_TEMPLATES = [
  { key: 'debugMode', value: 'true', type: 'boolean' },
  { key: 'verboseLog', value: 'false', type: 'boolean' },
  { key: 'maxRetries', value: '3', type: 'number' },
  { key: 'timeout', value: '5000', type: 'number' },
  { key: 'apiVersion', value: '"v2"', type: 'string' },
  { key: 'appName', value: '"E2E-App"', type: 'string' },
  { key: 'enableCache', value: 'true', type: 'boolean' },
  { key: 'logLevel', value: '"info"', type: 'string' },
  { key: 'batchSize', value: '100', type: 'number' },
  { key: 'retryDelay', value: '1000', type: 'number' },
]

/**
 * 生成随机后缀（用于区分不同测试轮次）
 */
function generateSuffix(): string {
  // 使用当前时间的 HHmm 作为后缀
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * 随机选取数组中的 N 个元素
 */
function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * 动态生成测试任务
 * 每次调用返回不同的任务组合，避免测试混淆
 */
export function generateTestTasks(count: number = 2): {
  tasks: typeof SAMPLE_TASKS
  promptText: string
} {
  const suffix = generateSuffix()

  // 随机选取一个函数模板和一个配置模板
  const [funcTemplate] = pickRandom(FUNCTION_TEMPLATES, 1)
  const [configTemplate] = pickRandom(CONFIG_TEMPLATES, 1)

  // 给函数名加上后缀，确保唯一性
  const funcName = `${funcTemplate.name}_${suffix}`
  const configKey = `${configTemplate.key}_${suffix}`

  const tasks = [
    {
      title: `${E2E_TEST.prefix} ${funcTemplate.description}`,
      description: `在 src/utils.ts 中添加 ${funcName}(${funcTemplate.signature.split('(')[1]}，返回 ${funcTemplate.returnFormat}`,
      priority: 1,
      acceptanceCriteria: [
        `函数名为 ${funcName}`,
        `签名: ${funcName}(${funcTemplate.signature.split('(')[1]}`,
        `返回值格式: ${funcTemplate.returnFormat}`,
      ],
      relatedFiles: ['src/utils.ts'],
      estimateHours: 0.5,
    },
    {
      title: `${E2E_TEST.prefix} 添加配置 ${configKey}`,
      description: `在 src/config.ts 的 config 对象中添加 ${configKey}: ${configTemplate.value}`,
      priority: 2,
      acceptanceCriteria: [
        `配置键名为 ${configKey}`,
        `类型为 ${configTemplate.type}`,
        `默认值为 ${configTemplate.value}`,
      ],
      relatedFiles: ['src/config.ts'],
      estimateHours: 0.25,
    },
  ]

  // 生成对应的 prompt 文本
  const promptText = `请为 e2e-test-repo 项目创建计划，包含以下任务：
1. ${funcTemplate.description}：在 src/utils.ts 中添加 ${funcName}(${funcTemplate.signature.split('(')[1]}，返回 ${funcTemplate.returnFormat}
2. 添加配置项：在 src/config.ts 的 config 对象中添加 ${configKey}: ${configTemplate.value}`

  return { tasks: tasks.slice(0, count), promptText }
}

/**
 * 简单的测试任务定义（静态版本，作为后备）
 */
export const SAMPLE_TASKS = [
  {
    title: `${E2E_TEST.prefix} 添加问候函数`,
    description: '在 src/utils.ts 中添加一个新的问候函数 sayHello',
    priority: 1,
    acceptanceCriteria: [
      '函数名为 sayHello',
      '接受 name 参数',
      '返回格式化的问候语',
    ],
    relatedFiles: ['src/utils.ts'],
    estimateHours: 0.5,
  },
  {
    title: `${E2E_TEST.prefix} 更新配置`,
    description: '在 src/config.ts 中添加一个新的配置项 testMode: true',
    priority: 2,
    acceptanceCriteria: ['添加 testMode 配置项', '默认值为 true'],
    relatedFiles: ['src/config.ts'],
    estimateHours: 0.25,
    blockedBy: [], // 依赖第一个任务完成
  },
  {
    title: `${E2E_TEST.prefix} 集成测试函数`,
    description: '在 src/index.ts 中调用新添加的 sayHello 函数',
    priority: 3,
    acceptanceCriteria: ['导入 sayHello', '在 main 函数中调用'],
    relatedFiles: ['src/index.ts'],
    estimateHours: 0.25,
    blockedBy: [], // 将在创建时设置为依赖前两个任务
  },
]
