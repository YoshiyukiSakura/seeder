'use client'

import { useState, useEffect } from 'react'
import { LoadingSpinner } from '@/components/ui'
import type { ToolExecution, ProgressState } from '@/types/progress'

interface ProgressPanelProps {
  state: ProgressState
  isProcessing: boolean
}

// 格式化时间显示
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

// 获取工具图标
function getToolIcon(name: string): string {
  const icons: Record<string, string> = {
    Read: '📖',
    Write: '✏️',
    Edit: '🔧',
    Grep: '🔍',
    Glob: '📁',
    Bash: '💻',
    WebSearch: '🌐',
    WebFetch: '🔗',
    LSP: '📍',
    TodoWrite: '📝',
    Task: '🤖',
    AskUserQuestion: '❓',
    EnterPlanMode: '📋',
    ExitPlanMode: '✅',
  }
  return icons[name] || '🔧'
}

export function ProgressPanel({ state, isProcessing }: ProgressPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [currentToolDuration, setCurrentToolDuration] = useState(0)

  // 获取当前正在执行的工具
  const currentTool = state.tools.find(t => t.id === state.currentToolId)

  // 更新累计时间
  useEffect(() => {
    if (!isProcessing || !state.sessionStartTime) return

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - state.sessionStartTime!)
    }, 100)

    return () => clearInterval(interval)
  }, [isProcessing, state.sessionStartTime])

  // 更新当前工具耗时
  useEffect(() => {
    if (!currentTool || currentTool.status !== 'running') {
      setCurrentToolDuration(0)
      return
    }

    const interval = setInterval(() => {
      setCurrentToolDuration(Date.now() - currentTool.startTime)
    }, 100)

    return () => clearInterval(interval)
  }, [currentTool])

  // 不处理且没有工具历史时不显示
  if (!isProcessing && state.tools.length === 0) {
    return null
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* 折叠头部 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-750 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isProcessing && <LoadingSpinner size="sm" />}

          {/* 当前工具显示 */}
          {currentTool ? (
            <span className="text-gray-200 text-sm flex items-center gap-2 truncate">
              <span>{getToolIcon(currentTool.name)}</span>
              <span className="font-medium">{currentTool.name}</span>
              {currentTool.summary && (
                <span className="text-gray-400 truncate">
                  {currentTool.summary}
                </span>
              )}
              <span className="text-gray-500 flex-shrink-0">
                ({formatDuration(currentToolDuration)})
              </span>
            </span>
          ) : isProcessing ? (
            <span className="text-gray-400 text-sm">Processing...</span>
          ) : (
            <span className="text-gray-400 text-sm">
              Completed {state.tools.length} operations
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          {/* 累计时间 */}
          {state.sessionStartTime && (
            <span className="text-gray-500 text-xs">
              Total: {formatDuration(elapsedTime)}
            </span>
          )}

          {/* 工具计数 */}
          <span className="bg-gray-700 px-2 py-0.5 rounded text-xs text-gray-400">
            {state.tools.length} tools
          </span>

          {/* 展开/收起图标 */}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* 展开的详细列表 */}
      {isExpanded && (
        <div className="border-t border-gray-700 max-h-64 overflow-y-auto">
          {state.tools.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm text-center">
              No operations yet
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {state.tools.map((tool, index) => (
                <ToolExecutionRow
                  key={tool.id}
                  tool={tool}
                  index={index + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 单个工具执行记录行
function ToolExecutionRow({
  tool,
  index,
}: {
  tool: ToolExecution
  index: number
}) {
  const [currentDuration, setCurrentDuration] = useState(tool.duration || 0)

  // 实时更新正在执行的工具耗时
  useEffect(() => {
    if (tool.status !== 'running') {
      setCurrentDuration(tool.duration || 0)
      return
    }

    const interval = setInterval(() => {
      setCurrentDuration(Date.now() - tool.startTime)
    }, 100)

    return () => clearInterval(interval)
  }, [tool.status, tool.startTime, tool.duration])

  const duration = tool.status === 'running' ? currentDuration : (tool.duration || 0)

  return (
    <div className={`px-4 py-2 flex items-center gap-3 ${
      tool.status === 'running' ? 'bg-blue-900/20' : ''
    }`}>
      {/* 序号 */}
      <span className="text-gray-600 text-xs w-6 text-right flex-shrink-0">
        {index}.
      </span>

      {/* 状态指示器 */}
      <div className="w-4 flex justify-center flex-shrink-0">
        {tool.status === 'running' ? (
          <LoadingSpinner size="sm" color="blue" />
        ) : tool.status === 'completed' ? (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* 工具图标和名称 */}
      <span className="text-gray-300 text-sm font-medium min-w-[100px] flex-shrink-0">
        {getToolIcon(tool.name)} {tool.name}
        {tool.repeatCount && tool.repeatCount > 1 && (
          <span className="ml-1 text-xs text-gray-500">×{tool.repeatCount}</span>
        )}
      </span>

      {/* 参数摘要 */}
      <span className="text-gray-500 text-sm flex-1 truncate" title={tool.summary}>
        {tool.summary || '-'}
      </span>

      {/* 耗时 */}
      <span className={`text-xs min-w-[50px] text-right flex-shrink-0 ${
        tool.status === 'running' ? 'text-blue-400' : 'text-gray-600'
      }`}>
        {formatDuration(duration)}
      </span>
    </div>
  )
}
