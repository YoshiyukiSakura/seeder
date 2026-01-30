/**
 * Slack 相关工具函数
 */

/**
 * 标准化频道名称
 * - 转小写
 * - 只保留字母、数字、连字符
 * - 合并连续连字符
 * - 移除首尾连字符
 *
 * 注意：此函数在 slack-bot/src/utils/config.ts 中也有一份副本
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
