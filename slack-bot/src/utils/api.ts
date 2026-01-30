/**
 * 共享 API 调用函数
 */

import { getWebUrl } from './config'

/**
 * Plan 数据返回类型
 */
export interface PlanData {
  planId: string
  planName: string
  sessionId: string
  projectPath?: string
}

/**
 * 调用 Thread 映射 API 获取 planId
 *
 * 返回值说明：
 * - 返回 PlanData: Plan 存在且 session 已就绪
 * - 返回 null: Plan 不存在（Thread 未关联任何 Plan）
 * - 抛出异常: session 未就绪 (503) 或其他错误
 *
 * 调用方需要处理异常，特别是 503 错误需要向用户提示 "会话正在初始化"
 */
export async function getPlanByThread(
  channelId: string,
  threadTs: string
): Promise<PlanData | null> {
  const webUrl = getWebUrl()
  const url = `${webUrl}/api/slack/thread-to-plan?channelId=${encodeURIComponent(channelId)}&threadTs=${encodeURIComponent(threadTs)}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    // 404: Plan 不存在，返回 null
    if (response.status === 404) {
      return null
    }
    // 503: Session 未就绪，抛出异常让调用方处理
    if (response.status === 503) {
      throw new Error('Session not ready yet, please wait a moment')
    }
    // 其他错误
    throw new Error(`Failed to get plan: ${response.status}`)
  }

  return response.json()
}

/**
 * 调用频道映射 API 获取 projectId
 */
export async function getProjectByChannel(
  channelId: string
): Promise<{ projectId: string; projectName: string; projectPath?: string } | null> {
  const webUrl = getWebUrl()
  const url = `${webUrl}/api/slack/channel-to-project?channelId=${encodeURIComponent(channelId)}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error(`Failed to get project: ${response.status}`)
  }

  return response.json()
}
