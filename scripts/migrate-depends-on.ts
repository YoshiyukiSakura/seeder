/**
 * 数据迁移脚本：将 dependsOnId 迁移到 blockedByIds
 *
 * 此脚本将所有使用 dependsOnId 的任务的值迁移到 blockedByIds 数组中，
 * 确保向后兼容性。
 *
 * 运行方式：
 * npx tsx scripts/migrate-depends-on.ts
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Starting migration: dependsOnId -> blockedByIds')

  // 查找所有有 dependsOnId 的任务
  const tasksWithDependsOn = await prisma.task.findMany({
    where: {
      dependsOnId: { not: null },
    },
  })

  console.log(`Found ${tasksWithDependsOn.length} tasks with dependsOnId`)

  let migratedCount = 0
  let skippedCount = 0

  for (const task of tasksWithDependsOn) {
    if (!task.dependsOnId) continue

    // 检查 dependsOnId 是否已经在 blockedByIds 中
    if (task.blockedByIds.includes(task.dependsOnId)) {
      console.log(`Task ${task.id}: dependsOnId already in blockedByIds, skipping`)
      skippedCount++
      continue
    }

    // 将 dependsOnId 添加到 blockedByIds
    await prisma.task.update({
      where: { id: task.id },
      data: {
        blockedByIds: [...task.blockedByIds, task.dependsOnId],
      },
    })

    console.log(`Task ${task.id}: migrated dependsOnId "${task.dependsOnId}" to blockedByIds`)
    migratedCount++
  }

  console.log('\n--- Migration Summary ---')
  console.log(`Total tasks with dependsOnId: ${tasksWithDependsOn.length}`)
  console.log(`Migrated: ${migratedCount}`)
  console.log(`Skipped (already migrated): ${skippedCount}`)
  console.log('Migration complete!')
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
