/**
 * 统计视图测试脚本
 * 用于验证所有统计视图是否正常工作
 */

import { stats } from './src/lib/statistics'

async function testStatistics() {
  console.log('开始测试统计视图...\n')

  try {
    // 1. 测试系统概览统计
    console.log('1. 测试系统概览统计...')
    const overview = await stats.getSystemOverview()
    console.log('系统概览:', {
      ...overview,
      totalUsers: overview?.totalUsers.toString(),
      totalProjects: overview?.totalProjects.toString(),
      totalPlans: overview?.totalPlans.toString(),
      totalMasterPlans: overview?.totalMasterPlans.toString(),
      totalTasks: overview?.totalTasks.toString(),
      totalConversations: overview?.totalConversations.toString(),
      totalExecutions: overview?.totalExecutions.toString(),
      totalIssueExecutions: overview?.totalIssueExecutions.toString()
    })
    console.log('✓ 系统概览统计测试通过\n')

    // 2. 测试计划状态分布
    console.log('2. 测试计划状态分布...')
    const planStatus = await stats.getPlanStatusDistribution()
    console.log('计划状态分布:')
    planStatus.forEach(s => {
      console.log(`  - ${s.status}: ${s.count.toString()} (${s.percentage}%)`)
    })
    console.log('✓ 计划状态分布测试通过\n')

    // 3. 测试主计划状态分布
    console.log('3. 测试主计划状态分布...')
    const masterPlanStatus = await stats.getMasterPlanStatusDistribution()
    console.log('主计划状态分布:')
    masterPlanStatus.forEach(s => {
      console.log(`  - ${s.status}: ${s.count.toString()} (${s.percentage}%)`)
    })
    console.log('✓ 主计划状态分布测试通过\n')

    // 4. 测试任务优先级分布
    console.log('4. 测试任务优先级分布...')
    const taskPriority = await stats.getTaskPriorityDistribution()
    console.log('任务优先级分布:')
    taskPriority.forEach(p => {
      console.log(`  - Priority ${p.priority}: ${p.taskCount.toString()} tasks (${p.percentage}%), ` +
                  `总工时: ${p.totalEstimateHours}h, 平均: ${p.avgEstimateHours.toFixed(2)}h`)
    })
    console.log('✓ 任务优先级分布测试通过\n')

    // 5. 测试执行状态分布
    console.log('5. 测试执行状态分布...')
    const executionStatus = await stats.getExecutionStatusDistribution()
    console.log('执行状态分布:')
    executionStatus.forEach(s => {
      console.log(`  - ${s.status}: ${s.count.toString()} (${s.percentage}%)`)
    })
    console.log('✓ 执行状态分布测试通过\n')

    // 6. 测试任务执行状态分布
    console.log('6. 测试任务执行状态分布...')
    const issueExecutionStatus = await stats.getIssueExecutionStatusDistribution()
    console.log('任务执行状态分布:')
    issueExecutionStatus.forEach(s => {
      console.log(`  - ${s.status}: ${s.count.toString()} (${s.percentage}%)`)
    })
    console.log('✓ 任务执行状态分布测试通过\n')

    // 7. 测试用户统计
    console.log('7. 测试用户统计...')
    const userStats = await stats.getAllUserStatistics()
    console.log(`找到 ${userStats.length} 个用户的统计数据`)
    if (userStats.length > 0) {
      const firstUser = userStats[0]
      console.log('第一个用户统计示例:')
      console.log(`  - 用户: ${firstUser.username}`)
      console.log(`  - 项目数: ${firstUser.projectCount.toString()}`)
      console.log(`  - 计划数: ${firstUser.planCount.toString()}`)
      console.log(`  - 任务数: ${firstUser.taskCount.toString()}`)
      console.log(`  - 总工时: ${firstUser.totalEstimateHours}h`)
    }
    console.log('✓ 用户统计测试通过\n')

    // 8. 测试项目统计
    console.log('8. 测试项目统计...')
    const projectStats = await stats.getAllProjectStatistics()
    console.log(`找到 ${projectStats.length} 个项目的统计数据`)
    if (projectStats.length > 0) {
      const firstProject = projectStats[0]
      console.log('第一个项目统计示例:')
      console.log(`  - 项目: ${firstProject.projectName}`)
      console.log(`  - 计划数: ${firstProject.planCount.toString()}`)
      console.log(`  - 任务数: ${firstProject.taskCount.toString()}`)
      console.log(`  - 总工时: ${firstProject.totalEstimateHours}h`)
    }
    console.log('✓ 项目统计测试通过\n')

    // 9. 测试计划统计
    console.log('9. 测试计划统计...')
    const planStats = await stats.getAllPlanStatistics()
    console.log(`找到 ${planStats.length} 个计划的统计数据`)
    if (planStats.length > 0) {
      const firstPlan = planStats[0]
      console.log('第一个计划统计示例:')
      console.log(`  - 计划: ${firstPlan.planName}`)
      console.log(`  - 状态: ${firstPlan.planStatus}`)
      console.log(`  - 任务数: ${firstPlan.taskCount.toString()}`)
      console.log(`  - 总工时: ${firstPlan.totalEstimateHours}h`)
    }
    console.log('✓ 计划统计测试通过\n')

    // 10. 测试任务标签分布
    console.log('10. 测试任务标签分布...')
    const labelDistribution = await stats.getTaskLabelDistribution()
    console.log(`找到 ${labelDistribution.length} 个不同的标签`)
    if (labelDistribution.length > 0) {
      console.log('前5个最常用标签:')
      labelDistribution.slice(0, 5).forEach(l => {
        console.log(`  - ${l.label}: ${l.taskCount.toString()} tasks (${l.percentage}%)`)
      })
    }
    console.log('✓ 任务标签分布测试通过\n')

    // 11. 测试每日创建趋势
    console.log('11. 测试每日创建趋势...')
    const dailyTrend = await stats.getDailyCreationTrend(7)
    console.log(`最近7天的创建趋势 (共 ${dailyTrend.length} 条记录)`)
    if (dailyTrend.length > 0) {
      console.log('前5条记录:')
      dailyTrend.slice(0, 5).forEach(t => {
        console.log(`  - ${t.date.toISOString().split('T')[0]}: ${t.entity_type} - ${t.count.toString()}`)
      })
    }
    console.log('✓ 每日创建趋势测试通过\n')

    // 12. 测试完整仪表板数据
    console.log('12. 测试完整仪表板数据...')
    const dashboard = await stats.getDashboardData()
    console.log('仪表板数据结构验证:')
    console.log(`  - 概览数据: ${dashboard.overview ? '✓' : '✗'}`)
    console.log(`  - 计划状态分布: ${dashboard.distributions.planStatus.length} 个状态`)
    console.log(`  - 任务优先级分布: ${dashboard.distributions.taskPriority.length} 个优先级`)
    console.log(`  - 执行状态分布: ${dashboard.distributions.executionStatus.length} 个状态`)
    console.log('✓ 完整仪表板数据测试通过\n')

    console.log('==================================')
    console.log('所有测试通过! ✓')
    console.log('==================================')

  } catch (error) {
    console.error('测试失败:', error)
    process.exit(1)
  }
}

// 运行测试
testStatistics()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('未处理的错误:', error)
    process.exit(1)
  })
