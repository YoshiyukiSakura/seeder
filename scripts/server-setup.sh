#!/bin/bash
# 服务器初始化脚本
# 在服务器上以 xin 用户运行此脚本进行首次设置

set -e

APP_DIR="/home/xin/apps/seeder"
REPO_URL="git@github.com:Wildmeta-ai/seeder.git"

echo "======================================"
echo "Seeder 服务器初始化脚本"
echo "======================================"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js 18+ first"
    exit 1
fi

echo "Node.js version: $(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed"
    exit 1
fi

echo "npm version: $(npm -v)"

# 检查 pm2
if ! command -v pm2 &> /dev/null; then
    echo "Installing pm2 globally..."
    npm install -g pm2
fi

echo "pm2 version: $(pm2 -v)"

# 创建应用目录
mkdir -p /home/xin/apps
cd /home/xin/apps

# Clone 项目（如果不存在）
if [ ! -d "$APP_DIR" ]; then
    echo "Cloning repository..."
    git clone $REPO_URL
fi

cd $APP_DIR

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo ""
    echo "======================================"
    echo "WARNING: .env file not found!"
    echo "======================================"
    echo "Please create /home/xin/apps/seeder/.env with the following variables:"
    echo ""
    echo "DATABASE_URL=postgresql://user:password@localhost:5432/seeder"
    echo "JWT_SECRET=your-jwt-secret-here"
    echo "SLACK_BOT_TOKEN=xoxb-your-slack-bot-token"
    echo "SLACK_SIGNING_SECRET=your-slack-signing-secret"
    echo "ANTHROPIC_API_KEY=your-anthropic-api-key"
    echo ""
    echo "After creating .env, run this script again."
    exit 1
fi

# 安装依赖
echo "Installing dependencies..."
npm ci

# 生成 Prisma Client
echo "Generating Prisma client..."
npx prisma generate

# 运行数据库迁移
echo "Running database migrations..."
npx prisma migrate deploy

# 构建项目
echo "Building project..."
npm run build

# 创建日志目录
mkdir -p $APP_DIR/logs

# 启动或重启应用
echo "Starting application with pm2..."
pm2 describe seeder > /dev/null 2>&1 && pm2 restart seeder || pm2 start ecosystem.config.js

# 保存 pm2 配置
pm2 save

# 设置开机自启
pm2 startup | tail -1 | bash || true

echo ""
echo "======================================"
echo "Setup completed!"
echo "======================================"
echo ""
echo "Application is running on port 38964"
echo "Configure nginx to proxy /seeder to http://localhost:38964/seeder"
echo ""
