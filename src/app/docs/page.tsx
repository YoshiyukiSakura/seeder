import Link from 'next/link'
import DocsNavigation from '@/components/docs/DocsNavigation'

export default function DocsHomePage() {
  return (
    <>
      <h1 className="text-4xl font-bold mb-4 text-white">文档</h1>
      <p className="text-xl text-gray-300 mb-8">
        欢迎使用 Seedbed 文档。Seedbed 是一个智能开发助手，帮助您管理项目、规划任务、追踪进度。
      </p>

      {/* 简介 */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-white">什么是 Seedbed？</h2>
        <p className="text-gray-300 mb-4">
          Seedbed 是一个 AI 驱动的开发工作流管理工具，它可以帮助您：
        </p>
        <ul className="space-y-2 text-gray-300">
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>通过对话与 AI 协作，规划和设计开发方案</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>自动从对话中提取任务，追踪开发进度</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>管理多个项目，支持从 Git 仓库创建</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>上传图片、分享截图，获得更丰富的上下文</span>
          </li>
        </ul>
      </section>

      {/* 章节卡片 */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6 text-white">开始阅读</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* 快速开始 */}
          <Link
            href="/docs/quick-start"
            className="block bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-indigo-500 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors">
                快速开始
              </h3>
            </div>
            <p className="text-gray-400 text-sm">
              分步骤指南，帮助您快速上手 Seedbed 的核心功能。
            </p>
          </Link>

          {/* 项目管理 */}
          <Link
            href="/docs/projects"
            className="block bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-indigo-500 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors">
                项目管理
              </h3>
            </div>
            <p className="text-gray-400 text-sm">
              学习如何创建、管理和删除项目。
            </p>
          </Link>

          {/* 从 Git URL 创建 */}
          <Link
            href="/docs/projects/from-git"
            className="block bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-indigo-500 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors">
                从 Git URL 创建
              </h3>
            </div>
            <p className="text-gray-400 text-sm">
              使用 Git 仓库 URL 创建项目，自动克隆并使用 AI 分析项目信息。
            </p>
          </Link>
        </div>
      </section>

      <DocsNavigation
        next={{ href: '/docs/quick-start', label: '快速开始' }}
      />
    </>
  )
}
