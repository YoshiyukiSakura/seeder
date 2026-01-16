import { NextRequest, NextResponse } from 'next/server'
import { getDeepSeekClient } from '@/lib/deepseek'
import { getGeminiClient } from '@/lib/gemini'
import { buildTaskExtractionPrompt } from '@/lib/prompts/task-extraction'
import type { Task } from '@/components/tasks/types'

interface ExtractedTask {
  title: string
  description: string
  priority: number
  labels: string[]
  acceptanceCriteria: string[]
  estimateHours?: number
  blockedBy?: number[]  // 依赖的任务索引数组
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { planContent } = body

    if (!planContent) {
      return NextResponse.json(
        { error: 'planContent is required' },
        { status: 400 }
      )
    }

    const prompt = buildTaskExtractionPrompt(planContent)
    console.log('Extracting tasks from plan content...')
    console.log('Plan content length:', planContent.length)
    console.log('Plan content preview:', planContent.slice(0, 200))

    // 优先使用 DeepSeek，失败时回退到 Gemini
    let response: string
    try {
      const deepseekClient = getDeepSeekClient()
      console.log('Using DeepSeek for task extraction...')
      response = await deepseekClient.generateContent(prompt)
    } catch (deepseekError) {
      console.warn('DeepSeek failed, falling back to Gemini:', deepseekError)
      const geminiClient = getGeminiClient()
      response = await geminiClient.generateContent(prompt)
    }

    // 解析 JSON 响应
    console.log('AI response length:', response.length)
    console.log('AI response preview:', response.slice(0, 300))

    let extractedTasks: ExtractedTask[]
    try {
      // 尝试提取 JSON 数组（可能被包裹在 markdown code block 中）
      let jsonStr = response.trim()

      // 移除可能的 markdown code block
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7)
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3)
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3)
      }
      jsonStr = jsonStr.trim()

      extractedTasks = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', response)
      return NextResponse.json(
        { error: 'Failed to parse task extraction response', raw: response },
        { status: 500 }
      )
    }

    // 先生成所有 task ID
    const taskIds = extractedTasks.map((_, index) => `task-${Date.now()}-${index}`)

    // 转换为 Task 格式，包含 blockedBy 引用
    const tasks: Task[] = extractedTasks.map((task, index) => ({
      id: taskIds[index],
      title: task.title,
      description: task.description,
      priority: task.priority,
      labels: task.labels || [],
      acceptanceCriteria: task.acceptanceCriteria || [],
      relatedFiles: [],
      estimateHours: task.estimateHours,
      sortOrder: index,
      // 将索引数组转换为 task ID 数组
      blockedBy: task.blockedBy?.map(idx => taskIds[idx]).filter(id => id) || []
    }))

    console.log(`Extracted ${tasks.length} tasks`)

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Task extraction error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
