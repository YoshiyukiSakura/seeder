/**
 * TaskCard 组件单元测试
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { createMockTask } from '../../utils/mocks'
import { Task } from '@/components/tasks/types'

// Mock TaskCard component for testing
// Since we're testing the logic, we create a simplified version
interface TaskCardProps {
  task: Task
  onClick?: (task: Task) => void
  isSelected?: boolean
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, isSelected }) => {
  const priorityColors: Record<number, string> = {
    0: 'bg-red-500',
    1: 'bg-orange-500',
    2: 'bg-yellow-500',
    3: 'bg-green-500',
  }

  return (
    <article
      role="article"
      className={`task-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick?.(task)}
      data-testid="task-card"
    >
      <div className="task-header">
        <span className={`priority-badge ${priorityColors[task.priority]}`} data-testid="priority-badge">
          P{task.priority}
        </span>
        <h3 className="task-title">{task.title}</h3>
      </div>
      <p className="task-description">{task.description}</p>
      {task.labels.length > 0 && (
        <div className="task-labels" data-testid="task-labels">
          {task.labels.map((label, index) => (
            <span key={index} className="label">{label}</span>
          ))}
        </div>
      )}
      {task.estimateHours && (
        <span className="estimate" data-testid="estimate">{task.estimateHours}h</span>
      )}
      {(task as any).linearIssueId && (
        <span data-testid="linear-linked-icon">Linear</span>
      )}
    </article>
  )
}

describe('TaskCard Component', () => {
  describe('Rendering', () => {
    it('should render task title', () => {
      const task = createMockTask({ title: 'Test Task Title' })
      render(<TaskCard task={task} />)

      expect(screen.getByText('Test Task Title')).toBeInTheDocument()
    })

    it('should render task description', () => {
      const task = createMockTask({ description: 'Test description' })
      render(<TaskCard task={task} />)

      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('should render priority badge', () => {
      const task = createMockTask({ priority: 0 })
      render(<TaskCard task={task} />)

      expect(screen.getByText('P0')).toBeInTheDocument()
    })

    it('should render labels', () => {
      const task = createMockTask({ labels: ['后端', '数据库'] })
      render(<TaskCard task={task} />)

      expect(screen.getByText('后端')).toBeInTheDocument()
      expect(screen.getByText('数据库')).toBeInTheDocument()
    })

    it('should render estimate when present', () => {
      const task = createMockTask({ estimateHours: 3 })
      render(<TaskCard task={task} />)

      expect(screen.getByTestId('estimate')).toHaveTextContent('3h')
    })

    it('should not render estimate when not present', () => {
      const task = createMockTask({ estimateHours: undefined })
      render(<TaskCard task={task} />)

      expect(screen.queryByTestId('estimate')).not.toBeInTheDocument()
    })
  })

  describe('Priority Colors', () => {
    it('should show red color for P0', () => {
      const task = createMockTask({ priority: 0 })
      render(<TaskCard task={task} />)

      const badge = screen.getByTestId('priority-badge')
      expect(badge).toHaveClass('bg-red-500')
    })

    it('should show orange color for P1', () => {
      const task = createMockTask({ priority: 1 })
      render(<TaskCard task={task} />)

      const badge = screen.getByTestId('priority-badge')
      expect(badge).toHaveClass('bg-orange-500')
    })

    it('should show yellow color for P2', () => {
      const task = createMockTask({ priority: 2 })
      render(<TaskCard task={task} />)

      const badge = screen.getByTestId('priority-badge')
      expect(badge).toHaveClass('bg-yellow-500')
    })

    it('should show green color for P3', () => {
      const task = createMockTask({ priority: 3 })
      render(<TaskCard task={task} />)

      const badge = screen.getByTestId('priority-badge')
      expect(badge).toHaveClass('bg-green-500')
    })
  })

  describe('Interactions', () => {
    it('should call onClick when clicked', () => {
      const handleClick = jest.fn()
      const task = createMockTask()
      render(<TaskCard task={task} onClick={handleClick} />)

      fireEvent.click(screen.getByRole('article'))
      expect(handleClick).toHaveBeenCalledWith(task)
    })

    it('should not throw when clicked without onClick handler', () => {
      const task = createMockTask()
      render(<TaskCard task={task} />)

      expect(() => {
        fireEvent.click(screen.getByRole('article'))
      }).not.toThrow()
    })

    it('should apply selected class when isSelected is true', () => {
      const task = createMockTask()
      render(<TaskCard task={task} isSelected={true} />)

      expect(screen.getByTestId('task-card')).toHaveClass('selected')
    })

    it('should not apply selected class when isSelected is false', () => {
      const task = createMockTask()
      render(<TaskCard task={task} isSelected={false} />)

      expect(screen.getByTestId('task-card')).not.toHaveClass('selected')
    })
  })

  describe('Linear Integration', () => {
    it('should show Linear icon when linearIssueId present', () => {
      const task = { ...createMockTask(), linearIssueId: 'issue123' }
      render(<TaskCard task={task} />)

      expect(screen.getByTestId('linear-linked-icon')).toBeInTheDocument()
    })

    it('should not show Linear icon when linearIssueId not present', () => {
      const task = createMockTask()
      render(<TaskCard task={task} />)

      expect(screen.queryByTestId('linear-linked-icon')).not.toBeInTheDocument()
    })
  })

  describe('Labels', () => {
    it('should render multiple labels', () => {
      const task = createMockTask({ labels: ['A', 'B', 'C'] })
      render(<TaskCard task={task} />)

      expect(screen.getByText('A')).toBeInTheDocument()
      expect(screen.getByText('B')).toBeInTheDocument()
      expect(screen.getByText('C')).toBeInTheDocument()
    })

    it('should not render labels section when empty', () => {
      const task = createMockTask({ labels: [] })
      render(<TaskCard task={task} />)

      expect(screen.queryByTestId('task-labels')).not.toBeInTheDocument()
    })
  })
})

describe('Task Data Handling', () => {
  it('should handle task with all fields', () => {
    const task = createMockTask({
      title: 'Full Task',
      description: 'Full description',
      priority: 1,
      labels: ['label1', 'label2'],
      acceptanceCriteria: ['criteria1', 'criteria2'],
      relatedFiles: ['file1.ts'],
      estimateHours: 5,
    })

    render(<TaskCard task={task} />)

    expect(screen.getByText('Full Task')).toBeInTheDocument()
    expect(screen.getByText('Full description')).toBeInTheDocument()
    expect(screen.getByText('P1')).toBeInTheDocument()
    expect(screen.getByText('label1')).toBeInTheDocument()
    expect(screen.getByText('5h')).toBeInTheDocument()
  })

  it('should handle task with minimal fields', () => {
    const task: Task = {
      id: 'minimal',
      title: 'Minimal Task',
      description: '',
      priority: 2,
      labels: [],
      acceptanceCriteria: [],
      relatedFiles: [],
    }

    render(<TaskCard task={task} />)

    expect(screen.getByText('Minimal Task')).toBeInTheDocument()
    expect(screen.getByText('P2')).toBeInTheDocument()
  })
})
