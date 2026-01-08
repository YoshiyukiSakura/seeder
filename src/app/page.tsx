'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { TaskList, Task } from '@/components/tasks'
import { TaskCanvas } from '@/components/tasks/canvas'
import { UserHeader } from '@/components/UserHeader'
import { ProjectSelector, Project } from '@/components/ProjectSelector'
import { ProgressPanel } from '@/components/progress'
import type { ProgressState, ToolExecution } from '@/types/progress'
import type { SSEToolData } from '@/lib/sse-types'
import { getLastActivePlan, saveLastActivePlan, clearLastActivePlan } from '@/lib/conversation-storage'
import { convertConversationToMessage, type Message } from '@/lib/conversation-utils'
import { PlanHistoryPanel } from '@/components/PlanHistoryPanel'
import { apiFetch } from '@/lib/basePath'

interface Question {
  question: string
  header?: string
  options?: Array<{ label: string; description?: string }>
  multiSelect?: boolean
}

interface PendingQuestion {
  toolUseId: string
  questions: Question[]
}

interface SelectedAnswers {
  [questionIndex: number]: string | string[]  // string for single select, string[] for multiSelect
}

type AppState = 'idle' | 'processing' | 'waiting_input' | 'completed'
type ViewMode = 'list' | 'canvas'

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlPlanId = searchParams.get('planId')

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [state, setState] = useState<AppState>('idle')
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswers>({})
  const [currentTools, setCurrentTools] = useState<string[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [extractingTasks, setExtractingTasks] = useState(false)
  const [resultContent, setResultContent] = useState('')
  const [progressState, setProgressState] = useState<ProgressState>({
    sessionStartTime: null,
    tools: [],
    currentToolId: null
  })
  const [sessionId, setSessionId] = useState<string | null>(null)  // Claude 会话 ID
  const [planId, setPlanId] = useState<string | null>(null)  // 当前对话关联的 Plan ID
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)  // 选中的项目
  const [isRestoring, setIsRestoring] = useState(false)  // 恢复对话中
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)  // 触发历史列表刷新
  const [viewMode, setViewMode] = useState<ViewMode>('list')  // 任务视图模式
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 判断是否是数据库项目（可以保存对话）
  const isDatabaseProject = selectedProject && selectedProject.source === 'database'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 恢复对话：优先 URL 参数，其次 localStorage
  useEffect(() => {
    const restoreConversation = async () => {
      // 只有数据库项目才能恢复对话
      if (!isDatabaseProject || !selectedProject) return

      // 优先使用 URL 参数，其次使用 localStorage
      const planIdToRestore = urlPlanId || getLastActivePlan(selectedProject.id)
      if (!planIdToRestore) return

      setIsRestoring(true)
      try {
        const response = await apiFetch(`/api/plans/${planIdToRestore}`)
        if (response.ok) {
          const { plan } = await response.json()

          // 验证 plan 属于当前项目
          if (plan.projectId !== selectedProject.id) {
            console.warn('Plan belongs to a different project')
            router.replace('/', { scroll: false })
            return
          }

          // 恢复状态
          setPlanId(plan.id)
          setSessionId(plan.sessionId)

          // 恢复消息
          if (plan.conversations && plan.conversations.length > 0) {
            setMessages(plan.conversations.map(convertConversationToMessage))
          }

          // 恢复任务
          if (plan.tasks && plan.tasks.length > 0) {
            setTasks(plan.tasks.map((t: { id: string; title: string; description: string; priority: number; labels: string[]; acceptanceCriteria: string[]; relatedFiles: string[]; estimateHours: number | null }) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              priority: t.priority,
              labels: t.labels,
              acceptanceCriteria: t.acceptanceCriteria,
              relatedFiles: t.relatedFiles,
              estimateHours: t.estimateHours || undefined
            })))
          }

          // 更新 URL（如果是从 localStorage 恢复的）
          if (!urlPlanId) {
            router.replace(`/?planId=${plan.id}`, { scroll: false })
          }

          // 如果有 sessionId，设置为 completed 状态
          // 但如果当前正在等待用户输入（waiting_input），不要覆盖状态
          if (plan.sessionId) {
            setState(prev => prev === 'waiting_input' ? prev : 'completed')
          }
        } else if (response.status === 404) {
          // Plan 不存在，清除 URL 参数
          console.warn('Plan not found:', planIdToRestore)
          router.replace('/', { scroll: false })
        }
      } catch (error) {
        console.error('Failed to restore conversation:', error)
      } finally {
        setIsRestoring(false)
      }
    }

    restoreConversation()
  }, [selectedProject?.id, urlPlanId, isDatabaseProject])

  // planId 变化时更新 URL 和 localStorage
  useEffect(() => {
    if (planId && isDatabaseProject && selectedProject) {
      // 更新 URL
      const currentUrlPlanId = searchParams.get('planId')
      if (currentUrlPlanId !== planId) {
        router.replace(`/?planId=${planId}`, { scroll: false })
      }
      // 保存到 localStorage
      saveLastActivePlan(selectedProject.id, planId)
    }
  }, [planId, isDatabaseProject, selectedProject, searchParams, router])

  // 使用 Gemini API 提取任务
  const extractAndSetTasks = async (planContent: string) => {
    setExtractingTasks(true)
    try {
      const res = await apiFetch('/api/tasks/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planContent })
      })
      if (res.ok) {
        const { tasks: extractedTasks } = await res.json()
        if (extractedTasks && extractedTasks.length > 0) {
          setTasks(extractedTasks)
          // 如果有 planId，保存任务到数据库
          if (planId) {
            await apiFetch(`/api/plans/${planId}/tasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tasks: extractedTasks })
            })
          }
        }
      } else {
        console.error('Failed to extract tasks:', await res.text())
      }
    } catch (error) {
      console.error('Task extraction error:', error)
    } finally {
      setExtractingTasks(false)
    }
  }

  const addMessage = (role: Message['role'], content: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date()
    }])
  }

  const updateLastAssistantMessage = (content: string) => {
    setMessages(prev => {
      const lastIdx = prev.findLastIndex(m => m.role === 'assistant')
      if (lastIdx === -1) {
        return [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content,
          timestamp: new Date()
        }]
      }
      const updated = [...prev]
      updated[lastIdx] = { ...updated[lastIdx], content: updated[lastIdx].content + content }
      return updated
    })
  }

  const processSSE = async (response: Response, isInitial: boolean) => {
    const reader = response.body?.getReader()
    if (!reader) return

    const decoder = new TextDecoder()
    let buffer = ''
    let hasQuestion = false
    let receivedSessionId: string | null = null  // 本地追踪 sessionId

    if (isInitial) {
      addMessage('assistant', '')
      // 初始化进度状态
      setProgressState({
        sessionStartTime: Date.now(),
        tools: [],
        currentToolId: null
      })
    }

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const jsonStr = line.slice(6)

        try {
          const event = JSON.parse(jsonStr)

          switch (event.type) {
            case 'init':
              // 从 init 事件中获取 sessionId（比 result 更早可用）
              if (event.data.sessionId) {
                receivedSessionId = event.data.sessionId
                setSessionId(event.data.sessionId)
              }
              break

            case 'text':
              updateLastAssistantMessage(event.data.content)
              break

            case 'tool':
              const toolData = event.data as SSEToolData
              setCurrentTools(prev => [...prev, toolData.name])
              // 标记前一个工具为完成，添加新工具
              setProgressState(prev => {
                const updatedTools = prev.tools.map(t => {
                  if (t.status === 'running') {
                    return {
                      ...t,
                      status: 'completed' as const,
                      endTime: toolData.timestamp,
                      duration: toolData.timestamp - t.startTime
                    }
                  }
                  return t
                })
                const newTool: ToolExecution = {
                  id: toolData.id,
                  name: toolData.name,
                  summary: toolData.summary || '',
                  startTime: toolData.timestamp,
                  status: 'running'
                }
                return {
                  ...prev,
                  tools: [...updatedTools, newTool],
                  currentToolId: toolData.id
                }
              })
              break

            case 'question':
              hasQuestion = true
              setPendingQuestion(event.data)
              setSelectedAnswers({})
              setState('waiting_input')
              break

            case 'result':
              if (event.data.content) {
                updateLastAssistantMessage('\n\n---\n**Plan Complete**\n' + event.data.content)
                // 保存计划内容，用于手动提取任务
                setResultContent(event.data.content)
              }
              // 保存 sessionId 用于后续继续对话
              if (event.data.sessionId) {
                receivedSessionId = event.data.sessionId
                setSessionId(event.data.sessionId)
              }
              // 保存 planId 用于后续继续对话
              if (event.data.planId) {
                setPlanId(event.data.planId)
                // 刷新历史列表（新对话创建成功）
                setHistoryRefreshTrigger(prev => prev + 1)
              }
              break

            case 'error':
              // 根据错误类型提供不同的提示
              if (event.data.errorType === 'session_error') {
                addMessage('system', `Session error: ${event.data.message}. Please start a new conversation.`)
                setSessionId(null)  // 清空无效的 sessionId
              } else {
                addMessage('system', `Error: ${event.data.message}`)
              }
              break
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    if (!hasQuestion) {
      setState('completed')
    } else if (!receivedSessionId) {
      // 有问题但没有收到 sessionId，警告用户
      console.warn('Question received but no sessionId in result')
      addMessage('system', 'Warning: Session ID was not received. You may need to start a new conversation if submitting answers fails.')
    }
    setCurrentTools([])
    // 标记最后一个工具为完成
    setProgressState(prev => ({
      ...prev,
      tools: prev.tools.map(t => {
        if (t.status === 'running') {
          return {
            ...t,
            status: 'completed' as const,
            endTime: Date.now(),
            duration: Date.now() - t.startTime
          }
        }
        return t
      }),
      currentToolId: null
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || state === 'processing') return

    const userMessage = input.trim()
    setInput('')
    addMessage('user', userMessage)
    setState('processing')
    setPendingQuestion(null)
    setSessionId(null)  // 启动新会话时清空旧的 sessionId
    setPlanId(null)     // 启动新会话时清空旧的 planId

    try {
      const response = await apiFetch('/api/claude/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          projectPath: selectedProject?.path,
          // 只有数据库项目才传递 projectId，用于创建 Plan 和保存对话
          projectId: isDatabaseProject ? selectedProject.id : undefined
        })
      })

      await processSSE(response, true)
    } catch (error) {
      addMessage('system', `Request failed: ${error}`)
      setState('idle')
    }
  }

  const handleSelectAnswer = (questionIndex: number, answer: string, isMultiSelect?: boolean) => {
    setSelectedAnswers(prev => {
      if (isMultiSelect) {
        // For multiSelect questions, toggle the answer in an array
        const currentAnswers = (prev[questionIndex] as string[]) || []
        const isSelected = currentAnswers.includes(answer)
        return {
          ...prev,
          [questionIndex]: isSelected
            ? currentAnswers.filter(a => a !== answer)  // Remove if already selected
            : [...currentAnswers, answer]               // Add if not selected
        }
      } else {
        // For single select questions, replace the answer
        return {
          ...prev,
          [questionIndex]: answer
        }
      }
    })
  }

  const handleSubmitAllAnswers = async () => {
    if (state !== 'waiting_input' || !pendingQuestion) return

    // Check all questions are answered (multiSelect: array length > 0, single: non-empty string)
    const allAnswered = pendingQuestion.questions.every((q, idx) => {
      const answer = selectedAnswers[idx]
      if (q.multiSelect) {
        return Array.isArray(answer) && answer.length > 0
      }
      return typeof answer === 'string' && answer.length > 0
    })
    if (!allAnswered) {
      alert('Please answer all questions')
      return
    }

    // 检查是否有有效的 sessionId
    if (!sessionId) {
      addMessage('system', 'Error: No active session found. This may happen if the Claude process ended unexpectedly. Please start a new conversation.')
      setState('idle')
      setPendingQuestion(null)
      setSelectedAnswers({})
      return
    }

    const combinedAnswer = pendingQuestion.questions.map((q, idx) => {
      const header = q.header || `Question ${idx + 1}`
      const answer = selectedAnswers[idx]
      // Format multiSelect answers as comma-separated list
      const formattedAnswer = Array.isArray(answer) ? answer.join(', ') : answer
      return `${header}: ${formattedAnswer}`
    }).join('\n')

    addMessage('user', combinedAnswer)
    setState('processing')
    setPendingQuestion(null)
    setSelectedAnswers({})

    try {
      const response = await apiFetch('/api/claude/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: combinedAnswer,
          sessionId,
          planId,  // 传递 planId 用于保存对话
          projectPath: selectedProject?.path
        })
      })

      await processSSE(response, true)
    } catch (error) {
      addMessage('system', `Request failed: ${error}`)
      setState('idle')
    }
  }

  // Task management handlers
  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    ))
  }

  const handleTaskDelete = async (taskId: string) => {
    // 立即从本地状态中移除任务并清理依赖引用
    setTasks(prev => prev
      .filter(task => task.id !== taskId)
      .map(task => ({
        ...task,
        blockedBy: task.blockedBy?.filter(id => id !== taskId),
      }))
    )

    // 如果有 planId，调用 API 持久化删除
    if (planId) {
      try {
        const response = await apiFetch(`/api/plans/${planId}/tasks/${taskId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          console.error('Failed to delete task from server')
          // 这里可以考虑显示错误通知，但不回滚本地状态
          // 因为用户已经看到任务被删除了
        }
      } catch (error) {
        console.error('Error deleting task:', error)
      }
    }
  }

  // 开始新对话
  const handleNewConversation = () => {
    // 清除 localStorage 中保存的 planId，防止 useEffect 重新恢复对话
    if (selectedProject?.id) {
      clearLastActivePlan(selectedProject.id)
    }
    setMessages([])
    setSessionId(null)
    setPlanId(null)
    setTasks([])
    setPendingQuestion(null)
    setSelectedAnswers({})
    setProgressState({ sessionStartTime: null, tools: [], currentToolId: null })
    setState('idle')
    router.replace('/', { scroll: false })
  }

  // 选择历史对话
  const handleSelectPlan = async (selectedPlanId: string) => {
    if (selectedPlanId === planId) return

    setIsRestoring(true)
    try {
      const res = await apiFetch(`/api/plans/${selectedPlanId}`)
      if (res.ok) {
        const { plan } = await res.json()

        setPlanId(plan.id)
        setSessionId(plan.sessionId)

        // 恢复消息
        if (plan.conversations && plan.conversations.length > 0) {
          setMessages(plan.conversations.map(convertConversationToMessage))
        } else {
          setMessages([])
        }

        // 恢复任务
        if (plan.tasks && plan.tasks.length > 0) {
          setTasks(plan.tasks.map((t: { id: string; title: string; description: string; priority: number; labels: string[]; acceptanceCriteria: string[]; relatedFiles: string[]; estimateHours: number | null }) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            labels: t.labels,
            acceptanceCriteria: t.acceptanceCriteria,
            relatedFiles: t.relatedFiles,
            estimateHours: t.estimateHours || undefined
          })))
        } else {
          setTasks([])
        }

        // 重置其他状态
        setPendingQuestion(null)
        setSelectedAnswers({})
        setProgressState({ sessionStartTime: null, tools: [], currentToolId: null })
        setState(plan.sessionId ? 'completed' : 'idle')

        router.replace(`/?planId=${plan.id}`, { scroll: false })
      }
    } catch (error) {
      console.error('Failed to select plan:', error)
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="flex h-screen">
      {/* History Panel - Only for database projects */}
      {isDatabaseProject && (
        <PlanHistoryPanel
          projectId={selectedProject?.id}
          currentPlanId={planId}
          onSelectPlan={handleSelectPlan}
          onNewConversation={handleNewConversation}
          refreshTrigger={historyRefreshTrigger}
        />
      )}

      {/* Center Panel - Chat (hidden in canvas mode) */}
      <div className={`flex flex-col border-r border-gray-700 transition-all duration-300 ${
        viewMode === 'canvas' ? 'w-0 opacity-0 overflow-hidden' : 'flex-1'
      }`}>
        {/* Header */}
        <header className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold">Seeder</h1>
              <p className="text-gray-400 text-sm">AI Task Planning Assistant</p>
            </div>
            <div className="flex items-center gap-3">
              {/* 新对话按钮 - 只有本地项目且有对话时显示（数据库项目在侧边栏有按钮） */}
              {!isDatabaseProject && messages.length > 0 && (
                <button
                  onClick={handleNewConversation}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-1"
                  title="Start new conversation"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New
                </button>
              )}
              <UserHeader />
            </div>
          </div>
          {/* Project Selector */}
          <ProjectSelector
            selectedProject={selectedProject}
            onSelect={setSelectedProject}
            className="max-w-md"
          />
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 恢复对话中的加载状态 */}
          {isRestoring && (
            <div className="text-center text-gray-400 mt-20">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-lg">Restoring conversation...</p>
            </div>
          )}

          {!isRestoring && messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">Enter your requirements to start planning</p>
              <p className="text-sm">e.g., &quot;Help me plan a user login feature&quot;</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : msg.role === 'system'
                    ? 'bg-red-900 text-red-200'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
              </div>
            </div>
          ))}

          {/* Processing indicator */}
          {(state === 'processing' || progressState.tools.length > 0) && (
            <ProgressPanel
              state={progressState}
              isProcessing={state === 'processing'}
            />
          )}

          {/* Question options */}
          {state === 'waiting_input' && pendingQuestion && (
            <div className="bg-gray-800 rounded-lg p-4 border border-blue-500">
              <p className="text-blue-400 font-medium mb-3">
                Please answer the following {pendingQuestion.questions.length} question(s):
              </p>
              {pendingQuestion.questions.map((q, idx) => (
                <div key={idx} className="mb-4 p-3 bg-gray-750 rounded-lg border border-gray-600">
                  <p className="text-white mb-2 font-medium">
                    <span className="text-blue-400 mr-2">{idx + 1}.</span>
                    {q.header && <span className="text-yellow-400">[{q.header}] </span>}
                    {q.question}
                  </p>
                  {q.options && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {q.multiSelect && (
                        <p className="w-full text-xs text-blue-300 mb-1">
                          (Multiple selections allowed)
                        </p>
                      )}
                      {q.options.map((opt, optIdx) => {
                        // Check if this option is selected
                        const isSelected = q.multiSelect
                          ? ((selectedAnswers[idx] as string[]) || []).includes(opt.label)
                          : selectedAnswers[idx] === opt.label

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleSelectAnswer(idx, opt.label, q.multiSelect)}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                              isSelected
                                ? 'bg-green-600 text-white ring-2 ring-green-400'
                                : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                            }`}
                            title={opt.description}
                          >
                            {q.multiSelect ? (isSelected ? '☑ ' : '☐ ') : ''}
                            {opt.label}
                            {!q.multiSelect && isSelected && ' ✓'}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* Custom input - only for single select */}
                  {!q.multiSelect && (
                    <div className="mt-2">
                      <input
                        type="text"
                        className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Or enter custom answer..."
                        value={selectedAnswers[idx] && !q.options?.some(o => o.label === selectedAnswers[idx]) ? (selectedAnswers[idx] as string) : ''}
                        onChange={(e) => handleSelectAnswer(idx, e.target.value)}
                      />
                    </div>
                  )}
                  {/* Display selected answer(s) */}
                  {selectedAnswers[idx] && (
                    <p className="mt-2 text-sm text-green-400">
                      Selected: {
                        Array.isArray(selectedAnswers[idx])
                          ? (selectedAnswers[idx] as string[]).join(', ')
                          : selectedAnswers[idx]
                      }
                    </p>
                  )}
                </div>
              ))}

              <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                <p className="text-gray-400 text-sm">
                  Answered {pendingQuestion.questions.filter((q, idx) => {
                    const answer = selectedAnswers[idx]
                    if (q.multiSelect) {
                      return Array.isArray(answer) && answer.length > 0
                    }
                    return typeof answer === 'string' && answer.length > 0
                  }).length} / {pendingQuestion.questions.length}
                </p>
                <button
                  onClick={handleSubmitAllAnswers}
                  disabled={!pendingQuestion.questions.every((q, idx) => {
                    const answer = selectedAnswers[idx]
                    if (q.multiSelect) {
                      return Array.isArray(answer) && answer.length > 0
                    }
                    return typeof answer === 'string' && answer.length > 0
                  })}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  Submit Answers
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={state === 'waiting_input' ? 'Please answer the questions above...' : 'Enter your requirements...'}
              disabled={state === 'processing' || state === 'waiting_input'}
              className="flex-1 bg-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={state === 'processing' || state === 'waiting_input' || !input.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>
              Status: {state === 'idle' ? 'Ready' : state === 'processing' ? 'Processing' : state === 'waiting_input' ? 'Waiting for input' : 'Complete'}
            </span>
            <span className="flex items-center gap-2">
              {isDatabaseProject ? (
                <span className="text-green-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Conversation will be saved
                </span>
              ) : (
                <span className="text-yellow-500 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {selectedProject ? 'Local project - not saved' : 'Select a project to save'}
                </span>
              )}
              {planId && <span className="text-gray-600">Plan: {planId.slice(0, 8)}...</span>}
            </span>
          </div>
        </form>
      </div>

      {/* Right Panel - Tasks */}
      <div className={`flex flex-col bg-gray-850 ${viewMode === 'canvas' ? 'flex-1' : ''}`}>
        {/* View Mode Toggle */}
        {tasks.length > 0 && (
          <div className="p-2 border-b border-gray-700 flex justify-center gap-1 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title="List View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
                viewMode === 'canvas'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title="Canvas View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Canvas
            </button>
          </div>
        )}

        {/* Task View */}
        {viewMode === 'list' ? (
          <TaskList
            tasks={tasks}
            onTasksReorder={setTasks}
            onTaskUpdate={handleTaskUpdate}
            onTaskDelete={handleTaskDelete}
            planId={planId || undefined}
            loading={state === 'processing'}
            extracting={extractingTasks}
            canExtract={!!resultContent && tasks.length === 0}
            onExtract={() => extractAndSetTasks(resultContent)}
          />
        ) : (
          <div className="flex-1 w-full h-full min-h-0">
            <TaskCanvas
              tasks={tasks}
              onTasksChange={setTasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              planId={planId || undefined}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}
