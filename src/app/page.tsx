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

type AppState = 'idle' | 'processing' | 'waiting_input' | 'completed'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [state, setState] = useState<AppState>('idle')
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswers>({})
  const [currentTools, setCurrentTools] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

    // Add empty assistant message to start
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
              setSelectedAnswers({}) // 清空已选答案
              setState('waiting_input')
              break

            case 'result':
              if (event.data.content) {
                updateLastAssistantMessage('\n\n---\n**计划结果:**\n' + event.data.content)
              }
              break

            case 'error':
              addMessage('system', `错误: ${event.data.message}`)
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
      addMessage('system', `请求失败: ${error}`)
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

    // 检查是否所有问题都已回答
    const allAnswered = pendingQuestion.questions.every((_, idx) => selectedAnswers[idx])
    if (!allAnswered) {
      alert('请回答所有问题')
      return
    }

    // 组合所有答案
    const combinedAnswer = pendingQuestion.questions.map((q, idx) => {
      const header = q.header || `问题${idx + 1}`
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
      addMessage('system', `请求失败: ${error}`)
      setState('idle')
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <header className="p-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold">Seeder</h1>
        <p className="text-gray-400 text-sm">AI 任务规划助手 - Claude Code Plan Mode 交互验证</p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-lg mb-2">输入你的需求，开始规划任务</p>
            <p className="text-sm">例如: &quot;帮我规划一个用户登录功能&quot;</p>
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
                {currentTools.length > 0 ? `正在使用: ${currentTools[currentTools.length - 1]}` : '处理中...'}
              </span>
            </div>
          </div>
        )}

        {/* Question options */}
        {state === 'waiting_input' && pendingQuestion && (
          <div className="bg-gray-800 rounded-lg p-4 border border-blue-500">
            <p className="text-blue-400 font-medium mb-3">
              Claude 需要你回答以下 {pendingQuestion.questions.length} 个问题:
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
                {/* 自定义输入 */}
                <div className="mt-2">
                  <input
                    type="text"
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="或输入自定义回答..."
                    value={selectedAnswers[idx] && !q.options?.some(o => o.label === selectedAnswers[idx]) ? selectedAnswers[idx] : ''}
                    onChange={(e) => handleSelectAnswer(idx, e.target.value)}
                  />
                </div>
                {selectedAnswers[idx] && (
                  <p className="mt-2 text-sm text-green-400">已选择: {selectedAnswers[idx]}</p>
                )}
              </div>
            ))}

            {/* 提交按钮 */}
            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
              <p className="text-gray-400 text-sm">
                已回答 {Object.keys(selectedAnswers).filter(k => selectedAnswers[parseInt(k)]).length} / {pendingQuestion.questions.length} 个问题
              </p>
              <button
                onClick={handleSubmitAllAnswers}
                disabled={!pendingQuestion.questions.every((_, idx) => selectedAnswers[idx])}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                提交所有答案
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
            placeholder={state === 'waiting_input' ? '请先回答上面的问题...' : '输入你的需求...'}
            disabled={state === 'processing' || state === 'waiting_input'}
            className="flex-1 bg-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={state === 'processing' || state === 'waiting_input' || !input.trim()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          状态: {state === 'idle' ? '就绪' : state === 'processing' ? '处理中' : state === 'waiting_input' ? '等待输入' : '完成'}
        </div>
      </form>
    </div>
  )
}
