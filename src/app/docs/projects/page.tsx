import Link from 'next/link'
import DocsNavigation from '@/components/docs/DocsNavigation'

export default function ProjectsPage() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-4 text-white">项目管理</h1>
      <p className="text-gray-300 mb-8">
        了解如何在 Seedbed 中创建和管理项目。
      </p>

      {/* 创建项目 */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 text-white">创建项目</h2>
        <Link
          href="/docs/projects/from-git"
          className="block bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-blue-500 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                从 Git URL 创建
              </h3>
              <span className="text-xs text-green-400 font-medium">推荐</span>
            </div>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            提供 Git 仓库 URL，系统自动克隆并使用 AI 分析项目。
          </p>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex gap-2">
              <span className="text-blue-400">✓</span>
              <span>自动克隆仓库</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400">✓</span>
              <span>AI 智能分析项目信息</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-400">✓</span>
              <span>自动填充名称、描述、技术栈</span>
            </li>
          </ul>
        </Link>
      </section>

      {/* 删除项目 */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-white">删除项目</h2>
        <p className="text-gray-300 mb-4">
          当项目不再需要时，您可以从已保存项目列表中删除它。
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-4">
          <h3 className="text-lg font-semibold mb-4 text-white">删除步骤</h3>
          <ol className="space-y-3 text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <span>打开聊天界面中的<strong className="text-white">项目选择器</strong>下拉菜单</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <span>在<strong className="text-white">已保存项目</strong>列表中找到要删除的项目</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <span>点击项目旁边的<strong className="text-white">删除</strong>按钮（垃圾桶图标）</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <span>在确认对话框中确认删除</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-medium">5</span>
              <span>项目将被移除，当前项目选择将自动清除</span>
            </li>
          </ol>
        </div>

        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="space-y-2">
              <p className="text-red-300 text-sm">
                <strong>重要提示：</strong>删除项目是永久性的，无法撤销。
              </p>
              <ul className="text-red-300 text-sm space-y-1 list-disc list-inside ml-2">
                <li>与该项目相关的所有对话将被删除</li>
                <li>与该项目关联的所有计划和任务将被移除</li>
                <li><code className="bg-gray-900 px-2 py-0.5 rounded text-green-400">~/projects/</code> 中的本地文件<strong>不会</strong>被删除</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-blue-300 text-sm">
                <strong>提示：</strong>删除后，如果您仍有本地仓库，可以通过使用相同的 Git URL 重新创建项目。
              </p>
            </div>
          </div>
        </div>
      </section>

      <DocsNavigation
        prev={{ href: '/docs/quick-start', label: '快速开始' }}
        next={{ href: '/docs/projects/from-git', label: '从 Git URL 创建' }}
      />
    </>
  )
}
