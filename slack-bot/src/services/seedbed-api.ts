/**
 * Seedbed API Service
 * 封装与 Seedbed 后端的 API 调用，支持 SSE 流式响应
 */

import type { Readable } from 'stream'

// SSE 事件类型
export type SSEEventType = 'init' | 'text' | 'question' | 'tool' | 'result' | 'error' | 'done' | 'git_sync' | 'plan_created'

// 错误类型
export type SSEErrorType =
  | 'validation_error'
  | 'auth_error'
  | 'session_error'
  | 'claude_error'
  | 'process_error'
  | 'timeout_error'
  | 'unknown_error'

// SSE 错误数据结构
export interface SSEErrorData {
  message: string
  errorType: SSEErrorType
  code?: string
  recoverable?: boolean
  details?: string
}

// 通用 SSE 事件
export interface SSEEvent<T = unknown> {
  type: SSEEventType
  data: T
}

// 具体事件类型
export interface SSEInitEventData {
  cwd: string
  resuming?: boolean
  tools?: number
  sessionId?: string
}

export interface SSETextEventData {
  content: string
}

export interface SSEQuestionOption {
  label: string
  description?: string
}

export interface SSEQuestionEventData {
  toolUseId: string
  questions: Array<{
    question: string
    header?: string
    options?: SSEQuestionOption[]
    multiSelect?: boolean
  }>
}

export interface SSEToolEventData {
  name: string
  id: string
  summary?: string
  timestamp: number
}

export interface SSEResultEventData {
  content: string
  sessionId?: string
  planId?: string
}

export interface SSEDoneEventData {
  planId?: string
}

export interface GitSyncEventData {
  success: boolean
  message?: string
  error?: string
  updated?: boolean
}

export interface PlanCreatedEventData {
  planId: string
}

// 联合类型
export type AnySSEEvent =
  | SSEEvent<SSEInitEventData>
  | SSEEvent<SSETextEventData>
  | SSEEvent<SSEQuestionEventData>
  | SSEEvent<SSEToolEventData>
  | SSEEvent<SSEResultEventData>
  | SSEEvent<SSEErrorData>
  | SSEEvent<SSEDoneEventData>
  | SSEEvent<GitSyncEventData>
  | SSEEvent<PlanCreatedEventData>

// 回调类型定义
export interface SeedbedCallbacks {
  onInit?: (data: SSEInitEventData) => void
  onText?: (content: string) => void
  onQuestion?: (data: SSEQuestionEventData) => void
  onTool?: (data: SSEToolEventData) => void
  onResult?: (data: SSEResultEventData) => void
  onError?: (error: SSEErrorData) => void
  onDone?: (data: SSEDoneEventData) => void
  onGitSync?: (data: GitSyncEventData) => void
  onPlanCreated?: (data: PlanCreatedEventData) => void
}

// 请求选项
export interface SendToSeedbedOptions {
  prompt: string
  projectPath?: string
  projectId?: string
  imagePaths?: string[]
  slackThreadTs?: string
  slackChannelId?: string
  slackChannelName?: string
  signal?: AbortSignal
  callbacks?: SeedbedCallbacks
}

export interface ResumeConversationOptions {
  answer: string
  projectPath?: string
  sessionId: string
  planId?: string
  imagePaths?: string[]
  signal?: AbortSignal
  callbacks?: SeedbedCallbacks
}

// API 错误
export class SeedbedAPIError extends Error {
  public errorType: SSEErrorType
  public code?: string
  public recoverable: boolean
  public details?: string

  constructor(errorData: SSEErrorData) {
    super(errorData.message)
    this.name = 'SeedbedAPIError'
    this.errorType = errorData.errorType
    this.code = errorData.code
    this.recoverable = errorData.recoverable ?? false
    this.details = errorData.details
  }
}

// 获取 API 基础 URL
function getBaseUrl(): string {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000'
  return webUrl.replace(/\/$/, '')
}

/**
 * 解析 SSE 流
 */
async function* parseSSEStream(response: Response): AsyncGenerator<AnySSEEvent> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new SeedbedAPIError({
      message: 'Failed to get response body reader',
      errorType: 'unknown_error',
    })
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data) {
            try {
              const event = JSON.parse(data) as AnySSEEvent
              yield event
            } catch {
              console.warn('Failed to parse SSE event:', data)
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * 处理 SSE 事件
 */
function processSSEEvent(event: AnySSEEvent, callbacks?: SeedbedCallbacks): void {
  switch (event.type) {
    case 'init':
      callbacks?.onInit?.(event.data as SSEInitEventData)
      break
    case 'text':
      callbacks?.onText?.((event.data as SSETextEventData).content)
      break
    case 'question':
      callbacks?.onQuestion?.(event.data as SSEQuestionEventData)
      break
    case 'tool':
      callbacks?.onTool?.(event.data as SSEToolEventData)
      break
    case 'result':
      callbacks?.onResult?.(event.data as SSEResultEventData)
      break
    case 'error':
      callbacks?.onError?.(event.data as SSEErrorData)
      break
    case 'done':
      callbacks?.onDone?.(event.data as SSEDoneEventData)
      break
    case 'git_sync':
      callbacks?.onGitSync?.(event.data as GitSyncEventData)
      break
    case 'plan_created':
      callbacks?.onPlanCreated?.(event.data as PlanCreatedEventData)
      break
  }
}

/**
 * 检查响应状态并处理错误
 */
async function checkResponse(response: Response): Promise<void> {
  if (!response.ok) {
    // 尝试从响应体中获取错误信息
    let errorMessage = `HTTP error ${response.status}`
    let errorType: SSEErrorType = 'unknown_error'

    try {
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('text/event-stream')) {
        // SSE 格式的错误
        const reader = response.body?.getReader()
        if (reader) {
          try {
            const decoder = new TextDecoder()
            const { value } = await reader.read()
            const text = decoder.decode(value)
            const match = text.match(/data: (.+)/)
            if (match) {
              const errorData = JSON.parse(match[1]) as AnySSEEvent
              if (errorData.type === 'error') {
                throw new SeedbedAPIError(errorData.data as SSEErrorData)
              }
            }
          } finally {
            reader.releaseLock()
          }
        }
      } else {
        const text = await response.text()
        errorMessage = text || errorMessage
      }
    } catch (e) {
      // 如果是 SeedbedAPIError，直接抛出
      if (e instanceof SeedbedAPIError) {
        throw e
      }
      // 其他错误，继续使用默认错误消息
    }

    if (response.status === 401) {
      errorType = 'auth_error'
    } else if (response.status === 400) {
      errorType = 'validation_error'
    } else if (response.status === 500) {
      errorType = 'process_error'
    }

    throw new SeedbedAPIError({
      message: errorMessage,
      errorType,
    })
  }
}

/**
 * 发送新对话到 Seedbed
 * 调用 POST /api/claude/start
 */
export async function sendToSeedbed(options: SendToSeedbedOptions): Promise<void> {
  const {
    prompt,
    projectPath,
    projectId,
    imagePaths,
    slackThreadTs,
    slackChannelId,
    slackChannelName,
    signal,
    callbacks,
  } = options

  const baseUrl = getBaseUrl()
  const url = `${baseUrl}/api/claude/start`

  const body: Record<string, unknown> = {
    prompt,
    projectPath,
    projectId,
    imagePaths,
    slackThreadTs,
    slackChannelId,
    slackChannelName,
  }

  // 过滤掉 undefined 值
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined) {
      delete body[key]
    }
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })

  await checkResponse(response)

  // 解析 SSE 流
  for await (const event of parseSSEStream(response)) {
    if (event.type === 'error') {
      throw new SeedbedAPIError(event.data as SSEErrorData)
    }
    processSSEEvent(event, callbacks)
  }
}

/**
 * 继续对话（回答问题）
 * 调用 POST /api/claude/continue
 */
export async function resumeConversation(options: ResumeConversationOptions): Promise<void> {
  const {
    answer,
    projectPath,
    sessionId,
    planId,
    imagePaths,
    signal,
    callbacks,
  } = options

  const baseUrl = getBaseUrl()
  const url = `${baseUrl}/api/claude/continue`

  const body: Record<string, unknown> = {
    answer,
    projectPath,
    sessionId,
    planId,
    imagePaths,
  }

  // 过滤掉 undefined 值
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined) {
      delete body[key]
    }
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })

  await checkResponse(response)

  // 解析 SSE 流
  for await (const event of parseSSEStream(response)) {
    if (event.type === 'error') {
      throw new SeedbedAPIError(event.data as SSEErrorData)
    }
    processSSEEvent(event, callbacks)
  }
}

/**
 * 检查错误是否可恢复
 */
export function isRecoverableError(error: SeedbedAPIError): boolean {
  switch (error.errorType) {
    case 'session_error':
      return true
    case 'timeout_error':
      return true
    default:
      return false
  }
}