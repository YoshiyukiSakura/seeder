import type { Task } from '@/components/tasks/types'

export interface ExportOptions {
  includeAcceptanceCriteria: boolean
  includeRelatedFiles: boolean
  priorityFilter: 'all' | 0 | 1 | 2 | 3
}

export interface TaskPhase {
  phaseNumber: number
  title: string
  tasks: Task[]
}

export interface PlanInfo {
  name?: string
  description?: string
}

/**
 * Get priority label from numeric priority
 */
export function getPriorityLabel(priority: number): string {
  const labels: Record<number, string> = {
    0: 'P0',
    1: 'P1',
    2: 'P2',
    3: 'P3',
  }
  return labels[priority] ?? `P${priority}`
}

/**
 * Get priority description
 */
export function getPriorityDescription(priority: number): string {
  const descriptions: Record<number, string> = {
    0: 'Critical',
    1: 'High',
    2: 'Medium',
    3: 'Low',
  }
  return descriptions[priority] ?? 'Unknown'
}

/**
 * Compute task phases using topological sort
 * Groups tasks by execution order based on dependencies
 */
export function computeTaskPhases(tasks: Task[]): TaskPhase[] {
  if (tasks.length === 0) return []

  // Build dependency graph
  const taskMap = new Map<string, Task>()
  const dependencyCount = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const task of tasks) {
    taskMap.set(task.id, task)
    dependencyCount.set(task.id, 0)
    dependents.set(task.id, [])
  }

  // Count dependencies and build reverse graph
  for (const task of tasks) {
    const blockers = task.blockedBy || []
    let validBlockerCount = 0
    for (const blockerId of blockers) {
      if (taskMap.has(blockerId)) {
        validBlockerCount++
        dependents.get(blockerId)!.push(task.id)
      }
    }
    dependencyCount.set(task.id, validBlockerCount)
  }

  const phases: TaskPhase[] = []
  const processed = new Set<string>()

  // Process tasks phase by phase
  while (processed.size < tasks.length) {
    // Find tasks with no remaining dependencies
    const readyTasks: Task[] = []
    for (const task of tasks) {
      if (!processed.has(task.id) && dependencyCount.get(task.id) === 0) {
        readyTasks.push(task)
      }
    }

    // Handle cycles - if no tasks are ready but some remain, add remaining as final phase
    if (readyTasks.length === 0) {
      const remainingTasks = tasks.filter(t => !processed.has(t.id))
      if (remainingTasks.length > 0) {
        phases.push({
          phaseNumber: phases.length + 1,
          title: `Phase ${phases.length + 1}: Remaining (Cyclic Dependencies)`,
          tasks: remainingTasks.sort((a, b) => a.priority - b.priority),
        })
        break
      }
    }

    // Sort ready tasks by priority, then by title
    readyTasks.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.title.localeCompare(b.title)
    })

    // Create phase
    const phaseNumber = phases.length + 1
    let phaseTitle: string
    if (phaseNumber === 1) {
      phaseTitle = 'Phase 1: Foundation (No dependencies)'
    } else {
      phaseTitle = `Phase ${phaseNumber}: After Phase ${phaseNumber - 1}`
    }

    phases.push({
      phaseNumber,
      title: phaseTitle,
      tasks: readyTasks,
    })

    // Mark as processed and update dependency counts
    for (const task of readyTasks) {
      processed.add(task.id)
      for (const dependentId of dependents.get(task.id) || []) {
        const count = dependencyCount.get(dependentId) || 0
        dependencyCount.set(dependentId, count - 1)
      }
    }
  }

  return phases
}

/**
 * Export tasks to AI Prompt format (for Claude Code / Cursor)
 */
export function exportToAIPrompt(
  plan: PlanInfo,
  tasks: Task[],
  options: ExportOptions
): string {
  const filteredTasks = options.priorityFilter === 'all'
    ? tasks
    : tasks.filter(t => t.priority === options.priorityFilter)

  const phases = computeTaskPhases(filteredTasks)
  const totalEstimate = filteredTasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0)

  // Build priority breakdown
  const priorityBreakdown = [0, 1, 2, 3]
    .map(p => {
      const count = filteredTasks.filter(t => t.priority === p).length
      return count > 0 ? `${getPriorityLabel(p)}(${count})` : null
    })
    .filter(Boolean)
    .join(', ')

  let output = ''

  // Header
  output += `# Implementation Plan: ${plan.name || 'Untitled Plan'}\n\n`

  // Context
  if (plan.description) {
    output += `## Context\n${plan.description}\n\n`
  }

  // Instructions
  output += `## Tasks to Execute\n\n`
  output += `Execute tasks in dependency order. Complete each task fully before moving to the next.\n\n`

  // Phases
  let taskNumber = 1
  for (const phase of phases) {
    output += `### ${phase.title}\n\n`

    for (const task of phase.tasks) {
      const priorityLabel = getPriorityLabel(task.priority)
      const estimate = task.estimateHours ? `${task.estimateHours}h` : ''
      const meta = [priorityLabel, estimate].filter(Boolean).join(', ')

      output += `#### Task ${taskNumber}: ${task.title}${meta ? ` [${meta}]` : ''}\n`

      // Dependencies
      if (task.blockedBy && task.blockedBy.length > 0) {
        const blockerTitles = task.blockedBy
          .map(id => {
            const blocker = filteredTasks.find(t => t.id === id)
            return blocker ? blocker.title : null
          })
          .filter(Boolean)
        if (blockerTitles.length > 0) {
          output += `*Depends on: ${blockerTitles.join(', ')}*\n`
        }
      }

      output += `\n${task.description}\n`

      // Related files
      if (options.includeRelatedFiles && task.relatedFiles && task.relatedFiles.length > 0) {
        output += `\n**Files:** \`${task.relatedFiles.join('`, `')}\`\n`
      }

      // Acceptance criteria
      if (options.includeAcceptanceCriteria && task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
        output += `\n**Acceptance Criteria:**\n`
        for (const criterion of task.acceptanceCriteria) {
          output += `- [ ] ${criterion}\n`
        }
      }

      output += `\n---\n\n`
      taskNumber++
    }
  }

  // Summary
  output += `## Summary\n`
  output += `- Total: ${filteredTasks.length} tasks\n`
  if (totalEstimate > 0) {
    output += `- Estimated: ${totalEstimate}h\n`
  }
  if (priorityBreakdown) {
    output += `- Priority breakdown: ${priorityBreakdown}\n`
  }

  return output
}

/**
 * Export tasks to Markdown format (for human reading)
 */
export function exportToMarkdown(
  plan: PlanInfo,
  tasks: Task[],
  options: ExportOptions
): string {
  const filteredTasks = options.priorityFilter === 'all'
    ? tasks
    : tasks.filter(t => t.priority === options.priorityFilter)

  const totalEstimate = filteredTasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0)

  let output = ''

  // Header
  output += `# ${plan.name || 'Task Plan'}\n\n`

  if (plan.description) {
    output += `${plan.description}\n\n`
  }

  // Summary table
  output += `## Overview\n\n`
  output += `| Metric | Value |\n`
  output += `|--------|-------|\n`
  output += `| Total Tasks | ${filteredTasks.length} |\n`
  if (totalEstimate > 0) {
    output += `| Total Estimate | ${totalEstimate}h |\n`
  }
  output += `| P0 (Critical) | ${filteredTasks.filter(t => t.priority === 0).length} |\n`
  output += `| P1 (High) | ${filteredTasks.filter(t => t.priority === 1).length} |\n`
  output += `| P2 (Medium) | ${filteredTasks.filter(t => t.priority === 2).length} |\n`
  output += `| P3 (Low) | ${filteredTasks.filter(t => t.priority === 3).length} |\n`
  output += `\n`

  // Task list table
  output += `## Task List\n\n`
  output += `| # | Title | Priority | Estimate | Dependencies |\n`
  output += `|---|-------|----------|----------|-------------|\n`

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return (a.sortOrder || 0) - (b.sortOrder || 0)
  })

  sortedTasks.forEach((task, idx) => {
    const deps = (task.blockedBy || [])
      .map(id => {
        const blocker = filteredTasks.find(t => t.id === id)
        return blocker ? blocker.title : null
      })
      .filter(Boolean)
      .join(', ') || '-'
    const estimate = task.estimateHours ? `${task.estimateHours}h` : '-'
    output += `| ${idx + 1} | ${task.title} | ${getPriorityLabel(task.priority)} | ${estimate} | ${deps} |\n`
  })
  output += `\n`

  // Task details
  output += `## Task Details\n\n`

  sortedTasks.forEach((task, idx) => {
    output += `### ${idx + 1}. ${task.title}\n\n`
    output += `**Priority:** ${getPriorityLabel(task.priority)} (${getPriorityDescription(task.priority)})\n`
    if (task.estimateHours) {
      output += `**Estimate:** ${task.estimateHours}h\n`
    }
    output += `\n${task.description}\n`

    if (options.includeRelatedFiles && task.relatedFiles && task.relatedFiles.length > 0) {
      output += `\n**Related Files:**\n`
      for (const file of task.relatedFiles) {
        output += `- \`${file}\`\n`
      }
    }

    if (options.includeAcceptanceCriteria && task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      output += `\n**Acceptance Criteria:**\n`
      for (const criterion of task.acceptanceCriteria) {
        output += `- [ ] ${criterion}\n`
      }
    }

    if (task.blockedBy && task.blockedBy.length > 0) {
      const blockerTitles = task.blockedBy
        .map(id => {
          const blocker = filteredTasks.find(t => t.id === id)
          return blocker ? blocker.title : null
        })
        .filter(Boolean)
      if (blockerTitles.length > 0) {
        output += `\n**Dependencies:** ${blockerTitles.join(', ')}\n`
      }
    }

    output += `\n---\n\n`
  })

  return output
}

/**
 * Export tasks to JSON format (for machine parsing)
 */
export function exportToJSON(
  plan: PlanInfo,
  tasks: Task[],
  options: ExportOptions
): string {
  const filteredTasks = options.priorityFilter === 'all'
    ? tasks
    : tasks.filter(t => t.priority === options.priorityFilter)

  const phases = computeTaskPhases(filteredTasks)

  const exportData = {
    plan: {
      name: plan.name || 'Untitled Plan',
      description: plan.description || null,
    },
    summary: {
      totalTasks: filteredTasks.length,
      totalEstimateHours: filteredTasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0),
      priorityBreakdown: {
        P0: filteredTasks.filter(t => t.priority === 0).length,
        P1: filteredTasks.filter(t => t.priority === 1).length,
        P2: filteredTasks.filter(t => t.priority === 2).length,
        P3: filteredTasks.filter(t => t.priority === 3).length,
      },
    },
    phases: phases.map(phase => ({
      phaseNumber: phase.phaseNumber,
      title: phase.title,
      tasks: phase.tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        priorityLabel: getPriorityLabel(task.priority),
        estimateHours: task.estimateHours || null,
        labels: task.labels || [],
        ...(options.includeAcceptanceCriteria && { acceptanceCriteria: task.acceptanceCriteria || [] }),
        ...(options.includeRelatedFiles && { relatedFiles: task.relatedFiles || [] }),
        blockedBy: task.blockedBy || [],
      })),
    })),
    tasks: filteredTasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      priorityLabel: getPriorityLabel(task.priority),
      estimateHours: task.estimateHours || null,
      labels: task.labels || [],
      ...(options.includeAcceptanceCriteria && { acceptanceCriteria: task.acceptanceCriteria || [] }),
      ...(options.includeRelatedFiles && { relatedFiles: task.relatedFiles || [] }),
      blockedBy: task.blockedBy || [],
    })),
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textArea)
    return success
  } catch {
    return false
  }
}

/**
 * Download content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
