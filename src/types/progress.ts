/**
 * 进度追踪相关类型定义
 */

// 工具执行状态
export type ToolStatus = 'running' | 'completed' | 'error'

// 单个工具执行记录
export interface ToolExecution {
  id: string              // tool_use_id
  name: string            // 工具名称
  summary: string         // 参数摘要
  startTime: number       // 开始时间戳
  endTime?: number        // 结束时间戳（完成后填充）
  duration?: number       // 执行耗时 (ms)
  status: ToolStatus
}

// 进度追踪状态
export interface ProgressState {
  sessionStartTime: number | null  // 会话开始时间
  tools: ToolExecution[]           // 工具执行历史
  currentToolId: string | null     // 当前正在执行的工具 ID
}

// 初始状态
export const initialProgressState: ProgressState = {
  sessionStartTime: null,
  tools: [],
  currentToolId: null
}
