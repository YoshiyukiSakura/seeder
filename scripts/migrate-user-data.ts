/**
 * 数据清洗脚本：为历史 Plan 和 Conversation 设置用户信息
 * 运行: npx tsx scripts/migrate-user-data.ts
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. 获取默认用户（尝试 yizhou.xin，否则用第一个用户）
  let defaultUser = await prisma.user.findFirst({
    where: { slackUsername: 'yizhou.xin' }
  })

  if (!defaultUser) {
    defaultUser = await prisma.user.findFirst()
  }

  const hanwenUser = await prisma.user.findFirst({
    where: { slackUsername: 'hanwen' }
  })

  if (!defaultUser) {
    console.error('No users found in database!')
    return
  }

  console.log(`Using default user: ${defaultUser.slackUsername} (${defaultUser.id})`)
  if (hanwenUser) {
    console.log(`Found hanwen: ${hanwenUser.id}`)
  } else {
    console.log('hanwen user not found, will only set default user')
  }

  const yizhouUser = defaultUser  // 向后兼容变量名

  // 2. 更新历史 Plan 的 creatorId
  const planUpdateResult = await prisma.plan.updateMany({
    where: { creatorId: null },
    data: { creatorId: yizhouUser.id }
  })
  console.log(`Updated ${planUpdateResult.count} Plans with default creatorId (yizhou.xin)`)

  // 3. 更新 hanwen 的特定 Plan
  const hanwenPlanId = 'cmkw27kpa00ewghqslmws200h'
  if (hanwenUser) {
    const hanwenPlanUpdate = await prisma.plan.update({
      where: { id: hanwenPlanId },
      data: { creatorId: hanwenUser.id }
    }).catch(() => {
      console.log(`Plan ${hanwenPlanId} not found, skipping hanwen plan update`)
      return null
    })

    if (hanwenPlanUpdate) {
      console.log(`Updated Plan ${hanwenPlanId} creatorId to hanwen`)
    }
  }

  // 4. 更新历史 Conversation 的 userId（仅 role='user' 的）
  const convUpdateResult = await prisma.conversation.updateMany({
    where: {
      role: 'user',
      userId: null
    },
    data: { userId: yizhouUser.id }
  })
  console.log(`Updated ${convUpdateResult.count} user Conversations with default userId (yizhou.xin)`)

  // 5. 更新 hanwen 的 plan 下的用户消息
  if (hanwenUser) {
    const hanwenConvUpdate = await prisma.conversation.updateMany({
      where: {
        planId: hanwenPlanId,
        role: 'user'
      },
      data: { userId: hanwenUser.id }
    })
    console.log(`Updated ${hanwenConvUpdate.count} Conversations in hanwen's plan`)
  }

  console.log('\nMigration complete!')

  // 统计信息
  const plansWithCreator = await prisma.plan.count({ where: { creatorId: { not: null } } })
  const totalPlans = await prisma.plan.count()
  const convsWithUser = await prisma.conversation.count({ where: { userId: { not: null } } })
  const totalUserConvs = await prisma.conversation.count({ where: { role: 'user' } })

  console.log(`\nStats:`)
  console.log(`  Plans with creatorId: ${plansWithCreator}/${totalPlans}`)
  console.log(`  User conversations with userId: ${convsWithUser}/${totalUserConvs}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
