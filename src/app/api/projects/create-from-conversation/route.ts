/**
 * /api/projects/create-from-conversation
 * POST - Create a project from an orphan conversation
 *
 * This endpoint creates a complete project setup:
 * 1. Local git repository with CLAUDE.md
 * 2. Optional GitHub remote repository
 * 3. Database project record
 * 4. Links orphan plan to the new project
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getProjectsRoot } from '@/lib/git-utils'
import { initializeLocalRepo, generateSafeDirectoryName } from '@/lib/git-init'
import { createGitHubRepo, isGitHubConfigured } from '@/lib/github'
import { generateClaudeMd } from '@/lib/prompts/project-extraction'
import * as path from 'path'
import * as fs from 'fs/promises'

interface CreateFromConversationRequest {
  planId?: string
  name: string
  displayName?: string
  description: string
  techStack: string[]
  createGitHub: boolean
  claudeMdContent?: string
  sourcePath?: string  // Start Fresh 模式下 Claude 工作的临时目录
  conventions?: {
    language?: string
    framework?: string
    codeStyle?: string
    architecture?: string
  }
  keyFeatures?: string[]
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: CreateFromConversationRequest = await request.json()
    const {
      planId,
      name,
      displayName,
      description,
      techStack,
      createGitHub,
      claudeMdContent,
      sourcePath,
      conventions,
      keyFeatures
    } = body

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    // Generate safe directory name
    const safeName = generateSafeDirectoryName(name)
    if (!safeName) {
      return NextResponse.json(
        { error: 'Invalid project name. Use only letters, numbers, spaces, and hyphens.' },
        { status: 400 }
      )
    }

    // Generate local path
    const projectsRoot = getProjectsRoot()
    const localPath = path.join(projectsRoot, user.id, safeName)

    // Generate CLAUDE.md content if not provided
    let finalClaudeMdContent = claudeMdContent
    if (!finalClaudeMdContent) {
      finalClaudeMdContent = generateClaudeMd({
        displayName: displayName || name,
        description,
        techStack,
        conventions,
        keyFeatures
      })
    }

    // Handle source code migration (Start Fresh mode)
    let hasExistingCode = false
    if (sourcePath) {
      console.log(`[create-from-conversation] Migrating code from temp directory: ${sourcePath}`)
      try {
        // Check if source directory has files
        const sourceStat = await fs.stat(sourcePath)
        if (sourceStat.isDirectory()) {
          const sourceFiles = await fs.readdir(sourcePath)
          if (sourceFiles.length > 0) {
            // Create parent directory
            await fs.mkdir(path.dirname(localPath), { recursive: true })
            // Copy files from temp directory to new project location
            await fs.cp(sourcePath, localPath, { recursive: true })
            hasExistingCode = true
            console.log(`[create-from-conversation] Migrated ${sourceFiles.length} items to ${localPath}`)
          }
        }
      } catch (error) {
        console.error('[create-from-conversation] Failed to migrate code:', error)
        // Continue without migrating - will create empty repo
      }
    }

    // Create GitHub repository (optional)
    let gitUrl: string | undefined
    let githubError: string | undefined
    if (createGitHub && isGitHubConfigured()) {
      try {
        const repo = await createGitHubRepo(safeName, description, true)
        gitUrl = repo.sshUrl
        console.log(`GitHub repository created: ${repo.htmlUrl}`)
      } catch (error) {
        githubError = error instanceof Error ? error.message : String(error)
        console.error('Failed to create GitHub repository:', githubError)
        // Continue without GitHub - local repo will still be created
      }
    }

    // Initialize local repository
    const initResult = await initializeLocalRepo(localPath, {
      remoteUrl: gitUrl,
      branch: 'main',
      claudeMdContent: finalClaudeMdContent,
      skipExistingGit: hasExistingCode  // 如果有现有代码，跳过 git init
    })

    if (!initResult.success) {
      return NextResponse.json(
        { error: `Failed to initialize local repository: ${initResult.error}` },
        { status: 500 }
      )
    }

    // Create database project record
    const project = await prisma.project.create({
      data: {
        name: displayName || name,
        description,
        userId: user.id,
        gitUrl,
        gitBranch: 'main',
        localPath,
        techStack,
        conventions: conventions ? JSON.parse(JSON.stringify(conventions)) : null
      }
    })

    console.log(`Project created: ${project.id} at ${localPath}`)

    // Link orphan plan to the new project
    if (planId) {
      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        select: { id: true, projectId: true }
      })

      if (plan && !plan.projectId) {
        // It's an orphan plan, link it to the new project
        await prisma.plan.update({
          where: { id: planId },
          data: { projectId: project.id }
        })
        console.log(`Linked orphan plan ${planId} to project ${project.id}`)
      }
    }

    return NextResponse.json({
      project,
      localPath,
      hasGitHub: !!gitUrl,
      githubError,
      claudeMdPath: path.join(localPath, 'CLAUDE.md')
    }, { status: 201 })
  } catch (error) {
    console.error('Create project from conversation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
