/**
 * Next.js Instrumentation
 *
 * 此文件在 Next.js 服务器启动时执行，用于初始化服务端功能
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 仅在 Node.js 运行时执行（不在 Edge 运行时）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCleanupScheduler } = await import('@/lib/temp-file-cleanup')

    // 启动临时文件清理定时任务
    // 默认每 10 分钟检查一次，清理超过 1 小时的文件
    startCleanupScheduler()
  }
}
