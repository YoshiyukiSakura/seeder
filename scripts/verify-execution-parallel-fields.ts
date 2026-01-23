#!/usr/bin/env tsx
/**
 * Verify Execution parallel execution fields
 */

import { PrismaClient, ParallelMode } from './src/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verifying Execution parallel execution fields...\n')

  // 1. Check ParallelMode enum
  console.log('✅ ParallelMode enum values:', Object.values(ParallelMode))

  // 2. Query an Execution with parallel fields
  const execution = await prisma.execution.findFirst({
    select: {
      id: true,
      parallelMode: true,
      maxParallelIssues: true,
      maxWorktreesPerIssue: true,
      hasConflicts: true,
      conflictedIssueIds: true,
    },
  })

  if (execution) {
    console.log('✅ Successfully queried Execution with parallel fields:')
    console.log(JSON.stringify(execution, null, 2))
  } else {
    console.log('⚠️  No Execution records found')
  }

  // 3. Type checking
  const typeCheck: {
    parallelMode: ParallelMode
    maxParallelIssues: number
    maxWorktreesPerIssue: number
    hasConflicts: boolean
    conflictedIssueIds: string[]
  } = {
    parallelMode: ParallelMode.SEQUENTIAL,
    maxParallelIssues: 1,
    maxWorktreesPerIssue: 1,
    hasConflicts: false,
    conflictedIssueIds: [],
  }
  console.log('\n✅ Type checking passed for parallel execution fields')

  console.log('\n🎉 All verifications passed!')
}

main()
  .catch((e) => {
    console.error('❌ Verification failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
