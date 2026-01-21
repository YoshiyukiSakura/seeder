import Link from 'next/link'
import DocsNavigation from '@/components/docs/DocsNavigation'

export default function QuickStartPage() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-4 text-white">快速开始</h1>
      <p className="text-gray-300 mb-8">
        Seedbed 是一个专注于<strong className="text-white">开发计划</strong>的 AI 工具。
        通过与 AI 对话，您可以为项目创建详细的开发计划，并将计划转化为可追踪的任务列表。
      </p>

      {/* 步骤 1：创建或选择项目 */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <span className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-lg font-bold">
            1
          </span>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-3 text-white">创建或选择项目</h2>
            <p className="text-gray-300 mb-4">
              Seedbed 中的所有工作都基于项目。每个开发计划、对话和任务都关联到特定的项目。
              开始之前，您需要先创建一个项目。
            </p>

            <div className="bg-gradient-to-r from-green-900/40 to-green-800/20 border border-green-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                从 Git URL 创建项目
              </h3>
              <p className="text-gray-300 text-sm mb-3">
                提供 Git 仓库 URL，系统会自动克隆仓库并使用 AI 分析提取项目详情。
              </p>
              <ol className="space-y-2 text-gray-300 text-sm">
                <li className="flex gap-2">
                  <span className="text-green-400 font-medium">1.</span>
                  <span>点击聊天界面中的<strong className="text-white">项目选择器</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-400 font-medium">2.</span>
                  <span>点击<strong className="text-white">+ 新建项目</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-400 font-medium">3.</span>
                  <span>输入 Git URL，点击 <strong className="text-white">AI</strong> 按钮自动分析</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-400 font-medium">4.</span>
                  <span>确认信息后点击<strong className="text-white">创建项目</strong></span>
                </li>
              </ol>
              <div className="mt-3 text-xs text-green-200">
                详见{' '}
                <Link href="/docs/projects/from-git" className="underline hover:text-green-100 font-semibold">
                  从 Git URL 创建
                </Link>{' '}
                章节。
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 步骤 2：描述您的需求 */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <span className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-lg font-bold">
            2
          </span>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-3 text-white">描述您的需求</h2>
            <p className="text-gray-300 mb-4">
              选择项目后，在聊天界面中描述您想要实现的功能或解决的问题。
              Seedbed 专注于帮您<strong className="text-white">规划开发方案</strong>，而不是直接执行具体任务。
            </p>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-400 mb-3">适合 Seedbed 的需求描述示例：</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="font-mono bg-gray-800 px-3 py-2 rounded">"我想给这个项目添加用户认证功能，帮我规划一下实现方案"</li>
                <li className="font-mono bg-gray-800 px-3 py-2 rounded">"需要重构订单模块，目前代码耦合度太高，帮我设计一个改造计划"</li>
                <li className="font-mono bg-gray-800 px-3 py-2 rounded">"想要添加 WebSocket 实时通知功能，请帮我分析需要做哪些工作"</li>
              </ul>
            </div>
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-blue-300 text-sm">
                    <strong>提示：</strong>您可以上传截图、设计稿或架构图来辅助说明需求。
                    支持文件选择、粘贴 (Cmd+V) 和拖放三种方式。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 步骤 3：创建开发计划 */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <span className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-lg font-bold">
            3
          </span>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-3 text-white">创建开发计划</h2>
            <p className="text-gray-300 mb-4">
              Seedbed 会根据您的需求描述，结合项目的技术栈和现有架构，生成详细的开发计划。
              计划会将复杂的需求分解为清晰、可执行的步骤。
            </p>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-400 mb-3">一个好的开发计划通常包含：</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong className="text-white">背景分析</strong> - 当前状态和需要解决的问题</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong className="text-white">技术方案</strong> - 采用的技术路线和架构设计</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong className="text-white">实施步骤</strong> - 分阶段的具体实现步骤</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span><strong className="text-white">注意事项</strong> - 潜在风险和需要注意的点</span>
                </li>
              </ul>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="w-6 h-6 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <div>
                  <p className="text-yellow-300 text-sm">
                    <strong>最佳实践：</strong>如果计划不够详细或方向不对，可以继续对话进行调整。
                    例如："这个方案太复杂了，有没有更简单的实现方式？" 或 "第三步能再详细展开一下吗？"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 创建计划的最佳实践 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-white border-b border-gray-700 pb-2">
          创建计划的最佳实践
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
              <span className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm">1</span>
              明确描述目标
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              清晰说明您想要实现什么，而不只是描述问题。
            </p>
            <div className="text-sm">
              <div className="flex gap-2 text-red-400 mb-1">
                <span>✗</span>
                <span className="text-gray-400">"登录有问题"</span>
              </div>
              <div className="flex gap-2 text-green-400">
                <span>✓</span>
                <span className="text-gray-300">"我想添加 OAuth 登录，支持 Google 和 GitHub"</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
              <span className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm">2</span>
              提供足够的上下文
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              说明当前状态、约束条件和技术偏好。
            </p>
            <div className="text-sm">
              <div className="flex gap-2 text-red-400 mb-1">
                <span>✗</span>
                <span className="text-gray-400">"加个缓存"</span>
              </div>
              <div className="flex gap-2 text-green-400">
                <span>✓</span>
                <span className="text-gray-300">"API 响应太慢，想加 Redis 缓存，服务器已有 Redis 实例"</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
              <span className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm">3</span>
              一次聚焦一个主题
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              每个计划专注于一个功能或模块，避免范围过大。
            </p>
            <div className="text-sm">
              <div className="flex gap-2 text-red-400 mb-1">
                <span>✗</span>
                <span className="text-gray-400">"重构整个后端"</span>
              </div>
              <div className="flex gap-2 text-green-400">
                <span>✓</span>
                <span className="text-gray-300">"重构用户模块，解耦数据库访问层"</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
              <span className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm">4</span>
              迭代完善计划
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              不满意可以继续对话，要求修改或深入某个部分。
            </p>
            <div className="text-sm text-gray-300">
              <p>"这个方案的第二步能用更现代的方法吗？"</p>
              <p>"数据库迁移部分需要更详细的步骤"</p>
            </div>
          </div>
        </div>
      </section>

      {/* 步骤 4：提取和跟踪任务 */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <span className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-lg font-bold">
            4
          </span>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-3 text-white">提取和跟踪任务</h2>
            <p className="text-gray-300 mb-4">
              计划完成后，您可以将计划转化为可追踪的任务列表。Seedbed 会智能分析对话内容，
              自动提取出需要执行的具体任务。
            </p>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-400 mb-3">任务提取流程：</p>
              <ol className="space-y-2 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-indigo-400 font-medium">1.</span>
                  <span>计划讨论完成后，点击<strong className="text-white">"提取任务"</strong>按钮</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400 font-medium">2.</span>
                  <span>AI 会分析对话，提取出具体的待办事项</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400 font-medium">3.</span>
                  <span>您可以编辑、删除或添加任务</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400 font-medium">4.</span>
                  <span>确认后任务会保存到项目中</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 任务可视化功能 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-white border-b border-gray-700 pb-2">
          任务可视化功能
        </h2>
        <p className="text-gray-300 mb-6">
          提取的任务会以可视化列表的形式展示，帮助您清晰地了解项目进度和待办事项。
        </p>

        <div className="space-y-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              任务状态追踪
            </h3>
            <p className="text-gray-400 text-sm mb-3">
              每个任务都有明确的状态，方便追踪进度：
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm">待开始</span>
              <span className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-sm">进行中</span>
              <span className="px-3 py-1 bg-green-900/50 text-green-300 rounded-full text-sm">已完成</span>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              任务编辑功能
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span><strong className="text-white">修改任务描述</strong> - 点击任务可编辑内容</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span><strong className="text-white">调整任务顺序</strong> - 拖拽重新排列优先级</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span><strong className="text-white">删除任务</strong> - 移除不需要的任务项</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span><strong className="text-white">添加新任务</strong> - 手动补充遗漏的事项</span>
              </li>
            </ul>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              计划与任务关联
            </h3>
            <p className="text-gray-400 text-sm mb-2">
              每个任务都与其来源的开发计划关联，您可以：
            </p>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span>从任务跳转回原始计划对话</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span>查看任务的上下文和设计背景</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span>在同一个项目下管理多个计划的任务</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 下一步 */}
      <section className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-700 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          下一步
        </h2>
        <p className="text-gray-300 mb-4">
          了解如何创建和管理项目：
        </p>
        <ul className="space-y-2 text-gray-300">
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>
              <Link href="/docs/projects" className="underline hover:text-indigo-200 font-semibold">
                项目管理
              </Link>{' '}
              - 项目管理概览
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>
              <Link href="/docs/projects/from-git" className="underline hover:text-indigo-200 font-semibold">
                从 Git URL 创建
              </Link>{' '}
              - 详细的项目创建指南
            </span>
          </li>
        </ul>
      </section>

      <DocsNavigation
        prev={{ href: '/docs', label: '文档首页' }}
        next={{ href: '/docs/projects', label: '项目管理' }}
      />
    </>
  )
}
