# Seeder 部署指南

## 生产环境

- **URL**: https://copilot.wildmeta.ai/seeder
- **服务器**: ubuntu@15.235.212.36
- **应用目录**: /home/ubuntu/apps/seeder
- **端口**: 38966
- **PM2 进程名**: seeder

## 部署前检查

```bash
# 1. 检查本地是否有未 push 的 commit
git log --oneline origin/main..main

# 2. 检查当前分支
git branch -vv

# 3. 本地构建测试
npm run build
```

**注意**: 如果有未 push 的 commit，必须先 `git push origin main`

## 部署方法

### 方式一：一行命令（推荐）

```bash
ssh ubuntu@15.235.212.36 "cd /home/ubuntu/apps/seeder && \
  git fetch origin && \
  LOCAL=\$(git rev-parse HEAD) && \
  REMOTE=\$(git rev-parse origin/main) && \
  if [ \"\$LOCAL\" != \"\$REMOTE\" ]; then git pull; fi && \
  npm ci --legacy-peer-deps && \
  npx prisma generate && \
  npx prisma migrate deploy && \
  npm run build && \
  pm2 restart seeder"
```

### 方式二：手动部署

```bash
ssh ubuntu@15.235.212.36 "cd /home/ubuntu/apps/seeder && git pull"
ssh ubuntu@15.235.212.36 "cd /home/ubuntu/apps/seeder && npm ci --legacy-peer-deps"
ssh ubuntu@15.235.212.36 "cd /home/ubuntu/apps/seeder && npx prisma generate"
ssh ubuntu@15.235.212.36 "cd /home/ubuntu/apps/seeder && npx prisma migrate deploy"
ssh ubuntu@15.235.212.36 "cd /home/ubuntu/apps/seeder && npm run build"
ssh ubuntu@15.235.212.36 "cd /home/ubuntu/apps/seeder && pm2 restart seeder"
```

## 常用运维命令

```bash
# 查看日志
ssh ubuntu@15.235.212.36 "pm2 logs seeder --nostream --lines 50"

# 重启服务
ssh ubuntu@15.235.212.36 "pm2 restart seeder"

# 查看状态
ssh ubuntu@15.235.212.36 "pm2 status seeder"
```

## 数据库

- **类型**: PostgreSQL (Docker)
- **连接**: postgresql://hbot:hummingbot-api@localhost:5432/seeder

```bash
# 进入数据库
ssh ubuntu@15.235.212.36 "docker exec -it hummingbot-postgres psql -U hbot -d seeder"
```
