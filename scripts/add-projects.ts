/**
 * 添加项目到数据库
 * 运行: npx tsx scripts/add-projects.ts
 */

import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 首先找到一个用户（或创建测试用户）
  let user = await prisma.user.findFirst()

  if (!user) {
    console.log('No user found, creating a dev user...')
    user = await prisma.user.create({
      data: {
        slackUserId: 'dev-user',
        slackUsername: 'Developer',
      }
    })
    console.log('Created user:', user.id)
  } else {
    console.log('Using existing user:', user.slackUsername, user.id)
  }

  // 要添加的项目
  const projectsToAdd = [
    {
      name: 'perp-app',
      description: 'Perpetual trading application - pnpm monorepo',
      localPath: '/Users/yoshiyuki/Documents/GitHub/perp-app',
      techStack: ['TypeScript', 'pnpm', 'Monorepo'],
      gitBranch: 'main',
    },
    {
      name: 'gpt-oss-web',
      description: 'GPT OSS Web - MCP servers and trading middleware',
      localPath: '/Users/yoshiyuki/gpt-oss-web',
      techStack: ['TypeScript', 'JavaScript', 'MCP', 'Node.js'],
      gitBranch: 'main',
    },
  ]

  for (const projectData of projectsToAdd) {
    // 检查是否已存在
    const existing = await prisma.project.findFirst({
      where: { localPath: projectData.localPath }
    })

    if (existing) {
      console.log(`Project already exists: ${projectData.name} (${existing.id})`)
      continue
    }

    const project = await prisma.project.create({
      data: {
        ...projectData,
        userId: user.id,
      }
    })
    console.log(`Created project: ${project.name} (${project.id})`)
  }

  // 列出所有项目
  const allProjects = await prisma.project.findMany()
  console.log('\nAll projects:')
  for (const p of allProjects) {
    console.log(`  - ${p.name}: ${p.localPath}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
