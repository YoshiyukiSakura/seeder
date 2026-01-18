/**
 * UploadProgress 组件单元测试
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UploadProgress } from '@/components/progress/UploadProgress'

describe('UploadProgress Component', () => {
  describe('Rendering', () => {
    it('should return null when files array is empty', () => {
      const { container } = render(
        <UploadProgress files={[]} totalProgress={0} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('should render upload progress UI when files are provided', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'test.jpg', progress: 50, status: 'uploading' }
          ]}
          totalProgress={50}
        />
      )

      expect(screen.getByText('Uploading images... (0/1)')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('should display total progress percentage', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'test.jpg', progress: 75, status: 'uploading' }
          ]}
          totalProgress={75}
        />
      )

      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('should display completed count correctly', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
            { id: '2', name: 'file2.jpg', progress: 100, status: 'completed' },
            { id: '3', name: 'file3.jpg', progress: 50, status: 'uploading' }
          ]}
          totalProgress={83}
        />
      )

      expect(screen.getByText('Uploading images... (2/3)')).toBeInTheDocument()
    })
  })

  describe('Single File Upload', () => {
    it('should not show individual file list for single file', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'single-file.jpg', progress: 50, status: 'uploading' }
          ]}
          totalProgress={50}
        />
      )

      // Single file should not display filename in the list
      expect(screen.queryByText('single-file.jpg')).not.toBeInTheDocument()
    })
  })

  describe('Multiple Files Upload', () => {
    it('should show individual file progress for multiple files', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
            { id: '2', name: 'file2.png', progress: 50, status: 'uploading' }
          ]}
          totalProgress={75}
        />
      )

      expect(screen.getByText('file1.jpg')).toBeInTheDocument()
      expect(screen.getByText('file2.png')).toBeInTheDocument()
    })

    it('should display percentage for each file', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
            { id: '2', name: 'file2.png', progress: 50, status: 'uploading' }
          ]}
          totalProgress={75}
        />
      )

      expect(screen.getByText('100%')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })
  })

  describe('File Status', () => {
    it('should show uploading status with spinner animation class', () => {
      const { container } = render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 50, status: 'uploading' },
            { id: '2', name: 'file2.png', progress: 0, status: 'pending' }
          ]}
          totalProgress={25}
        />
      )

      // Check for spinner (animate-spin class)
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should show completed status with green checkmark', () => {
      const { container } = render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
            { id: '2', name: 'file2.png', progress: 100, status: 'completed' }
          ]}
          totalProgress={100}
        />
      )

      // Check for green checkmark (text-green-500 class)
      const checkmarks = container.querySelectorAll('.text-green-500')
      expect(checkmarks.length).toBeGreaterThan(0)
    })

    it('should show error status with red X', () => {
      const { container } = render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 0, status: 'error', error: 'Upload failed' },
            { id: '2', name: 'file2.png', progress: 100, status: 'completed' }
          ]}
          totalProgress={50}
        />
      )

      // Check for red error icon (text-red-500 class)
      const errorIcons = container.querySelectorAll('.text-red-500')
      expect(errorIcons.length).toBeGreaterThan(0)
    })

    it('should show pending status with gray circle', () => {
      const { container } = render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 0, status: 'pending' },
            { id: '2', name: 'file2.png', progress: 0, status: 'pending' }
          ]}
          totalProgress={0}
        />
      )

      // Check for gray circle (bg-gray-600 class)
      const pendingIndicators = container.querySelectorAll('.bg-gray-600')
      expect(pendingIndicators.length).toBeGreaterThan(0)
    })

    it('should display "Err" instead of percentage for error status', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 0, status: 'error', error: 'Too large' },
            { id: '2', name: 'file2.png', progress: 100, status: 'completed' }
          ]}
          totalProgress={50}
        />
      )

      expect(screen.getByText('Err')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when any file has error', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
            { id: '2', name: 'file2.png', progress: 0, status: 'error', error: 'File too large' }
          ]}
          totalProgress={50}
        />
      )

      expect(screen.getByText('Some files failed to upload')).toBeInTheDocument()
    })

    it('should not display error message when no files have error', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' },
            { id: '2', name: 'file2.png', progress: 50, status: 'uploading' }
          ]}
          totalProgress={75}
        />
      )

      expect(screen.queryByText('Some files failed to upload')).not.toBeInTheDocument()
    })

    it('should show red progress bar when there are errors', () => {
      const { container } = render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 0, status: 'error' }
          ]}
          totalProgress={100}
        />
      )

      // Check for red progress bar (bg-red-500 class)
      const redProgressBar = container.querySelector('.bg-red-500')
      expect(redProgressBar).toBeInTheDocument()
    })

    it('should show blue progress bar when no errors', () => {
      const { container } = render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 50, status: 'uploading' }
          ]}
          totalProgress={50}
        />
      )

      // Check for blue progress bar (bg-blue-500 class)
      const blueProgressBar = container.querySelector('.bg-blue-500')
      expect(blueProgressBar).toBeInTheDocument()
    })
  })

  describe('Progress Bar Width', () => {
    it('should set correct width style on progress bar', () => {
      const { container } = render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 75, status: 'uploading' }
          ]}
          totalProgress={75}
        />
      )

      // Check for progress bar with 75% width
      const progressBar = container.querySelector('[style*="width: 75%"]')
      expect(progressBar).toBeInTheDocument()
    })

    it('should show 0% width for pending files', () => {
      const { container } = render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 0, status: 'pending' },
            { id: '2', name: 'file2.png', progress: 0, status: 'pending' }
          ]}
          totalProgress={0}
        />
      )

      const progressBar = container.querySelector('[style*="width: 0%"]')
      expect(progressBar).toBeInTheDocument()
    })

    it('should show 100% width for completed files', () => {
      const { container } = render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 100, status: 'completed' }
          ]}
          totalProgress={100}
        />
      )

      const progressBar = container.querySelector('[style*="width: 100%"]')
      expect(progressBar).toBeInTheDocument()
    })
  })

  describe('Progress Rounding', () => {
    it('should round progress percentage to nearest integer', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 33.33, status: 'uploading' }
          ]}
          totalProgress={33.33}
        />
      )

      // Should display 33% (rounded from 33.33)
      expect(screen.getByText('33%')).toBeInTheDocument()
    })

    it('should round up when progress is .5 or higher', () => {
      render(
        <UploadProgress
          files={[
            { id: '1', name: 'file1.jpg', progress: 66.67, status: 'uploading' }
          ]}
          totalProgress={66.67}
        />
      )

      // Should display 67% (rounded from 66.67)
      expect(screen.getByText('67%')).toBeInTheDocument()
    })
  })
})
