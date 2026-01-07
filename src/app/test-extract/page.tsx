'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { TaskList, Task } from '@/components/tasks'

type ExtractStep = 'idle' | 'sending' | 'analyzing' | 'parsing' | 'saving' | 'done' | 'error'

const STEP_MESSAGES: Record<ExtractStep, string> = {
  idle: '',
  sending: 'Sending request to Gemini 3 Pro...',
  analyzing: 'Gemini is analyzing your plan...',
  parsing: 'Parsing task list...',
  saving: 'Saving tasks to database...',
  done: 'Extraction complete!',
  error: 'Extraction failed'
}

// 硬编码的测试计划数据
const TEST_PLANS = {
  loginSystem: `## 实现计划摘要

**核心功能：**
- 邮箱 + 密码注册/登录
- HTTP-only Cookie 会话管理（30天有效）
- 可选登录（不影响现有聊天功能）

**新增：**
- 2 个数据库模型（User, UserSession）
- 4 个 API 路由（register, login, logout, me）
- 2 个页面（登录、注册）
- 1 个 Zustand store
- Header 用户菜单

**安全措施：**
- bcrypt 密码加密
- HTTP-only + Secure + SameSite Cookie
- 数据库 Session（支持服务端失效）

**迁移兼容：**
- 注册时自动关联旧的随机 userId
- 未登录用户继续使用现有逻辑`,

  taskBoard: `# 任务看板功能实现计划

## 概述
为项目添加一个可视化的任务看板，支持拖拽排序和状态管理。

## 技术方案

### 前端组件
- TaskBoard 主组件：显示多个列（待办、进行中、已完成）
- TaskColumn 列组件：包含任务卡片列表
- TaskCard 卡片组件：显示单个任务信息
- 使用 @dnd-kit 实现拖拽功能

### 后端 API
- GET /api/boards - 获取看板列表
- POST /api/boards - 创建看板
- PUT /api/tasks/:id/status - 更新任务状态
- PUT /api/tasks/reorder - 批量更新排序

### 数据模型
- Board: id, name, columns[], projectId
- Column: id, name, order, boardId
- Task 增加: columnId, boardId 字段

## 实现步骤
1. 创建数据库模型和迁移
2. 实现后端 API
3. 创建前端组件
4. 添加拖拽交互
5. 集成到项目页面

预估工时：16小时`,

  apiIntegration: `## Linear API 集成方案

### 目标
将 Seedbed 生成的任务自动同步到 Linear 项目管理工具。

### OAuth 流程
1. 用户点击"连接 Linear"按钮
2. 跳转到 Linear OAuth 授权页面
3. 用户授权后回调到 /api/auth/linear/callback
4. 保存 access_token 到用户表

### 同步功能
- 单向同步：Seedbed -> Linear
- 批量创建 Issues
- 支持设置 Team、Project、Priority
- 创建汇总 Issue（META）关联所有子任务

### 数据映射
| Seedbed | Linear |
|---------|--------|
| P0 | Urgent |
| P1 | High |
| P2 | Medium |
| P3 | Low |
| labels | Labels |
| acceptanceCriteria | Description |

### 需要实现
- OAuth 认证流程（3个API端点）
- Linear SDK 集成
- 发布对话框组件
- 任务状态同步（可选）`
}

export default function TestExtractPage() {
  const searchParams = useSearchParams()
  const planId = searchParams.get('planId') || undefined

  const [selectedPlan, setSelectedPlan] = useState<keyof typeof TEST_PLANS>('loginSystem')
  const [tasks, setTasks] = useState<Task[]>([])
  const [step, setStep] = useState<ExtractStep>('idle')
  const [error, setError] = useState<string | null>(null)
  const [rawResponse, setRawResponse] = useState<string | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // 计时器
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (step === 'sending' || step === 'analyzing' || step === 'parsing') {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 100)
      }, 100)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [step])

  const handleExtract = async () => {
    setStep('sending')
    setError(null)
    setRawResponse(null)
    setTasks([])
    setElapsedTime(0)

    try {
      // 模拟发送延迟
      await new Promise(r => setTimeout(r, 300))
      setStep('analyzing')

      const res = await fetch('/api/tasks/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planContent: TEST_PLANS[selectedPlan] })
      })

      setStep('parsing')
      const data = await res.json()

      if (res.ok) {
        const extractedTasks = data.tasks || []
        setRawResponse(JSON.stringify(data, null, 2))

        // 如果有 planId，保存到数据库
        if (planId && extractedTasks.length > 0) {
          setStep('saving')
          const saveRes = await fetch(`/api/plans/${planId}/tasks`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks: extractedTasks })
          })

          if (saveRes.ok) {
            const savedData = await saveRes.json()
            // 使用数据库返回的 tasks（包含真实的 id）
            setTasks(savedData.tasks || extractedTasks)
          } else {
            // 保存失败，但仍显示提取的任务
            setTasks(extractedTasks)
            console.warn('Failed to save tasks to database')
          }
        } else {
          setTasks(extractedTasks)
        }

        setStep('done')
      } else {
        setError(data.error || 'Unknown error')
        setRawResponse(JSON.stringify(data, null, 2))
        setStep('error')
      }
    } catch (err) {
      setError(String(err))
      setStep('error')
    }
  }

  const isExtracting = step === 'sending' || step === 'analyzing' || step === 'parsing' || step === 'saving'

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
      {/* Left Panel - Plan Content */}
      <div className="flex-1 flex flex-col border-r border-gray-700 overflow-hidden">
        <header className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold mb-2">Task Extraction Test</h1>
          <div className="flex gap-2">
            {Object.keys(TEST_PLANS).map(key => (
              <button
                key={key}
                onClick={() => {
                  setSelectedPlan(key as keyof typeof TEST_PLANS)
                  setTasks([])
                  setError(null)
                  setRawResponse(null)
                }}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  selectedPlan === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Plan Content */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-medium text-gray-400 mb-2">Plan Content:</h2>
            <pre className="whitespace-pre-wrap text-sm text-gray-200 font-mono">
              {TEST_PLANS[selectedPlan]}
            </pre>
          </div>

          {/* Extract Button & Progress */}
          {isExtracting ? (
            <div className="bg-gray-800 rounded-lg p-4 border border-blue-500">
              {/* Progress Steps */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {step === 'sending' && <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>}
                  {step !== 'sending' && <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                  <span className={step === 'sending' ? 'text-blue-400' : 'text-green-400'}>Sending request to Gemini 3 Pro</span>
                </div>

                <div className="flex items-center gap-3">
                  {step === 'analyzing' && <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>}
                  {step === 'sending' && <div className="h-5 w-5 rounded-full border-2 border-gray-600"></div>}
                  {['parsing', 'saving', 'done'].includes(step) && <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                  <span className={step === 'analyzing' ? 'text-blue-400' : step === 'sending' ? 'text-gray-500' : 'text-green-400'}>Gemini is analyzing your plan</span>
                </div>

                <div className="flex items-center gap-3">
                  {step === 'parsing' && <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>}
                  {['sending', 'analyzing'].includes(step) && <div className="h-5 w-5 rounded-full border-2 border-gray-600"></div>}
                  {['saving', 'done'].includes(step) && <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                  <span className={step === 'parsing' ? 'text-blue-400' : ['sending', 'analyzing'].includes(step) ? 'text-gray-500' : 'text-green-400'}>Parsing task list</span>
                </div>

                {/* Saving step - only show if planId exists */}
                {planId && (
                  <div className="flex items-center gap-3">
                    {step === 'saving' && <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>}
                    {(step === 'sending' || step === 'analyzing' || step === 'parsing') && <div className="h-5 w-5 rounded-full border-2 border-gray-600"></div>}
                    {(step as string) === 'done' && <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                    <span className={step === 'saving' ? 'text-blue-400' : (step === 'sending' || step === 'analyzing' || step === 'parsing') ? 'text-gray-500' : 'text-green-400'}>Saving tasks to database</span>
                  </div>
                )}
              </div>

              {/* Timer */}
              <div className="mt-4 pt-3 border-t border-gray-700 text-center">
                <span className="text-gray-400 text-sm">{(elapsedTime / 1000).toFixed(1)}s</span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleExtract}
              className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Extract Tasks with Gemini 3 Pro
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
              <h3 className="text-red-400 font-medium mb-1">Error:</h3>
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Raw Response */}
          {rawResponse && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Raw API Response:</h3>
              <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono max-h-60 overflow-y-auto">
                {rawResponse}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Task List */}
      <TaskList
        tasks={tasks}
        onTasksReorder={setTasks}
        onTaskUpdate={handleTaskUpdate}
        onTaskDelete={handleTaskDelete}
        planId={planId}
        planName={selectedPlan}
        loading={false}
        extracting={isExtracting}
      />
    </div>
  )
}
