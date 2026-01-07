/**
 * 任务提取 Prompt 模板
 */

export const TASK_EXTRACTION_PROMPT = `你是一个任务提取专家。请分析以下计划内容，提取出具体的开发任务。

要求：
1. 只返回 JSON 数组，不要有任何其他文字
2. 每个任务必须包含以下字段：
   - title: 简短的任务标题（不超过50字）
   - description: 详细描述
   - priority: 0-3 的数字（0=紧急/P0, 1=高/P1, 2=中/P2, 3=低/P3）
   - labels: 标签数组，从以下选择：["后端", "前端", "数据库", "测试", "文档", "配置"]
   - acceptanceCriteria: 验收标准数组
   - estimateHours: 预估小时数（可选，数字类型）
   - blockedBy: 依赖的任务索引数组（可选，表示该任务被哪些任务阻塞）

3. 按照依赖顺序排列任务（先做的排前面）
4. 根据任务的紧急程度和重要性分配优先级
5. 分析任务之间的依赖关系：
   - 数据库模型必须先于使用该模型的 API
   - API 必须先于使用该 API 的前端
   - 基础设施/配置任务通常应该最先
   - 测试任务通常依赖于被测功能

输出格式示例：
[
  {
    "title": "创建用户数据模型",
    "description": "在 Prisma schema 中定义 User 模型，包含 id、email、password 等字段",
    "priority": 0,
    "labels": ["后端", "数据库"],
    "acceptanceCriteria": ["User 模型已定义", "包含必要字段", "已运行 prisma migrate"],
    "estimateHours": 1
  },
  {
    "title": "实现注册 API",
    "description": "POST /api/auth/register 接口",
    "priority": 0,
    "labels": ["后端"],
    "acceptanceCriteria": ["API 可正常调用", "参数校验完善"],
    "estimateHours": 2,
    "blockedBy": [0]
  },
  {
    "title": "实现登录页面",
    "description": "创建登录表单组件",
    "priority": 1,
    "labels": ["前端"],
    "acceptanceCriteria": ["表单可提交", "错误提示正常"],
    "estimateHours": 3,
    "blockedBy": [1]
  }
]

---
计划内容：
{PLAN_CONTENT}
`

/**
 * 生成完整的提取 prompt
 */
export function buildTaskExtractionPrompt(planContent: string): string {
  return TASK_EXTRACTION_PROMPT.replace('{PLAN_CONTENT}', planContent)
}
