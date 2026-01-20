'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/basePath'
import { ProjectDialog, type ProjectFormData } from '@/components/project'

interface UserInfo {
  username: string
  email?: string
}

interface ProjectData {
  id: string
  name: string
  description?: string
  gitUrl?: string
  gitBranch?: string
  localPath?: string
  techStack: string[]
  _count?: {
    plans: number
  }
}

export default function SettingsPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)

  // Dialog states
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null)

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadProjects = async () => {
    setProjectsLoading(true)
    try {
      const res = await apiFetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setProjectsLoading(false)
    }
  }

  useEffect(() => {
    async function loadUserInfo() {
      try {
        const res = await apiFetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUserInfo({
            username: data.user?.slackUsername || 'Unknown',
            email: data.user?.email,
          })
        }
      } catch (error) {
        console.error('Failed to load user info:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUserInfo()
    loadProjects()
  }, [])

  const handleEditProject = (project: ProjectData) => {
    setEditingProject(project)
    setDialogMode('edit')
    setShowDialog(true)
  }

  const handleCreateProject = () => {
    setEditingProject(null)
    setDialogMode('create')
    setShowDialog(true)
  }

  const handleDeleteProject = async (projectId: string) => {
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setProjects(projects.filter(p => p.id !== projectId))
        setDeleteConfirmId(null)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete project')
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
      alert('Failed to delete project')
    } finally {
      setDeleting(false)
    }
  }

  const handleDialogSuccess = (savedProject: ProjectFormData & { id: string }) => {
    loadProjects()
    setShowDialog(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-white">
              ← Back
            </Link>
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* User Info Section */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>

          {userInfo && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                <p className="text-white">{userInfo.username}</p>
              </div>
              {userInfo.email && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                  <p className="text-white">{userInfo.email}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Projects Section */}
        <section className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Projects</h2>
            <button
              onClick={handleCreateProject}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </button>
          </div>

          {projectsLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No projects yet.</p>
              <p className="text-sm mt-1">Create your first project to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(project => (
                <div
                  key={project.id}
                  className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white">{project.name}</h3>
                      {project.description && (
                        <p className="text-sm text-gray-400 mt-1 truncate">{project.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {project.techStack.slice(0, 4).map(tech => (
                          <span key={tech} className="text-xs px-2 py-0.5 bg-gray-600 text-gray-300 rounded">
                            {tech}
                          </span>
                        ))}
                        {project.techStack.length > 4 && (
                          <span className="text-xs text-gray-500">+{project.techStack.length - 4}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {project.gitUrl && (
                          <span className="flex items-center gap-1" title={project.gitUrl}>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                            {project.gitBranch || 'main'}
                          </span>
                        )}
                        {project._count && (
                          <span>{project._count.plans} plan{project._count.plans !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEditProject(project)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-lg transition-colors"
                        title="Edit project"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(project.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded-lg transition-colors"
                        title="Delete project"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  {deleteConfirmId === project.id && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <p className="text-sm text-red-400 mb-2">
                        Delete this project? All associated plans and tasks will also be deleted.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          disabled={deleting}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium disabled:opacity-50"
                        >
                          {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={deleting}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm font-medium disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Project Dialog */}
      <ProjectDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onSuccess={handleDialogSuccess}
        mode={dialogMode}
        initialData={editingProject ? {
          id: editingProject.id,
          name: editingProject.name,
          description: editingProject.description || '',
          gitUrl: editingProject.gitUrl || '',
          gitBranch: editingProject.gitBranch || 'main',
          techStack: editingProject.techStack.join(', '),
          localPath: editingProject.localPath || '',
        } : undefined}
      />
    </div>
  )
}
