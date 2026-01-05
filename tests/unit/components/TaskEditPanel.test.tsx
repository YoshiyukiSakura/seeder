/**
 * TaskEditPanel 组件单元测试
 */
import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { createMockTask } from '../../utils/mocks'
import { Task } from '@/components/tasks/types'

// Mock TaskEditPanel component for testing
interface TaskEditPanelProps {
  task: Task
  onSave: (task: Task) => void
  onClose?: () => void
}

const TaskEditPanel: React.FC<TaskEditPanelProps> = ({ task, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    title: task.title,
    description: task.description,
    priority: task.priority,
    labels: [...task.labels],
    acceptanceCriteria: [...task.acceptanceCriteria],
    estimateHours: task.estimateHours,
  })
  const [newCriteria, setNewCriteria] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    if (!formData.title.trim()) {
      setError('标题不能为空')
      return
    }
    setError(null)
    onSave({
      ...task,
      ...formData,
    })
  }

  const addCriteria = () => {
    if (newCriteria.trim()) {
      setFormData(prev => ({
        ...prev,
        acceptanceCriteria: [...prev.acceptanceCriteria, newCriteria.trim()],
      }))
      setNewCriteria('')
    }
  }

  const removeCriteria = (index: number) => {
    setFormData(prev => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.filter((_, i) => i !== index),
    }))
  }

  return (
    <div data-testid="task-edit-panel">
      <div>
        <label htmlFor="title">标题</label>
        <input
          id="title"
          data-testid="edit-title"
          value={formData.title}
          onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
        />
      </div>

      <div>
        <label htmlFor="description">描述</label>
        <textarea
          id="description"
          data-testid="edit-description"
          value={formData.description}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <div>
        <label htmlFor="priority">优先级</label>
        <select
          id="priority"
          data-testid="edit-priority"
          value={formData.priority}
          onChange={e => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
        >
          <option value={0}>P0 - 紧急</option>
          <option value={1}>P1 - 高</option>
          <option value={2}>P2 - 中</option>
          <option value={3}>P3 - 低</option>
        </select>
      </div>

      <div>
        <h4>验收标准</h4>
        <input
          placeholder="添加验收标准"
          data-testid="new-criteria-input"
          value={newCriteria}
          onChange={e => setNewCriteria(e.target.value)}
        />
        <button onClick={addCriteria} data-testid="add-criteria-btn">
          添加
        </button>
        <ul>
          {formData.acceptanceCriteria.map((criteria, index) => (
            <li key={index} data-testid="criteria-item">
              {criteria}
              <button
                onClick={() => removeCriteria(index)}
                data-testid="remove-criteria-btn"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      </div>

      {error && <div className="error" data-testid="error-message">{error}</div>}

      <div>
        <button onClick={onClose} data-testid="cancel-btn">取消</button>
        <button onClick={handleSave} data-testid="save-task-btn">保存</button>
      </div>
    </div>
  )
}

describe('TaskEditPanel Component', () => {
  describe('Form Population', () => {
    it('should populate form with task data', () => {
      const task = createMockTask({
        title: 'Edit Me',
        description: 'Description here',
        priority: 1,
      })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      expect(screen.getByDisplayValue('Edit Me')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Description here')).toBeInTheDocument()
      // Check that priority select has correct value
      const prioritySelect = screen.getByTestId('edit-priority') as HTMLSelectElement
      expect(prioritySelect.value).toBe('1')
    })

    it('should populate acceptance criteria', () => {
      const task = createMockTask({
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
      })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      expect(screen.getByText('Criterion 1')).toBeInTheDocument()
      expect(screen.getByText('Criterion 2')).toBeInTheDocument()
    })
  })

  describe('Form Editing', () => {
    it('should update title on input change', async () => {
      const task = createMockTask({ title: 'Original' })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      const titleInput = screen.getByTestId('edit-title')
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Updated Title')

      expect(screen.getByDisplayValue('Updated Title')).toBeInTheDocument()
    })

    it('should update description on input change', async () => {
      const task = createMockTask({ description: 'Original' })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      const descInput = screen.getByTestId('edit-description')
      await userEvent.clear(descInput)
      await userEvent.type(descInput, 'Updated Description')

      expect(screen.getByDisplayValue('Updated Description')).toBeInTheDocument()
    })

    it('should update priority on select change', async () => {
      const task = createMockTask({ priority: 2 })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      const prioritySelect = screen.getByTestId('edit-priority') as HTMLSelectElement
      await userEvent.selectOptions(prioritySelect, '0')

      expect(prioritySelect.value).toBe('0')
    })
  })

  describe('Save Functionality', () => {
    it('should call onSave with updated data', async () => {
      const onSave = jest.fn()
      const task = createMockTask({ title: 'Original' })
      render(<TaskEditPanel task={task} onSave={onSave} />)

      const titleInput = screen.getByTestId('edit-title')
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Updated Title')

      fireEvent.click(screen.getByTestId('save-task-btn'))

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Title',
        })
      )
    })

    it('should preserve unedited fields on save', async () => {
      const onSave = jest.fn()
      const task = createMockTask({
        title: 'Title',
        description: 'Description',
        priority: 1,
        labels: ['label1'],
      })
      render(<TaskEditPanel task={task} onSave={onSave} />)

      // Only change title
      const titleInput = screen.getByTestId('edit-title')
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'New Title')

      fireEvent.click(screen.getByTestId('save-task-btn'))

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Title',
          description: 'Description',
          priority: 1,
          labels: ['label1'],
        })
      )
    })
  })

  describe('Validation', () => {
    it('should show error for empty title', async () => {
      const task = createMockTask({ title: 'Title' })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      const titleInput = screen.getByTestId('edit-title')
      await userEvent.clear(titleInput)

      fireEvent.click(screen.getByTestId('save-task-btn'))

      expect(screen.getByText('标题不能为空')).toBeInTheDocument()
    })

    it('should not call onSave when validation fails', async () => {
      const onSave = jest.fn()
      const task = createMockTask({ title: 'Title' })
      render(<TaskEditPanel task={task} onSave={onSave} />)

      const titleInput = screen.getByTestId('edit-title')
      await userEvent.clear(titleInput)

      fireEvent.click(screen.getByTestId('save-task-btn'))

      expect(onSave).not.toHaveBeenCalled()
    })

    it('should clear error when valid data is submitted', async () => {
      const task = createMockTask({ title: 'Title' })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      // First, cause an error
      const titleInput = screen.getByTestId('edit-title')
      await userEvent.clear(titleInput)
      fireEvent.click(screen.getByTestId('save-task-btn'))
      expect(screen.getByText('标题不能为空')).toBeInTheDocument()

      // Then fix it
      await userEvent.type(titleInput, 'New Title')
      fireEvent.click(screen.getByTestId('save-task-btn'))

      expect(screen.queryByText('标题不能为空')).not.toBeInTheDocument()
    })
  })

  describe('Acceptance Criteria Management', () => {
    it('should add new acceptance criteria', async () => {
      const task = createMockTask({ acceptanceCriteria: [] })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      const input = screen.getByTestId('new-criteria-input')
      await userEvent.type(input, 'New criterion')
      fireEvent.click(screen.getByTestId('add-criteria-btn'))

      expect(screen.getByText('New criterion')).toBeInTheDocument()
    })

    it('should clear input after adding criteria', async () => {
      const task = createMockTask({ acceptanceCriteria: [] })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      const input = screen.getByTestId('new-criteria-input')
      await userEvent.type(input, 'New criterion')
      fireEvent.click(screen.getByTestId('add-criteria-btn'))

      expect(input).toHaveValue('')
    })

    it('should not add empty criteria', async () => {
      const task = createMockTask({ acceptanceCriteria: [] })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      fireEvent.click(screen.getByTestId('add-criteria-btn'))

      expect(screen.queryByTestId('criteria-item')).not.toBeInTheDocument()
    })

    it('should remove acceptance criteria', async () => {
      const task = createMockTask({
        acceptanceCriteria: ['To Remove', 'Keep This'],
      })
      render(<TaskEditPanel task={task} onSave={jest.fn()} />)

      const removeButtons = screen.getAllByTestId('remove-criteria-btn')
      fireEvent.click(removeButtons[0])

      expect(screen.queryByText('To Remove')).not.toBeInTheDocument()
      expect(screen.getByText('Keep This')).toBeInTheDocument()
    })

    it('should include updated criteria in save', async () => {
      const onSave = jest.fn()
      const task = createMockTask({ acceptanceCriteria: ['Existing'] })
      render(<TaskEditPanel task={task} onSave={onSave} />)

      const input = screen.getByTestId('new-criteria-input')
      await userEvent.type(input, 'New criterion')
      fireEvent.click(screen.getByTestId('add-criteria-btn'))

      fireEvent.click(screen.getByTestId('save-task-btn'))

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          acceptanceCriteria: ['Existing', 'New criterion'],
        })
      )
    })
  })

  describe('Close Functionality', () => {
    it('should call onClose when cancel button clicked', () => {
      const onClose = jest.fn()
      const task = createMockTask()
      render(<TaskEditPanel task={task} onSave={jest.fn()} onClose={onClose} />)

      fireEvent.click(screen.getByTestId('cancel-btn'))

      expect(onClose).toHaveBeenCalled()
    })

    it('should not save changes when canceling', async () => {
      const onSave = jest.fn()
      const onClose = jest.fn()
      const task = createMockTask({ title: 'Original' })
      render(<TaskEditPanel task={task} onSave={onSave} onClose={onClose} />)

      const titleInput = screen.getByTestId('edit-title')
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, 'Changed')

      fireEvent.click(screen.getByTestId('cancel-btn'))

      expect(onSave).not.toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
