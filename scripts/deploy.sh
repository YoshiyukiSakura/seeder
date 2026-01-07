#!/bin/bash
# 部署脚本 - 在服务器上运行
set -e

APP_DIR="/home/ubuntu/apps/seeder"

cd $APP_DIR

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm ci

echo "Generating Prisma client..."
npx prisma generate

echo "Running database migrations..."
npx prisma migrate deploy

echo "Building project..."
npm run build

echo "Restarting application..."
pm2 describe seeder > /dev/null 2>&1 && pm2 restart seeder || pm2 start ecosystem.config.js
pm2 save

echo "Done! App running at https://copilot.wildmeta.ai/seeder"
