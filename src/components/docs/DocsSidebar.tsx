'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menuItems = [
  {
    title: '入门',
    items: [
      { href: '/docs/quick-start', label: '快速开始' },
    ]
  },
  {
    title: '项目管理',
    items: [
      { href: '/docs/projects', label: '概览' },
      { href: '/docs/projects/from-git', label: '从 Git URL 创建' },
    ]
  }
]

export default function DocsSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 flex-shrink-0 bg-gray-800 border-r border-gray-700 min-h-screen">
      <div className="sticky top-0 p-6">
        {/* 返回首页链接 */}
        <Link
          href="/"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="text-sm">返回首页</span>
        </Link>

        {/* 文档标题 */}
        <Link href="/docs" className="block mb-8">
          <h2 className={`text-xl font-bold transition-colors ${
            pathname === '/docs' ? 'text-indigo-400' : 'text-white hover:text-indigo-400'
          }`}>
            文档
          </h2>
        </Link>

        {/* 导航菜单 */}
        <nav className="space-y-6">
          {menuItems.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
