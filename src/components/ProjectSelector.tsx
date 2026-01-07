'use client'

import { useState, useEffect, useRef } from 'react'

// 统一的项目类型（合并数据库项目和本地项目）
export interface Project {
  id: string
  name: string
  path?: string        // 本地项目路径
  description?: string
  techStack: string[]
  source: 'database' | 'local'
  hasGit?: boolean
}

interface ProjectSelectorProps {
  onSelect: (project: Project | null) => void
  selectedProject: Project | null
  className?: string
}

interface DBProject {
  id: string
  name: string
  description?: string
  localPath?: string
  techStack: string[]
}

interface LocalProject {
  name: string
  path: string
  description?: string
  techStack: string[]
  hasGit: boolean
}

export function ProjectSelector({ onSelect, selectedProject, className = '' }: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 加载项目列表
  useEffect(() => {
    async function loadProjects() {
      setLoading(true)
      setError(null)

      try {
        // 并行请求数据库项目和本地项目
        const [dbResponse, localResponse] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/projects/local')
        ])

        const allProjects: Project[] = []

        // 处理数据库项目
        if (dbResponse.ok) {
          const dbData = await dbResponse.json()
          if (dbData.projects) {
            dbData.projects.forEach((p: DBProject) => {
              allProjects.push({
                id: p.id,
                name: p.name,
                path: p.localPath,
                description: p.description,
                techStack: p.techStack || [],
                source: 'database'
              })
            })
          }
        }

        // 处理本地项目
        if (localResponse.ok) {
          const localData = await localResponse.json()
          if (localData.projects) {
            localData.projects.forEach((p: LocalProject) => {
              // 避免重复：如果路径已存在于数据库项目中，跳过
              const exists = allProjects.some(
                existing => existing.path === p.path
              )
              if (!exists) {
                allProjects.push({
                  id: `local-${p.path}`,
                  name: p.name,
                  path: p.path,
                  description: p.description,
                  techStack: p.techStack || [],
                  source: 'local',
                  hasGit: p.hasGit
                })
              }
            })
          }
        }

        setProjects(allProjects)
      } catch (err) {
        console.error('Failed to load projects:', err)
        setError('Failed to load projects')
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  // 过滤项目
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.techStack.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // 分组显示
  const dbProjects = filteredProjects.filter(p => p.source === 'database')
  const localProjects = filteredProjects.filter(p => p.source === 'local')

  const handleSelect = (project: Project) => {
    onSelect(project)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(null)
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* 选择按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg hover:border-gray-500 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          {selectedProject ? (
            <div className="flex items-center gap-2">
              <span className="text-white truncate">{selectedProject.name}</span>
              {selectedProject.source === 'local' && (
                <span className="text-xs px-1.5 py-0.5 bg-green-900 text-green-300 rounded">Local</span>
              )}
              {selectedProject.techStack.slice(0, 2).map(tech => (
                <span key={tech} className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
                  {tech}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-400">Select a project...</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {selectedProject && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClear(e as unknown as React.MouseEvent) }}
              className="p-1 hover:bg-gray-700 rounded cursor-pointer"
              title="Clear selection"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-80 overflow-hidden">
          {/* 搜索框 */}
          <div className="p-2 border-b border-gray-700">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* 项目列表 */}
          <div className="overflow-y-auto max-h-60">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-400 text-sm mt-2">Loading projects...</p>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-400 text-sm">{error}</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                {searchQuery ? 'No projects found' : 'No projects available'}
              </div>
            ) : (
              <>
                {/* 数据库项目 */}
                {dbProjects.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-750">
                      Saved Projects ({dbProjects.length})
                    </div>
                    {dbProjects.map(project => (
                      <ProjectItem
                        key={project.id}
                        project={project}
                        isSelected={selectedProject?.id === project.id}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                )}

                {/* 本地项目 */}
                {localProjects.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-750">
                      Local Projects ({localProjects.length})
                    </div>
                    {localProjects.map(project => (
                      <ProjectItem
                        key={project.id}
                        project={project}
                        isSelected={selectedProject?.id === project.id}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 项目列表项组件
function ProjectItem({
  project,
  isSelected,
  onSelect
}: {
  project: Project
  isSelected: boolean
  onSelect: (project: Project) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(project)}
      className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
        isSelected ? 'bg-gray-700' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{project.name}</span>
        <div className="flex items-center gap-1">
          {project.hasGit && (
            <span className="text-xs text-gray-500" title="Git repository">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </span>
          )}
          {isSelected && (
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>

      {project.description && (
        <p className="text-sm text-gray-400 truncate mt-0.5">{project.description}</p>
      )}

      {project.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {project.techStack.slice(0, 4).map(tech => (
            <span key={tech} className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
              {tech}
            </span>
          ))}
          {project.techStack.length > 4 && (
            <span className="text-xs text-gray-500">+{project.techStack.length - 4}</span>
          )}
        </div>
      )}

      {project.path && (
        <p className="text-xs text-gray-500 truncate mt-1" title={project.path}>
          {project.path}
        </p>
      )}
    </button>
  )
}
