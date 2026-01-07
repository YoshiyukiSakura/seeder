import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 生产环境部署在 /seeder 子路径
  basePath: process.env.NODE_ENV === 'production' ? '/seeder' : '',

  // 静态资源也使用子路径
  assetPrefix: process.env.NODE_ENV === 'production' ? '/seeder' : '',

  // 输出 standalone 模式，方便部署
  output: 'standalone',
}

export default nextConfig
