/**
 * 共享配置和工具函数
 */

/**
 * 获取 Web 端基础 URL
 */
export function getWebUrl(): string {
  const webUrl = process.env.WEB_URL || 'http://localhost:3000'
  return webUrl.replace(/\/$/, '')
}

/**
 * 生成 Web 端 Plan URL
 */
export function getWebUrlForPlan(planId: string): string {
  return `${getWebUrl()}/?planId=${planId}`
}

/**
 * 生成 Web 端 Plan URL (带消息锚点)
 */
export function getWebUrlForPlanWithMessage(planId: string, messageTs: string): string {
  return `${getWebUrl()}/?planId=${planId}&msg=${messageTs}`
}

/**
 * Slack 消息字符限制
 */
export const SLACK_MESSAGE_LIMIT = 3900  // 留一些余量，实际限制是 4000

/**
 * 标准化频道名称
 * - 转小写
 * - 只保留字母、数字、连字符
 * - 合并连续连字符
 * - 移除首尾连字符
 *
 * 注意：此函数在 src/lib/slack-utils.ts 中也有一份副本
 * 如果修改逻辑，请同步更新两处
 */
export function normalizeChannelName(name: string, maxLength: number = 80): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')  // 替换非法字符为连字符
    .replace(/-+/g, '-')          // 合并连续连字符
    .replace(/^-|-$/g, '')        // 移除首尾连字符
    .slice(0, maxLength)
}
