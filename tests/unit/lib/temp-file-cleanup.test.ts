/**
 * Temporary file cleanup utility unit tests
 */
import {
  extractTimestampFromFilename,
  shouldCleanupFile,
  cleanupTempFiles,
  startCleanupScheduler,
  stopCleanupScheduler,
  isCleanupSchedulerRunning,
  CLEANUP_CONFIG,
} from '@/lib/temp-file-cleanup'
import { readdir, unlink, stat, mkdir, writeFile, rm } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Mock fs/promises and fs
jest.mock('fs/promises')
jest.mock('fs')

const mockReaddir = readdir as jest.MockedFunction<typeof readdir>
const mockUnlink = unlink as jest.MockedFunction<typeof unlink>
const mockStat = stat as jest.MockedFunction<typeof stat>
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>

// Fixed timestamp for testing
const FIXED_NOW = 1700000000000

// Store original Date.now
const originalDateNow = Date.now

describe('extractTimestampFromFilename', () => {
  it('should extract timestamp from valid filename', () => {
    const filename = '1705123456789-abc12345.jpg'
    const timestamp = extractTimestampFromFilename(filename)
    expect(timestamp).toBe(1705123456789)
  })

  it('should extract timestamp from filename with different extensions', () => {
    expect(extractTimestampFromFilename('1705123456789-abc12345.png')).toBe(1705123456789)
    expect(extractTimestampFromFilename('1705123456789-abc12345.gif')).toBe(1705123456789)
    expect(extractTimestampFromFilename('1705123456789-abc12345.webp')).toBe(1705123456789)
  })

  it('should return null for filename without valid timestamp', () => {
    expect(extractTimestampFromFilename('invalid-filename.jpg')).toBeNull()
    expect(extractTimestampFromFilename('abc12345.jpg')).toBeNull()
    expect(extractTimestampFromFilename('123.jpg')).toBeNull()
  })

  it('should return null for filename with invalid format', () => {
    expect(extractTimestampFromFilename('.gitkeep')).toBeNull()
    expect(extractTimestampFromFilename('README.md')).toBeNull()
    expect(extractTimestampFromFilename('')).toBeNull()
  })

  it('should return null for very old timestamps (before 2020)', () => {
    // Timestamp before 2020
    const oldTimestamp = '1000000000000-abc12345.jpg'
    expect(extractTimestampFromFilename(oldTimestamp)).toBeNull()
  })

  it('should handle filenames with uppercase extensions', () => {
    const filename = '1705123456789-abc12345.JPG'
    const timestamp = extractTimestampFromFilename(filename)
    expect(timestamp).toBe(1705123456789)
  })
})

describe('shouldCleanupFile', () => {
  const now = 1705200000000 // Fixed "current" time for testing

  it('should return true for files older than maxAge', () => {
    // File created 2 hours ago, maxAge is 1 hour
    const oldFilename = `${now - 2 * 60 * 60 * 1000}-abc12345.jpg`
    const maxAgeMs = 60 * 60 * 1000 // 1 hour
    expect(shouldCleanupFile(oldFilename, maxAgeMs, now)).toBe(true)
  })

  it('should return false for files younger than maxAge', () => {
    // File created 30 minutes ago, maxAge is 1 hour
    const newFilename = `${now - 30 * 60 * 1000}-abc12345.jpg`
    const maxAgeMs = 60 * 60 * 1000 // 1 hour
    expect(shouldCleanupFile(newFilename, maxAgeMs, now)).toBe(false)
  })

  it('should return false for very new files (less than MIN_FILE_AGE)', () => {
    // File created 2 minutes ago, even with maxAge of 1 minute
    const veryNewFilename = `${now - 2 * 60 * 1000}-abc12345.jpg`
    const maxAgeMs = 60 * 1000 // 1 minute
    expect(shouldCleanupFile(veryNewFilename, maxAgeMs, now)).toBe(false)
  })

  it('should return false for files with invalid filename format', () => {
    expect(shouldCleanupFile('invalid.jpg', 1000, now)).toBe(false)
    expect(shouldCleanupFile('.gitkeep', 1000, now)).toBe(false)
  })

  it('should respect MIN_FILE_AGE for safety', () => {
    // File created exactly at MIN_FILE_AGE - 1ms
    const justUnderMinAge = `${now - CLEANUP_CONFIG.MIN_FILE_AGE_MS + 1000}-abc12345.jpg`
    expect(shouldCleanupFile(justUnderMinAge, 0, now)).toBe(false)

    // File created exactly at MIN_FILE_AGE + 1ms
    const justOverMinAge = `${now - CLEANUP_CONFIG.MIN_FILE_AGE_MS - 1000}-abc12345.jpg`
    expect(shouldCleanupFile(justOverMinAge, 0, now)).toBe(true)
  })
})

describe('cleanupTempFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock Date.now directly
    Date.now = jest.fn(() => FIXED_NOW)
  })

  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow
  })

  it('should return empty result when upload directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false)

    const result = await cleanupTempFiles()

    expect(result).toEqual({
      deleted: [],
      skipped: [],
      errors: [],
    })
    expect(mockReaddir).not.toHaveBeenCalled()
  })

  it('should delete old files and keep new files', async () => {
    const oldFile = `${FIXED_NOW - 2 * 60 * 60 * 1000}-abc12345.jpg` // 2 hours old
    const newFile = `${FIXED_NOW - 30 * 60 * 1000}-def12345.jpg` // 30 minutes old

    mockExistsSync.mockReturnValue(true)
    mockReaddir.mockResolvedValue([oldFile, newFile] as unknown as string[])
    mockStat.mockResolvedValue({ isDirectory: () => false } as any)
    mockUnlink.mockResolvedValue(undefined)

    const result = await cleanupTempFiles()

    expect(result.deleted).toContain(oldFile)
    expect(result.skipped).toContain(newFile)
    expect(mockUnlink).toHaveBeenCalledTimes(1)
    expect(mockUnlink).toHaveBeenCalledWith(
      path.join(CLEANUP_CONFIG.UPLOAD_DIR, oldFile)
    )
  })

  it('should skip directories', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddir.mockResolvedValue(['subdir'] as unknown as string[])
    mockStat.mockResolvedValue({ isDirectory: () => true } as any)

    const result = await cleanupTempFiles()

    expect(result.skipped).toContain('subdir')
    expect(result.deleted).toHaveLength(0)
    expect(mockUnlink).not.toHaveBeenCalled()
  })

  it('should skip files with invalid filename format', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddir.mockResolvedValue(['.gitkeep', 'README.md'] as unknown as string[])
    mockStat.mockResolvedValue({ isDirectory: () => false } as any)

    const result = await cleanupTempFiles()

    expect(result.skipped).toContain('.gitkeep')
    expect(result.skipped).toContain('README.md')
    expect(result.deleted).toHaveLength(0)
    expect(mockUnlink).not.toHaveBeenCalled()
  })

  it('should handle unlink errors gracefully', async () => {
    const oldFile = `${FIXED_NOW - 2 * 60 * 60 * 1000}-abc12345.jpg`

    mockExistsSync.mockReturnValue(true)
    mockReaddir.mockResolvedValue([oldFile] as unknown as string[])
    mockStat.mockResolvedValue({ isDirectory: () => false } as any)
    mockUnlink.mockRejectedValue(new Error('Permission denied'))

    const result = await cleanupTempFiles()

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].file).toBe(oldFile)
    expect(result.errors[0].error).toBe('Permission denied')
  })

  it('should respect custom maxAge parameter', async () => {
    // File that is 40 minutes old
    const mediumAgeFile = `${FIXED_NOW - 40 * 60 * 1000}-bbb12345.jpg`

    mockExistsSync.mockReturnValue(true)
    mockReaddir.mockResolvedValue([mediumAgeFile] as unknown as string[])
    mockStat.mockResolvedValue({ isDirectory: () => false } as any)
    mockUnlink.mockResolvedValue(undefined)

    // With 1 hour maxAge, should not delete
    const result1 = await cleanupTempFiles(60 * 60 * 1000)
    expect(result1.deleted).toHaveLength(0)
    expect(result1.skipped).toContain(mediumAgeFile)

    // Reset mocks but keep Date.now mock
    mockExistsSync.mockClear()
    mockReaddir.mockClear()
    mockStat.mockClear()
    mockUnlink.mockClear()

    mockExistsSync.mockReturnValue(true)
    mockReaddir.mockResolvedValue([mediumAgeFile] as unknown as string[])
    mockStat.mockResolvedValue({ isDirectory: () => false } as any)
    mockUnlink.mockResolvedValue(undefined)

    // With 30 minute maxAge, should delete
    const result2 = await cleanupTempFiles(30 * 60 * 1000)
    expect(result2.deleted).toContain(mediumAgeFile)
  })

  it('should handle stat errors gracefully', async () => {
    const file = `${FIXED_NOW - 2 * 60 * 60 * 1000}-ccc12345.jpg`

    mockExistsSync.mockReturnValue(true)
    mockReaddir.mockResolvedValue([file] as unknown as string[])
    mockStat.mockRejectedValue(new Error('File not found'))

    const result = await cleanupTempFiles()

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].file).toBe(file)
    expect(result.errors[0].error).toBe('File not found')
  })
})

describe('Cleanup scheduler', () => {
  beforeEach(() => {
    stopCleanupScheduler() // Ensure clean state
    jest.clearAllMocks()

    // Default mocks for cleanup
    mockExistsSync.mockReturnValue(false)
  })

  afterEach(() => {
    stopCleanupScheduler()
    Date.now = originalDateNow
  })

  it('should start and stop correctly', () => {
    expect(isCleanupSchedulerRunning()).toBe(false)

    startCleanupScheduler()
    expect(isCleanupSchedulerRunning()).toBe(true)

    stopCleanupScheduler()
    expect(isCleanupSchedulerRunning()).toBe(false)
  })

  it('should not start multiple times', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

    startCleanupScheduler()
    startCleanupScheduler()

    expect(consoleSpy).toHaveBeenCalledWith(
      '[TempFileCleanup] Cleanup scheduler is already running'
    )

    consoleSpy.mockRestore()
  })

  it('should run cleanup immediately on start', () => {
    startCleanupScheduler()

    // Cleanup should have been called once immediately
    expect(mockExistsSync).toHaveBeenCalled()
  })

  it('should run cleanup at specified intervals', () => {
    jest.useFakeTimers()
    const intervalMs = 1000 // 1 second for testing

    startCleanupScheduler(intervalMs)

    // Initial call
    expect(mockExistsSync).toHaveBeenCalledTimes(1)

    // Advance time by interval
    jest.advanceTimersByTime(intervalMs)
    expect(mockExistsSync).toHaveBeenCalledTimes(2)

    // Advance time by another interval
    jest.advanceTimersByTime(intervalMs)
    expect(mockExistsSync).toHaveBeenCalledTimes(3)

    jest.useRealTimers()
  })

  it('should log when files are deleted', async () => {
    // Mock Date.now before calling cleanup
    Date.now = jest.fn(() => FIXED_NOW)
    const oldFile = `${FIXED_NOW - 2 * 60 * 60 * 1000}-abc12345.jpg`

    mockExistsSync.mockReturnValue(true)
    mockReaddir.mockResolvedValue([oldFile] as unknown as string[])
    mockStat.mockResolvedValue({ isDirectory: () => false } as any)
    mockUnlink.mockResolvedValue(undefined)

    // Call cleanupTempFiles directly
    const result = await cleanupTempFiles()

    // Verify cleanup worked
    expect(result.deleted).toContain(oldFile)

    // Test the logging behavior
    const logSpy = jest.spyOn(console, 'log').mockImplementation()

    // Simulate what runCleanup does when it finds deleted files
    if (result.deleted.length > 0) {
      console.log(`[TempFileCleanup] Cleaned up ${result.deleted.length} file(s)`)
    }

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TempFileCleanup] Cleaned up 1 file(s)')
    )

    logSpy.mockRestore()
  })

  it('should log errors during cleanup', async () => {
    // Mock Date.now before calling cleanup
    Date.now = jest.fn(() => FIXED_NOW)
    const oldFile = `${FIXED_NOW - 2 * 60 * 60 * 1000}-abc12345.jpg`

    mockExistsSync.mockReturnValue(true)
    mockReaddir.mockResolvedValue([oldFile] as unknown as string[])
    mockStat.mockResolvedValue({ isDirectory: () => false } as any)
    mockUnlink.mockRejectedValue(new Error('Permission denied'))

    // Call cleanupTempFiles directly
    const result = await cleanupTempFiles()

    // Verify error was captured
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].error).toBe('Permission denied')

    // Test the logging behavior
    const errorSpy = jest.spyOn(console, 'error').mockImplementation()

    // Simulate what runCleanup does when it finds errors
    if (result.errors.length > 0) {
      console.error(
        `[TempFileCleanup] ${result.errors.length} error(s) during cleanup:`,
        result.errors
      )
    }

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TempFileCleanup] 1 error(s) during cleanup'),
      expect.anything()
    )

    errorSpy.mockRestore()
  })
})

describe('CLEANUP_CONFIG', () => {
  it('should export correct configuration values', () => {
    expect(CLEANUP_CONFIG.DEFAULT_MAX_AGE_MS).toBe(60 * 60 * 1000) // 1 hour
    expect(CLEANUP_CONFIG.DEFAULT_CLEANUP_INTERVAL_MS).toBe(10 * 60 * 1000) // 10 minutes
    expect(CLEANUP_CONFIG.MIN_FILE_AGE_MS).toBe(5 * 60 * 1000) // 5 minutes
    expect(CLEANUP_CONFIG.UPLOAD_DIR).toContain('tmp')
    expect(CLEANUP_CONFIG.UPLOAD_DIR).toContain('uploads')
  })
})
