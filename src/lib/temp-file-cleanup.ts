/**
 * 临时文件自动清理模块
 *
 * 定期清理 tmp/uploads 目录中的旧文件
 * 使用文件名中的时间戳判断文件年龄，避免误删正在使用的文件
 */

import { readdir, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// 配置常量
const UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'uploads')
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000 // 默认 1 小时
const DEFAULT_CLEANUP_INTERVAL_MS = 10 * 60 * 1000 // 默认每 10 分钟执行一次清理

// 最小文件年龄，防止删除刚上传的文件（5分钟）
const MIN_FILE_AGE_MS = 5 * 60 * 1000

// 清理任务定时器
let cleanupInterval: ReturnType<typeof setInterval> | null = null

/**
 * 从文件名中提取时间戳
 * 文件名格式: {timestamp}-{randomHex}{.ext}
 * 例如: 1705123456-abc12345.jpg
 */
export function extractTimestampFromFilename(filename: string): number | null {
  const match = filename.match(/^(\d+)-[a-f0-9]+\.[a-z]+$/i)
  if (match) {
    const timestamp = parseInt(match[1], 10)
    // 验证时间戳是合理的（在 2020 年之后）
    if (timestamp > 1577836800000) {
      return timestamp
    }
  }
  return null
}

/**
 * 判断文件是否应该被清理
 * @param filename 文件名
 * @param maxAgeMs 最大文件年龄（毫秒）
 * @param now 当前时间戳
 */
export function shouldCleanupFile(
  filename: string,
  maxAgeMs: number,
  now: number = Date.now()
): boolean {
  const fileTimestamp = extractTimestampFromFilename(filename)

  if (fileTimestamp === null) {
    // 无法识别的文件名格式，跳过不删除
    return false
  }

  const fileAge = now - fileTimestamp

  // 确保文件至少存在了 MIN_FILE_AGE_MS 时间
  if (fileAge < MIN_FILE_AGE_MS) {
    return false
  }

  return fileAge > maxAgeMs
}

/**
 * 清理过期的临时文件
 * @param maxAgeMs 最大文件年龄（毫秒），默认 1 小时
 * @returns 清理结果统计
 */
export async function cleanupTempFiles(
  maxAgeMs: number = DEFAULT_MAX_AGE_MS
): Promise<{
  deleted: string[]
  skipped: string[]
  errors: Array<{ file: string; error: string }>
}> {
  const result = {
    deleted: [] as string[],
    skipped: [] as string[],
    errors: [] as Array<{ file: string; error: string }>,
  }

  // 检查目录是否存在
  if (!existsSync(UPLOAD_DIR)) {
    return result
  }

  try {
    const files = await readdir(UPLOAD_DIR)
    const now = Date.now()

    for (const filename of files) {
      const filePath = path.join(UPLOAD_DIR, filename)

      try {
        // 跳过目录
        const fileStat = await stat(filePath)
        if (fileStat.isDirectory()) {
          result.skipped.push(filename)
          continue
        }

        // 判断是否应该清理
        if (shouldCleanupFile(filename, maxAgeMs, now)) {
          await unlink(filePath)
          result.deleted.push(filename)
        } else {
          result.skipped.push(filename)
        }
      } catch (error) {
        result.errors.push({
          file: filename,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } catch (error) {
    console.error('[TempFileCleanup] Failed to read upload directory:', error)
  }

  return result
}

/**
 * 启动定时清理任务
 * @param intervalMs 清理间隔（毫秒），默认 10 分钟
 * @param maxAgeMs 最大文件年龄（毫秒），默认 1 小时
 */
export function startCleanupScheduler(
  intervalMs: number = DEFAULT_CLEANUP_INTERVAL_MS,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS
): void {
  // 避免重复启动
  if (cleanupInterval !== null) {
    console.warn('[TempFileCleanup] Cleanup scheduler is already running')
    return
  }

  console.log(
    `[TempFileCleanup] Starting cleanup scheduler (interval: ${intervalMs / 1000}s, maxAge: ${maxAgeMs / 1000}s)`
  )

  // 立即执行一次清理
  runCleanup(maxAgeMs)

  // 设置定时任务
  cleanupInterval = setInterval(() => {
    runCleanup(maxAgeMs)
  }, intervalMs)

  // 确保定时器不会阻止进程退出
  cleanupInterval.unref()
}

/**
 * 停止定时清理任务
 */
export function stopCleanupScheduler(): void {
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    console.log('[TempFileCleanup] Cleanup scheduler stopped')
  }
}

/**
 * 检查清理任务是否正在运行
 */
export function isCleanupSchedulerRunning(): boolean {
  return cleanupInterval !== null
}

/**
 * 执行一次清理并记录日志
 */
async function runCleanup(maxAgeMs: number): Promise<void> {
  try {
    const result = await cleanupTempFiles(maxAgeMs)

    if (result.deleted.length > 0) {
      console.log(
        `[TempFileCleanup] Cleaned up ${result.deleted.length} file(s)`
      )
    }

    if (result.errors.length > 0) {
      console.error(
        `[TempFileCleanup] ${result.errors.length} error(s) during cleanup:`,
        result.errors
      )
    }
  } catch (error) {
    console.error('[TempFileCleanup] Cleanup failed:', error)
  }
}

// 导出常量供测试使用
export const CLEANUP_CONFIG = {
  UPLOAD_DIR,
  DEFAULT_MAX_AGE_MS,
  DEFAULT_CLEANUP_INTERVAL_MS,
  MIN_FILE_AGE_MS,
}
