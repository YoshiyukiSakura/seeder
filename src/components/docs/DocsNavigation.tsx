import Link from 'next/link'

interface NavLink {
  href: string
  label: string
}

interface DocsNavigationProps {
  prev?: NavLink
  next?: NavLink
}

export default function DocsNavigation({ prev, next }: DocsNavigationProps) {
  return (
    <nav className="mt-12 pt-8 border-t border-gray-700">
      <div className="flex justify-between">
        {prev ? (
          <Link
            href={prev.href}
            className="flex items-center gap-2 text-gray-400 hover:text-indigo-400 transition-colors group"
          >
            <svg
              className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <div className="text-right">
              <span className="text-xs text-gray-500 block">上一页</span>
              <span className="text-sm font-medium">{prev.label}</span>
            </div>
          </Link>
        ) : (
          <div />
        )}

        {next ? (
          <Link
            href={next.href}
            className="flex items-center gap-2 text-gray-400 hover:text-indigo-400 transition-colors group ml-auto"
          >
            <div className="text-left">
              <span className="text-xs text-gray-500 block">下一页</span>
              <span className="text-sm font-medium">{next.label}</span>
            </div>
            <svg
              className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </nav>
  )
}
