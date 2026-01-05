'use client'

import { useState, useRef, useEffect } from 'react'

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
  [questionIndex: number]: string
}

interface Task {
  id: string
  title: string
  description: string
  priority: number
  labels: string[]
  acceptanceCriteria: string[]
  relatedFiles: string[]
  estimateHours?: number
}

type AppState = 'idle' | 'processing' | 'waiting_input' | 'completed'

// 任务卡片组件
function TaskCard({ task }: { task: Task }) {
  const priorityColors: Record<number, string> = {
    0: 'border-red-500 bg-red-900/20',
    1: 'border-orange-500 bg-orange-900/20',
    2: 'border-yellow-500 bg-yellow-900/20',
    3: 'border-gray-500 bg-gray-900/20',
  }

  const priorityLabels = ['P0', 'P1', 'P2', 'P3']

  return (
    <div className={`border-l-4 ${priorityColors[task.priority] || priorityColors[2]} rounded-lg p-3 mb-3 bg-gray-800`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-400">{priorityLabels[task.priority]}</span>
        {task.estimateHours && (
          <span className="text-xs text-gray-500">{task.estimateHours}h</span>
        )}
      </div>
      <h4 className="font-medium text-white mb-2">{task.title}</h4>
      <p className="text-sm text-gray-400 mb-2 line-clamp-2">{task.description}</p>
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((label, i) => (
            <span key={i} className="px-2 py-0.5 text-xs bg-blue-900/50 text-blue-300 rounded">
              {label}
            </span>
          ))}
        </div>
      )}
      {task.acceptanceCriteria.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-500 mb-1">Acceptance Criteria:</p>
          <ul className="text-xs text-gray-400 space-y-0.5">
            {task.acceptanceCriteria.slice(0, 3).map((ac, i) => (
              <li key={i} className="flex items-start">
                <span className="mr-1 text-gray-600">-</span>
                <span className="line-clamp-1">{ac}</span>
              </li>
            ))}
            {task.acceptanceCriteria.length > 3 && (
              <li className="text-gray-500">+{task.acceptanceCriteria.length - 3} more...</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

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
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
              break

            case 'error':
              addMessage('system', `Error: ${event.data.message}`)
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

    try {
      const response = await fetch('/api/claude/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage })
      })

      await processSSE(response, true)
    } catch (error) {
      addMessage('system', `Request failed: ${error}`)
      setState('idle')
    }
  }

  const handleSelectAnswer = (questionIndex: number, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }))
  }

  const handleSubmitAllAnswers = async () => {
    if (state !== 'waiting_input' || !pendingQuestion) return

    const allAnswered = pendingQuestion.questions.every((_, idx) => selectedAnswers[idx])
    if (!allAnswered) {
      alert('Please answer all questions')
      return
    }

    const combinedAnswer = pendingQuestion.questions.map((q, idx) => {
      const header = q.header || `Question ${idx + 1}`
      return `${header}: ${selectedAnswers[idx]}`
    }).join('\n')

    addMessage('user', combinedAnswer)
    setState('processing')
    setPendingQuestion(null)
    setSelectedAnswers({})

    try {
      const response = await fetch('/api/claude/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: combinedAnswer })
      })

      await processSSE(response, true)
    } catch (error) {
      addMessage('system', `Request failed: ${error}`)
      setState('idle')
    }
  }

  const totalEstimate = tasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0)

  return (
    <div className="flex h-screen">
      {/* Left Panel - Chat */}
      <div className="flex-1 flex flex-col border-r border-gray-700">
        {/* Header */}
        <header className="p-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold">Seedbed</h1>
          <p className="text-gray-400 text-sm">AI Task Planning Assistant</p>
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
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
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
                      {q.options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectAnswer(idx, opt.label)}
                          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                            selectedAnswers[idx] === opt.label
                              ? 'bg-green-600 text-white ring-2 ring-green-400'
                              : 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                          }`}
                          title={opt.description}
                        >
                          {opt.label}
                          {selectedAnswers[idx] === opt.label && ' ✓'}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <input
                      type="text"
                      className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Or enter custom answer..."
                      value={selectedAnswers[idx] && !q.options?.some(o => o.label === selectedAnswers[idx]) ? selectedAnswers[idx] : ''}
                      onChange={(e) => handleSelectAnswer(idx, e.target.value)}
                    />
                  </div>
                  {selectedAnswers[idx] && (
                    <p className="mt-2 text-sm text-green-400">Selected: {selectedAnswers[idx]}</p>
                  )}
                </div>
              ))}

              <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                <p className="text-gray-400 text-sm">
                  Answered {Object.keys(selectedAnswers).filter(k => selectedAnswers[parseInt(k)]).length} / {pendingQuestion.questions.length}
                </p>
                <button
                  onClick={handleSubmitAllAnswers}
                  disabled={!pendingQuestion.questions.every((_, idx) => selectedAnswers[idx])}
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
          <div className="mt-2 text-xs text-gray-500">
            Status: {state === 'idle' ? 'Ready' : state === 'processing' ? 'Processing' : state === 'waiting_input' ? 'Waiting for input' : 'Complete'}
          </div>
        </form>
      </div>

      {/* Right Panel - Task List */}
      <div className="w-96 flex flex-col bg-gray-850">
        <header className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Tasks</h2>
            {tasks.length > 0 && (
              <span className="text-sm text-gray-400">{tasks.length} tasks</span>
            )}
          </div>
          {tasks.length > 0 && totalEstimate > 0 && (
            <p className="text-xs text-gray-500 mt-1">Est. {totalEstimate}h total</p>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {tasks.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <p className="text-sm">No tasks yet</p>
              <p className="text-xs mt-1">Tasks will appear here after planning</p>
            </div>
          ) : (
            <>
              {/* Priority filters */}
              <div className="flex gap-2 mb-4">
                {['All', 'P0', 'P1', 'P2'].map(filter => (
                  <button
                    key={filter}
                    className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* Task cards */}
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </>
          )}
        </div>

        {/* Export buttons */}
        {tasks.length > 0 && (
          <div className="p-4 border-t border-gray-700 space-y-2">
            <button
              onClick={() => {
                const json = JSON.stringify(tasks, null, 2)
                const blob = new Blob([json], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'tasks.json'
                a.click()
              }}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={() => {
                const md = tasks.map(t =>
                  `### [P${t.priority}] ${t.title}\n\n${t.description}\n\n` +
                  (t.acceptanceCriteria.length ? `**Acceptance Criteria:**\n${t.acceptanceCriteria.map(ac => `- ${ac}`).join('\n')}\n\n` : '') +
                  (t.estimateHours ? `**Estimate:** ${t.estimateHours}h\n` : '')
                ).join('\n---\n\n')
                const blob = new Blob([md], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'tasks.md'
                a.click()
              }}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              Export Markdown
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
