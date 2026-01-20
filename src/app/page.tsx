'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { TaskList, Task } from '@/components/tasks'
import { TaskCanvas } from '@/components/tasks/canvas'
import { UserHeader } from '@/components/UserHeader'
import { ProjectSelector, Project } from '@/components/ProjectSelector'
import { ProgressPanel, UploadProgress } from '@/components/progress'
import { uploadFilesWithProgress, type UploadFileProgress } from '@/lib/upload'
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

interface AttachedImage {
  id: string
  file: File
  previewUrl: string
}

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlPlanId = searchParams.get('planId')

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [state, setState] = useState<AppState>('idle')
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<SelectedAnswers>({})
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)  // 答案提交中状态
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
  const [planStatus, setPlanStatus] = useState<string>('DRAFT')  // Plan 状态
  const [planName, setPlanName] = useState<string>('')  // Plan 名称
  const [planDescription, setPlanDescription] = useState<string>('')  // Plan 描述
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)  // 选中的项目
  const [isRestoring, setIsRestoring] = useState(false)  // 恢复对话中
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)  // 触发历史列表刷新
  const [viewMode, setViewMode] = useState<ViewMode>('list')  // 任务视图模式
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])  // 附加的图片
  const [isUploading, setIsUploading] = useState(false)  // 图片上传中状态
  const [uploadProgress, setUploadProgress] = useState<{
    files: UploadFileProgress[]
    totalProgress: number
  } | null>(null)  // 上传进度状态
  const [isDragging, setIsDragging] = useState(false)  // 拖放状态
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentPlanIdRef = useRef<string | null>(null)  // 用于跟踪当前正在处理的会话，避免重复恢复

  // 判断是否是数据库项目（可以保存对话）
  const isDatabaseProject = selectedProject && selectedProject.source === 'database'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 添加图片到附件列表
  const addImage = useCallback((file: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const previewUrl = URL.createObjectURL(file)
    setAttachedImages(prev => [...prev, { id, file, previewUrl }])
  }, [])

  // 从附件列表移除图片并清理预览 URL
  const removeImage = useCallback((id: string) => {
    setAttachedImages(prev => {
      const imageToRemove = prev.find(img => img.id === id)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl)
      }
      return prev.filter(img => img.id !== id)
    })
  }, [])

  // 组件卸载时清理所有预览 URL
  useEffect(() => {
    return () => {
      attachedImages.forEach(img => {
        URL.revokeObjectURL(img.previewUrl)
      })
    }
  }, [])  // 仅在组件卸载时执行

  // 处理文件选择
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // 添加预览（立即显示）
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        addImage(file)
      }
    }

    // 重置 file input，允许再次选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [addImage])

  // 触发文件选择对话框
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // 处理粘贴事件（支持从剪贴板粘贴图片）
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items
    if (!items) return

    let hasImage = false
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          addImage(file)
          hasImage = true
        }
      }
    }

    // 如果粘贴的是图片，阻止默认的文本粘贴行为
    if (hasImage) {
      e.preventDefault()
    }
  }, [addImage])

  // 处理拖放事件
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        addImage(file)
      }
    }
  }, [addImage])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set isDragging to false if we're leaving the drop zone entirely
    // Check if the related target is outside the drop zone
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  // 恢复对话：优先 URL 参数，其次 localStorage
  useEffect(() => {
    const restoreConversation = async () => {
      // 只有数据库项目才能恢复对话
      if (!isDatabaseProject || !selectedProject) return

      // 优先使用 URL 参数，其次使用 localStorage
      const planIdToRestore = urlPlanId || getLastActivePlan(selectedProject.id)
      if (!planIdToRestore) return

      // 修复：如果当前planId已经等于要恢复的planId，跳过恢复
      // 这避免了因URL更新触发的重复恢复导致内容被覆盖
      if (planIdToRestore === currentPlanIdRef.current) return

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
          currentPlanIdRef.current = plan.id  // 更新ref，防止重复恢复
          setSessionId(plan.sessionId)
          setPlanStatus(plan.status || 'DRAFT')
          setPlanName(plan.name || '')
          setPlanDescription(plan.description || '')

          // 恢复消息
          if (plan.conversations && plan.conversations.length > 0) {
            const restoredMessages = plan.conversations.map(convertConversationToMessage)
            setMessages(restoredMessages)

            // 修复：从恢复的消息中提取 resultContent，使 Extract Tasks 按钮可见
            // 1. 首先尝试查找带有 **Plan Complete** 标记的消息
            const lastAssistantMsgWithMarker = [...restoredMessages].reverse()
              .find((m: Message) => m.role === 'assistant' && m.content.includes('**Plan Complete**'))
            if (lastAssistantMsgWithMarker) {
              const match = lastAssistantMsgWithMarker.content.match(/---\s*\*\*Plan Complete\*\*\s*\n([\s\S]*)$/)
              if (match?.[1]) {
                setResultContent(match[1])
              }
            } else if (plan.sessionId && !plan.pendingQuestion?.questions?.length) {
              // 2. 如果没有标记，但有 sessionId 且没有待回答问题，使用最后一条足够长的 assistant 消息
              const lastLongAssistantMsg = [...restoredMessages].reverse()
                .find((m: Message) => m.role === 'assistant' && m.content.length > 500)
              if (lastLongAssistantMsg) {
                setResultContent(lastLongAssistantMsg.content)
              }
            }
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

          // 恢复 pendingQuestion（如果有未回答的问题）
          if (plan.pendingQuestion && plan.pendingQuestion.questions?.length > 0) {
            setPendingQuestion(plan.pendingQuestion)
            setSelectedAnswers({})
            setState('waiting_input')
          } else if (plan.sessionId) {
            // 如果没有待回答问题但有 sessionId，设置为 completed 状态
            setState('completed')
          }

          // 更新 URL（如果是从 localStorage 恢复的）
          if (!urlPlanId) {
            router.replace(`/?planId=${plan.id}`, { scroll: false })
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
            const saveRes = await apiFetch(`/api/plans/${planId}/tasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tasks: extractedTasks })
            })
            if (!saveRes.ok) {
              console.error('Failed to save tasks to database:', await saveRes.text())
            } else {
              console.log('Tasks saved to database successfully')
            }
          } else {
            console.warn('No planId available, tasks not saved to database')
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

  const addMessage = (role: Message['role'], content: string, imagePaths?: string[]) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      imagePaths
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
              // 只保留第一个有效的 question 事件，忽略后续的
              // （Claude 可能从主 agent 和 Task 子 agent 发送多个 AskUserQuestion）
              if (!hasQuestion && event.data?.questions?.length > 0) {
                hasQuestion = true
                setPendingQuestion(event.data)
                setSelectedAnswers({})
                setState('waiting_input')
              }
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
                currentPlanIdRef.current = event.data.planId  // 更新ref，防止URL变化触发重复恢复
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
      // 没有新问题时，清空旧的问题状态
      setPendingQuestion(null)
      setSelectedAnswers({})
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
    const hasText = input.trim().length > 0
    const hasImages = attachedImages.length > 0
    if ((!hasText && !hasImages) || state === 'processing') return

    const userMessage = input.trim()
    setInput('')

    // 清空附加图片（保存引用用于上传）
    const imagesToUpload = [...attachedImages]
    setAttachedImages([])

    setState('processing')
    setPendingQuestion(null)

    try {
      // 上传图片获取路径（带进度显示）
      let imagePaths: string[] = []
      if (imagesToUpload.length > 0) {
        setIsUploading(true)
        setUploadProgress({
          files: imagesToUpload.map((img, index) => ({
            id: `file-${index}-${Date.now()}`,
            name: img.file.name,
            progress: 0,
            status: 'pending' as const
          })),
          totalProgress: 0
        })

        try {
          const result = await uploadFilesWithProgress(
            imagesToUpload.map(img => img.file),
            (progress) => setUploadProgress(progress)
          )

          if (result.paths && result.paths.length > 0) {
            imagePaths = result.paths
          }
          if (result.error) {
            console.error('Image upload failed:', result.error)
          }
          if (result.warnings) {
            result.warnings.forEach(w => console.warn('Upload warning:', w))
          }
        } catch (uploadError) {
          console.error('Image upload error:', uploadError)
        } finally {
          setIsUploading(false)
          // 延迟清除进度显示，让用户看到完成状态
          setTimeout(() => setUploadProgress(null), 1000)
          // 清理预览 URL
          imagesToUpload.forEach(img => URL.revokeObjectURL(img.previewUrl))
        }
      }

      // 显示用户消息（含图片路径）
      addMessage('user', userMessage || '', imagePaths.length > 0 ? imagePaths : undefined)

      // 如果有 sessionId，继续现有对话；否则创建新对话
      if (sessionId) {
        const response = await apiFetch('/api/claude/continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answer: userMessage || '[Images attached]',
            sessionId,
            planId,
            projectPath: selectedProject?.path,
            imagePaths: imagePaths.length > 0 ? imagePaths : undefined
          })
        })
        await processSSE(response, true)
      } else {
        // 启动新会话时清空旧的状态
        setSessionId(null)
        setPlanId(null)

        const response = await apiFetch('/api/claude/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userMessage || '[Images attached]',
            projectPath: selectedProject?.path,
            // 只有数据库项目才传递 projectId，用于创建 Plan 和保存对话
            projectId: isDatabaseProject ? selectedProject.id : undefined,
            imagePaths: imagePaths.length > 0 ? imagePaths : undefined
          })
        })
        await processSSE(response, true)
      }
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
    if (state !== 'waiting_input' || !pendingQuestion || isSubmittingAnswer) return

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

    // 标记开始提交（保留问题UI显示提交状态）
    setIsSubmittingAnswer(true)

    const combinedAnswer = pendingQuestion.questions.map((q, idx) => {
      const header = q.header || `Question ${idx + 1}`
      const answer = selectedAnswers[idx]
      // Format multiSelect answers as comma-separated list
      const formattedAnswer = Array.isArray(answer) ? answer.join(', ') : answer
      return `${header}: ${formattedAnswer}`
    }).join('\n')

    addMessage('user', combinedAnswer)
    setState('processing')
    // 注意：不要在这里清空 pendingQuestion 和 selectedAnswers
    // 保留它们以便在提交过程中显示已选状态

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
    } finally {
      setIsSubmittingAnswer(false)
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
    currentPlanIdRef.current = null  // 清空ref
    setTasks([])
    setPendingQuestion(null)
    setSelectedAnswers({})
    setProgressState({ sessionStartTime: null, tools: [], currentToolId: null })
    setState('idle')
    setPlanStatus('DRAFT')
    setPlanName('')
    setPlanDescription('')
    router.replace('/', { scroll: false })
  }

  // 发布 Plan
  const handlePublish = async () => {
    if (!planId) return

    try {
      const res = await apiFetch(`/api/plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PUBLISHED',
        })
      })

      if (res.ok) {
        setPlanStatus('PUBLISHED')
        // 刷新历史列表
        setHistoryRefreshTrigger(prev => prev + 1)
      } else {
        console.error('Failed to publish plan')
      }
    } catch (error) {
      console.error('Publish error:', error)
    }
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
        currentPlanIdRef.current = plan.id  // 更新ref，防止重复恢复
        setSessionId(plan.sessionId)
        setPlanStatus(plan.status || 'DRAFT')
        setPlanName(plan.name || '')
        setPlanDescription(plan.description || '')

        // 恢复消息
        if (plan.conversations && plan.conversations.length > 0) {
          const restoredMessages = plan.conversations.map(convertConversationToMessage)
          setMessages(restoredMessages)

          // 修复：从恢复的消息中提取 resultContent，使 Extract Tasks 按钮可见
          // 1. 首先尝试查找带有 **Plan Complete** 标记的消息
          const lastAssistantMsgWithMarker = [...restoredMessages].reverse()
            .find((m: Message) => m.role === 'assistant' && m.content.includes('**Plan Complete**'))
          if (lastAssistantMsgWithMarker) {
            const match = lastAssistantMsgWithMarker.content.match(/---\s*\*\*Plan Complete\*\*\s*\n([\s\S]*)$/)
            if (match?.[1]) {
              setResultContent(match[1])
            }
          } else if (plan.sessionId) {
            // 2. 如果没有标记，但有 sessionId，使用最后一条足够长的 assistant 消息
            const lastLongAssistantMsg = [...restoredMessages].reverse()
              .find((m: Message) => m.role === 'assistant' && m.content.length > 500)
            if (lastLongAssistantMsg) {
              setResultContent(lastLongAssistantMsg.content)
            } else {
              setResultContent('')
            }
          } else {
            setResultContent('')
          }
        } else {
          setMessages([])
          setResultContent('')  // 清空 resultContent
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
              <a
                href="/farmer"
                className="px-3 py-1.5 text-sm bg-green-700 hover:bg-green-600 rounded-lg transition-colors flex items-center gap-1"
                title="Go to Farmer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Farmer
              </a>
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
                {msg.imagePaths && msg.imagePaths.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {msg.imagePaths.map((path, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-black/20 rounded text-xs"
                        title={path}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {path.split('/').pop()}
                      </span>
                    ))}
                  </div>
                )}
                {msg.content && (
                  <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                )}
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
          {(state === 'waiting_input' || isSubmittingAnswer) && pendingQuestion && (
            <div className={`bg-gray-800 rounded-lg p-4 border border-blue-500 ${isSubmittingAnswer ? 'opacity-70' : ''}`}>
              {isSubmittingAnswer && (
                <div className="mb-3 p-2 bg-green-800/50 rounded text-green-400 text-sm flex items-center gap-2">
                  <span className="animate-pulse">...</span> Submitting answers...
                </div>
              )}
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
                            disabled={isSubmittingAnswer}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                              isSubmittingAnswer ? 'cursor-not-allowed' : ''
                            } ${
                              isSelected
                                ? 'bg-green-600 text-white ring-2 ring-green-400'
                                : 'bg-gray-600 hover:bg-gray-500 text-gray-200 disabled:hover:bg-gray-600'
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
                        disabled={isSubmittingAnswer}
                        className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isSubmittingAnswer || !pendingQuestion.questions.every((q, idx) => {
                    const answer = selectedAnswers[idx]
                    if (q.multiSelect) {
                      return Array.isArray(answer) && answer.length > 0
                    }
                    return typeof answer === 'string' && answer.length > 0
                  })}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {isSubmittingAnswer ? 'Submitting...' : 'Submit Answers'}
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
          {/* 图片预览区域 */}
          {attachedImages.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.previewUrl}
                    alt="Preview"
                    className="h-16 w-16 object-cover rounded-lg border border-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 上传进度显示 */}
          {uploadProgress && (
            <UploadProgress
              files={uploadProgress.files}
              totalProgress={uploadProgress.totalProgress}
            />
          )}

          {/* 输入区域（拖放目标） */}
          <div
            className={`flex gap-2 p-2 -m-2 rounded-lg transition-colors ${
              isDragging
                ? 'bg-blue-500/20 border-2 border-dashed border-blue-500'
                : 'border-2 border-transparent'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            {/* 隐藏的文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* 上传按钮 */}
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={state === 'processing' || state === 'waiting_input'}
              className="px-3 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Upload images"
            >
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            {/* 文本输入框 */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder={state === 'waiting_input' ? 'Please answer the questions above...' : 'Enter your requirements...'}
              disabled={state === 'processing' || state === 'waiting_input'}
              className="flex-1 bg-gray-800 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />

            {/* 发送按钮 */}
            <button
              type="submit"
              disabled={state === 'processing' || state === 'waiting_input' || (!input.trim() && attachedImages.length === 0)}
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
            loading={state === 'processing'}
            extracting={extractingTasks}
            canExtract={!!resultContent && tasks.length === 0}
            onExtract={() => extractAndSetTasks(resultContent)}
            planId={planId}
            planStatus={planStatus}
            onPublish={handlePublish}
            planName={planName}
            planDescription={planDescription}
          />
        ) : (
          <div className="flex-1 w-full h-full min-h-0">
            <TaskCanvas
              tasks={tasks}
              onTasksChange={setTasks}
              onTaskUpdate={handleTaskUpdate}
              onTaskDelete={handleTaskDelete}
              planName={planName}
              planDescription={planDescription}
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
