/**
 * project-scanner.ts 单元测试
 */

import { scanLocalProjects, getProjectDetails, type LocalProject, type ProjectDetails } from '@/lib/project-scanner'
import { readdir, stat, readFile, access } from 'fs/promises'

// Mock fs/promises
jest.mock('fs/promises')

const mockReaddir = readdir as jest.MockedFunction<typeof readdir>
const mockStat = stat as jest.MockedFunction<typeof stat>
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>
const mockAccess = access as jest.MockedFunction<typeof access>

describe('project-scanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('scanLocalProjects', () => {
    it('should return empty array if root directory does not exist', async () => {
      mockAccess.mockRejectedValue(new Error('ENOENT'))

      const result = await scanLocalProjects('/nonexistent')

      expect(result).toEqual([])
    })

    it('should skip hidden directories', async () => {
      mockAccess.mockResolvedValue(undefined)
      mockReaddir.mockResolvedValue(['.git', '.hidden', 'valid-project'] as unknown as string[])
      mockStat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date('2024-01-01'),
      } as unknown as ReturnType<typeof stat>)
      mockAccess.mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('package.json')) {
          return Promise.resolve(undefined)
        }
        return Promise.reject(new Error('ENOENT'))
      })
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'valid-project',
        description: 'A test project',
        dependencies: { react: '^18.0.0' }
      }))

      const result = await scanLocalProjects('/data/repos')

      // 应该只处理 valid-project，跳过 .git 和 .hidden
      expect(result.length).toBeLessThanOrEqual(1)
    })

    it('should extract tech stack from package.json', async () => {
      mockAccess.mockImplementation((path) => {
        if (typeof path === 'string') {
          if (path === '/data/repos') return Promise.resolve(undefined)
          if (path.includes('package.json')) return Promise.resolve(undefined)
          if (path.includes('.git')) return Promise.resolve(undefined)
        }
        return Promise.reject(new Error('ENOENT'))
      })
      mockReaddir.mockResolvedValue(['my-nextjs-app'] as unknown as string[])
      mockStat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date('2024-01-15'),
      } as unknown as ReturnType<typeof stat>)
      mockReadFile.mockResolvedValue(JSON.stringify({
        name: 'my-nextjs-app',
        description: 'A Next.js app',
        dependencies: {
          next: '^14.0.0',
          react: '^18.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          tailwindcss: '^3.0.0',
        }
      }))

      const result = await scanLocalProjects('/data/repos')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('my-nextjs-app')
      expect(result[0].techStack).toContain('Next.js')
      expect(result[0].techStack).toContain('React')
      expect(result[0].techStack).toContain('TypeScript')
      expect(result[0].techStack).toContain('Tailwind CSS')
      expect(result[0].hasGit).toBe(true)
    })

    it('should detect non-Node.js projects', async () => {
      mockAccess.mockImplementation((path) => {
        if (typeof path === 'string') {
          if (path === '/data/repos') return Promise.resolve(undefined)
          if (path.includes('Cargo.toml')) return Promise.resolve(undefined)
          if (path.includes('.git')) return Promise.resolve(undefined)
        }
        return Promise.reject(new Error('ENOENT'))
      })
      mockReaddir.mockResolvedValue(['rust-project'] as unknown as string[])
      mockStat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date('2024-01-10'),
      } as unknown as ReturnType<typeof stat>)

      const result = await scanLocalProjects('/data/repos')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('rust-project')
      expect(result[0].techStack).toContain('Rust')
    })

    it('should sort projects by last modified date (newest first)', async () => {
      mockAccess.mockImplementation((path) => {
        if (typeof path === 'string') {
          if (path === '/data/repos') return Promise.resolve(undefined)
          if (path.includes('package.json')) return Promise.resolve(undefined)
        }
        return Promise.reject(new Error('ENOENT'))
      })
      mockReaddir.mockResolvedValue(['old-project', 'new-project'] as unknown as string[])
      mockStat.mockImplementation((path) => {
        const isNew = typeof path === 'string' && path.includes('new-project')
        return Promise.resolve({
          isDirectory: () => true,
          mtime: new Date(isNew ? '2024-02-01' : '2024-01-01'),
        } as unknown as ReturnType<typeof stat>)
      })
      mockReadFile.mockResolvedValue(JSON.stringify({ name: 'test', dependencies: {} }))

      const result = await scanLocalProjects('/data/repos')

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('new-project')
      expect(result[1].name).toBe('old-project')
    })
  })

  describe('getProjectDetails', () => {
    it('should return null for non-existent project', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'))

      const result = await getProjectDetails('/nonexistent')

      expect(result).toBeNull()
    })

    it('should include README content', async () => {
      mockStat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date('2024-01-15'),
      } as unknown as ReturnType<typeof stat>)
      mockAccess.mockImplementation((path) => {
        if (typeof path === 'string') {
          if (path.includes('package.json')) return Promise.resolve(undefined)
          if (path.includes('.git')) return Promise.resolve(undefined)
          if (path.includes('README.md')) return Promise.resolve(undefined)
        }
        return Promise.reject(new Error('ENOENT'))
      })
      mockReadFile.mockImplementation((path) => {
        if (typeof path === 'string') {
          if (path.includes('package.json')) {
            return Promise.resolve(JSON.stringify({
              name: 'test-project',
              description: 'A test project',
              dependencies: { react: '^18.0.0' },
              devDependencies: { typescript: '^5.0.0' },
            }))
          }
          if (path.includes('README.md')) {
            return Promise.resolve('# Test Project\n\nThis is a test project.')
          }
        }
        return Promise.reject(new Error('ENOENT'))
      })

      const result = await getProjectDetails('/data/repos/test-project')

      expect(result).not.toBeNull()
      expect(result?.readme).toContain('# Test Project')
      expect(result?.dependencies).toHaveProperty('react')
      expect(result?.devDependencies).toHaveProperty('typescript')
    })

    it('should truncate long README content', async () => {
      mockStat.mockResolvedValue({
        isDirectory: () => true,
        mtime: new Date('2024-01-15'),
      } as unknown as ReturnType<typeof stat>)
      mockAccess.mockImplementation((path) => {
        if (typeof path === 'string') {
          if (path.includes('package.json')) return Promise.resolve(undefined)
          if (path.includes('README.md')) return Promise.resolve(undefined)
        }
        return Promise.reject(new Error('ENOENT'))
      })
      mockReadFile.mockImplementation((path) => {
        if (typeof path === 'string') {
          if (path.includes('package.json')) {
            return Promise.resolve(JSON.stringify({ name: 'test', dependencies: {} }))
          }
          if (path.includes('README.md')) {
            // 创建一个超长的 README
            return Promise.resolve('A'.repeat(5000))
          }
        }
        return Promise.reject(new Error('ENOENT'))
      })

      const result = await getProjectDetails('/data/repos/test-project')

      expect(result).not.toBeNull()
      expect(result?.readme?.length).toBeLessThanOrEqual(2000)
    })
  })
})
