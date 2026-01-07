module.exports = {
  apps: [
    {
      name: 'seeder',
      script: 'npm',
      args: 'start',
      cwd: '/home/xin/apps/seeder',
      env: {
        NODE_ENV: 'production',
        PORT: 38964,
      },
      // 实例数量 (使用 cluster 模式可以启用多实例)
      instances: 1,
      exec_mode: 'fork',

      // 自动重启
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',

      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/xin/apps/seeder/logs/error.log',
      out_file: '/home/xin/apps/seeder/logs/out.log',
      merge_logs: true,

      // 健康检查
      min_uptime: '10s',
      max_restarts: 10,
    },
  ],
}
