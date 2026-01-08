/**
 * SSE 事件类型定义 - 统一前后端的 SSE 事件格式
 */

// 错误类型枚举
export type SSEErrorType =
  | 'validation_error'    // 请求参数验证错误
  | 'auth_error'          // 认证错误
  | 'session_error'       // 会话错误（不存在、过期等）
  | 'claude_error'        // Claude CLI 返回的错误
  | 'process_error'       // 进程启动/执行错误
  | 'timeout_error'       // 超时错误
  | 'unknown_error'       // 未知错误

// 错误数据结构
export interface SSEErrorData {
  message: string
  errorType: SSEErrorType
  code?: string           // 可选的错误代码
  recoverable?: boolean   // 是否可恢复（例如可以重试）
  details?: string        // 附加详情
}

// SSE 事件类型
export type SSEEventType = 'init' | 'text' | 'question' | 'tool' | 'result' | 'error' | 'done'

// SSE 事件定义
export interface SSEEvent<T = unknown> {
  type: SSEEventType
  data: T
}

// 具体事件类型
export interface SSEInitEvent extends SSEEvent<{ cwd: string; resuming?: boolean; tools?: number; sessionId?: string }> {
  type: 'init'
}

export interface SSETextEvent extends SSEEvent<{ content: string }> {
  type: 'text'
}

export interface SSEQuestionEvent extends SSEEvent<{
  toolUseId: string
  questions: Array<{
    question: string
    header?: string
    options?: Array<{ label: string; description?: string }>
    multiSelect?: boolean
  }>
}> {
  type: 'question'
}

// 增强的工具事件数据
export interface SSEToolData {
  name: string          // 工具名称
  id: string            // tool_use_id（用于跟踪）
  summary?: string      // 参数摘要（如 "src/app/page.tsx"）
  timestamp: number     // 工具开始时间戳
}

export interface SSEToolEvent extends SSEEvent<SSEToolData> {
  type: 'tool'
}

export interface SSEResultEvent extends SSEEvent<{ content: string; sessionId?: string; planId?: string }> {
  type: 'result'
}

export interface SSEErrorEvent extends SSEEvent<SSEErrorData> {
  type: 'error'
}

export interface SSEDoneEvent extends SSEEvent<Record<string, never>> {
  type: 'done'
}

// 联合类型
export type AnySSEEvent =
  | SSEInitEvent
  | SSETextEvent
  | SSEQuestionEvent
  | SSEToolEvent
  | SSEResultEvent
  | SSEErrorEvent
  | SSEDoneEvent

/**
 * 创建 SSE 错误事件
 */
export function createSSEError(
  message: string,
  errorType: SSEErrorType,
  options?: {
    code?: string
    recoverable?: boolean
    details?: string
  }
): SSEErrorEvent {
  return {
    type: 'error',
    data: {
      message,
      errorType,
      code: options?.code,
      recoverable: options?.recoverable ?? false,
      details: options?.details,
    },
  }
}

/**
 * 根据错误类型判断是否可恢复
 */
export function isRecoverableError(errorType: SSEErrorType): boolean {
  switch (errorType) {
    case 'session_error':
      return true  // 可以重新开始会话
    case 'timeout_error':
      return true  // 可以重试
    case 'validation_error':
    case 'auth_error':
    case 'claude_error':
    case 'process_error':
    case 'unknown_error':
      return false
    default:
      return false
  }
}

/**
 * 编码 SSE 事件为字符串
 */
export function encodeSSEEvent(event: AnySSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}
