'use client'

import { useState, useRef, useEffect } from 'react'
import { TaskList, Task } from '@/components/tasks'
import { UserHeader } from '@/components/UserHeader'
import { ProjectSelector, Project } from '@/components/ProjectSelector'
import { LoadingSpinner } from '@/components/ui'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

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

// 解析 Claude 输出中的任务
function parseTasksFromResult(content: string): Task[] {
  const tasks: Task[] = []

  // 尝试匹配常见的任务格式
  // 格式 1: ## 任务列表 下的 ### 任务标题
  const taskRegex = /###?\s*(?:\d+\.\s*)?(?:\[P(\d)\]\s*)?(.+?)(?:\n|\r\n)([\s\S]*?)(?=###|\n##|$)/g

  let match
  let id = 1

  while ((match = taskRegex.exec(content)) !== null) {
    const priority = match[1] ? parseInt(match[1]) : 2
    const title = match[2].trim()
    const body = match[3].trim()

    // 跳过非任务内容
    if (title.includes('任务列表') || title.includes('计划') || title.includes('概述') || title.length < 3) {
      continue
    }

    // 提取验收标准
    const acMatch = body.match(/验收标准[：:]([\s\S]*?)(?=\n\n|涉及文件|预估|$)/i)
    const acceptanceCriteria = acMatch
      ? acMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'))
          .map(l => l.replace(/^[\s\-\*]+/, '').trim())
          .filter(l => l.length > 0)
      : []

    // 提取标签
    const labels: string[] = []
    if (body.includes('后端') || body.includes('Backend') || body.includes('API')) labels.push('后端')
    if (body.includes('前端') || body.includes('Frontend') || body.includes('UI')) labels.push('前端')
    if (body.includes('测试') || body.includes('Test')) labels.push('测试')
    if (body.includes('数据库') || body.includes('Database') || body.includes('DB')) labels.push('数据库')

    // 提取预估时间
    const timeMatch = body.match(/预估[：:]?\s*([\d.]+)\s*[hH小时]/i)
    const estimateHours = timeMatch ? parseFloat(timeMatch[1]) : undefined

    // 提取相关文件
    const filesMatch = body.match(/(?:涉及文件|相关文件)[：:]([\s\S]*?)(?=\n\n|验收|预估|$)/i)
    const relatedFiles = filesMatch
      ? filesMatch[1].split('\n').filter(l => l.trim()).map(l => l.replace(/^[\s\-\*`]+/, '').replace(/`$/, '').trim()).filter(l => l.length > 0)
      : []

    tasks.push({
      id: `task-${id++}`,
      title,
      description: body.split('\n')[0] || title,
      priority,
      labels,
      acceptanceCriteria,
      relatedFiles,
      estimateHours,
    })
  }

  return tasks
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [state, setState] = useState<AppState>('idle')
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswers>({})
  const [currentTools, setCurrentTools] = useState<string[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [resultContent, setResultContent] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)  // Claude 会话 ID
  const [planId, setPlanId] = useState<string | null>(null)  // 当前对话关联的 Plan ID
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)  // 选中的项目
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 判断是否是数据库项目（可以保存对话）
  const isDatabaseProject = selectedProject && selectedProject.source === 'database'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 当收到 result 时解析任务
  useEffect(() => {
    if (resultContent) {
      const parsedTasks = parseTasksFromResult(resultContent)
      if (parsedTasks.length > 0) {
        setTasks(parsedTasks)
      }
    }
  }, [resultContent])

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

    if (isInitial) {
      addMessage('assistant', '')
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
            case 'text':
              updateLastAssistantMessage(event.data.content)
              break

            case 'tool':
              setCurrentTools(prev => [...prev, event.data.name])
              break

            case 'question':
              hasQuestion = true
              setPendingQuestion(event.data)
              setSelectedAnswers({})
              setState('waiting_input')
              break

            case 'result':
              if (event.data.content) {
                setResultContent(event.data.content)
                updateLastAssistantMessage('\n\n---\n**Plan Complete**\n' + event.data.content)
              }
              // 保存 sessionId 用于后续继续对话
              if (event.data.sessionId) {
                setSessionId(event.data.sessionId)
              }
              // 保存 planId 用于后续继续对话
              if (event.data.planId) {
                setPlanId(event.data.planId)
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
    }
    setCurrentTools([])
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
      const response = await fetch('/api/claude/start', {
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
      addMessage('system', 'Error: Session expired or not found. Please start a new conversation.')
      setState('idle')
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
      const response = await fetch('/api/claude/continue', {
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

  const handleTaskDelete = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId))
  }

  return (
    <div className="flex h-screen">
      {/* Left Panel - Chat */}
      <div className="flex-1 flex flex-col border-r border-gray-700">
        {/* Header */}
        <header className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-2xl font-bold">Seedbed</h1>
              <p className="text-gray-400 text-sm">AI Task Planning Assistant</p>
            </div>
            <UserHeader />
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
          {messages.length === 0 && (
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
          {state === 'processing' && (
            <div className="flex justify-start">
              <div className="bg-gray-700 rounded-lg p-3 flex items-center space-x-2">
                <LoadingSpinner size="sm" />
                <span className="text-gray-300 text-sm">
                  {currentTools.length > 0 ? `Using: ${currentTools[currentTools.length - 1]}` : 'Processing...'}
                </span>
              </div>
            </div>
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

      {/* Right Panel - Task List */}
      <TaskList
        tasks={tasks}
        onTasksReorder={setTasks}
        onTaskUpdate={handleTaskUpdate}
        onTaskDelete={handleTaskDelete}
        loading={state === 'processing'}
      />
    </div>
  )
}
