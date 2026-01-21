import Link from 'next/link'
import DocsNavigation from '@/components/docs/DocsNavigation'

export default function QuickStartPage() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-4 text-white">快速开始</h1>
      <p className="text-gray-300 mb-8">
        按照以下步骤快速上手 Seedbed，开始您的开发工作。
      </p>

      {/* 步骤 0：选择项目 */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <span className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-lg font-bold">
            0
          </span>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-3 text-white">选择项目</h2>
            <p className="text-gray-300 mb-4">
              开始之前，您需要选择或创建一个项目。项目是 Seedbed 工作的基础。
            </p>

            <div className="space-y-4 mt-6">
              {/* 推荐：从 Git URL 创建 */}
              <div className="bg-gradient-to-r from-green-900/40 to-green-800/20 border border-green-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2 text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  推荐：从 Git URL 创建
                </h3>
                <p className="text-gray-300 text-sm mb-3">
                  最佳方式是从 Git 仓库创建项目。系统会自动克隆仓库并使用 AI 分析提取项目详情。
                </p>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>自动克隆仓库</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>AI 智能分析项目</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-green-400">•</span>
                    <span>自动填充项目详情（名称、描述、技术栈）</span>
                  </li>
                </ul>
                <div className="mt-3 text-xs text-green-200">
                  详见{' '}
                  <Link href="/docs/projects/from-git" className="underline hover:text-green-100 font-semibold">
                    从 Git URL 创建
                  </Link>{' '}
                  章节。
                </div>
              </div>

              {/* 快速开始：不选择项目 */}
              <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-2 text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  快速开始：不选择项目
                </h3>
                <p className="text-gray-400 text-sm mb-2">
                  您也可以不选择项目直接开始聊天。适用于：
                </p>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex gap-2">
                    <span className="text-blue-400">•</span>
                    <span>一般性问题和讨论</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-400">•</span>
                    <span>测试 Seedbed 的功能</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-blue-400">•</span>
                    <span>在创建项目前先进行规划</span>
                  </li>
                </ul>
                <div className="mt-3 bg-yellow-900/30 border border-yellow-800/50 rounded p-2">
                  <p className="text-yellow-200 text-xs">
                    <strong>注意：</strong>部分功能如任务管理和项目上下文需要选择项目后才能使用。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 步骤 1：开始聊天 */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <span className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-lg font-bold">
            1
          </span>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-3 text-white">开始聊天</h2>
            <p className="text-gray-300 mb-4">
              打开聊天界面，与 Seedbed 开始对话。您可以提问、请求代码审查或获取开发任务帮助。
            </p>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">示例提示词：</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="font-mono bg-gray-800 px-3 py-2 rounded">"帮我搭建一个新的 React 项目"</li>
                <li className="font-mono bg-gray-800 px-3 py-2 rounded">"审查这段代码，找出潜在的 bug"</li>
                <li className="font-mono bg-gray-800 px-3 py-2 rounded">"解释这个项目中的认证是如何工作的"</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 步骤 2：上传图片 */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4">
          <span className="flex-shrink-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center text-lg font-bold">
            2
          </span>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold mb-3 text-white">上传图片（可选）</h2>
            <p className="text-gray-300 mb-4">
              分享截图、图表或 UI 设计稿，为讨论提供视觉上下文。
            </p>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-3">三种上传图片的方式：</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-indigo-400">1.</span>
                  <span><strong className="text-white">文件选择：</strong>点击聊天输入框中的上传按钮</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">2.</span>
                  <span><strong className="text-white">粘贴：</strong>使用 Cmd+V 从剪贴板粘贴图片</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">3.</span>
                  <span><strong className="text-white">拖放：</strong>将图片文件拖入聊天区域</span>
                </li>
              </ul>
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
              Seedbed 可以帮助您为项目创建结构化的开发计划。计划将复杂任务分解为可管理的步骤。
            </p>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-3">创建计划的步骤：</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>描述您想要构建或完成的内容</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>Seedbed 将分析并创建详细计划</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>在实施前审查并批准计划</span>
                </li>
              </ul>
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
              完成计划后，从对话中提取可执行的任务并跟踪进度。
            </p>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-3">任务工作流程：</p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>计划完成后点击<strong className="text-white">"提取任务"</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>审查和编辑自动提取的任务</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>在实施过程中跟踪进度</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400">•</span>
                  <span>完成后标记任务为已完成</span>
                </li>
              </ul>
            </div>
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
