import DocsNavigation from '@/components/docs/DocsNavigation'

export default function FromGitPage() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-4 text-white">从 Git URL 创建项目</h1>
      <p className="text-gray-300 mb-8">
        Seedbed 支持直接从 Git 仓库创建项目。只需提供 Git URL，系统将自动克隆仓库并使用 AI 分析其内容。
      </p>

      {/* 快速开始 */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-white">快速开始</h2>
        <ol className="space-y-3 text-gray-300">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
            <span>点击聊天界面中的<strong className="text-white">项目选择器</strong>下拉菜单</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
            <span>点击底部的<strong className="text-white">+ 新建项目</strong></span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
            <span>在<strong className="text-white">Git URL</strong>字段中输入您的 Git URL</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
            <span>点击<strong className="text-white">AI</strong>按钮自动分析并填充项目详情</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">5</span>
            <span>审查自动填充的信息，根据需要进行调整</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">6</span>
            <span>点击<strong className="text-white">创建项目</strong>克隆并保存项目</span>
          </li>
        </ol>
      </section>

      {/* 支持的 Git URL 格式 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-white">支持的 Git URL 格式</h2>
        <p className="text-gray-300 mb-4">
          Seedbed 支持 HTTPS 和 SSH 两种 Git URL 格式：
        </p>

        <div className="space-y-4">
          {/* HTTPS 格式 */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-blue-400 uppercase">HTTPS</span>
              <span className="text-xs text-gray-500">（推荐用于公开仓库）</span>
            </div>
            <code className="block bg-gray-900 border border-gray-700 rounded px-4 py-3 text-green-400 font-mono text-sm">
              https://github.com/owner/repository.git
            </code>
            <p className="text-xs text-gray-500 mt-2">
              示例：https://github.com/vercel/next.js.git
            </p>
          </div>

          {/* SSH 格式 */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-purple-400 uppercase">SSH</span>
              <span className="text-xs text-gray-500">（推荐用于私有仓库）</span>
            </div>
            <code className="block bg-gray-900 border border-gray-700 rounded px-4 py-3 text-green-400 font-mono text-sm">
              git@github.com:owner/repository.git
            </code>
            <p className="text-xs text-gray-500 mt-2">
              示例：git@github.com:vercel/next.js.git
            </p>
          </div>
        </div>
      </section>

      {/* AI 分析功能 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-white">AI 智能分析自动填充</h2>
        <p className="text-gray-300 mb-4">
          AI 分析功能通过分析仓库内容自动提取并填充项目信息，包括：
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <ul className="space-y-3 text-gray-300">
            <li className="flex gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white">项目名称</strong>
                <p className="text-sm text-gray-400">从仓库名称提取并格式化为可读形式</p>
              </div>
            </li>
            <li className="flex gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white">项目描述</strong>
                <p className="text-sm text-gray-400">从 README.md 和仓库分析生成</p>
              </div>
            </li>
            <li className="flex gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white">技术栈</strong>
                <p className="text-sm text-gray-400">从 package.json、依赖项和文件类型检测</p>
              </div>
            </li>
            <li className="flex gap-3">
              <svg className="w-6 h-6 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <strong className="text-white">默认分支</strong>
                <p className="text-sm text-gray-400">自动检测（main、master 等）</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="mt-4 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-blue-300 text-sm">
                <strong>提示：</strong>创建项目前您仍可以手动编辑任何自动填充的字段。AI 分析只是帮助您节省时间的起点。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 创建后发生什么 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-white">创建后会发生什么</h2>
        <p className="text-gray-300 mb-4">
          当您使用 Git URL 创建项目时，Seedbed 会执行以下操作：
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <ol className="space-y-4 text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <div className="flex-1">
                <strong className="text-white">克隆仓库</strong>
                <p className="text-sm text-gray-400 mt-1">
                  仓库将被克隆到您本地的 <code className="bg-gray-900 px-2 py-0.5 rounded text-green-400">~/projects/</code> 目录
                </p>
                <code className="block bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-400 font-mono text-sm mt-2">
                  ~/projects/repository-name/
                </code>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <div className="flex-1">
                <strong className="text-white">切换分支</strong>
                <p className="text-sm text-gray-400 mt-1">
                  自动切换到指定分支（或默认分支）
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <div className="flex-1">
                <strong className="text-white">保存项目</strong>
                <p className="text-sm text-gray-400 mt-1">
                  项目元数据保存到数据库，并在项目选择器中可用
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <div className="flex-1">
                <strong className="text-white">准备就绪</strong>
                <p className="text-sm text-gray-400 mt-1">
                  现在您可以选择该项目并在聊天中开始使用
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* 示例工作流程 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-white">示例工作流程</h2>
        <p className="text-gray-300 mb-4">
          以下是从 GitHub 仓库创建项目的完整示例：
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">步骤 1：输入 Git URL</div>
            <code className="block bg-gray-900 border border-gray-700 rounded px-4 py-3 text-green-400 font-mono text-sm">
              https://github.com/vercel/next.js.git
            </code>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">步骤 2：点击 AI 按钮（自动填充）</div>
            <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">名称：</span>
                <span className="text-green-400">Next.js</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">描述：</span>
                <span className="text-green-400">The React Framework for the Web</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">技术栈：</span>
                <span className="text-green-400">React, TypeScript, Node.js</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">分支：</span>
                <span className="text-green-400">canary</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-400 mb-2">步骤 3：结果</div>
            <code className="block bg-gray-900 border border-gray-700 rounded px-4 py-3 text-green-400 font-mono text-sm">
              项目已克隆到：~/projects/next.js/
            </code>
          </div>
        </div>
      </section>

      {/* 提示和最佳实践 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-white">提示与最佳实践</h2>
        <div className="space-y-3">
          <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-green-300 text-sm">
                  <strong>私有仓库使用 SSH</strong> - SSH 认证更安全，不需要重复输入凭据。
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-yellow-300 text-sm">
                  <strong>大型仓库克隆可能需要更长时间</strong> - 系统对克隆操作有 5 分钟超时限制。对于非常大的仓库，可考虑使用浅克隆。
                </p>
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
                  <strong>私有仓库访问</strong> - 对于私有仓库，请确保服务器的 GitHub 账号已被授予访问权限。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 故障排除 */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-white">故障排除</h2>
        <div className="bg-gray-800 border border-gray-700 rounded-lg divide-y divide-gray-700">
          <details className="p-4 cursor-pointer hover:bg-gray-750">
            <summary className="font-medium text-white">
              克隆时出现"权限被拒绝"错误
            </summary>
            <p className="mt-2 text-sm text-gray-400">
              确保服务器的 GitHub 账号有访问该仓库的权限。对于私有仓库，您需要将服务器账号添加为具有至少读取权限的协作者。
            </p>
          </details>

          <details className="p-4 cursor-pointer hover:bg-gray-750">
            <summary className="font-medium text-white">
              "仓库未找到"错误
            </summary>
            <p className="mt-2 text-sm text-gray-400">
              验证 Git URL 是否正确且仓库存在。同时检查仓库是否可访问（公开或您有必要的权限）。
            </p>
          </details>

          <details className="p-4 cursor-pointer hover:bg-gray-750">
            <summary className="font-medium text-white">
              AI 分析失败或返回不完整数据
            </summary>
            <p className="mt-2 text-sm text-gray-400">
              AI 分析需要访问仓库。如果失败，您仍可以手动填写项目详情并创建项目。分析是可选的。
            </p>
          </details>

          <details className="p-4 cursor-pointer hover:bg-gray-750">
            <summary className="font-medium text-white">
              克隆操作超时
            </summary>
            <p className="mt-2 text-sm text-gray-400">
              大型仓库可能超过 5 分钟超时限制。考虑手动将仓库克隆到 ~/projects/，然后重新尝试创建项目。
            </p>
          </details>
        </div>
      </section>

      <DocsNavigation
        prev={{ href: '/docs/projects', label: '项目管理' }}
      />
    </>
  )
}
