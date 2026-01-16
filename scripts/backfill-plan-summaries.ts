/**
 * 回填脚本：为已发布的 Plans 生成摘要
 *
 * 此脚本会查找所有已发布但没有 summary 的 Plans，
 * 使用 DeepSeek API 生成摘要并更新数据库。
 *
 * 运行方式：
 * npx tsx scripts/backfill-plan-summaries.ts
 *
 * 环境变量要求：
 * - DEEPSEEK_API_KEY: DeepSeek API 密钥
 * - DATABASE_URL: 数据库连接字符串
 */

import { prisma } from '../src/lib/prisma'
import { generatePlanSummary } from '../src/lib/summary-generator'

async function main() {
  console.log('Starting backfill: Generate summaries for published plans')

  // 查找所有已发布但没有 summary 的 Plans
  const plansToUpdate = await prisma.plan.findMany({
    where: {
      status: 'PUBLISHED',
      summary: null,
    },
    select: {
      id: true,
      name: true,
    },
  })

  console.log(`Found ${plansToUpdate.length} plans without summary`)

  if (plansToUpdate.length === 0) {
    console.log('Nothing to do, all published plans have summaries')
    return
  }

  let successCount = 0
  let failedCount = 0

  for (const plan of plansToUpdate) {
    console.log(`\nProcessing plan: ${plan.id} (${plan.name.slice(0, 50)}...)`)

    try {
      const summary = await generatePlanSummary(plan.id)

      await prisma.plan.update({
        where: { id: plan.id },
        data: { summary },
      })

      console.log(`  Success: ${summary.slice(0, 100)}...`)
      successCount++

      // 添加延迟避免 API 限流
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`  Failed:`, error instanceof Error ? error.message : error)
      failedCount++
    }
  }

  console.log('\n--- Backfill Summary ---')
  console.log(`Total plans processed: ${plansToUpdate.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Failed: ${failedCount}`)
  console.log('Backfill complete!')
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
